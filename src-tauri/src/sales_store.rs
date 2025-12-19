use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
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
const APP_SECRET: &str = "dealio-pos-secure-storage-salt"; 

pub struct SalesState {
    pub queue: Mutex<Vec<QueuedSale>>,
}

impl SalesState {
    pub fn new() -> Self {
        Self {
            queue: Mutex::new(Vec::new()),
        }
    }
}

// ... [Keep Encryption Helpers (get_cipher_key, save_queue_encrypted, load_queue_encrypted, get_store_path) exactly as they were] ...
// (Omitting them here for brevity, assume they are unchanged)

fn get_cipher_key() -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(APP_SECRET);
    hasher.finalize().into()
}

fn save_queue_encrypted(app: &AppHandle, queue: &Vec<QueuedSale>) -> Result<()> {
    let json_data = serde_json::to_string(queue)?;
    let key = get_cipher_key();
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

    let file_bytes = fs::read(path)?;
    if file_bytes.len() < 12 { return Ok(Vec::new()); }

    let (nonce_slice, ciphertext) = file_bytes.split_at(12);
    
    let mut nonce_arr = [0u8; 12];
    nonce_arr.copy_from_slice(nonce_slice);
    let nonce = Nonce::from(nonce_arr);

    let key = get_cipher_key();
    let cipher = Aes256Gcm::new(&key.into());

    let plaintext = cipher.decrypt(&nonce, ciphertext)
        .map_err(|_| anyhow::anyhow!("Decryption failed"))?;

    let queue: Vec<QueuedSale> = serde_json::from_slice(&plaintext)?;
    Ok(queue)
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

// 1. Process Sale (Queue first, then try sync)
pub async fn process_sale(
    app: AppHandle,
    state: &SalesState,
    sale_id: String,
    location_id: String,
    payload: serde_json::Value,
    base_url: String,
    device_key: Option<String>,
    token: Option<String>
) -> Result<SaleResponse> {
    
    // A. Add to Local Queue (Encrypted)
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
            eprintln!("CRITICAL: Failed to persist sales queue: {}", e);
        }
    }

    // B. Attempt Immediate Sync
    let sync_result = push_single_sale(&base_url, &location_id, &payload, device_key, token).await;

    let mut q = state.queue.lock().unwrap();
    
    match sync_result {
        Ok(server_resp) => {
            if let Some(pos) = q.iter().position(|x| x.id == sale_id) {
                q.remove(pos);
                let _ = save_queue_encrypted(&app, &q); 
            }
            Ok(SaleResponse {
                success: true,
                message: "Sale processed successfully".into(),
                server_response: Some(server_resp)
            })
        },
        Err(e) => {
            if let Some(item) = q.iter_mut().find(|x| x.id == sale_id) {
                item.last_error = Some(e.to_string());
                item.retry_count += 1;
            }
            let _ = save_queue_encrypted(&app, &q);
            
            Ok(SaleResponse {
                success: true, 
                message: "Network unreachable. Saved to offline queue.".into(),
                server_response: None
            })
        }
    }
}

// 2. Background Sync (Retry mechanism)
pub async fn sync_pending_sales(
    app: AppHandle,
    state: &SalesState,
    base_url: String,
    device_key: Option<String>,
    token: Option<String>
) -> Result<usize> {
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

    for sale in pending_items {
        // Pass device_key and token to the helper
        match push_single_sale(&base_url, &sale.location_id, &sale.transaction_data, device_key.clone(), token.clone()).await {
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
    token: Option<String>
) -> Result<serde_json::Value> {
    
    let clean_base = base_url.trim_end_matches('/');
    let url = format!("{}/api/v1/pos/sale/process?locationId={}&enableStockTracking=true", clean_base, location_id);

    // --- BUILD HEADERS (Matches store.rs) ---
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

    let client = reqwest::Client::builder()
        .default_headers(headers)
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