use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use crate::models::{PosCustomer, CustomersSyncResponse};
use anyhow::{Result, Context};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce 
};
use sha2::{Sha256, Digest};
use rand::RngCore;

const CUSTOMER_FILENAME: &str = "secure_customers.bin"; 
const TIMEOUT_SECONDS: u64 = 15;
// A hardcoded salt for key derivation
const APP_SECRET: &str = "dealio-pos-secure-storage-salt"; 

// --- State Management ---
pub struct CustomerState {
    pub customers: Mutex<Vec<PosCustomer>>,
    pub last_sync_token: Mutex<Option<String>>,
}

impl CustomerState {
    pub fn new() -> Self {
        Self {
            customers: Mutex::new(Vec::new()),
            last_sync_token: Mutex::new(None),
        }
    }
}

// --- Helper: Encryption Logic ---
fn get_cipher_key() -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(APP_SECRET);
    hasher.finalize().into()
}

fn save_encrypted(path: PathBuf, sync_token: Option<String>, customers: &Vec<PosCustomer>) -> Result<()> {
    // 1. Serialize data to JSON
    let data_wrapper = (sync_token, customers);
    let json_data = serde_json::to_string(&data_wrapper)?;

    // 2. Encrypt
    let key = get_cipher_key();
    let cipher = Aes256Gcm::new(&key.into());
    
    // Generate a random 96-bit nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    
    let nonce = Nonce::from(nonce_bytes);

    // FIX: Added '&' before nonce
    let ciphertext = cipher.encrypt(&nonce, json_data.as_bytes())
        .map_err(|_| anyhow::anyhow!("Encryption failed"))?;

    // 3. Store: [Nonce (12 bytes)] + [Ciphertext]
    let mut final_payload = nonce_bytes.to_vec();
    final_payload.extend_from_slice(&ciphertext);

    fs::write(path, final_payload).context("Failed to write secure file")?;
    Ok(())
}

fn load_encrypted(path: PathBuf) -> Result<(Option<String>, Vec<PosCustomer>)> {
    let file_bytes = fs::read(path).context("Failed to read secure file")?;
    
    if file_bytes.len() < 12 {
        return Err(anyhow::anyhow!("File corrupted or too short"));
    }

    // 1. Split Nonce and Ciphertext
    let (nonce_slice, ciphertext) = file_bytes.split_at(12);

    let mut nonce_arr = [0u8; 12];
    nonce_arr.copy_from_slice(nonce_slice);
    let nonce = Nonce::from(nonce_arr);

    // 2. Decrypt
    let key = get_cipher_key();
    let cipher = Aes256Gcm::new(&key.into());

    // FIX: Added '&' before nonce
    let plaintext = cipher.decrypt(&nonce, ciphertext)
        .map_err(|_| anyhow::anyhow!("Decryption failed - Invalid Key or Corrupted Data"))?;

    // 3. Parse JSON
    let data = serde_json::from_slice(&plaintext)?;
    Ok(data)
}

// --- Helper: File Path ---
fn get_store_path(app: &AppHandle) -> Result<PathBuf> {
    let app_dir = app.path().app_data_dir().context("Failed to resolve App Data Directory")?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }
    Ok(app_dir.join(CUSTOMER_FILENAME))
}

// --- 1. Load Data on Startup ---
pub fn load_customers_from_disk(app: &AppHandle, state: &CustomerState) -> Result<()> {
    let path = get_store_path(app)?;
    
    if path.exists() {
        match load_encrypted(path) {
            Ok((token, customers)) => {
                *state.last_sync_token.lock().unwrap() = token;
                *state.customers.lock().unwrap() = customers;
                println!("[SecureStore] Loaded {} customers successfully.", state.customers.lock().unwrap().len());
            },
            Err(e) => eprintln!("[SecureStore] Failed to load customers: {}", e),
        }
    }
    Ok(())
}

// --- 2. Sync Engine ---
pub async fn run_sync(
    app: AppHandle,
    state: &CustomerState,
    base_url: String,
    _location_id: String,
    device_key: Option<String>,
    member_token: Option<String>
) -> Result<usize> {
    
    if base_url.is_empty() { return Err(anyhow::anyhow!("Base URL is empty")); }

    let clean_base_url = base_url.trim_end_matches('/');
    let target_url = format!("{}/api/v1/pos/customers", clean_base_url);
    let last_token = state.last_sync_token.lock().unwrap().clone();
    
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
        ("limit", "1000".to_string()), 
    ];
    if let Some(token) = &last_token {
        query_params.push(("lastSync", token.clone()));
    }

    // --- EXECUTE REQUEST ---
    let response = client.get(&target_url)
        .query(&query_params)
        .send()
        .await
        .context("Failed to send request to server")?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!("Server returned error: {}", response.status()));
    }

    let res_body = response.json::<CustomersSyncResponse>().await
        .context("Failed to parse server response JSON")?;

    // --- MERGE LOGIC ---
    let mut customers_guard = state.customers.lock().unwrap();
    
    let mut customer_map: HashMap<String, PosCustomer> = customers_guard
        .drain(..)
        .map(|c| (c.id.clone(), c))
        .collect();

    let incoming_count = res_body.data.len();
    
    for customer in res_body.data {
        customer_map.insert(customer.id.clone(), customer);
    }

    let updated_list: Vec<PosCustomer> = customer_map.into_values().collect();
    *customers_guard = updated_list.clone();

    // --- SAVE TO DISK SECURELY ---
    let new_token = res_body.next_sync_token;
    *state.last_sync_token.lock().unwrap() = Some(new_token.clone());

    let path = get_store_path(&app)?;
    save_encrypted(path, Some(new_token), &updated_list)?;

    Ok(incoming_count)
}

// --- 3. Search Logic ---
pub fn search_local(state: &CustomerState, query: String) -> Vec<PosCustomer> {
    let customers = state.customers.lock().unwrap();
    let query = query.trim().to_lowercase();

    if query.is_empty() {
        return customers.iter().take(50).cloned().collect();
    }

    customers.iter().filter(|c| {
        let matches_name = c.name.to_lowercase().contains(&query);
        let matches_phone = c.phone.as_ref().map_or(false, |p| p.contains(&query));
        let matches_email = c.email.as_ref().map_or(false, |e| e.to_lowercase().contains(&query));
        let matches_company = c.company.as_ref().map_or(false, |comp| comp.to_lowercase().contains(&query));

        matches_name || matches_phone || matches_email || matches_company
    })
    .take(50) 
    .cloned()
    .collect()
}