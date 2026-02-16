use std::collections::HashMap;
use std::fs; // Keep std::fs for synchronous startup logic
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use crate::models::{PosProduct, ProductsSyncResponse};
use anyhow::{Result, Context};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use tokio::fs as async_fs; 

const TIMEOUT_SECONDS: u64 = 60; 

// --- State Management ---
pub struct ProductState {
    // Multi-location cache: HashMap keyed by location_id
    pub products_by_location: Mutex<HashMap<String, Vec<PosProduct>>>,
    pub last_sync_by_location: Mutex<HashMap<String, Option<String>>>,
}

impl ProductState {
    pub fn new() -> Self {
        Self {
            products_by_location: Mutex::new(HashMap::new()),
            last_sync_by_location: Mutex::new(HashMap::new()),
        }
    }
}

// --- Helper: File Paths ---
async fn get_store_path(app: &AppHandle, location_id: &str) -> Result<PathBuf> {
    let app_dir = app.path().app_data_dir().context("Failed to resolve App Data Directory")?;
    
    if !app_dir.exists() {
        tokio::fs::create_dir_all(&app_dir).await.context("Failed to create App Data Directory")?;
    }
    
    // Location-specific filename
    Ok(app_dir.join(format!("products_loc_{}.json", location_id)))
}

async fn get_images_dir(app: &AppHandle) -> Result<PathBuf> {
    let app_dir = app.path().app_data_dir().context("Failed to resolve App Data Directory")?;
    let images_dir = app_dir.join("product_images");

    if !images_dir.exists() {
        tokio::fs::create_dir_all(&images_dir).await.context("Failed to create Images Directory")?;
    }
    
    Ok(images_dir)
}

// --- Helper: Cache Single Image ---
async fn cache_image(app: &AppHandle, url: &str) -> Option<String> {
    if url.trim().is_empty() {
        return None;
    }

    // 1. Generate a safe filename from the URL
    let clean_name = url.replace("https://", "")
                        .replace("http://", "")
                        .replace('/', "_")
                        .replace(':', "")
                        .replace('?', "_");
    
    // Ensure extension exists or default to .jpg if missing
    let filename = if clean_name.contains('.') {
        clean_name
    } else {
        format!("{}.jpg", clean_name)
    };

    let images_dir = match get_images_dir(app).await {
        Ok(d) => d,
        Err(e) => {
            eprintln!("Failed to get image dir: {}", e);
            return Some(url.to_string()); // Fallback to remote URL
        }
    };

    let file_path = images_dir.join(&filename);
    let file_path_str = file_path.to_string_lossy().to_string();

    // 2. Check if file already exists locally AND has content
    if file_path.exists() {
        // Integrity check: If file is 0 bytes, it's corrupt/empty.
        if let Ok(metadata) = tokio::fs::metadata(&file_path).await {
             if metadata.len() > 0 {
                  return Some(file_path_str);
             }
        }
        // If we reach here, file exists but is invalid (0 bytes). Remove it.
        let _ = async_fs::remove_file(&file_path).await;
    }

    // 3. Download if not exists (or was just deleted)
    match reqwest::get(url).await {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.bytes().await {
                    Ok(bytes) => {
                        // Write to file
                        if let Err(e) = async_fs::write(&file_path, &bytes).await {
                            eprintln!("Failed to write image {}: {}", filename, e);
                            return Some(url.to_string());
                        }

                        // Verify write success (double check)
                        if let Ok(metadata) = tokio::fs::metadata(&file_path).await {
                            if metadata.len() > 0 {
                                return Some(file_path_str);
                            }
                        }
                        return Some(url.to_string());
                    }
                    Err(_) => return Some(url.to_string()),
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to download image {}: {}", url, e);
        }
    }

    // Fallback: return original URL if download failed
    Some(url.to_string())
}

// --- 1. Load Data on Startup (Synchronous is fine here) ---
pub async fn load_products_from_disk(app: &AppHandle, state: &ProductState, location_id: &str) -> Result<()> {
    let path = get_store_path(app, location_id).await?;
    
    if path.exists() {
        let content = tokio::fs::read_to_string(path).await.context("Failed to read store file")?;
        let data: Result<(Option<String>, Vec<PosProduct>), _> = serde_json::from_str(&content);

        if let Ok((last_sync, products)) = data {
            let mut products_map = state.products_by_location.lock().unwrap_or_else(|e| e.into_inner());
            let mut sync_map = state.last_sync_by_location.lock().unwrap_or_else(|e| e.into_inner());
            
            products_map.insert(location_id.to_string(), products);
            sync_map.insert(location_id.to_string(), last_sync);
        }
    }
    Ok(())
}

// --- 2. Sync Engine (Modified) ---
use crate::auth_store::AuthState;

pub async fn run_sync(
    app: AppHandle,
    state: &ProductState,
    auth_state: &AuthState,
    force_full_sync: bool // NEW: if true, ignore lastSync and get all products
) -> Result<usize> {
    
    // 1. Get Config/Auth from State
    let (base_url, location_id, device_key) = {
        let config_guard = auth_state.device_config.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        let config = config_guard.as_ref().ok_or_else(|| anyhow::anyhow!("Device not configured"))?;
        (config.base_url.clone(), config.location_id.clone(), config.device_key.clone())
    };

    // FIX: Extract Member ID along with Token
    let (member_token, member_id) = {
        let token_guard = auth_state.member_token.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        let user_guard = auth_state.current_user.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        let mid = user_guard.as_ref().map(|u| u.id.clone());
        (token_guard.clone(), mid)
    };
    
    if base_url.is_empty() {
        return Err(anyhow::anyhow!("Base URL is empty"));
    }

    let clean_base_url = base_url.trim_end_matches('/');
    let target_url = format!("{}/api/v1/pos/products", clean_base_url);
    
    // Get last sync time for THIS location (not global)
    let last_sync_time = if force_full_sync {
        None
    } else {
        state.last_sync_by_location.lock().unwrap_or_else(|e| e.into_inner())
            .get(&location_id)
            .and_then(|opt| opt.clone())
    };
    
    // --- BUILD HEADERS ---
    let mut headers = HeaderMap::new();
    
    // Device Key is now always present if we got past the config check
    let mut val = HeaderValue::from_str(&device_key).map_err(|_| anyhow::anyhow!("Invalid Device Key"))?;
    val.set_sensitive(true);
    headers.insert("X-Device-Api-Key", val);

    if let Some(token) = member_token {
        let auth_val = format!("Bearer {}", token);
        let mut val = HeaderValue::from_str(&auth_val).map_err(|_| anyhow::anyhow!("Invalid Token"))?;
        val.set_sensitive(true);
        headers.insert(AUTHORIZATION, val);
    }

    // FIX: Add Member ID Header
    if let Some(mid) = member_id {
        let val = HeaderValue::from_str(&mid).map_err(|_| anyhow::anyhow!("Invalid Member ID"))?;
        headers.insert("X-Member-Id", val);
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

    let mut res_body = response.json::<ProductsSyncResponse>().await
        .context("Failed to parse server response JSON")?;

    // --- IMAGE CACHING LOGIC ---
    // Updated: Ensure we only attempt to cache if the URL is valid/remote.
    for product in &mut res_body.products {
        if let Some(url) = &product.image_url {
             // Basic check to ensure we aren't re-caching a local path (if server sent weird data)
             if !url.starts_with('/') && !url.starts_with("C:") && url.starts_with("http") {
                let local_path = cache_image(&app, url).await;
                product.image_url = local_path;
             }
        }
    }

    // --- MERGE LOGIC ---
    let incoming_count = res_body.products.len();
    let sync_timestamp = res_body.sync_timestamp.clone();

    // --- MERGE LOGIC FOR THIS LOCATION ---
    let updated_list = {
        let mut products_map_guard = state.products_by_location.lock().unwrap_or_else(|e| e.into_inner());
        
        // Get existing products for this location, or empty vec
        let existing_products = products_map_guard
            .get(&location_id)
            .cloned()
            .unwrap_or_default();
        
        let mut product_map: HashMap<String, PosProduct> = existing_products
            .into_iter()
            .map(|p| (p.product_id.clone(), p))
            .collect();

        for product in res_body.products {
            product_map.insert(product.product_id.clone(), product);
        }

        let list: Vec<PosProduct> = product_map.into_values().collect();
        
        // Update location-specific cache
        products_map_guard.insert(location_id.clone(), list.clone());
        list
    };

    // --- ASYNC SAVE TO DISK (LOCATION-SPECIFIC FILE) ---
    let new_sync_time = sync_timestamp.unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
    
    // Update sync timestamp for this location
    state.last_sync_by_location.lock().unwrap_or_else(|e| e.into_inner())
        .insert(location_id.clone(), Some(new_sync_time.clone()));

    let file_data = (Some(new_sync_time), updated_list);
    
    let json = tokio::task::spawn_blocking(move || {
        serde_json::to_string(&file_data)
    }).await??;
    
    let path = get_store_path(&app, &location_id).await?;
    async_fs::write(path, json).await.context("Failed to write to disk")?;

    Ok(incoming_count)
}

// --- 3. Search Logic ---
// Helper to get products for current location from auth state
pub fn search_local(state: &ProductState, location_id: &str, query: String, category: String) -> Vec<PosProduct> {
    let products_map = state.products_by_location.lock().unwrap_or_else(|e| e.into_inner());
    let products = products_map.get(location_id).cloned().unwrap_or_default();
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

pub fn get_products_by_ids(state: &ProductState, location_id: &str, ids: Vec<String>) -> Vec<PosProduct> {
    let products_map = state.products_by_location.lock().unwrap_or_else(|e| e.into_inner());
    let products = products_map.get(location_id).cloned().unwrap_or_default();
    if ids.is_empty() {
        return Vec::new();
    }
    
    products.iter()
        .filter(|p| {
            if ids.contains(&p.product_id) { return true; }
            p.variants.iter().any(|v| ids.contains(&v.variant_id))
        })
        .cloned()
        .collect()
}

// --- 4. Location Switch Command ---
#[tauri::command]
pub async fn switch_location(
    app: AppHandle,
    state: tauri::State<'_, ProductState>,
    _auth_state: tauri::State<'_, AuthState>,
    new_location_id: String,
) -> Result<Vec<PosProduct>, String> {
    // 1. Load cached products for this location (instant response)
    load_products_from_disk(&app, &state, &new_location_id).await
        .map_err(|e| e.to_string())?;
    
    // 2. Return cached products immediately (even if empty)
    let cached = {
        let products_map = state.products_by_location.lock().unwrap_or_else(|e| e.into_inner());
        products_map.get(&new_location_id).cloned().unwrap_or_default()
    };
    
    // 3. Trigger background sync (delta if we have lastSync, full if first visit)
    let app_clone = app.clone();
    
    tauri::async_runtime::spawn(async move {
        // Retrieve states inside the task to avoid lifetime issues
        let state_inner = app_clone.state::<ProductState>();
        let auth_inner = app_clone.state::<AuthState>();
        let _ = run_sync(app_clone.clone(), &state_inner, &auth_inner, false).await;
    });
    
    Ok(cached)
}
