use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use log::info;

/// Network status state
#[derive(Clone)]
pub struct NetworkState {
    pub is_online: Arc<Mutex<bool>>,
    pub last_check: Arc<Mutex<std::time::Instant>>,
    pub base_url: Arc<Mutex<Option<String>>>,
}

impl NetworkState {
    pub fn new() -> Self {
        Self {
            is_online: Arc::new(Mutex::new(false)),
            last_check: Arc::new(Mutex::new(std::time::Instant::now())),
            base_url: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_base_url(&self, url: String) {
        let mut base = self.base_url.lock().unwrap();
        *base = Some(url);
    }
}

/// Check if the API endpoint or the base URL is reachable
pub async fn check_network_status(base_url: &str) -> bool {
    let clean_base = base_url.trim_end_matches("/api/v1/health");
    let health_url = format!("{}/api/v1/health", clean_base);
    
    // Try a simple GET request with short timeout
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build();
    
    let client = match client {
        Ok(c) => c,
        Err(_) => return false,
    };

    // 1. Try health endpoint
    match client.get(&health_url).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                return true;
            }
            // If 404 or 405, it might just be that the endpoint isn't implemented.
            // Proceed to check the base URL.
        },
        Err(_) => {
            // Transient network error or host unreachable
        }
    }

    // 2. Fallback: Try base URL
    match client.get(clean_base).send().await {
        Ok(resp) => resp.status().is_success() || resp.status().is_redirection(),
        Err(_) => false,
    }
}

/// Start periodic network monitoring
pub fn start_network_monitor(
    app: AppHandle,
    network_state: Arc<NetworkState>,
    check_interval_secs: u64,
) {
    tauri::async_runtime::spawn(async move {
        // We still keep the interval but maybe make it less aggressive or 
        // use it as a fallback if Ably isn't active.
        let mut interval = tokio::time::interval(Duration::from_secs(check_interval_secs));
        
        loop {
            interval.tick().await;
            
            let base_url = {
                let guard = network_state.base_url.lock().unwrap();
                guard.clone()
            };

            // If we are already online (e.g., via Ably), we might skip the ping to save resources,
            // but a periodic health check isn't bad as a fallback.
            let is_online = if let Some(url) = base_url {
                check_network_status(&url).await
            } else {
                false
            };
            
            update_internal_status(&app, &network_state, is_online);
        }
    });
}

/// Internal helper to update status and emit events
fn update_internal_status(app: &AppHandle, network_state: &Arc<NetworkState>, is_online: bool) {
    let mut current_status = network_state.is_online.lock().unwrap();
    let previous_status = *current_status;
    
    if previous_status == is_online {
        // Update last check time even if status didn't change
        *network_state.last_check.lock().unwrap() = std::time::Instant::now();
        return;
    }

    *current_status = is_online;
    drop(current_status);
    
    // Update last check time
    *network_state.last_check.lock().unwrap() = std::time::Instant::now();
    
    // Emit event if status changed
    info!("[NetworkMonitor] Status changed: {} -> {}", 
        if previous_status { "Online" } else { "Offline" },
        if is_online { "Online" } else { "Offline" }
    );
    
    let _ = app.emit("network-status-changed", is_online);
    
    // If we just came online, trigger sync
    if is_online && !previous_status {
        info!("[NetworkMonitor] Connection restored. Triggering sales sync...");
        let _ = app.emit("trigger-sales-sync", ());
    }
}

/// Tauri command to manually update network status (e.g., from Ably events)
#[tauri::command]
pub fn update_network_status_command(
    app: AppHandle,
    state: tauri::State<'_, NetworkState>,
    is_online: bool
) {
    let network_state = Arc::new(state.inner().clone());
    update_internal_status(&app, &network_state, is_online);
}

/// Tauri command to get current network status
#[tauri::command]
pub fn get_network_status_command(state: tauri::State<'_, NetworkState>) -> bool {
    *state.is_online.lock().unwrap()
}
