use hidapi::HidApi;
use tauri::{AppHandle, Emitter};
use tauri_plugin_printer_v2::init;

// Define the payload structure for the event
#[derive(Clone, serde::Serialize)]
struct ScanPayload {
    message: String,
}

// 1. Helper command to list devices so the frontend knows what is available
#[tauri::command]
fn list_hid_devices() -> Result<Vec<(u16, u16, String)>, String> {
    let api = HidApi::new().map_err(|e| e.to_string())?;
    let mut devices = Vec::new();

    for device in api.device_list() {
        let name = device
            .product_string()
            .unwrap_or("Unknown Device")
            .to_string();
        devices.push((device.vendor_id(), device.product_id(), name));
    }
    Ok(devices)
}

// 2. The Main Scanner Command
#[tauri::command]
fn start_scan(app: AppHandle, vid_hex: String, pid_hex: String) -> Result<String, String> {
    // Parse Hex strings from frontend (e.g., "0xE851") to u16
    let vid = u16::from_str_radix(vid_hex.trim_start_matches("0x"), 16)
        .map_err(|_| "Invalid Vendor ID format")?;
    let pid = u16::from_str_radix(pid_hex.trim_start_matches("0x"), 16)
        .map_err(|_| "Invalid Product ID format")?;

    println!(
        "[Scanner] Attempting to connect to VID: {:04X}, PID: {:04X}",
        vid, pid
    );

    // Spawn the listener in a separate thread to not block the main UI
    tauri::async_runtime::spawn(async move {
        let api = match HidApi::new() {
            Ok(api) => api,
            Err(e) => {
                eprintln!("[Scanner] HID API Init Error: {}", e);
                return;
            }
        };

        // Try to open the device
        let device = match api.open(vid, pid) {
            Ok(dev) => dev,
            Err(e) => {
                let _ = app.emit("scanner-error", format!("Could not open device: {}", e));
                return;
            }
        };

        let _ = app.emit("scanner-status", "Connected");
        println!("[Scanner] Device connected.");

        // Optimized Buffer Logic
        let mut buf = [0u8; 64];
        let mut string_buffer = String::new();

        loop {
            // Read with a timeout to allow the loop to check for exit conditions if needed
            match device.read_timeout(&mut buf, 1000) {
                Ok(bytes_read) => {
                    if bytes_read > 0 {
                        let data_chunk = String::from_utf8_lossy(&buf[..bytes_read]);

                        // HID scanners often send characters one by one or in chunks.
                        // We append to a buffer until we hit a newline (Enter key).
                        string_buffer.push_str(&data_chunk);

                        if string_buffer.contains('\n') {
                            // Split by newline in case multiple scans came in fast
                            let parts: Vec<&str> = string_buffer.split('\n').collect();

                            // The last part is either empty (if ended with \n) or incomplete data
                            // We process everything except the last part
                            for i in 0..parts.len() - 1 {
                                let code = parts[i].trim();
                                if !code.is_empty() {
                                    println!("[Scanner] Code detected: {}", code);
                                    let _ = app.emit(
                                        "scanner-data",
                                        ScanPayload {
                                            message: code.to_string(),
                                        },
                                    );
                                }
                            }

                            // Keep the remaining incomplete part in the buffer
                            let remaining = parts.last().unwrap_or(&"").to_string();
                            string_buffer = remaining;
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[Scanner] Read Error: {}", e);
                    let _ = app.emit("scanner-status", "Disconnected");
                    break;
                }
            }
        }
    });

    Ok("Scanner listener started successfully".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_websocket::init())
        .plugin(init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_hid::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        // REGISTER YOUR COMMANDS HERE
        .invoke_handler(tauri::generate_handler![start_scan, list_hid_devices])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
