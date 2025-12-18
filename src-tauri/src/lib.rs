use hidapi::HidApi;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};
use tauri_plugin_printer_v2::init;
use std::thread;
use std::time::Duration;
use pcsc::{Context, Protocols, ReaderState, Scope, ShareMode, State as PcscState, PNP_NOTIFICATION};
use std::io::Write;

mod models;
mod store;
use store::ProductState;

#[derive(Clone, serde::Serialize)]
struct ScanPayload {
    message: String,
}

#[tauri::command]
async fn sync_products_command(
    app: AppHandle,
    state: State<'_, ProductState>,
    base_url: String,
    location_id: String,
    device_key: Option<String>,
    member_token: Option<String>
) -> Result<String, String> {
    match store::run_sync(app, &state, base_url, location_id, device_key, member_token).await {
        Ok(count) => {
            Ok(format!("Synced {} products", count))
        },
        Err(e) => {
            // We still convert the error to a string so the frontend can display it
            Err(e.to_string())
        }
    }
}

#[tauri::command]
fn search_products_command(
    state: State<'_, ProductState>,
    query: String,
    category: String
) -> Vec<models::PosProduct> {
    store::search_local(&state, query, category)
}

// --- Command to open/manage the Customer Window ---
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

#[tauri::command]
fn start_nfc_listener(app: AppHandle) {
    thread::spawn(move || {
        // Establish the PC/SC Context
        let ctx = match Context::establish(Scope::User) {
            Ok(ctx) => ctx,
            Err(_) => return, // Handle error appropriately
        };

        let mut readers_buf = [0; 2048];
        let mut reader_states = vec![
            // Listen for reader insertions/removals
            ReaderState::new(PNP_NOTIFICATION(), PcscState::UNAWARE),
        ];

        loop {
            // Wait for state changes (blocking to save CPU)
            if ctx.get_status_change(Some(Duration::from_millis(1000)), &mut reader_states).is_ok() {
                
                // Get list of connected readers
                if let Ok(readers) = ctx.list_readers(&mut readers_buf) {
                    for reader in readers {
                        // Connect to the card
                        if let Ok(card) = ctx.connect(reader, ShareMode::Shared, Protocols::ANY) {
                            // Get the Card UID (The "Member ID")
                            // Standard command to get UID: 0xFF, 0xCA, 0x00, 0x00, 0x00
                            let apdu = [0xFF, 0xCA, 0x00, 0x00, 0x00];
                            let mut rapdu_buf = [0; 256];

                            if let Ok(rapdu) = card.transmit(&apdu, &mut rapdu_buf) {
                                // Convert bytes to hex string
                                let uid: String = rapdu.iter()
                                    .map(|b| format!("{:02X}", b))
                                    .collect();
                                
                                // Clean up status bytes (usually last 2 bytes like 90 00)
                                let clean_uid = &uid[0..uid.len()-4]; 

                                // Emit to Frontend
                                app.emit("nfc-read", clean_uid).unwrap();
                                
                                // Sleep briefly to prevent spamming the same read
                                thread::sleep(Duration::from_secs(2));
                            }
                        }
                    }
                }
            }
        }
    });
}

// 1. Command to list available ports (so user can select the printer)
#[tauri::command]
fn get_serial_ports() -> Result<Vec<String>, String> {
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
fn open_cash_drawer(port_name: String) -> Result<String, String> {
    // ESC/POS Command to kick drawer
    // Decimal: 27, 112, 0, 25, 250
    // Hex: 1B 70 00 19 FA
    // 1B 70: Command
    // 00: Pin 2 (usually)
    // 19: Pulse ON time (25 * 2ms = 50ms)
    // FA: Pulse OFF time (250 * 2ms = 500ms)
    let kick_code = [0x1B, 0x70, 0x00, 0x19, 0xFA];

    match serialport::new(&port_name, 9600)
        .timeout(Duration::from_millis(100))
        .open() 
    {
        Ok(mut port) => {
            // Write the kick code to the printer
            match port.write(&kick_code) {
                Ok(_) => Ok("Drawer signal sent".into()),
                Err(e) => Err(format!("Failed to write to printer: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to open port {}: {}", port_name, e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProductState::new()) // Initialize State
            .setup(|app| {
                // Load data from disk immediately on app launch
                let state = app.state::<ProductState>();
                if let Err(e) = store::load_products_from_disk(app.handle(), &state) {
                    eprintln!("Failed to load initial data: {}", e);
                }

                // --- System Tray Configuration ---
                let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let show_i = MenuItem::with_id(app, "show", "Show Main Window", true, None::<&str>)?;
                let hide_i = MenuItem::with_id(app, "hide", "Hide Main Window", true, None::<&str>)?;
                let customer_i = MenuItem::with_id(app, "customer", "Open Customer Display", true, None::<&str>)?;
                let sep = PredefinedMenuItem::separator(app)?;
                
                let menu = Menu::with_items(app, &[&show_i, &hide_i, &customer_i, &sep, &quit_i])?;

                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| {
                        match event.id.as_ref() {
                            "quit" => {
                                app.exit(0);
                            }
                            "show" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            "hide" => {
                               if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.hide();
                                }
                            }
                            "customer" => {
                                let app_handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = open_customer_screen(app_handle).await;
                                });
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                         match event {
                            TrayIconEvent::Click {
                                button: MouseButton::Left,
                                ..
                            } => {
                                let app = tray.app_handle();
                                 if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            _ => {
                            }
                         }

                    })
                    .build(app)?;

                Ok(())
            })
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
            open_customer_screen,
            sync_products_command,
            search_products_command,
            start_nfc_listener,
            get_serial_ports, 
            open_cash_drawer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}