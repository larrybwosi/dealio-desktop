use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use crate::models::{PosProduct, ProductsSyncResponse};
use anyhow::Result;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};

const STORE_FILENAME: &str = "pos_products.json";
const TIMEOUT_SECONDS: u64 = 10;

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
fn get_store_path(app: &AppHandle) -> PathBuf {
    let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
    if !app_dir.exists() {
        let _ = fs::create_dir_all(&app_dir);
    }
    app_dir.join(STORE_FILENAME)
}

// --- 1. Load Data on Startup ---
pub fn load_products_from_disk(app: &AppHandle, state: &ProductState) -> Result<()> {
    let path = get_store_path(app);
    if path.exists() {
        let content = fs::read_to_string(path)?;
        // We expect JSON: [last_sync_string, [product_list]]
        let data: (Option<String>, Vec<PosProduct>) = serde_json::from_str(&content)?;
        
        *state.last_sync.lock().unwrap() = data.0;
        *state.products.lock().unwrap() = data.1;
        println!("Loaded {} products from disk.", state.products.lock().unwrap().len());
    }
    Ok(())
}

// --- 2. Sync Engine (Replicating Axios Logic) ---
pub async fn run_sync(
    app: AppHandle,
    state: &ProductState,
    base_url: String,
    location_id: String,
    device_key: Option<String>, // Passed from Frontend
    member_token: Option<String> // Passed from Frontend
) -> Result<usize> {
    
    let last_sync_time = state.last_sync.lock().unwrap().clone();
    
    // --- BUILD HEADERS (Matches Axios Interceptor) ---
    let mut headers = HeaderMap::new();
    
    // 1. X-Device-Api-Key
    if let Some(key) = device_key {
        let mut val = HeaderValue::from_str(&key).map_err(|_| anyhow::anyhow!("Invalid Device Key"))?;
        val.set_sensitive(true);
        headers.insert("X-Device-Api-Key", val);
    }

    // 2. Authorization: Bearer <token>
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
        ("locationId", location_id),
        ("page", "1".to_string()),
        ("limit", "1000".to_string()), // Adjust limit as needed
        ("categoryId", "all".to_string()),
    ];

    if let Some(ts) = &last_sync_time {
        println!("Fetching Delta since: {}", ts);
        query_params.push(("lastSync", ts.clone()));
    } else {
        println!("Fetching FULL Product list...");
    }

    // --- FETCH ---
    let res = client.get(format!("{}/api/v1/pos/products", base_url))
        .query(&query_params)
        .send()
        .await?
        .error_for_status()? // Throws error if 401/500
        .json::<ProductsSyncResponse>()
        .await?;

    // --- MERGE LOGIC ---
    let mut products_guard = state.products.lock().unwrap();
    
    // Convert Vec to Map for O(1) merging
    let mut product_map: HashMap<String, PosProduct> = products_guard
        .drain(..)
        .map(|p| (p.product_id.clone(), p))
        .collect();

    // Upsert new/updated products
    for product in res.products {
        product_map.insert(product.product_id.clone(), product);
    }

    let updated_list: Vec<PosProduct> = product_map.into_values().collect();
    *products_guard = updated_list.clone();

    // --- SAVE TO DISK ---
    let new_sync_time = res.sync_timestamp.unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
    *state.last_sync.lock().unwrap() = Some(new_sync_time.clone());

    let file_data = (Some(new_sync_time), updated_list);
    let json = serde_json::to_string(&file_data)?;
    fs::write(get_store_path(&app), json)?;

    Ok(products_guard.len())
}

// --- 3. Search Logic ---
pub fn search_local(state: &ProductState, query: String, category: String) -> Vec<PosProduct> {
    let products = state.products.lock().unwrap();
    let query = query.to_lowercase();
    let filter_category = category != "all";

    products.iter().filter(|p| {
        let matches_category = !filter_category || p.category == category;
        
        let matches_search = query.is_empty() || 
            p.product_name.to_lowercase().contains(&query) ||
            p.sku.to_lowercase().contains(&query) ||
            p.barcode.as_ref().map_or(false, |b| b.to_lowercase().contains(&query)) ||
            p.variants.iter().any(|v| v.barcode.to_lowercase().contains(&query));
        
        matches_category && matches_search
    }).cloned().collect()
}