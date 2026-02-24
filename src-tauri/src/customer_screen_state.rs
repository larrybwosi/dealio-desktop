use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CustomerScreenConfig {
    pub enabled: bool,
}

pub struct CustomerScreenState {
    config: Mutex<CustomerScreenConfig>,
}

impl CustomerScreenState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(CustomerScreenConfig::default()),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.config
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .enabled
    }

    pub fn set_enabled(&self, enabled: bool) {
        let mut config = self.config.lock().unwrap_or_else(|e| e.into_inner());
        config.enabled = enabled;
    }

    pub fn get_config(&self) -> CustomerScreenConfig {
        self.config
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    async fn get_store_path(app: &AppHandle) -> Result<PathBuf, String> {
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        if !app_data.exists() {
            tokio::fs::create_dir_all(&app_data)
                .await
                .map_err(|e| format!("Failed to create app data dir: {}", e))?;
        }

        Ok(app_data.join("customer_screen_state.json"))
    }

    pub async fn save_to_store(&self, app: &AppHandle) -> Result<(), String> {
        let path = Self::get_store_path(app).await?;
        let config = self.get_config();
        let json = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        tokio::fs::write(&path, json)
            .await
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        Ok(())
    }

    pub async fn load_from_store(&self, app: &AppHandle) -> Result<(), String> {
        let path = Self::get_store_path(app).await?;

        if !path.exists() {
            // No saved state, use default
            return Ok(());
        }

        let json = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        let config: CustomerScreenConfig = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to deserialize config: {}", e))?;

        let mut current_config = self.config.lock().unwrap_or_else(|e| e.into_inner());
        *current_config = config;

        Ok(())
    }
}
