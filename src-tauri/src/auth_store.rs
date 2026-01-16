use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use keyring::Entry;

// --- Data Types ---

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct MemberProfile {
    pub id: String,
    pub name: String,
    pub role: Option<String>,
    // Add other non-sensitive fields from your Member model
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DeviceConfig {
    pub base_url: String,
    pub location_id: String,
    pub device_key: String,
}

// --- The State Container ---

pub struct AuthState {
    // We wrap in Mutex to allow safe concurrent access
    pub device_config: Mutex<Option<DeviceConfig>>, 
    pub member_token: Mutex<Option<String>>,
    pub current_user: Mutex<Option<MemberProfile>>,
}

const KEYRING_SERVICE: &str = "dealio-desktop";
const KEYRING_USER: &str = "device-config";

impl AuthState {
    pub fn new() -> Self {
        // Try keyring first, then file
        let initial_config = Self::load_from_keyring().or_else(|| Self::load_from_file());
        
        if initial_config.is_some() {
            println!("[AuthStore] Loaded device config successfully");
        } else {
            println!("[AuthStore] No device config found in Keyring or File");
        }

        Self {
            device_config: Mutex::new(initial_config),
            member_token: Mutex::new(None),
            current_user: Mutex::new(None),
        }
    }

    fn get_config_path() -> Option<std::path::PathBuf> {
        let proj_dirs = directories::ProjectDirs::from("com", "dealio", "pos")?;
        let config_dir = proj_dirs.config_dir();
        if !config_dir.exists() {
            let _ = std::fs::create_dir_all(config_dir);
        }
        Some(config_dir.join("device.json"))
    }

    fn load_from_file() -> Option<DeviceConfig> {
        let path = Self::get_config_path()?;
        println!("[AuthStore] Attempting to load from file: {:?}", path);
        
        let content = std::fs::read_to_string(path).ok()?;
        match serde_json::from_str(&content) {
            Ok(config) => {
                 println!("[AuthStore] Loaded config from file");
                 Some(config)
            },
            Err(e) => {
                eprintln!("[AuthStore] Failed to parse file config: {}", e);
                None
            }
        }
    }

    fn save_to_file(config: &DeviceConfig) -> Result<(), String> {
        let path = Self::get_config_path().ok_or("Could not determine config path")?;
        println!("[AuthStore] Saving to file: {:?}", path);

        let json = serde_json::to_string(config).map_err(|e| e.to_string())?;
        std::fs::write(&path, json).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn load_from_keyring() -> Option<DeviceConfig> {
        println!("[AuthStore] Attempting to load from keyring Service: {}, User: {}", KEYRING_SERVICE, KEYRING_USER);
        
        let entry = match Entry::new(KEYRING_SERVICE, KEYRING_USER) {
            Ok(e) => e,
            Err(e) => {
                eprintln!("[AuthStore] Failed to create keyring entry: {}", e);
                return None;
            }
        };

        let password = match entry.get_password() {
            Ok(p) => p,
            Err(e) => {
                eprintln!("[AuthStore] Failed to retrieve password from keyring: {}", e);
                return None;
            }
        };
        
        match serde_json::from_str(&password) {
            Ok(config) => {
                println!("[AuthStore] Successfully loaded and parsed device config.");
                Some(config)
            },
            Err(e) => {
                eprintln!("[AuthStore] Failed to parse config from keyring: {}", e);
                None
            }
        }
    }

    fn save_to_keyring(config: &DeviceConfig) -> Result<(), String> {
        // 1. Try Keyring
        println!("[AuthStore] Saving config to keyring...");
        let keyring_result = (|| -> Result<(), String> {
            let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())?;
            let json = serde_json::to_string(config).map_err(|e| e.to_string())?;
            entry.set_password(&json).map_err(|e| e.to_string())?;
            Ok(())
        })();

        if let Err(e) = keyring_result {
            eprintln!("[AuthStore] Keyring save failed: {}. Falling back to file.", e);
        } else {
             println!("[AuthStore] Successfully saved to keyring");
        }

        // 2. ALWAYS Save to File as Backup
        Self::save_to_file(config)?;
        
        Ok(())
    }

    // --- Helper to get a configured HTTP Client ---
    // This replaces creating Axios instances in React
    pub fn get_client(&self) -> Result<(reqwest::Client, String), String> {
        let config_guard = self.device_config.lock().map_err(|_| "Failed to lock config")?;
        let config = config_guard.as_ref().ok_or("Device not initialized")?;

        let token_guard = self.member_token.lock().map_err(|_| "Failed to lock token")?;
        
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        
        // Add Device Key Header
        if let Ok(val) = HeaderValue::from_str(&config.device_key) {
            headers.insert("x-device-key", val); // Adjust header name to your API spec
        }

        // Add Bearer Token if logged in
        if let Some(token) = token_guard.as_ref() {
            let auth_val = format!("Bearer {}", token);
            if let Ok(val) = HeaderValue::from_str(&auth_val) {
                headers.insert(AUTHORIZATION, val);
            }
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|e| e.to_string())?;

        Ok((client, config.base_url.clone()))
    }
}

// --- API Response Models ---

#[derive(Deserialize)]
struct LoginResponse {
    token: String,
    member: MemberProfile,
}

// --- Commands ---

#[tauri::command]
pub async fn set_device_config(
    state: State<'_, AuthState>,
    base_url: String,
    location_id: String,
    device_key: String
) -> Result<(), String> {
    let new_config = DeviceConfig { base_url, location_id, device_key };
    
    // 1. Save to Keyring first (fail early if secure storage fails)
    AuthState::save_to_keyring(&new_config)?;

    // 2. Update memory
    let mut config = state.device_config.lock().map_err(|_| "Lock error")?;
    *config = Some(new_config);
    
    Ok(())
}

#[tauri::command]
pub async fn login_member(
    state: State<'_, AuthState>,
    card_id: String,
    pin: Option<String>
) -> Result<MemberProfile, String> {
    // 1. Get Client and URL from state
    let (client, base_url) = state.get_client()?;
    let url = format!("{}/api/v1/pos/check-in", base_url); // Adjusted endpoint path

    // 2. Perform Request
    let body = serde_json::json!({ "cardId": card_id, "pin": pin });
    
    let res = client.post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Login failed: {}", res.status()));
    }

    // 3. Parse and Store Token Internally
    let data: LoginResponse = res.json().await.map_err(|e| e.to_string())?;

    // CRITICAL: Token stays here, never returned to UI
    *state.member_token.lock().unwrap() = Some(data.token); 
    *state.current_user.lock().unwrap() = Some(data.member.clone());

    Ok(data.member)
}

#[tauri::command]
pub async fn logout_member(state: State<'_, AuthState>) -> Result<(), String> {
    *state.member_token.lock().unwrap() = None;
    *state.current_user.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub async fn get_device_config(state: State<'_, AuthState>) -> Result<Option<DeviceConfig>, String> {
    let config = state.device_config.lock().map_err(|_| "Lock error")?;
    Ok(config.clone())
}

#[tauri::command]
pub async fn restore_member_session(
    state: State<'_, AuthState>,
    token: String,
    member: MemberProfile
) -> Result<(), String> {
    *state.member_token.lock().unwrap() = Some(token);
    *state.current_user.lock().unwrap() = Some(member.clone());
    println!("[AuthStore] Session restored for member: {}", member.name);
    Ok(())
}