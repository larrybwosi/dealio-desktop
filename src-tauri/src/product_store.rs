use std::collections::HashMap;
use std::fs; // Keep std::fs for synchronous startup logic
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use crate::models::{PosProduct, ProductsSyncResponse};
use anyhow::{Result, Context};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use tokio::fs as async_fs; // Import Tokio FS for async operations

const STORE_FILENAME: &str = "pos_products.json";
const TIMEOUT_SECONDS: u64 = 15;

// --- State Management ---
pub struct ProductState {
    pub products: Mutex<Vec<PosProduct>>,
    pub last_sync: Mutex<Option<String>>,
}

impl ProductState {
    pub fn new() -> Self {
        Self {
            products: Mutex::new(Vec::new()),
            last_sync: Mutex::new(None),
        }
    }
}

// --- Helper: File Path ---
fn get_store_path(app: &AppHandle) -> Result<PathBuf> {
    let app_dir = app.path().app_data_dir().context("Failed to resolve App Data Directory")?;
    
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).context("Failed to create App Data Directory")?;
    }
    
    Ok(app_dir.join(STORE_FILENAME))
}

// --- 1. Load Data on Startup (Synchronous is fine here) ---
pub fn load_products_from_disk(app: &AppHandle, state: &ProductState) -> Result<()> {
    let path = get_store_path(app)?;
    
    if path.exists() {
        // std::fs is fine here because this runs once during app boot
        let content = fs::read_to_string(path).context("Failed to read store file")?;
        let data: Result<(Option<String>, Vec<PosProduct>), _> = serde_json::from_str(&content);

        if let Ok((last_sync, products)) = data {
            *state.last_sync.lock().unwrap() = last_sync;
            *state.products.lock().unwrap() = products;
        }
    }
    Ok(())
}

// --- 2. Sync Engine (Fixed) ---
pub async fn run_sync(
    app: AppHandle,
    state: &ProductState,
    base_url: String,
    location_id: String,
    device_key: Option<String>,
    member_token: Option<String>
) -> Result<usize> {
    
    if base_url.is_empty() {
        return Err(anyhow::anyhow!("Base URL is empty"));
    }

    let clean_base_url = base_url.trim_end_matches('/');
    let target_url = format!("{}/api/v1/pos/products", clean_base_url);
    
    // Quick lock just to read the timestamp
    let last_sync_time = state.last_sync.lock().unwrap().clone();
    
    // --- BUILD HEADERS ---
    let mut headers = HeaderMap::new();
    
    if let Some(key) = device_key {
        let mut val = HeaderValue::from_str(&key).map_err(|_| anyhow::anyhow!("Invalid Device Key"))?;
        val.set_sensitive(true);
        headers.insert("X-Device-Api-Key", val);
    }

    if let Some(token) = member_token {
        let auth_val = format!("Bearer {}", token);
        let mut val = HeaderValue::from_str(&auth_val).map_err(|_| anyhow::anyhow!("Invalid Token"))?;
        val.set_sensitive(true);
        headers.insert(AUTHORIZATION, val);
    }

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(TIMEOUT_SECONDS))
        .build()?;

    // --- PREPARE PARAMS ---
    let mut query_params = vec![
        ("locationId", location_id.clone()),
        ("page", "1".to_string()),
        ("limit", "2000".to_string()), 
        ("categoryId", "all".to_string()),
    ];

    if let Some(ts) = &last_sync_time {
        query_params.push(("lastSync", ts.clone()));
    }

    // --- EXECUTE REQUEST ---
    let response = client.get(&target_url)
        .query(&query_params)
        .send()
        .await
        .context("Failed to send request to server")?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!("Server returned error: {} - {}", status, error_text));
    }

    let res_body = response.json::<ProductsSyncResponse>().await
        .context("Failed to parse server response JSON")?;

    // --- MERGE LOGIC ---
    // Capture the count BEFORE moving 'res_body.products'
    let incoming_count = res_body.products.len();
    let sync_timestamp = res_body.sync_timestamp.clone();

    // We block momentarily to update memory (fast)
    let updated_list = {
        let mut products_guard = state.products.lock().unwrap();
        
        let mut product_map: HashMap<String, PosProduct> = products_guard
            .drain(..)
            .map(|p| (p.product_id.clone(), p))
            .collect();

        // Consume res_body.products here
        for product in res_body.products {
            product_map.insert(product.product_id.clone(), product);
        }

        let list: Vec<PosProduct> = product_map.into_values().collect();
        *products_guard = list.clone(); // Update memory state
        list
    };

    // --- ASYNC SAVE TO DISK ---
    let new_sync_time = sync_timestamp.unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
    *state.last_sync.lock().unwrap() = Some(new_sync_time.clone());

    let file_data = (Some(new_sync_time), updated_list);
    
    // CPU INTENSIVE: Serialization (Run in blocking thread)
    let json = tokio::task::spawn_blocking(move || {
        serde_json::to_string(&file_data)
    }).await??;
    
    // I/O INTENSIVE: File Write (Async)
    let path = get_store_path(&app)?;
    async_fs::write(path, json).await.context("Failed to write to disk")?;

    Ok(incoming_count)
}

// --- 3. Search Logic (Kept the same) ---
pub fn search_local(state: &ProductState, query: String, category: String) -> Vec<PosProduct> {
    let products = state.products.lock().unwrap();
    let query = query.trim().to_lowercase();
    let filter_category = category != "all" && !category.is_empty();

    if query.is_empty() && !filter_category {
        return products.iter().take(50).cloned().collect();
    }

    products.iter().filter(|p| {
        let matches_category = !filter_category || p.category == category;
        if !matches_category { return false; }
        if query.is_empty() { return true; }

        let matches_product_name = p.product_name.to_lowercase().contains(&query);
        let matches_variant = p.variants.iter().any(|v| {
            v.sku.to_lowercase().contains(&query) || 
            v.variant_name.to_lowercase().contains(&query) ||
            v.barcode.as_ref().map_or(false, |b| b.to_lowercase().contains(&query))
        });

        matches_product_name || matches_variant
    })
    .take(100) 
    .cloned()
    .collect()
}

pub fn get_products_by_ids(state: &ProductState, ids: Vec<String>) -> Vec<PosProduct> {
    let products = state.products.lock().unwrap();
    if ids.is_empty() {
        return Vec::new();
    }
    
    // Create a HashSet for O(1) lookups if the list is large, 
    // but for small lists, simple iteration is fine. 
    // Given the use case (page load), ids could be 50+, so let's stick to simple filter.
    products.iter()
        .filter(|p| {
            // Check if Product ID matches
            if ids.contains(&p.product_id) { return true; }

            // Check if ANY variant ID matches
            p.variants.iter().any(|v| ids.contains(&v.variant_id))
        })
        .cloned()
        .collect()
}