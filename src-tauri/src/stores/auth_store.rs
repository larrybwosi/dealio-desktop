use keyring::Entry;
use log::info;
use reqwest::header::{HeaderValue, AUTHORIZATION};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, State};



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
    #[serde(default)]
    pub allow_negative_stock: bool,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SanitizedDeviceConfig {
    pub location_id: String,
    pub allow_negative_stock: bool,
}

// --- The State Container ---

pub struct AuthState {
    // We wrap in Mutex to allow safe concurrent access
    pub device_config: Mutex<Option<DeviceConfig>>,
    pub member_token: Mutex<Option<String>>,
    pub current_user: Mutex<Option<MemberProfile>>,
    pub client: reqwest::Client,
}

const KEYRING_SERVICE: &str = "dealio-desktop";
const KEYRING_USER: &str = "device-config";

impl AuthState {
    pub fn new() -> Self {
        // Try keyring first, then file
        let initial_config = Self::load_from_keyring().or_else(Self::load_from_file);
        let initial_token = Self::load_token_from_keyring();

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        Self {
            device_config: Mutex::new(initial_config),
            member_token: Mutex::new(initial_token),
            current_user: Mutex::new(None),
            client,
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

        let content = std::fs::read_to_string(path).ok()?;
        match serde_json::from_str(&content) {
            Ok(config) => Some(config),
            Err(e) => {
                eprintln!("[AuthStore] Failed to parse file config: {}", e);
                None
            }
        }
    }

    async fn save_to_file_async(config: &DeviceConfig) -> Result<(), String> {
        let path = Self::get_config_path().ok_or("Could not determine config path")?;
        let json = serde_json::to_string(config).map_err(|e| e.to_string())?;
        tokio::fs::write(&path, json)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn load_from_keyring() -> Option<DeviceConfig> {
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
                eprintln!(
                    "[AuthStore] Failed to retrieve password from keyring: {}",
                    e
                );
                return None;
            }
        };

        match serde_json::from_str(&password) {
            Ok(config) => Some(config),
            Err(e) => {
                eprintln!("[AuthStore] Failed to parse config from keyring: {}", e);
                None
            }
        }
    }

    async fn save_to_keyring_async(config: &DeviceConfig) -> Result<(), String> {
        // 1. Try Keyring
        let keyring_result: Result<(), String> = {
            let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())?;
            let json = serde_json::to_string(config).map_err(|e| e.to_string())?;
            entry.set_password(&json).map_err(|e| e.to_string())?;
            Ok(())
        };

        if let Err(e) = keyring_result {
            eprintln!(
                "[AuthStore] Keyring save failed: {}. Falling back to file.",
                e
            );
        }

        // 2. ALWAYS Save to File as Backup
        Self::save_to_file_async(config).await?;

        Ok(())
    }

    // --- Helper to get a configured HTTP Client ---
    // This provides a request builder utilizing the persistent client and automatically
    // injects API Key, Bearer token, and Member ID headers.
    pub fn build_request(
        &self,
        method: reqwest::Method,
        path: &str,
    ) -> Result<reqwest::RequestBuilder, String> {
        let (base_url, device_key) = {
            let config_guard = self
                .device_config
                .lock()
                .map_err(|_| "Failed to lock device config")?;
            let config = config_guard.as_ref().ok_or("Device not configured")?;
            (config.base_url.clone(), config.device_key.clone())
        };

        let token = {
            self.member_token
                .lock()
                .map_err(|_| "Failed to lock token store")?
                .clone()
        };

        let member_id = {
            let user_guard = self
                .current_user
                .lock()
                .map_err(|_| "Failed to lock user store")?;
            user_guard.as_ref().map(|u| u.id.clone())
        };

        let full_url = if path.starts_with("http") {
            path.to_string()
        } else {
            format!(
                "{}/{}",
                base_url.trim_end_matches('/'),
                path.trim_start_matches('/')
            )
        };

        let mut request_builder = self.client.request(method, &full_url);

        let mut key_val = HeaderValue::from_str(&device_key).map_err(|e| e.to_string())?;
        key_val.set_sensitive(true);
        request_builder = request_builder.header("X-Device-Api-Key", key_val);

        if let Some(t) = token {
            let auth_val = format!("Bearer {}", t);
            let mut val = HeaderValue::from_str(&auth_val).map_err(|e| e.to_string())?;
            val.set_sensitive(true);
            request_builder = request_builder.header(AUTHORIZATION, val);
        }

        if let Some(mid) = member_id {
            let val = HeaderValue::from_str(&mid).map_err(|e| e.to_string())?;
            request_builder = request_builder.header("X-Member-Id", val);
        }

        Ok(request_builder)
    }

    fn load_token_from_keyring() -> Option<String> {
        let entry = Entry::new(KEYRING_SERVICE, "member-token").ok()?;
        entry.get_password().ok()
    }

    fn save_token_to_keyring(token: &str) -> Result<(), String> {
        let entry = Entry::new(KEYRING_SERVICE, "member-token").map_err(|e| e.to_string())?;
        entry.set_password(token).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn delete_token_from_keyring() -> Result<(), String> {
        if let Ok(entry) = Entry::new(KEYRING_SERVICE, "member-token") {
            let _ = entry.delete_password();
        }
        Ok(())
    }
}

// --- API Response Models ---

#[derive(Deserialize)]
struct ServerLoginResponse {
    token: String,
    member: MemberProfile,
    #[serde(rename = "restoredSession")]
    restored_session: Option<bool>,
}

#[derive(Serialize)]
pub struct CheckInResult {
    pub member: MemberProfile,
    pub restored_session: bool,
}

// --- Commands ---

#[tauri::command]
pub async fn set_device_config(
    state: State<'_, AuthState>,
    network_state: State<'_, crate::network_monitor::NetworkState>,
    base_url: String,
    location_id: String,
    device_key: String,
) -> Result<(), String> {
    let new_config = DeviceConfig {
        base_url: base_url.clone(),
        location_id,
        device_key,
        allow_negative_stock: false, // Default to false for new setups
    };

    // 1. Save to Keyring first (fail early if secure storage fails)
    AuthState::save_to_keyring_async(&new_config).await?;

    // 2. Update memory
    {
        let mut config = state.device_config.lock().map_err(|_| "Lock error")?;
        *config = Some(new_config);
    }

    // 3. Update network monitor
    network_state.set_base_url(base_url);

    Ok(())
}

#[tauri::command]
pub async fn login_member(
    app: AppHandle,
    state: State<'_, AuthState>,
    card_id: String,
    pin: Option<String>,
    location_id: Option<String>,
) -> Result<CheckInResult, String> {
    // 1. Build request (handles base_url, persistent client, and headers automatically)
    let request =
        state.build_request(reqwest::Method::POST, crate::api_config::routes::CHECK_IN)?;

    // 2. Perform Request
    let device_key = {
        let config_guard = state.device_config.lock().map_err(|_| "Lock error")?;
        config_guard.as_ref().map(|c| c.device_key.clone())
    };

    let body = serde_json::json!({
        "cardId": card_id,
        "pin": pin,
        "locationId": location_id,
        "deviceKey": device_key
    });

    let res = request
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let error_text = res
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        // Audit failed login attempt
        let _ = crate::audit_store::write_event(
            &app,
            crate::audit_store::AuditLevel::Warning,
            "LOGIN_FAILED",
            Some(card_id.clone()),
            None,
            location_id,
            None,
            serde_json::json!({ "card_id": card_id, "reason": format!("{} - {}", status, error_text) }),
        );
        return Err(format!("Login failed: {} - {}", status, error_text));
    }

    // 3. Parse and Store Token Internally
    let data: ServerLoginResponse = res.json().await.map_err(|e| e.to_string())?;

    // CRITICAL: Token stays here, never returned to UI
    let _ = AuthState::save_token_to_keyring(&data.token);
    *state.member_token.lock().unwrap() = Some(data.token);
    *state.current_user.lock().unwrap() = Some(data.member.clone());

    // Audit successful login
    info!("[AUTH] Member {} logged in", data.member.name);
    let _ = crate::audit_store::write_event(
        &app,
        crate::audit_store::AuditLevel::Info,
        "LOGIN",
        Some(data.member.id.clone()),
        Some(data.member.name.clone()),
        location_id,
        None,
        serde_json::json!({ "card_id": card_id, "role": data.member.role }),
    );

    Ok(CheckInResult {
        member: data.member,
        restored_session: data.restored_session.unwrap_or(false),
    })
}

#[tauri::command]
pub async fn logout_member(
    app: AppHandle,
    state: State<'_, AuthState>,
    location_id: Option<String>,
) -> Result<(), String> {
    // Capture actor before clearing
    let (actor_id, actor_name) = {
        let user_guard = state.current_user.lock().unwrap_or_else(|e| e.into_inner());
        (
            user_guard.as_ref().map(|u| u.id.clone()),
            user_guard.as_ref().map(|u| u.name.clone()),
        )
    };

    // 1. Attempt to notify the server (Best effort)
    if let Ok(request) =
        state.build_request(reqwest::Method::POST, crate::api_config::routes::CHECK_OUT)
    {
        let device_key = {
            let config_guard = state.device_config.lock().map_err(|_| "Lock error")?;
            config_guard.as_ref().map(|c| c.device_key.clone())
        };

        let body = serde_json::json!({
            "locationId": location_id,
            "deviceKey": device_key
        });
        let _ = request.json(&body).send().await;
    }

    // 2. Clear local session
    let _ = AuthState::delete_token_from_keyring();
    *state.member_token.lock().unwrap() = None;
    *state.current_user.lock().unwrap() = None;

    // Audit logout
    info!("[AUTH] Member {:?} logged out", actor_name);
    let _ = crate::audit_store::write_event(
        &app,
        crate::audit_store::AuditLevel::Info,
        "LOGOUT",
        actor_id,
        actor_name,
        location_id,
        None,
        serde_json::Value::Null,
    );

    Ok(())
}

#[tauri::command]
pub async fn get_device_config(
    state: State<'_, AuthState>,
) -> Result<Option<SanitizedDeviceConfig>, String> {
    let config_guard = state.device_config.lock().map_err(|_| "Lock error")?;
    Ok(config_guard.as_ref().map(|c| SanitizedDeviceConfig {
        location_id: c.location_id.clone(),
        allow_negative_stock: c.allow_negative_stock,
    }))
}

#[tauri::command]
pub async fn authenticated_api_request(
    state: State<'_, AuthState>,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let req_method = match method.to_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        _ => return Err(format!("Unsupported method: {}", method)),
    };

    // 1. Build Request (handles URL formatting and all headers including Member-Id)
    let mut request = state.build_request(req_method, &path)?;

    if let Some(b) = body {
        request = request.json(&b);
    }

    // 2. Send and handle response
    let res = request
        .send()
        .await
        .map_err(|e| format!("Proxy request failed: {}", e))?;

    let status = res.status();
    if !status.is_success() {
        let err_body = res.text().await.unwrap_or_default();
        return Err(format!("API Error {}: {}", status, err_body));
    }

    let json_res: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Invalid JSON response: {}", e))?;
    Ok(json_res)
}

#[tauri::command]
pub async fn restore_member_session(
    state: State<'_, AuthState>,
    member: MemberProfile,
) -> Result<(), String> {
    // If we have a token (loaded from keyring), but no member in memory, sync them
    *state.current_user.lock().unwrap() = Some(member);
    Ok(())
}

#[tauri::command]
pub async fn reset_device_config(state: State<'_, AuthState>) -> Result<(), String> {
    // 1. Clear Keyring
    let keyring_del = (|| -> Result<(), String> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())?;
        entry.delete_password().map_err(|e| e.to_string())?;
        Ok(())
    })();

    if let Err(e) = keyring_del {
        eprintln!(
            "[AuthStore] Optional Keyring delete failed (might not exist): {}",
            e
        );
    }

    // 2. Clear File
    if let Some(path) = AuthState::get_config_path() {
        if path.exists() {
            let _ = tokio::fs::remove_file(path).await;
        }
    }

    // 3. Clear Memory
    *state.device_config.lock().unwrap() = None;
    *state.member_token.lock().unwrap() = None;
    *state.current_user.lock().unwrap() = None;

    println!("[AuthStore] Device configuration reset complete.");
    Ok(())
}

// --- NEW COMMANDS FOR REFACTOR ---

#[tauri::command]
pub async fn start_device_setup_command(
    state: State<'_, AuthState>,
    network_state: State<'_, crate::network_monitor::NetworkState>,
    base_url: String,
    device_key: String,
) -> Result<(), String> {
    // We store a partial config (no location_id yet) in memory
    // This allows get_locations_command to work using build_request
    let mut config = state.device_config.lock().map_err(|_| "Lock error")?;
    *config = Some(DeviceConfig {
        base_url: base_url.clone(),
        location_id: String::new(), // Empty for now
        device_key,
        allow_negative_stock: false, // Default for setup
    });

    // Update network monitor
    network_state.set_base_url(base_url);

    Ok(())
}

#[tauri::command]
pub async fn set_negative_stock_command(
    state: tauri::State<'_, AuthState>,
    allow: bool,
) -> Result<(), String> {
    // 1. Isolate the Mutex lock in its own block to drop it before awaiting
    let config_to_save = {
        let mut config_guard = state.device_config.lock().map_err(|_| "Lock error")?;

        if let Some(config) = config_guard.as_mut() {
            config.allow_negative_stock = allow;
            Some(config.clone()) // Clone the data so we can use it safely outside the lock
        } else {
            None
        }
    }; // <-- config_guard is strictly dropped right here.

    // 2. Await the async save operation without holding the lock
    if let Some(config) = config_to_save {
        AuthState::save_to_keyring_async(&config)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        return Err("Device not configured".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn get_locations_command(
    state: State<'_, AuthState>,
) -> Result<serde_json::Value, String> {
    let request =
        state.build_request(reqwest::Method::GET, crate::api_config::routes::LOCATIONS)?;

    let res = request
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = res.status();
    if !status.is_success() {
        let err_body = res.text().await.unwrap_or_default();
        return Err(format!(
            "Failed to fetch locations: {} - {}",
            status, err_body
        ));
    }

    let data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    Ok(data)
}

#[tauri::command]
pub async fn get_ably_auth_token_command(
    state: State<'_, AuthState>,
    params: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let mut request =
        match state.build_request(reqwest::Method::POST, crate::api_config::routes::ABLY_AUTH) {
            Ok(req) => req,
            Err(e) => {
                println!("[AuthStore] Failed to build request: {}", e);
                return Err(e);
            }
        };

    // If params are provided, send them in body
    if let Some(p) = params {
        request = request.json(&serde_json::json!({ "params": p }));
    } else {
        // Ensure we send an empty JSON object if server expects JSON
        request = request.json(&serde_json::json!({}));
    }

    let res = request.send().await.map_err(|e| {
        println!("[AuthStore] Network request failed: {}", e);
        format!("Network error: {}", e)
    })?;

    let status = res.status();
    println!("[AuthStore] Response Status: {}", status);

    if !status.is_success() {
        let err_body = res.text().await.unwrap_or_default();
        println!("[AuthStore] Error Body: {}", err_body);
        return Err(format!("Ably auth failed: {} - {}", status, err_body));
    }

    let data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    Ok(data)
}
#[tauri::command]
pub async fn update_device_location(
    state: State<'_, AuthState>,
    location_id: String,
) -> Result<(), String> {
    let config_to_save = {
        let mut config_guard = state.device_config.lock().map_err(|_| "Lock error")?;
        let config = config_guard.as_mut().ok_or("Device not configured")?;
        config.location_id = location_id;
        config.clone()
    };

    AuthState::save_to_keyring_async(&config_to_save)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
