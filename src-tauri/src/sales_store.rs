use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use crate::models::{QueuedSale, SaleStatus, SaleResponse};
use crate::auth_store::AuthState;
use crate::shift_store::ShiftState;
use anyhow::{Result, Context};
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
static LEGACY_SECRET: OnceLock<String> = OnceLock::new();

fn get_legacy_secret() -> &'static str {
    LEGACY_SECRET.get_or_init(|| {
        option_env!("LEGACY_APP_SECRET")
            .map(|s| s.to_string())
            .unwrap_or_else(|| "dealio-pos-secure-storage-salt".to_string())
    })
}
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
    hasher.update(get_legacy_secret().as_bytes());
    hasher.finalize().into()
}

async fn save_queue_encrypted(app: &AppHandle, queue: &Vec<QueuedSale>) -> Result<()> {
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
    tokio::fs::write(path, final_payload).await.context("Failed to write sales queue")?;
    Ok(())
}

async fn load_queue_encrypted(app: &AppHandle) -> Result<Vec<QueuedSale>> {
    let path = get_store_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let file_bytes = tokio::fs::read(&path).await?;
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
             if let Err(e) = save_queue_encrypted(app, &queue).await {
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

pub async fn init_state(app: &AppHandle, state: &SalesState) {
    match load_queue_encrypted(app).await {
        Ok(q) => {
            *state.queue.lock().unwrap_or_else(|e| e.into_inner()) = q;
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
    let (_base_url, location_id, _device_key) = {
        let config_guard = auth_state.device_config.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        let config = config_guard.as_ref().ok_or_else(|| anyhow::anyhow!("Device not configured"))?;
        (config.base_url.clone(), config.location_id.clone(), config.device_key.clone())
    };

    let (_member_token, _member_id) = {
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
        
        match push_single_sale(auth_state, &location_id, &payload).await {
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
    let queue_copy = {
        let mut q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
        q.push(new_sale.clone());
        q.clone()
    };
    
    if let Err(e) = save_queue_encrypted(&app, &queue_copy).await {
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
        
        // Re-acquire auth_state from app handle
        let auth_state = app_handle.state::<AuthState>();

        let sync_result = push_single_sale(
            &auth_state,
            &location_id, 
            &payload_clone
        ).await;

        let queue_copy = {
            let mut q = queue_ref.lock().unwrap_or_else(|e| e.into_inner());
            
            match sync_result {
                Ok(_) => {
                    info!("[Background] Sale {} synced successfully.", sale_id_clone);
                    if let Some(pos) = q.iter().position(|x| x.id == sale_id_clone) {
                        q.remove(pos);
                    }
                },
                Err(e) => {
                    warn!("[Background] Sync failed for {}: {}. Leaving in queue.", sale_id_clone, e);
                    if let Some(item) = q.iter_mut().find(|x| x.id == sale_id_clone) {
                        item.last_error = Some(e.to_string());
                        item.retry_count += 1;
                    }
                }
            }
            q.clone()
        };

        let _ = save_queue_encrypted(&app_handle, &queue_copy).await;
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
    // Simplified: No longer need to pre-extract auth data here for push_single_sale
    // but preserving strict checks for base_url logic if needed by other parts, 
    // although push_single_sale handles it internally now.
    // We'll keep the empty check optimization but use the helper accessor.
    
    let has_config = {
        auth_state.device_config.lock().is_ok_and(|c| c.is_some())
    };

    if !has_config {
        return Ok(0);
    }

    let pending_items: Vec<QueuedSale> = {
        let q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
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
            tokio::time::sleep(Duration::from_millis(100 * (sale.retry_count as u64))).await;
        }

        match push_single_sale(
            auth_state,
            &sale.location_id, 
            &sale.transaction_data
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
                        let mut q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
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
        let queue_copy = {
            let mut q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
            q.retain(|s| !ids_to_remove.contains(&s.id));
            q.clone()
        };
        let _ = save_queue_encrypted(&app, &queue_copy).await;
    }

    Ok(success_count)
}

// --- Helper: Network Request ---
async fn push_single_sale(
    auth_state: &AuthState,
    location_id: &str, 
    payload: &serde_json::Value
) -> Result<serde_json::Value> {
    
    // Check if this is an M-Pesa sale to adjust timeout (handled by shared client timeout)
    let encoded_loc = urlencoding::encode(&location_id);
    let url_path = format!("/api/v1/pos/sale/process?locationId={}&enableStockTracking=true", encoded_loc);

    // Build request using shared client
    // Note: SalesError::AuthError mapping
    let req = auth_state.build_request(reqwest::Method::POST, &url_path)
        .map_err(SalesError::AuthError)?
        .json(payload);
    
    // We specifically want a longer timeout for sales processing if needed, 
    // but the shared client has 30s. If we need 45s, we might need a per-request timeout override
    // which reqwest supports on the RequestBuilder.
    let resp = req.timeout(Duration::from_secs(45))
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

// --- NEW COMMANDS FOR REFACTOR ---

#[tauri::command]
pub async fn get_sales_history_command(
    auth_state: State<'_, AuthState>,
    location_id: Option<String>
) -> Result<Vec<serde_json::Value>, String> {
    // Construct URL with optional locationId
    let mut url_path = "/api/v1/pos/sale".to_string();
    if let Some(loc_id) = location_id {
        let encoded_loc = urlencoding::encode(&loc_id);
        url_path = format!("{}?locationId={}", url_path, encoded_loc);
    }

    let res = auth_state.build_request(reqwest::Method::GET, &url_path)?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to fetch sales history: {}", res.status()));
    }

    let sales: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
    Ok(sales)
}

#[tauri::command]
pub async fn record_payment_command(
    auth_state: State<'_, AuthState>,
    payload: serde_json::Value
) -> Result<serde_json::Value, String> {
    let url_path = "/api/v1/pos/sale/payments";

    let res = auth_state.build_request(reqwest::Method::POST, url_path)?
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    if !status.is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Payment recording failed: {} - {}", status, err_text));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn initiate_mpesa_payment_command(
    auth_state: State<'_, AuthState>,
    phone_number: String,
    amount: f64,
    sale_number: String
) -> Result<serde_json::Value, String> {
    let url_path = "/api/mpesa/initiate";

    let payload = serde_json::json!({
        "phoneNumber": phone_number,
        "amount": amount,
        "saleNumber": sale_number
    });

    let res = auth_state.build_request(reqwest::Method::POST, url_path)?
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    if !status.is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("M-Pesa initiation failed: {} - {}", status, err_text));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

pub fn get_queue_status(state: &SalesState) -> Vec<QueuedSale> {
    state.queue.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

/// Retry a single sale by ID
pub async fn retry_single_sale(
    app: AppHandle,
    state: &SalesState,
    auth_state: &AuthState,
    sale_id: String,
) -> Result<bool> {
    // Find the sale in the queue

    // Find the sale in the queue
    let sale_data = {
        let q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
        q.iter().find(|s| s.id == sale_id).cloned()
    };

    let sale = sale_data.ok_or_else(|| anyhow::anyhow!("Sale not found"))?;

    // Attempt to sync
    match push_single_sale(
        auth_state,
        &sale.location_id,
        &sale.transaction_data,
    ).await {
        Ok(_) => {
            info!("[SalesStore] Sale {} retried successfully.", sale_id);
            // Remove from queue
            let queue_copy = {
                let mut q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
                q.retain(|s| s.id != sale_id);
                q.clone()
            };
            let _ = save_queue_encrypted(&app, &queue_copy).await;
            Ok(true)
        },
        Err(e) => {
            warn!("[SalesStore] Retry failed for {}: {}", sale_id, e);
            // Update retry count
            let queue_copy = {
                let mut q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
                if let Some(item) = q.iter_mut().find(|x| x.id == sale_id) {
                    item.retry_count += 1;
                    item.last_error = Some(e.to_string());
                    if item.retry_count > 10 {
                        item.status = SaleStatus::Failed;
                    }
                }
                q.clone()
            };
            let _ = save_queue_encrypted(&app, &queue_copy).await;
            Err(e)
        }
    }
}

/// Check for sales older than specified days
pub fn check_old_pending_sales(state: &SalesState, days_threshold: u64) -> Vec<QueuedSale> {
    let q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    
    let threshold_ms = days_threshold * 24 * 60 * 60 * 1000;
    
    q.iter()
        .filter(|s| s.status != SaleStatus::Synced && (now - s.timestamp) > threshold_ms)
        .cloned()
        .collect()
}

/// Check for repeatedly failed sales
pub fn check_failed_sales(state: &SalesState, retry_threshold: u32) -> Vec<QueuedSale> {
    let q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
    q.iter()
        .filter(|s| s.retry_count >= retry_threshold)
        .cloned()
        .collect()
}

pub async fn delete_sale(app: &AppHandle, state: &SalesState, sale_id: String) -> Result<bool> {
    let (should_save, queue_copy) = {
        let mut q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
        let initial_len = q.len();
        q.retain(|s| s.id != sale_id);
        
        if q.len() < initial_len {
            (true, q.clone())
        } else {
            (false, Vec::new())
        }
    };
    
    if should_save {
        save_queue_encrypted(app, &queue_copy).await?;
        info!("[SalesStore] Sale {} deleted from queue.", sale_id);
        Ok(true)
    } else {
        Ok(false)
    }
}


pub async fn scan_transaction_qr(
    auth_state: &AuthState,
    qr_code: String,
) -> Result<serde_json::Value> {
    // Url match: /api/v1/pos/transaction/scan
    let url_path = "/api/v1/pos/transaction/scan";

    let req = auth_state.build_request(reqwest::Method::POST, url_path)
        .map_err(SalesError::AuthError)?;

    let payload = serde_json::json!({ "code": qr_code });

    let resp = req.json(&payload)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| SalesError::NetworkError(e.to_string()))?;
    
    let status = resp.status();

    if status.is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| SalesError::NetworkError(format!("Invalid JSON: {}", e)))?;
        return Ok(body);
    }

    let error_body = resp.text().await.unwrap_or_default();
    Err(SalesError::NetworkError(format!("Server Error {}: {}", status, error_body)).into())
}

pub fn search_local(state: &SalesState, query: String) -> Vec<QueuedSale> {
    let q = state.queue.lock().unwrap_or_else(|e| e.into_inner());
    let lower_query = query.to_lowercase();
    
    q.iter()
        .filter(|s| {
            s.id.to_lowercase().contains(&lower_query) ||
            s.transaction_data.get("saleNumber").and_then(|v| v.as_str()).map(|v| v.to_lowercase().contains(&lower_query)).unwrap_or(false)
        })
        .cloned()
        .collect()
}

// --- CREATE ORDER (Online Orders / Special Orders) ---
pub async fn create_order(
    auth_state: &AuthState,
    location_id: String,
    order_payload: serde_json::Value,
) -> Result<serde_json::Value> {
    let encoded_loc = urlencoding::encode(&location_id);
    let url_path = format!("/api/v1/pos/orders?locationId={}", encoded_loc);

    let req = auth_state.build_request(reqwest::Method::POST, &url_path)
        .map_err(SalesError::AuthError)?;

    let resp = req.json(&order_payload)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| SalesError::NetworkError(e.to_string()))?;
    
    let status = resp.status();

    if status.is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| SalesError::NetworkError(format!("Invalid JSON: {}", e)))?;
        return Ok(body);
    }

    // Error Handling
    let error_body = resp.text().await.unwrap_or_default();
    
    match status {
        StatusCode::BAD_REQUEST | StatusCode::UNPROCESSABLE_ENTITY => {
            Err(SalesError::ValidationError(format!("{} - {}", status, error_body)).into())
        },
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            Err(SalesError::AuthError(format!("{} - {}", status, error_body)).into())
        },
        _ => {
            Err(SalesError::NetworkError(format!("Server Error {}: {}", status, error_body)).into())
        }
    }
}