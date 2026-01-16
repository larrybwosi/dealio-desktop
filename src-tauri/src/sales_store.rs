use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use crate::models::{QueuedSale, SaleStatus, SaleResponse};
use anyhow::{Result, Context};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce 
};
use sha2::{Sha256, Digest};
use rand::RngCore;

const SALES_FILENAME: &str = "secure_sales_queue.bin";
const LEGACY_APP_SECRET: &str = "dealio-pos-secure-storage-salt"; 

// Refactored to Arc<Mutex> to allow sharing with background threads
pub struct SalesState {
    pub queue: Arc<Mutex<Vec<QueuedSale>>>,
}

impl SalesState {
    pub fn new() -> Self {
        Self {
            queue: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

// Legacy key derivation for backward compatibility
fn get_legacy_key() -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(LEGACY_APP_SECRET);
    hasher.finalize().into()
}

fn save_queue_encrypted(app: &AppHandle, queue: &Vec<QueuedSale>) -> Result<()> {
    let json_data = serde_json::to_string(queue)?;
    
    // Use secure key from keyring
    let key = crate::security::get_or_create_key("sales_queue_key")
        .map_err(|e| anyhow::anyhow!("Keyring error: {}", e))?;
        
    let cipher = Aes256Gcm::new(&key.into());
    
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from(nonce_bytes);

    let ciphertext = cipher.encrypt(&nonce, json_data.as_bytes())
        .map_err(|_| anyhow::anyhow!("Encryption failed"))?;

    let mut final_payload = nonce_bytes.to_vec();
    final_payload.extend_from_slice(&ciphertext);

    let path = get_store_path(app)?;
    fs::write(path, final_payload).context("Failed to write sales queue")?;
    Ok(())
}

fn load_queue_encrypted(app: &AppHandle) -> Result<Vec<QueuedSale>> {
    let path = get_store_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let file_bytes = fs::read(&path)?;
    if file_bytes.len() < 12 { return Ok(Vec::new()); }

    let (nonce_slice, ciphertext) = file_bytes.split_at(12);
    
    let mut nonce_arr = [0u8; 12];
    nonce_arr.copy_from_slice(nonce_slice);
    let nonce = Nonce::from(nonce_arr);

    // 1. Try with authorized key from Keyring
    let secure_key_res = crate::security::get_or_create_key("sales_queue_key");
    
    if let Ok(key) = secure_key_res {
        let cipher = Aes256Gcm::new(&key.into());
        if let Ok(plaintext) = cipher.decrypt(&nonce, ciphertext) {
            let queue: Vec<QueuedSale> = serde_json::from_slice(&plaintext)?;
            return Ok(queue);
        }
    }

    // 2. Migration: Try with Legacy Key
    println!("[SalesStore] Decryption with secure key failed. Attempting migration with legacy key...");
    let legacy_key = get_legacy_key();
    let legacy_cipher = Aes256Gcm::new(&legacy_key.into());

    match legacy_cipher.decrypt(&nonce, ciphertext) {
        Ok(plaintext) => {
             let queue: Vec<QueuedSale> = serde_json::from_slice(&plaintext)?;
             println!("[SalesStore] Legacy decryption successful. Migrating data to secure key...");
             
             // Re-encrypt immediately with new safe key
             if let Err(e) = save_queue_encrypted(app, &queue) {
                 eprintln!("[SalesStore] Failed to migrate updated data: {}", e);
             } else {
                 println!("[SalesStore] Data successfully migrated to secure storage.");
             }
             
             Ok(queue)
        },
        Err(_) => {
            Err(anyhow::anyhow!("Decryption failed with both keys"))
        }
    }
}

fn get_store_path(app: &AppHandle) -> Result<PathBuf> {
    let app_dir = app.path().app_data_dir().context("No App Data Dir")?;
    if !app_dir.exists() { fs::create_dir_all(&app_dir)?; }
    Ok(app_dir.join(SALES_FILENAME))
}

// --- Public Methods ---

pub fn init_state(app: &AppHandle, state: &SalesState) {
    match load_queue_encrypted(app) {
        Ok(q) => {
            *state.queue.lock().unwrap() = q;
            println!("[SalesStore] Loaded pending sales queue.");
        }
        Err(e) => eprintln!("[SalesStore] Failed to load queue: {}", e),
    }
}

// 1. Process Sale (Non-blocking Background Sync)
use crate::auth_store::AuthState;

// In sales_store.rs

// 1. Process Sale (Non-blocking Background Sync)
pub async fn process_sale(
    app: AppHandle,
    state: &SalesState,
    sale_id: String,
    payload: serde_json::Value,
    auth_state: &AuthState
) -> Result<SaleResponse> {
    
    // 1. Get Config/Auth from State
    let (base_url, location_id, device_key) = {
        let config_guard = auth_state.device_config.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        let config = config_guard.as_ref().ok_or_else(|| anyhow::anyhow!("Device not configured"))?;
        (config.base_url.clone(), config.location_id.clone(), config.device_key.clone())
    };

    // FIX: Extract Member ID along with Token
    let (token, member_id) = {
        let token_guard = auth_state.member_token.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        let user_guard = auth_state.current_user.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        (token_guard.clone(), user_guard.as_ref().map(|u| u.id.clone()))
    };
    
    // A. Add to Local Queue (Encrypted) immediately
    let new_sale = QueuedSale {
        id: sale_id.clone(),
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_millis() as u64,
        location_id: location_id.clone(),
        transaction_data: payload.clone(),
        status: SaleStatus::Pending,
        retry_count: 0,
        last_error: None,
    };

    // Block briefly to save to disk (Offline First guarantee)
    {
        let mut q = state.queue.lock().unwrap();
        q.push(new_sale.clone());
        if let Err(e) = save_queue_encrypted(&app, &q) {
            eprintln!("CRITICAL: Failed to persist sales queue: {}", e);
            return Err(anyhow::anyhow!("Failed to persist sale locally: {}", e));
        }
    }

    // B. Spawn Background Sync Task
    // We clone the necessary ARCs and data to move them into the async thread
    let queue_ref = state.queue.clone();
    let app_handle = app.clone();
    let sale_id_clone = sale_id.clone();
    let payload_clone = payload.clone();
    let base_url_clone = base_url.clone();
    let location_id_clone = location_id.clone();
    let device_key_clone = device_key.clone();
    let token_clone = token.clone();
    
    // FIX: Clone member_id for background thread
    let member_id_clone = member_id.clone();

    tauri::async_runtime::spawn(async move {
        println!("[Background] Starting sync for sale: {}", sale_id_clone);
        
        // Attempt upload (this will await M-Pesa response if the API is designed to wait)
        let sync_result = push_single_sale(
            &base_url_clone, 
            &location_id_clone, 
            &payload_clone, 
            Some(device_key_clone),
            token_clone,
            member_id_clone // <--- Added member_id
        ).await;

        let mut q = queue_ref.lock().unwrap();
        
        match sync_result {
            Ok(_) => {
                println!("[Background] Sale {} synced successfully.", sale_id_clone);
                // Remove from queue on success
                if let Some(pos) = q.iter().position(|x| x.id == sale_id_clone) {
                    q.remove(pos);
                    let _ = save_queue_encrypted(&app_handle, &q); 
                }
            },
            Err(e) => {
                eprintln!("[Background] Sync failed for {}: {}. Leaving in queue.", sale_id_clone, e);
                // Update error state in queue
                if let Some(item) = q.iter_mut().find(|x| x.id == sale_id_clone) {
                    item.last_error = Some(e.to_string());
                    item.retry_count += 1;
                }
                let _ = save_queue_encrypted(&app_handle, &q);
            }
        }
    });

    // C. Return immediate success to UI
    Ok(SaleResponse {
        success: true,
        message: "Sale saved locally and processing in background.".into(),
        server_response: None // UI shouldn't rely on this for immediate feedback anymore
    })
}

// 2. Background Sync (Retry mechanism)
pub async fn sync_pending_sales(
    app: AppHandle,
    state: &SalesState,
    auth_state: &AuthState
) -> Result<usize> {
    // 1. Get Config/Auth from State
    let (base_url, device_key) = {
        let config_guard = auth_state.device_config.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        match config_guard.as_ref() {
            Some(c) => (c.base_url.clone(), Some(c.device_key.clone())),
            None => (String::new(), None) // Handle unconfigured state gracefully?
        }
    };

    // FIX: Extract Member ID along with Token
    let (token, member_id) = {
        let token_guard = auth_state.member_token.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        let user_guard = auth_state.current_user.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        
        (token_guard.clone(), user_guard.as_ref().map(|u| u.id.clone()))
    };

    if base_url.is_empty() || device_key.is_none() {
        return Ok(0); // Cannot sync if not configured
    }
    let pending_items: Vec<QueuedSale> = {
        let q = state.queue.lock().unwrap();
        q.iter()
            .filter(|s| s.status != SaleStatus::Failed)
            .cloned()
            .collect()
    };

    if pending_items.is_empty() { return Ok(0); }

    let mut success_count = 0;
    let mut ids_to_remove = Vec::new();

    // We can run these concurrently or sequentially. Sequentially is safer for order.
    for sale in pending_items {
        // FIX: Pass member_id to push_single_sale
        match push_single_sale(
            &base_url, 
            &sale.location_id, 
            &sale.transaction_data, 
            device_key.clone(), 
            token.clone(),
            member_id.clone() // <--- Added member_id
        ).await {
            Ok(_) => {
                ids_to_remove.push(sale.id);
                success_count += 1;
            },
            Err(e) => {
                eprintln!("Failed to sync sale {}: {}", sale.id, e);
            }
        }
    }

    if success_count > 0 {
        let mut q = state.queue.lock().unwrap();
        q.retain(|s| !ids_to_remove.contains(&s.id));
        let _ = save_queue_encrypted(&app, &q);
    }

    Ok(success_count)
}

// --- Helper: Network Request ---
async fn push_single_sale(
    base_url: &str, 
    location_id: &str, 
    payload: &serde_json::Value, 
    device_key: Option<String>,
    token: Option<String>,
    member_id: Option<String> // <--- FIX: Added member_id parameter
) -> Result<serde_json::Value> {
    
    let clean_base = base_url.trim_end_matches('/');
    // Check if this is an M-Pesa sale to adjust timeout potentially? 
    // Usually reqwest defaults are fine, but for STK we might want a longer timeout.
    let url = format!("{}/api/v1/pos/sale/process?locationId={}&enableStockTracking=true", clean_base, location_id);

    // --- BUILD HEADERS ---
    let mut headers = HeaderMap::new();
    
    if let Some(key) = device_key {
        let mut val = HeaderValue::from_str(&key).map_err(|_| anyhow::anyhow!("Invalid Device Key"))?;
        val.set_sensitive(true);
        headers.insert("X-Device-Api-Key", val);
    }

    if let Some(t) = token {
        let auth_val = format!("Bearer {}", t);
        let mut val = HeaderValue::from_str(&auth_val).map_err(|_| anyhow::anyhow!("Invalid Token"))?;
        val.set_sensitive(true);
        headers.insert(AUTHORIZATION, val);
    }

    // FIX: Add Member ID Header
    if let Some(mid) = member_id {
        let val = HeaderValue::from_str(&mid).map_err(|_| anyhow::anyhow!("Invalid Member ID"))?;
        headers.insert("X-Member-Id", val);
    }

    // Build client with extended timeout for M-Pesa scenarios
    let client = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(60)) // 60s timeout for M-Pesa waits
        .build()?;

    let resp = client.post(&url)
        .json(payload)
        .send()
        .await?;
    
    if !resp.status().is_success() {
        return Err(anyhow::anyhow!("Server error: {}", resp.status()));
    }

    let body: serde_json::Value = resp.json().await?;
    Ok(body)
}


pub fn get_queue_status(state: &SalesState) -> Vec<QueuedSale> {
    state.queue.lock().unwrap().clone()
}