use tauri::{AppHandle, Manager, Runtime};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::models::PrinterError;
// use crate::print_system_receipt;

// Define the jobs you want to support
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PrinterSettings {
    pub receipt_printer: Option<String>,
    pub kitchen_printer: Option<String>,
    pub bar_printer: Option<String>,
}

// Helper to get the path where we save settings
fn get_settings_path<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    app.path()
        .app_config_dir()
        .expect("Could not resolve app config dir")
        .join("printer_settings.json")
}

// --- COMMANDS ---

#[tauri::command]
pub async fn get_system_printers() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let output = tokio::process::Command::new("powershell")
            .args(["-Command", "Get-Printer | Select-Object -ExpandProperty Name"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let text = String::from_utf8_lossy(&output.stdout);
        let printers: Vec<String> = text
            .lines()
            .map(|line| line.trim().to_string())
            .filter(|line| !line.is_empty())
            .collect();

        Ok(printers)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = tokio::process::Command::new("lpstat")
            .arg("-e")
            .output()
            .await
            .map_err(|e| e.to_string())?;

        let text = String::from_utf8_lossy(&output.stdout);
        let printers: Vec<String> = text
            .lines()
            .map(|line| line.trim().to_string())
            .filter(|line| !line.is_empty())
            .collect();

        Ok(printers)
    }
}

#[tauri::command]
pub async fn save_printer_config(
    app: AppHandle,
    config: PrinterSettings
) -> Result<(), String> {
    let path = get_settings_path(&app);
    
    // Ensure the directory exists
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    tokio::fs::write(path, json).await.map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_printer_config(app: AppHandle) -> Result<PrinterSettings, String> {
    let path = get_settings_path(&app);
    
    if !path.exists() {
        return Ok(PrinterSettings::default());
    }

    let data = tokio::fs::read_to_string(path).await.map_err(|e| e.to_string())?;
    let config: PrinterSettings = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    
    Ok(config)
}

#[tauri::command]
pub async fn print_job(
    app: AppHandle,
    job_type: String, // "receipt", "kitchen", "bar"
    content: String,  // Can be raw text or a file path
    is_path: bool     // New flag to distinguish text vs file
) -> Result<String, PrinterError> {
    
    // 1. Load the config
    // FIX: Clone 'app' here because get_printer_config consumes it, 
    // but we need 'app' again for step 3.
    let config = get_printer_config(app.clone()) 
        .await
        .map_err(PrinterError::SystemError)?;
    
    // 2. Determine which printer to use based on job_type
    let target_printer = match job_type.as_str() {
        "receipt" => config.receipt_printer,
        "kitchen" => config.kitchen_printer,
        "bar" => config.bar_printer,
        _ => return Err(PrinterError::SystemError(format!("Unknown job type: {}", job_type))),
    };

    // 3. Print
    if let Some(printer_name) = target_printer {
        // FIX: Pass 'app' as the first argument
        crate::print_system_receipt(app, printer_name, content, is_path).await
    } else {
        Err(PrinterError::SystemError(format!("No printer configured for {}", job_type)))
    }
}