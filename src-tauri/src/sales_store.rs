use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use crate::models::{QueuedSale, SaleStatus, SaleResponse};
use crate::auth_store::AuthState;
use crate::shift_store::ShiftState;
use anyhow::{Result, Context};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::StatusCode;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce 
};
use sha2::{Sha256, Digest};
use rand::RngCore;
use log::{info, error, warn}; // Enterprise logging
use thiserror::Error; // For custom error types

const SALES_FILENAME: &str = "secure_sales_queue.bin";
const LEGACY_APP_SECRET: &str = "dealio-pos-secure-storage-salt"; 

// --- Enterprise Error Handling ---
#[derive(Error, Debug)]
pub enum SalesError {
    #[error("Network request failed: {0}")]
    NetworkError(String),
    #[error("Server rejected request (Fatal): {0}")]
    ValidationError(String),
    #[error("Authentication failed: {0}")]
    AuthError(String),
    #[error("Encryption/Storage failed: {0}")]
    StorageError(String),
    #[error("Digital payment processing failed: {0}")]
    PaymentProcessingError(String),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

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
    hasher.update(LEGACY_APP_SECRET.as_bytes());
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
    warn!("[SalesStore] Decryption with secure key failed. Attempting migration with legacy key...");
    let legacy_key = get_legacy_key();
    let legacy_cipher = Aes256Gcm::new(&legacy_key.into());

    match legacy_cipher.decrypt(&nonce, ciphertext) {
        Ok(plaintext) => {
             let queue: Vec<QueuedSale> = serde_json::from_slice(&plaintext)?;
             info!("[SalesStore] Legacy decryption successful. Migrating data to secure key...");
             
             // Re-encrypt immediately with new safe key
             if let Err(e) = save_queue_encrypted(app, &queue) {
                 error!("[SalesStore] Failed to migrate updated data: {}", e);
             } else {
                 info!("[SalesStore] Data successfully migrated to secure storage.");
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
            info!("[SalesStore] Loaded pending sales queue.");
        }
        Err(e) => error!("[SalesStore] Failed to load queue: {}", e),
    }
}

// 1. Process Sale (Smart Routing: Instant vs Background)
pub async fn process_sale(
    app: AppHandle,
    state: &SalesState,
    shift_state: &ShiftState,
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

    let (token, member_id) = {
        let token_guard = auth_state.member_token.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        let user_guard = auth_state.current_user.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        (token_guard.clone(), user_guard.as_ref().map(|u| u.id.clone()))
    };

    // 2. Identify Payment Method for Special Handling
    let payment_method = payload.get("paymentMethod")
        .and_then(|v| v.as_str())
        .unwrap_or("UNKNOWN")
        .to_uppercase();

    // 3. Determine Handling Strategy
    // Cash/Card = Can be Offline/Queued.
    // Paybill/Till/Mpesa = Prefer Immediate Sync to show instructions/push prompt.
    let is_interactive_payment = ["MPESA", "PAYBILL", "TILL"].contains(&payment_method.as_str());

    // 4. Handle Shift Recording (Local)
    if payment_method == "CASH" {
        if let Some(total) = payload.get("total").and_then(|v| v.as_f64()) {
             if let Err(e) = crate::shift_store::record_cash_sale(shift_state, total) {
                 error!("[SalesStore] Failed to record cash sale in shift: {}", e);
             } else {
                 info!("[SalesStore] Recorded cash sale of {:.2}", total);
             }
        }
    }

    // 5. Strategy A: Immediate Sync (For Interactive Payments)
    if is_interactive_payment {
        info!("[SalesStore] Attempting immediate sync for interactive payment: {}", payment_method);
        
        match push_single_sale(&base_url, &location_id, &payload, Some(device_key.clone()), token.clone(), member_id.clone()).await {
            Ok(server_resp) => {
                // Success! Return the server response so the UI can show Paybill/Till instructions
                return Ok(SaleResponse {
                    success: true,
                    message: "Transaction initiated successfully.".into(),
                    server_response: Some(server_resp) 
                });
            }
            Err(e) => {
                error!("[SalesStore] Immediate sync failed for {}: {}", payment_method, e);
                // Decide: Do we queue or fail? 
                // For Paybill/Till, offline is useless as we need the server to verify.
                // We return an error to the UI asking them to check internet or switch to Cash.
                return Err(SalesError::PaymentProcessingError(format!(
                    "{} requires an active internet connection. Please check your network or switch to Cash.", 
                    payment_method
                )).into());
            }
        }
    }

    // 6. Strategy B: Queue First (For Cash/Standard Sales)
    // Add to Local Queue (Encrypted)
    let new_sale = QueuedSale {
        id: sale_id.clone(),
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_millis() as u64,
        location_id: location_id.clone(),
        transaction_data: payload.clone(),
        status: SaleStatus::Pending,
        retry_count: 0,
        last_error: None,
    };

    {
        let mut q = state.queue.lock().unwrap();
        q.push(new_sale.clone());
        if let Err(e) = save_queue_encrypted(&app, &q) {
            error!("CRITICAL: Failed to persist sales queue: {}", e);
            return Err(SalesError::StorageError(e.to_string()).into());
        }
    }

    // Spawn Background Sync Task (Fire and Forget)
    let queue_ref = state.queue.clone();
    let app_handle = app.clone();
    let sale_id_clone = sale_id.clone();
    let payload_clone = payload.clone();

    tauri::async_runtime::spawn(async move {
        info!("[Background] Starting sync for sale: {}", sale_id_clone);
        
        let sync_result = push_single_sale(
            &base_url, 
            &location_id, 
            &payload_clone, 
            Some(device_key),
            token,
            member_id
        ).await;

        let mut q = queue_ref.lock().unwrap();
        
        match sync_result {
            Ok(_) => {
                info!("[Background] Sale {} synced successfully.", sale_id_clone);
                if let Some(pos) = q.iter().position(|x| x.id == sale_id_clone) {
                    q.remove(pos);
                    let _ = save_queue_encrypted(&app_handle, &q); 
                }
            },
            Err(e) => {
                warn!("[Background] Sync failed for {}: {}. Leaving in queue.", sale_id_clone, e);
                if let Some(item) = q.iter_mut().find(|x| x.id == sale_id_clone) {
                    item.last_error = Some(e.to_string());
                    item.retry_count += 1;
                    // Logic to mark as FAILED if retries > 10 could go here
                }
                let _ = save_queue_encrypted(&app_handle, &q);
            }
        }
    });

    Ok(SaleResponse {
        success: true,
        message: "Sale saved locally. Syncing in background.".into(),
        server_response: None 
    })
}

// 2. Background Sync (Retry mechanism)
pub async fn sync_pending_sales(
    app: AppHandle,
    state: &SalesState,
    auth_state: &AuthState
) -> Result<usize> {
    let (base_url, device_key) = {
        let config_guard = auth_state.device_config.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        match config_guard.as_ref() {
            Some(c) => (c.base_url.clone(), Some(c.device_key.clone())),
            None => (String::new(), None)
        }
    };

    let (token, member_id) = {
        let token_guard = auth_state.member_token.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        let user_guard = auth_state.current_user.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        (token_guard.clone(), user_guard.as_ref().map(|u| u.id.clone()))
    };

    if base_url.is_empty() || device_key.is_none() {
        return Ok(0);
    }

    let pending_items: Vec<QueuedSale> = {
        let q = state.queue.lock().unwrap();
        q.iter()
            .filter(|s| s.status != SaleStatus::Failed && s.retry_count < 20) // Enterprise: Max Retry Limit
            .cloned()
            .collect()
    };

    if pending_items.is_empty() { return Ok(0); }

    info!("[Sync] Found {} pending sales to sync...", pending_items.len());
    let mut success_count = 0;
    let mut ids_to_remove = Vec::new();

    for sale in pending_items {
        // Enterprise: Exponential Backoff (Basic Implementation)
        // If retry_count is high, delay briefly (in a real queue, this would be scheduled)
        if sale.retry_count > 5 {
            std::thread::sleep(Duration::from_millis(100 * (sale.retry_count as u64)));
        }

        match push_single_sale(
            &base_url, 
            &sale.location_id, 
            &sale.transaction_data, 
            device_key.clone(), 
            token.clone(),
            member_id.clone()
        ).await {
            Ok(_) => {
                ids_to_remove.push(sale.id);
                success_count += 1;
            },
            Err(e) => {
                // Enterprise: Analyze Error Type
                match e.downcast_ref::<SalesError>() {
                    Some(SalesError::ValidationError(_)) => {
                        // Fatal error: Mark as failed so we stop retrying
                        error!("[Sync] Fatal validation error for {}: {}. Marking FAILED.", sale.id, e);
                        let mut q = state.queue.lock().unwrap();
                         if let Some(item) = q.iter_mut().find(|x| x.id == sale.id) {
                            item.status = SaleStatus::Failed;
                            item.last_error = Some(format!("Fatal: {}", e));
                        }
                    },
                    _ => warn!("[Sync] Transient error for {}: {}", sale.id, e),
                }
            }
        }
    }

    if success_count > 0 || !ids_to_remove.is_empty() {
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
    member_id: Option<String> 
) -> Result<serde_json::Value> {
    
    let clean_base = base_url.trim_end_matches('/');
    // Check if this is an M-Pesa sale to adjust timeout
    let url = format!("{}/api/v1/pos/sale/process?locationId={}&enableStockTracking=true", clean_base, location_id);

    // --- BUILD HEADERS ---
    let mut headers = HeaderMap::new();
    
    if let Some(key) = device_key {
        let mut val = HeaderValue::from_str(&key).map_err(|_| SalesError::AuthError("Invalid Device Key chars".into()))?;
        val.set_sensitive(true);
        headers.insert("X-Device-Api-Key", val);
    }

    if let Some(t) = token {
        let auth_val = format!("Bearer {}", t);
        let mut val = HeaderValue::from_str(&auth_val).map_err(|_| SalesError::AuthError("Invalid Token chars".into()))?;
        val.set_sensitive(true);
        headers.insert(AUTHORIZATION, val);
    }

    if let Some(mid) = member_id {
        let val = HeaderValue::from_str(&mid).map_err(|_| SalesError::AuthError("Invalid Member ID chars".into()))?;
        headers.insert("X-Member-Id", val);
    }

    // Build client
    let client = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(Duration::from_secs(45)) 
        .build()?;

    let resp = client.post(&url)
        .json(payload)
        .send()
        .await
        .map_err(|e| SalesError::NetworkError(e.to_string()))?;
    
    let status = resp.status();

    // Enterprise: Detailed Status Handling
    if status.is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| SalesError::NetworkError(format!("Invalid JSON: {}", e)))?;
        return Ok(body);
    }

    // Error Handling
    let error_body = resp.text().await.unwrap_or_default();
    
    match status {
        StatusCode::BAD_REQUEST | StatusCode::UNPROCESSABLE_ENTITY => {
            // 400/422: Data is wrong. Do not retry.
            Err(SalesError::ValidationError(format!("{} - {}", status, error_body)).into())
        },
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            // 401/403: Auth wrong. Retry might fix if token refreshes, but usually fatal for current session.
            Err(SalesError::AuthError(format!("{} - {}", status, error_body)).into())
        },
        _ => {
            // 500 or others: Retry.
            Err(SalesError::NetworkError(format!("Server Error {}: {}", status, error_body)).into())
        }
    }
}

pub fn get_queue_status(state: &SalesState) -> Vec<QueuedSale> {
    state.queue.lock().unwrap().clone()
}