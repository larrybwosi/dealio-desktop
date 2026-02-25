use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};
use tempfile::Builder;
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
                // Use the existing system printer logic
                // printer.target holds the System Printer Name
                print_system_receipt(app, printer.target, content, is_path).await
            }
        }
    } else {
        Err(PrinterError::SystemError(format!(
            "No printer configured for {}",
            job_type
        )))
    }
}

// 1. Command to list available ports (so user can select the printer)
#[tauri::command]
pub fn get_serial_ports() -> Result<Vec<String>, String> {
    match serialport::available_ports() {
        Ok(ports) => {
            let port_names: Vec<String> = ports.iter().map(|p| p.port_name.clone()).collect();
            Ok(port_names)
        }
        Err(e) => Err(format!("Error listing ports: {}", e)),
    }
}

// 2. Command to Open the Drawer
#[tauri::command]
pub fn open_cash_drawer(port_name: String) -> Result<String, String> {
    // ESC/POS Command to kick drawer
    // Decimal: 27, 112, 0, 25, 250
    // Hex: 1B 70 00 19 FA
    let kick_code = [0x1B, 0x70, 0x00, 0x19, 0xFA];

    match serialport::new(&port_name, 9600)
        .timeout(std::time::Duration::from_millis(100))
        .open()
    {
        Ok(mut port) => {
            // Write the kick code to the printer
            match port.write_all(&kick_code) {
                Ok(_) => Ok("Drawer signal sent".into()),
                Err(e) => Err(format!("Failed to write to printer: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to open port {}: {}", port_name, e)),
    }
}

// --- Method 1: Network (TCP) ---
#[tauri::command]
pub async fn print_network_receipt(
    ip: String,
    port: Option<u16>,
    text: String,
) -> Result<String, PrinterError> {
    let port = port.unwrap_or(9100);
    let address = format!("{}:{}", ip, port);

    // 1. Enforce a connection timeout
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

    // 2. Write with async
    stream.write_all(text.as_bytes()).await?;
    stream.flush().await?;

    Ok("Network print job sent successfully".into())
}

// --- Method 2: OS Driver (Shell) ---
#[tauri::command]
pub async fn print_system_receipt(
    _app: AppHandle,
    printer_name: String,
    content: String,
    is_path: bool,
) -> Result<String, PrinterError> {
    // Logic: If it's already a file path (PDF), use it.
    // If it's raw text, write it to a temp file with a specific extension (.txt).
    let file_to_print = if is_path {
        // Verify file exists
        let path = std::path::PathBuf::from(&content);
        if !path.exists() {
            return Err(PrinterError::SystemError(format!(
                "File not found: {}",
                content
            )));
        }
        content
    } else {
        // FIX: Use Builder to add a ".txt" suffix.
        // SumatraPDF requires an extension to know how to render the file.
        let mut temp_file = Builder::new()
            .suffix(".txt")
            .tempfile()
            .map_err(|e| PrinterError::SystemError(format!("Temp file creation failed: {}", e)))?;

        // Write content to the file
        temp_file.write_all(content.as_bytes()).map_err(|e| {
            PrinterError::SystemError(format!("Failed to write to temp file: {}", e))
        })?;

        // Persist the file so the external process (Sumatra/lp) can read it
        let (_, path) = temp_file.keep().map_err(|e| {
            PrinterError::SystemError(format!("Failed to persist temp file: {}", e))
        })?;

        path.to_string_lossy().to_string()
    };

    #[cfg(target_os = "windows")]
    {
        use tauri_plugin_shell::ShellExt;

        // SumatraPDF arguments for silent printing
        let args = vec![
            "-print-to".to_string(),
            printer_name,
            "-silent".to_string(),
            "-print-settings".to_string(),
            "noscale".to_string(),
            file_to_print.clone(), // Clone path string for the args
        ];

        let command = app
            .shell()
            .sidecar("sumatrapdf")
            .map_err(|e| PrinterError::SystemError(format!("Sidecar config error: {}", e)))?
            .args(&args);

        let (mut _rx, _child) = command
            .spawn()
            .map_err(|e| PrinterError::SystemError(format!("Failed to spawn SumatraPDF: {}", e)))?;

        Ok("Sent to SumatraPDF sidecar".into())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Linux/Mac: Use 'lp' (CUPS), which supports text and PDF natively
        let output = std::process::Command::new("lp")
            .arg("-d")
            .arg(&printer_name)
            .arg(&file_to_print)
            // optional: "-o raw" if you are sending raw ESC/POS codes,
            // but for plain text/PDF, omit it.
            .output()
            .map_err(|e| PrinterError::SystemError(format!("Failed to execute lp: {}", e)))?;

        if output.status.success() {
            Ok("Sent to CUPS".into())
        } else {
            Err(PrinterError::SystemError(format!(
                "CUPS failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )))
        }
    }
}

#[tauri::command]
pub async fn print_usb(vid: u16, pid: u16, text: String) -> Result<String, PrinterError> {
    tokio::task::spawn_blocking(move || {
        // Explicitly use imports here to fix E0433
        use escpos_rs::{Printer, PrinterProfile};

        let profile = PrinterProfile::usb_builder(vid, pid).build();

        match Printer::new(profile) {
            Ok(maybe_printer) => {
                // FIX E0599: Compiler says this is Option<Printer>, so we unwrap it
                let printer = maybe_printer.expect("Failed to initialize printer instance");

                match printer.print(&text) {
                    Ok(_) => {
                        // Attempt cut
                        let _ = printer.cut();
                        Ok("USB print sent successfully".into())
                    }
                    Err(e) => Err(PrinterError::SystemError(format!("USB Write Error: {}", e))),
                }
            }
            Err(_e) => Err(PrinterError::UsbDeviceNotFound(vid, pid)),
        }
    })
    .await
    .map_err(|_| PrinterError::SystemError("Task Join Error".into()))?
}