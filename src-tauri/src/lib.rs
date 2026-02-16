// src-tauri/src/lib.rs

use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};
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

mod notification_manager;
use notification_manager::NotificationState;

mod data_management;

mod network_monitor;
use network_monitor::NetworkState;

mod customer_screen_state;
use customer_screen_state::CustomerScreenState;

mod delivery_store;
mod stock_acceptance;
pub mod stock_transfer;
mod http_server;
mod stock_acceptance_models;

mod scanner_manager; 

#[cfg(test)]
mod test_utils;
#[cfg(test)]
mod pricing_tests;


#[tauri::command]
async fn sync_products_command(
    app: AppHandle,
    state: State<'_, ProductState>,
    auth_state: State<'_, AuthState>
) -> Result<String, String> {
    match product_store::run_sync(app, &state, &auth_state, false).await {
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
    auth_state: State<'_, AuthState>,
    query: String,
    category: String
) -> Vec<models::PosProduct> {
    // Get current location from auth state
    let location_id = {
        let config_guard = auth_state.device_config.lock().unwrap_or_else(|e| e.into_inner());
        config_guard.as_ref().map(|c| c.location_id.clone()).unwrap_or_default()
    };
    product_store::search_local(&state, &location_id, query, category)
}

#[tauri::command]
fn search_global_command(
    product_state: State<'_, ProductState>,
    customer_state: State<'_, CustomerState>,
    sales_state: State<'_, SalesState>,
    auth_state: State<'_, AuthState>,
    query: String
) -> models::GlobalSearchResult {
    // 1. Search Products
    let location_id = {
        let config_guard = auth_state.device_config.lock().unwrap_or_else(|e| e.into_inner());
        config_guard.as_ref().map(|c| c.location_id.clone()).unwrap_or_default()
    };
    
    let products = product_store::search_local(&product_state, &location_id, query.clone(), "All".to_string())
        .into_iter()
        .take(5)
        .collect();

    // 2. Search Customers
    let customers = customer_store::search_local(&customer_state, query.clone())
        .into_iter()
        .take(5)
        .collect();

    // 3. Search Sales (Pending/Failed/Queue)
    let sales = sales_store::search_local(&sales_state, query)
        .into_iter()
        .take(5)
        .collect();

    models::GlobalSearchResult {
        products,
        customers,
        sales
    }
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
async fn create_customer_command(
    app: AppHandle,
    state: State<'_, CustomerState>,
    auth_state: State<'_, AuthState>,
    data: serde_json::Value
) -> Result<models::PosCustomer, String> {
    customer_store::create_customer(app, &state, &auth_state, data)
        .await
        .map_err(|e| e.to_string())
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
async fn retry_sale_command(
    app: AppHandle,
    state: State<'_, SalesState>,
    auth_state: State<'_, AuthState>,
    sale_id: String
) -> Result<bool, String> {
    sales_store::retry_single_sale(app, &state, &auth_state, sale_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn check_old_sales_command(
    state: State<'_, SalesState>,
    days_threshold: u64
) -> Vec<models::QueuedSale> {
    sales_store::check_old_pending_sales(&state, days_threshold)
}

#[tauri::command]
fn check_failed_sales_command(
    state: State<'_, SalesState>,
    retry_threshold: u32
) -> Vec<models::QueuedSale> {
    sales_store::check_failed_sales(&state, retry_threshold)
}

#[tauri::command]
async fn delete_sale_command(
    app: AppHandle,
    state: State<'_, SalesState>,
    sale_id: String
) -> Result<bool, String> {
    sales_store::delete_sale(&app, &state, sale_id).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn scan_transaction_code(
    _state: State<'_, SalesState>,
    auth_state: State<'_, AuthState>,
    code: String
) -> Result<serde_json::Value, String> {
    sales_store::scan_transaction_qr(&auth_state, code)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_order_command(
    auth_state: State<'_, AuthState>,
    location_id: String,
    order: serde_json::Value
) -> Result<serde_json::Value, String> {
    sales_store::create_order(&auth_state, location_id, order)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_invoice_blob_command(
    auth_state: State<'_, AuthState>,
    url: String,
) -> Result<Vec<u8>, String> {
    let (device_key, token, member_id, base_url) = {
        let config_guard = auth_state.device_config.lock().map_err(|e| e.to_string())?;
        let config = config_guard.as_ref().ok_or("Device not initialized")?;
        
        let token_guard = auth_state.member_token.lock().map_err(|e| e.to_string())?;
        let user_guard = auth_state.current_user.lock().map_err(|e| e.to_string())?;
        
        (
            config.device_key.clone(), 
            token_guard.clone(), 
            user_guard.as_ref().map(|u| u.id.clone()),
            config.base_url.clone()
        )
    };

    let full_url = if url.starts_with("http") {
        url
    } else {
        format!("{}/{}", base_url.trim_end_matches('/'), url.trim_start_matches('/'))
    };

    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("X-Device-Api-Key", reqwest::header::HeaderValue::from_str(&device_key).map_err(|e| e.to_string())?);
    
    if let Some(t) = token {
        let auth_val = format!("Bearer {}", t);
        headers.insert(reqwest::header::AUTHORIZATION, reqwest::header::HeaderValue::from_str(&auth_val).map_err(|e| e.to_string())?);
    }

    if let Some(mid) = member_id {
        headers.insert("X-Member-Id", reqwest::header::HeaderValue::from_str(&mid).map_err(|e| e.to_string())?);
    }

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&full_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if !status.is_success() {
        let error_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Failed to fetch invoice: {} - {}", status, error_text));
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    Ok(bytes.to_vec())
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
    // 0. Check if enabled in state
    let state = app.state::<CustomerScreenState>();
    if !state.is_enabled() {
        return Err("Customer screen is disabled in settings".to_string());
    }

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

// --- New State Management Commands ---
#[tauri::command]
async fn set_customer_screen_enabled(
    app: AppHandle,
    state: State<'_, CustomerScreenState>,
    enabled: bool
) -> Result<(), String> {
    // Update state
    state.set_enabled(enabled);
    
    // Save to disk
    state.save_to_store(&app).await?;
    
    // Open or close window based on state
    if enabled {
        open_customer_screen(app).await?;
    } else {
        close_customer_screen(app).await?;
    }
    
    Ok(())
}

#[tauri::command]
fn get_customer_screen_state(state: State<'_, CustomerScreenState>) -> bool {
    state.is_enabled()
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
        .timeout(std::time::Duration::from_millis(100))
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
        std::time::Duration::from_secs(5), 
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
    auth_state: State<'_, AuthState>,
    ids: Vec<String>
) -> Vec<models::PosProduct> {
    // Get current location from auth state
    let location_id = {
        let config_guard = auth_state.device_config.lock().unwrap_or_else(|e| e.into_inner());
        config_guard.as_ref().map(|c| c.location_id.clone()).unwrap_or_default()
    };
    product_store::get_products_by_ids(&state, &location_id, ids)
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
        .manage(NotificationState::new()) // Initialize Notification State
        .manage(NetworkState::new()) // Initialize Network State
        .manage(CustomerScreenState::new()) // Initialize Customer Screen State
        .setup(|app| {
            // --- 1. Load Data (Existing Code) ---
            // Note: We can't load products at startup since we need location_id
            // Products will be loaded when the device is configured/location is set
            let state = app.state::<ProductState>();
            
            // Try to load products for the configured location if available
            let auth_state_init = app.state::<AuthState>();
            if let Some(location_id) = {
                let config_guard = auth_state_init.device_config.lock().unwrap_or_else(|e| e.into_inner());
                config_guard.as_ref().map(|c| c.location_id.clone())
            } {
                if let Err(e) = tauri::async_runtime::block_on(product_store::load_products_from_disk(app.handle(), &state, &location_id)) {
                    eprintln!("Failed to load initial data for location {}: {}", location_id, e);
                }
            }

            let cust_state = app.state::<CustomerState>();
            if let Err(e) = tauri::async_runtime::block_on(customer_store::load_customers_from_disk(app.handle(), &cust_state)) {
                eprintln!("Failed to load initial customer data: {}", e);
            }

            let sales_state = app.state::<SalesState>();
            tauri::async_runtime::block_on(sales_store::init_state(app.handle(), &sales_state));

            let pricing_state = app.state::<PricingState>();
            if let Err(e) = tauri::async_runtime::block_on(pricing_store::load_pricing_from_disk(app.handle(), &pricing_state)) {
                eprintln!("Failed to load initial pricing data: {}", e);
            }

            let notification_state = app.state::<NotificationState>();
            notification_manager::init_notification_state(app.handle(), &notification_state);

            // Customer Screen State Loading
            let customer_screen_state = app.state::<CustomerScreenState>();
            if let Err(e) = tauri::async_runtime::block_on(customer_screen_state.load_from_store(app.handle())) {
                eprintln!("Failed to load customer screen state: {}", e);
            }

            // Check for old pending sales and notify user
            let old_sales = sales_store::check_old_pending_sales(&sales_state, 3);
            if !old_sales.is_empty() {
                let notification = notification_manager::AppNotification::new(
                    notification_manager::NotificationType::Warning,
                    notification_manager::NotificationPriority::High,
                    "Old Pending Sales Detected".to_string(),
                    format!("You have {} pending sales older than 3 days. Please connect to the internet to sync them and avoid data loss.", old_sales.len()),
                );
                notification_state.add_notification(notification.clone());
                let _ = notification_state.save_to_store(app.handle());
                
                // Send native notification
                let _ = app.emit("old-sales-detected", old_sales.len());
            }

            // Check for failed sales and notify
            let failed_sales = sales_store::check_failed_sales(&sales_state, 5);
            if !failed_sales.is_empty() {
                let _ = app.emit("failed-sales-detected", failed_sales);
            }

            // Start network monitoring
            let auth_state_ref = app.state::<AuthState>();
            let initial_base_url = {
                let config_guard = auth_state_ref.device_config.lock().unwrap_or_else(|e| e.into_inner());
                config_guard.as_ref().map(|c| c.base_url.clone())
            };
            
            let network_state = app.state::<NetworkState>();
            if let Some(url) = initial_base_url {
                network_state.set_base_url(url);
            }

            // --- Customer Screen Auto-Open ---
            let customer_screen_state = app.state::<CustomerScreenState>();
            
            // Auto-open customer screen if enabled
            if customer_screen_state.is_enabled() {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = open_customer_screen(app_handle).await {
                        eprintln!("Failed to open customer screen on startup: {}", e);
                    }
                });
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
                            let state = app.state::<CustomerScreenState>();
                            if state.is_enabled() {
                                tauri::async_runtime::spawn(async move {
                                    let _ = open_customer_screen(app_handle).await;
                                });
                            }
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
            scanner_manager::start_scan,          // Updated reference
            scanner_manager::list_hid_devices,    // Updated reference
            scanner_manager::start_nfc_listener,  // Updated reference
            scan_transaction_code, 
            open_customer_screen,
            close_customer_screen,
            set_customer_screen_enabled,
            get_customer_screen_state,
            sync_products_command,
            search_products_command,
            search_global_command,
            get_products_by_ids_command,
            product_store::switch_location,
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
            auth_store::reset_device_config,
            auth_store::authenticated_api_request,
            notification_manager::send_native_notification,
            notification_manager::get_notification_history,
            notification_manager::get_unread_notification_count,
            notification_manager::mark_notification_read,
            notification_manager::mark_all_notifications_read,
            notification_manager::delete_notification,
            notification_manager::clear_all_notifications,
            data_management::dangerously_clear_all_data,
            retry_sale_command,
            check_old_sales_command,
            check_failed_sales_command,
            delete_sale_command,
            network_monitor::get_network_status_command,
            network_monitor::update_network_status_command,
            create_order_command,
            get_invoice_blob_command,
            create_customer_command,
            // New delivery commands
            delivery_store::get_drivers_command,
            delivery_store::dispatch_order_command,
            delivery_store::reconcile_delivery_command,
            // New sales commands
            sales_store::get_sales_history_command,
            sales_store::record_payment_command,
            sales_store::initiate_mpesa_payment_command,
            // New auth commands
            auth_store::get_locations_command,
            auth_store::get_ably_auth_token_command,
            auth_store::start_device_setup_command,
            stock_acceptance::save_document_locally,
            stock_acceptance::fetch_incoming_shipments,
            stock_acceptance::receive_purchase_order,
            stock_acceptance::receive_stock_transfer,
            stock_acceptance::submit_stock_process,
            stock_transfer::submit_stock_transfer,
            http_server::start_file_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}