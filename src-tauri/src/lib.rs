use hidapi::HidApi;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_printer_v2::init;

#[derive(Clone, serde::Serialize)]
struct ScanPayload {
    message: String,
}

// --- NEW: Command to open/manage the Customer Window ---
#[tauri::command]
async fn open_customer_screen(app: AppHandle) -> Result<(), String> {
    let window_label = "customer";

    // 1. Check if window exists
    if let Some(window) = app.get_webview_window(window_label) {
        // If it exists, just focus it and return
        let _ = window.set_focus();
        return Ok(());
    }

    // 2. Create the window HIDDEN to prevent flashing on the wrong screen
    let builder = WebviewWindowBuilder::new(
        &app,
        window_label,
        WebviewUrl::App("/customer".into()), 
    )
    .title("Customer Display")
    .visible(false) // <--- CRITICAL: Start hidden
    .decorations(false)
    .skip_taskbar(true)
    .inner_size(800.0, 600.0);

    let window = builder.build().map_err(|e| e.to_string())?;

    // 3. Detect Monitors and Move
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    println!("[Screen] Found {} monitors", monitors.len());

    if monitors.len() > 1 {
        // Simple heuristic: Take the second monitor in the list
        // (For production, you might want to filter for m.name() or coordinates)
        let secondary_monitor = &monitors[1];
        let pos = secondary_monitor.position();

        println!("[Screen] Moving to monitor at {:?}", pos);
        
        // Move window to the secondary monitor's coordinate space
        window.set_position(*pos).map_err(|e| e.to_string())?;
        
        // Fullscreen it there
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
    } 

    // 4. Show the window ONLY after it is in the correct position
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;

    Ok(())
}

// Helper command to list devices ---
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

// The Main Scanner Command ---
#[tauri::command]
fn start_scan(app: AppHandle, vid_hex: String, pid_hex: String) -> Result<String, String> {
    let vid = u16::from_str_radix(vid_hex.trim_start_matches("0x"), 16)
        .map_err(|_| "Invalid Vendor ID format")?;
    let pid = u16::from_str_radix(pid_hex.trim_start_matches("0x"), 16)
        .map_err(|_| "Invalid Product ID format")?;

    println!("[Scanner] Connecting to VID: {:04X}, PID: {:04X}", vid, pid);

    tauri::async_runtime::spawn(async move {
        let api = match HidApi::new() {
            Ok(api) => api,
            Err(e) => {
                eprintln!("[Scanner] HID API Init Error: {}", e);
                return;
            }
        };

        let device = match api.open(vid, pid) {
            Ok(dev) => dev,
            Err(e) => {
                let _ = app.emit("scanner-error", format!("Could not open device: {}", e));
                return;
            }
        };

        let _ = app.emit("scanner-status", "Connected");
        println!("[Scanner] Device connected.");

        let mut buf = [0u8; 64];
        let mut string_buffer = String::new();

        loop {
            match device.read_timeout(&mut buf, 1000) {
                Ok(bytes_read) => {
                    if bytes_read > 0 {
                        let data_chunk = String::from_utf8_lossy(&buf[..bytes_read]);
                        string_buffer.push_str(&data_chunk);

                        if string_buffer.contains('\n') {
                            let parts: Vec<&str> = string_buffer.split('\n').collect();
                            for i in 0..parts.len() - 1 {
                                let code = parts[i].trim();
                                if !code.is_empty() {
                                    println!("[Scanner] Code detected: {}", code);
                                    let _ = app.emit("scanner-data", ScanPayload { message: code.to_string() });
                                }
                            }
                            string_buffer = parts.last().unwrap_or(&"").to_string();
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
        // REGISTER NEW COMMAND HERE
        .invoke_handler(tauri::generate_handler![
            start_scan, 
            list_hid_devices, 
            open_customer_screen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}