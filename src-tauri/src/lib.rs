// use escpos_rs::{Printer, PrinterProfile};
use hidapi::HidApi;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};
use std::thread;
use std::time::Duration;
use pcsc::{Context, Protocols, ReaderState, Scope, ShareMode, State as PcscState, PNP_NOTIFICATION};
use std::io::Write;
use tempfile::Builder;

use tokio::net::TcpStream;
use tokio::io::AsyncWriteExt;

use models::PrinterError;
mod models;
mod product_store;
use product_store::ProductState;

mod customer_store;
use customer_store::CustomerState;

mod sales_store;
use sales_store::SalesState;

mod pricing_store;
use pricing_store::PricingState;

mod printer_manager;

mod shift_store;
use shift_store::ShiftState;
use models::Shift;

mod auth_store;
use auth_store::AuthState;

mod security;

#[derive(Clone, serde::Serialize)]
struct ScanPayload {
    message: String,
}

#[tauri::command]
async fn sync_products_command(
    app: AppHandle,
    state: State<'_, ProductState>,
    auth_state: State<'_, AuthState>
) -> Result<String, String> {
    match product_store::run_sync(app, &state, &auth_state).await {
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
    product_store::search_local(&state, query, category)
}

// --- CUSTOMER COMMANDS ---

#[tauri::command]
async fn sync_customers_command(
    app: AppHandle,
    state: State<'_, CustomerState>,
    auth_state: State<'_, AuthState>
) -> Result<String, String> {
    match customer_store::run_sync(app, &state, &auth_state).await {
        Ok(count) => Ok(format!("Synced {} customers", count)),
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command]
fn search_customers_command(
    state: State<'_, CustomerState>,
    query: String,
) -> Vec<models::PosCustomer> {
    customer_store::search_local(&state, query)
}

// --- SALES COMMANDS ---

#[tauri::command]
async fn process_sale_command(
    app: AppHandle,
    state: State<'_, SalesState>,
    shift_state: State<'_, ShiftState>,
    auth_state: State<'_, AuthState>,
    sale_id: String,
    payload: serde_json::Value
) -> Result<models::SaleResponse, String> {
    // Pass auth_state and shift_state to the logic
    sales_store::process_sale(app, &state, &shift_state, sale_id, payload, &auth_state)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sync_sales_command(
    app: AppHandle,
    state: State<'_, SalesState>,
    auth_state: State<'_, AuthState>
) -> Result<String, String> {
    // Pass auth_state to the logic
    match sales_store::sync_pending_sales(app, &state, &auth_state).await {
        Ok(count) => Ok(format!("Synced {} sales", count)),
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command]
fn get_pending_sales_command(state: State<'_, SalesState>) -> Vec<models::QueuedSale> {
    sales_store::get_queue_status(&state)
}

#[tauri::command]
async fn scan_transaction_code(
    state: State<'_, SalesState>,
    auth_state: State<'_, AuthState>,
    code: String
) -> Result<serde_json::Value, String> {
    sales_store::scan_transaction_qr(&auth_state, code)
        .await
        .map_err(|e| e.to_string())
}



// --- PRICING COMMANDS ---

#[tauri::command]
async fn sync_pricing_command(
    app: AppHandle,
    state: State<'_, PricingState>,
    auth_state: State<'_, AuthState>
) -> Result<String, String> {
    match pricing_store::run_sync(app, &state, &auth_state).await {
        Ok(timestamp) => Ok(timestamp),
        Err(e) => Err(e.to_string())
    }
}

#[derive(serde::Deserialize)]
struct BatchPricingRequest {
    variant_id: String,
    unit_id: Option<String>,
    is_base_unit: bool,
}

#[tauri::command]
fn resolve_price_batch_command(
    state: State<'_, PricingState>,
    customer_id: Option<String>,
    requests: Vec<BatchPricingRequest>
) -> Vec<Option<f64>> {
    let mut results = Vec::new();
    for req in requests {
        let price = pricing_store::resolve_price(
            &state, 
            customer_id.clone(), 
            req.variant_id, 
            req.unit_id, 
            req.is_base_unit
        );
        results.push(price);
    }
    results
}

#[tauri::command]
fn get_pos_pricing_command(state: State<'_, PricingState>) -> models::PosPricingData {
    pricing_store::get_all_pricing(&state)
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

#[tauri::command]
async fn close_customer_screen(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("customer") {
        window.close().map_err(|e| e.to_string())?;
    }
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

// --- Method 1: Network (TCP) ---
#[tauri::command]
async fn print_network_receipt(ip: String, port: Option<u16>, text: String) -> Result<String, PrinterError> {
    let port = port.unwrap_or(9100);
    let address = format!("{}:{}", ip, port);

    // 1. Enforce a connection timeout
    let stream_result = tokio::time::timeout(
        Duration::from_secs(5), 
        TcpStream::connect(&address)
    ).await;

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
async fn print_system_receipt(
    app: AppHandle, 
    printer_name: String, 
    content: String, 
    is_path: bool 
) -> Result<String, PrinterError> { 
    
    // Logic: If it's already a file path (PDF), use it. 
    // If it's raw text, write it to a temp file with a specific extension (.txt).
    let file_to_print = if is_path {
        // Verify file exists
        let path = std::path::PathBuf::from(&content);
        if !path.exists() {
             return Err(PrinterError::SystemError(format!("File not found: {}", content)));
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
        temp_file.write_all(content.as_bytes())
            .map_err(|e| PrinterError::SystemError(format!("Failed to write to temp file: {}", e)))?;

        // Persist the file so the external process (Sumatra/lp) can read it
        let (_, path) = temp_file.keep()
            .map_err(|e| PrinterError::SystemError(format!("Failed to persist temp file: {}", e)))?;

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
            file_to_print.clone() // Clone path string for the args
        ];

        let command = app.shell().sidecar("sumatrapdf") 
            .map_err(|e| PrinterError::SystemError(format!("Sidecar config error: {}", e)))?
            .args(&args);

        let (mut _rx, _child) = command.spawn()
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
             Err(PrinterError::SystemError(format!("CUPS failed: {}", String::from_utf8_lossy(&output.stderr))))
        }
    }
}

#[tauri::command]
async fn print_usb(vid: u16, pid: u16, text: String) -> Result<String, PrinterError> {
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
                    },
                    Err(e) => Err(PrinterError::SystemError(format!("USB Write Error: {}", e))),
                }
            },
            Err(_e) => Err(PrinterError::UsbDeviceNotFound(vid, pid)),
        }
    }).await.map_err(|_| PrinterError::SystemError("Task Join Error".into()))?
}


#[tauri::command]
fn get_products_by_ids_command(
    state: State<'_, ProductState>,
    ids: Vec<String>
) -> Vec<models::PosProduct> {
    product_store::get_products_by_ids(&state, ids)
}

#[tauri::command]
fn get_customers_by_ids_command(
    state: State<'_, CustomerState>,
    ids: Vec<String>
) -> Vec<models::PosCustomer> {
    customer_store::get_customers_by_ids(&state, ids)
}

// --- SHIFT COMMANDS ---

#[tauri::command]
fn get_shift_command(state: State<'_, ShiftState>) -> Option<Shift> {
    shift_store::get_shift_status(&state)
}

#[tauri::command]
fn add_cash_drop_command(
    state: State<'_, ShiftState>,
    amount: f64,
    reason: String
) -> Result<(), String> {
    shift_store::record_cash_drop(&state, amount, reason)
}

#[tauri::command]
fn record_shift_sale_command(
    state: State<'_, ShiftState>,
    amount: f64
) -> Result<(), String> {
    shift_store::record_cash_sale(&state, amount)
}

#[tauri::command]
fn open_shift_command(
    state: State<'_, ShiftState>,
    card_id: String,
    pin: String,
    float_amount: f64
) -> Result<Shift, String> {
    if card_id.is_empty() || pin.is_empty() {
        return Err("Credentials missing".to_string());
    }

    // Now passes card_id and pin individually to shift_store
    shift_store::open_new_shift(&state, card_id, pin, float_amount)
}

#[tauri::command]
async fn close_shift_command(
    app: AppHandle,
    state: State<'_, ShiftState>,
    card_id: String,
    pin: String,
    actual_count: f64,
    printer_name: Option<String>
) -> Result<Shift, String> {
    if card_id.is_empty() || pin.is_empty() {
        return Err("Credentials missing".to_string());
    }

    let closed_shift = shift_store::close_current_shift(&state, actual_count)?;
    let report_text = shift_store::generate_z_report_text(&closed_shift);
    
    if let Some(p_name) = printer_name {
         let _ = print_system_receipt(app, p_name, report_text, false).await;
    }

    Ok(closed_shift)
}

#[tauri::command]
async fn sync_shifts_command(
    state: State<'_, ShiftState>,
    auth_state: State<'_, AuthState>
) -> Result<String, String> {
    shift_store::sync_pending_shifts(&state, &auth_state).await
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ProductState::new()) // Initialize State
        .manage(CustomerState::new()) // Initialize Customer State
        .manage(SalesState::new()) // Initialize Sales State
        .manage(PricingState::new()) // Initialize Pricing State
        .manage(ShiftState::new()) // Initialize Shift State
        .manage(AuthState::new()) // Initialize Auth State
        .setup(|app| {
            // --- 1. Load Data (Existing Code) ---
            let state = app.state::<ProductState>();
            if let Err(e) = product_store::load_products_from_disk(app.handle(), &state) {
                eprintln!("Failed to load initial data: {}", e);
            }

            let cust_state = app.state::<CustomerState>();
            if let Err(e) = customer_store::load_customers_from_disk(app.handle(), &cust_state) {
                eprintln!("Failed to load initial customer data: {}", e);
            }

            let sales_state = app.state::<SalesState>();
            sales_store::init_state(app.handle(), &sales_state);

            let pricing_state = app.state::<PricingState>();
            if let Err(e) = pricing_store::load_pricing_from_disk(app.handle(), &pricing_state) {
                eprintln!("Failed to load initial pricing data: {}", e);
            }

            // --- 2. Startup Visibility Logic (NEW) ---
            // Get command line arguments
            let args: Vec<String> = std::env::args().collect();
            
            // We check if the flag "--minimized" is present.
            // If it is NOT present, we show the window.
            // If it IS present, we do nothing (window remains hidden per tauri.conf.json).
            if !args.contains(&"--minimized".to_string()) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            // --- 3. System Tray (Existing Code) ---
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
                        "quit" => app.exit(0),
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
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Prevent the app from closing and hide the window instead
                api.prevent_close();
                let _ = window.hide();
            }
        })
        // .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_websocket::init())
        // .plugin(init())
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
        .plugin(tauri_plugin_shell::init())
        // REGISTER NEW COMMAND HERE
        .invoke_handler(tauri::generate_handler![
            start_scan, 
            scan_transaction_code, 
            list_hid_devices, 
            open_customer_screen,
            close_customer_screen,
            sync_products_command,
            search_products_command,
            get_products_by_ids_command,
            start_nfc_listener,
            get_serial_ports, 
            open_cash_drawer,
            sync_customers_command,   
            search_customers_command, 
            get_customers_by_ids_command,
            process_sale_command,    
            sync_sales_command,      
            get_pending_sales_command,
            sync_pricing_command,
            resolve_price_batch_command,
            get_pos_pricing_command, 
            print_network_receipt, 
            print_system_receipt,
            print_usb,
            printer_manager::get_system_printers,
            printer_manager::save_printer_config,
            printer_manager::get_printer_config,
            printer_manager::print_job,
            open_shift_command,
            get_shift_command,
            add_cash_drop_command,
            record_shift_sale_command,
            close_shift_command,
            sync_shifts_command,
            auth_store::set_device_config,
            auth_store::login_member,
            auth_store::logout_member,
            auth_store::get_device_config,
            auth_store::restore_member_session,
            auth_store::reset_device_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}