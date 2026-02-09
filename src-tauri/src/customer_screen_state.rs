use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerScreenConfig {
    pub enabled: bool,
}

impl Default for CustomerScreenConfig {
    fn default() -> Self {
        Self { enabled: false }
    }
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
        self.config.lock().unwrap().enabled
    }

    pub fn set_enabled(&self, enabled: bool) {
        let mut config = self.config.lock().unwrap();
        config.enabled = enabled;
    }

    pub fn get_config(&self) -> CustomerScreenConfig {
        self.config.lock().unwrap().clone()
    }

    fn get_store_path(app: &AppHandle) -> Result<PathBuf, String> {
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        if !app_data.exists() {
            fs::create_dir_all(&app_data)
                .map_err(|e| format!("Failed to create app data dir: {}", e))?;
        }

        Ok(app_data.join("customer_screen_state.json"))
    }

    pub fn save_to_store(&self, app: &AppHandle) -> Result<(), String> {
        let path = Self::get_store_path(app)?;
        let config = self.get_config();
        let json = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(&path, json)
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        Ok(())
    }

    pub fn load_from_store(&self, app: &AppHandle) -> Result<(), String> {
        let path = Self::get_store_path(app)?;

        if !path.exists() {
            // No saved state, use default
            return Ok(());
        }

        let json = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        let config: CustomerScreenConfig = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to deserialize config: {}", e))?;

        let mut current_config = self.config.lock().unwrap();
        *current_config = config;

        Ok(())
    }
}
