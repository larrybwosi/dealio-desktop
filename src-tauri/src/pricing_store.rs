use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use crate::models::{
    ClientPriceList, ClientPriceListItem, PosPricingData
};
use anyhow::{Result, Context};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce 
};
use sha2::{Sha256, Digest};
use rand::RngCore;
use chrono::{DateTime, Utc};

const PRICING_FILENAME: &str = "secure_pricing.bin"; 
const TIMEOUT_SECONDS: u64 = 30; // Slightly longer for potentially large pricing data
const APP_SECRET: &str = "dealio-pos-secure-storage-salt"; 

// --- State Management ---
pub struct PricingState {
    pub data: Mutex<PosPricingData>,
    pub last_sync_at: Mutex<Option<String>>,
}

impl PricingState {
    pub fn new() -> Self {
        Self {
            data: Mutex::new(PosPricingData {
                lists: Vec::new(),
                items: Vec::new(),
                allocations: HashMap::new(),
            }),
            last_sync_at: Mutex::new(None),
        }
    }
}

// --- Helper: Encryption Logic (Same as Customer Store) ---
fn get_cipher_key() -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(APP_SECRET);
    hasher.finalize().into()
}

fn save_encrypted(path: PathBuf, sync_at: Option<String>, data: &PosPricingData) -> Result<()> {
    // 1. Serialize data to JSON
    let data_wrapper = (sync_at, data);
    let json_data = serde_json::to_string(&data_wrapper)?;

    // 2. Encrypt with Secure Key from Keyring
    let key = crate::security::get_or_create_key("pricing_store_key")
         .map_err(|e| anyhow::anyhow!("Keyring error: {}", e))?;
    
    let cipher = Aes256Gcm::new(&key.into());
    
    // Generate a random 96-bit nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from(nonce_bytes);

    let ciphertext = cipher.encrypt(&nonce, json_data.as_bytes())
        .map_err(|_| anyhow::anyhow!("Encryption failed"))?;

    // 3. Store: [Nonce (12 bytes)] + [Ciphertext]
    let mut final_payload = nonce_bytes.to_vec();
    final_payload.extend_from_slice(&ciphertext);

    fs::write(path, final_payload).context("Failed to write secure file")?;
    Ok(())
}

fn load_encrypted(path: PathBuf) -> Result<(Option<String>, PosPricingData)> {
    let file_bytes = fs::read(&path).context("Failed to read secure file")?;
    
    if file_bytes.len() < 12 {
        return Err(anyhow::anyhow!("File corrupted or too short"));
    }

    // 1. Split Nonce and Ciphertext
    let (nonce_slice, ciphertext) = file_bytes.split_at(12);

    let mut nonce_arr = [0u8; 12];
    nonce_arr.copy_from_slice(nonce_slice);
    let nonce = Nonce::from(nonce_arr);

    // 2a. Try Secure Key
    if let Ok(key) = crate::security::get_or_create_key("pricing_store_key") {
        let cipher = Aes256Gcm::new(&key.into());
        if let Ok(plaintext) = cipher.decrypt(&nonce, ciphertext) {
             let data = serde_json::from_slice(&plaintext)?;
             return Ok(data);
        }
    }

    // 2b. Try Legacy Key (Migration)
    println!("[PricingStore] Decryption with secure key failed. Attempting legacy migration...");
    let legacy_key = get_cipher_key();
    let cipher = Aes256Gcm::new(&legacy_key.into());

    let plaintext = cipher.decrypt(&nonce, ciphertext)
        .map_err(|_| anyhow::anyhow!("Decryption failed - Invalid Key or Corrupted Data"))?;

    let data: (Option<String>, PosPricingData) = serde_json::from_slice(&plaintext)?;
    
    // Re-save immediately with new secure key
    println!("[PricingStore] Legacy migration successful. Re-saving with secure key...");
    if let Err(e) = save_encrypted(path, data.0.clone(), &data.1) {
        eprintln!("[PricingStore] Migration save failed: {}", e);
    }

    Ok(data)
}

// --- Helper: File Path ---
fn get_store_path(app: &AppHandle) -> Result<PathBuf> {
    let app_dir = app.path().app_data_dir().context("Failed to resolve App Data Directory")?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }
    Ok(app_dir.join(PRICING_FILENAME))
}

// --- 1. Load Data on Startup ---
pub fn load_pricing_from_disk(app: &AppHandle, state: &PricingState) -> Result<()> {
    let path = get_store_path(app)?;
    
    if path.exists() {
        match load_encrypted(path) {
            Ok((sync_at, data)) => {
                *state.last_sync_at.lock().unwrap() = sync_at;
                *state.data.lock().unwrap() = data;
                println!("[SecureStore] Loaded Pricing Schema successfully.");
            },
            Err(e) => eprintln!("[SecureStore] Failed to load pricing: {}", e),
        }
    }
    Ok(())
}

// --- 2. Sync Engine ---
use crate::auth_store::AuthState;

pub async fn run_sync(
    app: AppHandle,
    state: &PricingState,
    auth_state: &AuthState
) -> Result<String> { // Returns new sync timestamp
    
    // 1. Get Config/Auth from State
    let (base_url, device_key) = {
        let config_guard = auth_state.device_config.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        let config = config_guard.as_ref().ok_or_else(|| anyhow::anyhow!("Device not configured"))?;
        (config.base_url.clone(), config.device_key.clone())
    };

    let member_token = {
        let token_guard = auth_state.member_token.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        token_guard.clone()
    };
    
    if base_url.is_empty() { 
        return Err(anyhow::anyhow!("Base URL is empty")); 
    }

    let clean_base_url = base_url.trim_end_matches('/');
    // Endpoint: /api/v1/pos/pricing OR /api/v1/pos/pricing/sync
    
    let last_sync = state.last_sync_at.lock().unwrap().clone();
    
    let target_url = if last_sync.is_some() {
        format!("{}/api/v1/pos/pricing/sync", clean_base_url)
    } else {
        format!("{}/api/v1/pos/pricing", clean_base_url)
    };

    // --- BUILD HEADERS ---
    let mut headers = HeaderMap::new();
    
    let mut val = HeaderValue::from_str(&device_key).map_err(|_| anyhow::anyhow!("Invalid Device Key"))?;
    val.set_sensitive(true);
    headers.insert("X-Device-Api-Key", val);

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
    let mut query_params = vec![];
    if let Some(token) = &last_sync {
        query_params.push(("lastSync", token.clone()));
    }

    // --- EXECUTE REQUEST ---
    let response = client.get(&target_url)
        .query(&query_params)
        .send()
        .await
        .context("Failed to send request to server")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!("Server returned error: {} - {}", status, body));
    }

    let res_body = response.json::<crate::models::ServerPricingResponse>().await
        .context("Failed to parse server response JSON")?;

    let metadata = res_body.metadata;
    let server_data = res_body.data;
    
    // Transform Server Data -> Client Flat Data
    let mut flat_lists = Vec::new();
    for slist in server_data.lists {
        flat_lists.push(ClientPriceList {
            id: slist.id,
            code: slist.code,
            priority: slist.priority,
            is_global: slist.is_global,
            is_active: slist.is_active,
            valid_from: slist.valid_from,
            valid_to: slist.valid_to,
            updated_at: slist.updated_at,
        });
    }

    let mut flat_items = Vec::new();
    for sitem in server_data.items {
        flat_items.push(ClientPriceListItem {
            id: sitem.id,
            price_list_id: sitem.price_list_id,
            variant_id: sitem.variant_id,
            selling_unit_id: sitem.selling_unit_id,
            min_quantity: sitem.min_quantity,
            price: sitem.price,
            updated_at: sitem.updated_at,
        });
    }

    let customer_allocations = server_data.customer_allocations.unwrap_or_default();


    // Idempotency check
    if let Some(last) = &last_sync {
        if last == &metadata.synced_at {
             return Ok(last.clone());
        }
    }

    // --- MERGE LOGIC ---
    let mut data_guard = state.data.lock().unwrap();
    
    if !metadata.is_delta || metadata.temp_full_sync {
        // Full Sync - Overwrite
        *data_guard = PosPricingData {
            lists: flat_lists,
            items: flat_items,
            allocations: customer_allocations,
        };
        println!("[PricingStore] Performed full sync. Items: {}", data_guard.items.len());
    } else {
        // Delta Sync - Merge
        // 1. Lists
        let mut list_map: HashMap<String, ClientPriceList> = data_guard.lists.drain(..).map(|l| (l.id.clone(), l)).collect();
        for list in flat_lists {
            list_map.insert(list.id.clone(), list);
        }
        data_guard.lists = list_map.into_values().collect();

        // 2. Items
        let mut item_map: HashMap<String, ClientPriceListItem> = data_guard.items.drain(..).map(|i| (i.id.clone(), i)).collect();
        
        // Remove deleted items if list provided
        for deleted_id in server_data.deleted_item_ids {
            item_map.remove(&deleted_id);
        }
        
        // Add/Update new
        for item in flat_items {
            item_map.insert(item.id.clone(), item);
        }
        data_guard.items = item_map.into_values().collect();

        // 3. Allocations (Merge maps)
        for (cust_id, lists) in customer_allocations {
            data_guard.allocations.insert(cust_id, lists);
        }
        println!("[PricingStore] Performed delta sync. Active Items: {}", data_guard.items.len());
    }

    // --- SAVE TO DISK SECURELY ---
    let new_time = metadata.synced_at;
    *state.last_sync_at.lock().unwrap() = Some(new_time.clone());

    let path = get_store_path(&app)?;
    save_encrypted(path, Some(new_time.clone()), &data_guard)?;

    Ok(new_time)
}

// --- 3. Pricing Resolution Engine ---
pub fn resolve_price(
    state: &PricingState,
    customer_id: Option<String>,
    variant_id: String,
    unit_id: Option<String>, // Explicit Unit ID or None (for base unit implicit)
    is_base_unit: bool
) -> Option<f64> {
    let data = state.data.lock().unwrap();
    
    // 1. Identify Applicable Price Lists
    let mut applicable_list_ids = HashSet::new();

    // a. Customer Specific Lists
    if let Some(cid) = &customer_id {
        if let Some(lists) = data.allocations.get(cid) {
            for list_id in lists {
                applicable_list_ids.insert(list_id.clone());
            }
        }
    }

    // b. Global Lists
    for list in &data.lists {
        if list.is_global {
            applicable_list_ids.insert(list.id.clone());
        }
    }

    if applicable_list_ids.is_empty() {
        return None;
    }

    // 2. Filter and Sort Lists
    let now = Utc::now();
    let mut sorted_lists: Vec<&ClientPriceList> = data.lists.iter()
        .filter(|list| {
            if !applicable_list_ids.contains(&list.id) { return false; }
            if !list.is_active { return false; }
            
            // Check dates
            if let Some(from) = &list.valid_from {
                if let Ok(dt) = DateTime::parse_from_rfc3339(from) {
                     if dt > now { return false; }
                }
            }
            if let Some(to) = &list.valid_to {
                if let Ok(dt) = DateTime::parse_from_rfc3339(to) {
                     if dt < now { return false; }
                }
            }
            true
        })
        .collect();

    // Sort by priority DESC (Higher is better)
    sorted_lists.sort_by(|a, b| b.priority.cmp(&a.priority));

    // 3. Find first matching item
    for list in sorted_lists {
        let matched = data.items.iter().find(|item| {
            if item.price_list_id != list.id { return false; }
            if item.variant_id != variant_id { return false; }
            
            // Match Logic:
            // 1. Exact Unit Match: item.selling_unit_id == unit_id
            // 2. Base Unit Match: is_base_unit=true AND item.selling_unit_id is None
            
            match (&item.selling_unit_id, &unit_id) {
                (Some(id1), Some(id2)) => id1 == id2,
                (None, _) => is_base_unit, // If item has no unit, it applies to base unit. So we match if current request implies base unit.
                (Some(_), None) => false, // Item is for a specific unit, but we have none? Unlikely if is_base_unit logic holds. 
            }
        });

        if let Some(item) = matched {
            // Parse price string to f64
            if let Ok(price) = item.price.parse::<f64>() {
                return Some(price);
            }
        }
    }

    None
}

// --- 4. Data Access ---
pub fn get_all_pricing(state: &PricingState) -> PosPricingData {
    state.data.lock().unwrap().clone()
}
