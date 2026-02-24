use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;

use crate::models::PrinterError;

// --- CONFIGURATION STRUCTS ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrinterConfig {
    /// The type of connection: "system" or "network"
    #[serde(rename = "type")]
    pub method: String,

    /// For system: the printer name (e.g., "EPSON TM-T20").
    /// For network: the IP address (e.g., "192.168.1.50").
    pub target: String,

    /// Only used for network printers (defaults to 9100 if missing)
    pub port: Option<u16>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PrinterSettings {
    pub receipt_printer: Option<PrinterConfig>,
    pub kitchen_printer: Option<PrinterConfig>,
    pub bar_printer: Option<PrinterConfig>,
}

// Helper to get the path where we save settings
fn get_settings_path<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    app.path()
        .app_config_dir()
        .expect("Could not resolve app config dir")
        .join("printer_settings.json")
}

// --- NETWORK HELPER ---

async fn print_network_raw(
    ip: String,
    port: Option<u16>,
    content: String,
) -> Result<String, PrinterError> {
    let port = port.unwrap_or(9100);
    let address = format!("{}:{}", ip, port);

    // 1. Enforce a connection timeout (5 seconds)
    let stream_result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        TcpStream::connect(&address),
    )
    .await;

    let mut stream = match stream_result {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => return Err(PrinterError::ConnectionFailed(e.to_string())),
        Err(_) => return Err(PrinterError::Timeout),
    };

    // 2. Write content bytes
    if let Err(e) = stream.write_all(content.as_bytes()).await {
        return Err(PrinterError::SystemError(format!(
            "Network Write Error: {}",
            e
        )));
    }

    // 3. Flush
    if let Err(e) = stream.flush().await {
        return Err(PrinterError::SystemError(format!(
            "Network Flush Error: {}",
            e
        )));
    }

    Ok("Network print job sent successfully".into())
}

// --- COMMANDS ---

#[tauri::command]
pub async fn get_system_printers() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let output = tokio::process::Command::new("powershell")
            .args([
                "-Command",
                "Get-Printer | Select-Object -ExpandProperty Name",
            ])
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
pub async fn save_printer_config(app: AppHandle, config: PrinterSettings) -> Result<(), String> {
    let path = get_settings_path(&app);

    // Ensure the directory exists
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    tokio::fs::write(path, json)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_printer_config(app: AppHandle) -> Result<PrinterSettings, String> {
    let path = get_settings_path(&app);

    if !path.exists() {
        return Ok(PrinterSettings::default());
    }

    let data = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| e.to_string())?;

    // Attempt to parse. If the structure changed (string -> struct),
    // this might fail for old configs. You might want to handle fallback here
    // or assume the user will re-save settings.
    let config: PrinterSettings = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    Ok(config)
}

#[tauri::command]
pub async fn print_job(
    app: AppHandle,
    job_type: String, // "receipt", "kitchen", "bar"
    content: String,  // Can be raw text or a file path
    is_path: bool,    // Flag to distinguish text vs file
) -> Result<String, PrinterError> {
    // 1. Load the config
    let config = get_printer_config(app.clone())
        .await
        .map_err(PrinterError::SystemError)?;

    // 2. Determine which printer config to use
    let target_config = match job_type.as_str() {
        "receipt" => config.receipt_printer,
        "kitchen" => config.kitchen_printer,
        "bar" => config.bar_printer,
        _ => {
            return Err(PrinterError::SystemError(format!(
                "Unknown job type: {}",
                job_type
            )))
        }
    };

    // 3. Execute Print based on type
    if let Some(printer) = target_config {
        match printer.method.as_str() {
            "network" => {
                // For network, we usually expect raw content/ESC-POS.
                // If 'is_path' is true, we assume the file content should be read and sent,
                // or (simpler) that the 'content' string IS the data to send.
                // Here we assume 'content' holds the data or ESC/POS commands.
                print_network_raw(printer.target, printer.port, content).await
            }
            "system" | _ => {
                // Use the existing system printer logic in lib.rs
                // printer.target holds the System Printer Name
                crate::print_system_receipt(app, printer.target, content, is_path).await
            }
        }
    } else {
        Err(PrinterError::SystemError(format!(
            "No printer configured for {}",
            job_type
        )))
    }
}
