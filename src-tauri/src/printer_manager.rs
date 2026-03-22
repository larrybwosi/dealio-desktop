use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};
use tempfile::Builder;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use serde_json::Value; 
use base64::{Engine as _, engine::general_purpose};

use crate::escpos_builder::EscPosBuilder; 
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
    app: AppHandle,
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
            "shrink".to_string(), // IMPROVEMENT: Changed from "noscale" to "shrink" to respect hardware margins
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
            .arg("-o")         
            .arg("fit-to-page")
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

#[tauri::command] 
pub async fn print_receipt_native(
    app: tauri::AppHandle, 
    order: Value,
    settings: Value,
    branch_name: Option<String>,
) -> Result<String, String> {
    let mut esc = EscPosBuilder::new();
    
    // 1. Setup layout constraints based on Paper Size
    let config = settings.get("receiptConfig").unwrap_or(&Value::Null);
    let paper_size = config.get("paperSize").and_then(|v| v.as_str()).unwrap_or("80mm");
    let is_58mm = paper_size == "58mm";
    
    let width = if is_58mm { 32 } else { 48 };
    let cols = if is_58mm { (14, 4, 6, 8) } else { (22, 6, 9, 11) };

    // --- LOGO ---
    if let Some(logo_path) = config.get("logoUrl").and_then(|v| v.as_str()) {
        let _ = esc.logo(logo_path, is_58mm);
    }

    // --- HEADER (Center Aligned) ---
    esc.align(1);
    if let Some(biz_name) = settings.get("businessName").and_then(|v| v.as_str()) {
        esc.size(2, 2); // Double height and width
        esc.bold(true);
        esc.text_line(biz_name);
        
        esc.size(1, 1); // Reset
        esc.bold(false);
    }
    
    if let Some(slogan) = settings.get("businessSlogan").and_then(|v| v.as_str()) {
        if !slogan.is_empty() { esc.text_line(slogan); }
    }
    if let Some(branch) = branch_name {
        if !branch.is_empty() { esc.text_line(&format!("Branch: {}", branch)); }
    }
    if let Some(address) = settings.get("address").and_then(|v| v.as_str()) {
        if !address.is_empty() { esc.text_line(address); }
    }
    if let Some(phone) = settings.get("phone").and_then(|v| v.as_str()) {
        if !phone.is_empty() { esc.text_line(&format!("Tel: {}", phone)); }
    }
    
    esc.feed(1);

    // --- META DATA (Left Aligned) ---
    esc.align(0);
    esc.divider(width);
    if let Some(order_num) = order.get("orderNumber").and_then(|v| v.as_str()) {
        esc.text_line(&format!("Receipt No: {}", order_num));
    }
    if let Some(date) = order.get("createdAt").and_then(|v| v.as_str()) {
        esc.text_line(&format!("Date: {}", date));
    }
    if let Some(cashier) = order.get("cashierName").and_then(|v| v.as_str()) {
        esc.text_line(&format!("Cashier: {}", cashier));
    }
    
    // --- TABLE HEADER ---
    esc.divider(width);
    esc.bold(true);
    esc.item_row("ITEM", "QTY", "PRICE", "AMT", cols);
    esc.bold(false);
    esc.divider(width);

    // --- ITEMS LOOP ---
    if let Some(items) = order.get("items").and_then(|v| v.as_array()) {
        for item in items {
            let name = item.get("productName").and_then(|v| v.as_str()).unwrap_or("Item");
            let qty = item.get("quantity").and_then(|v| v.as_f64()).unwrap_or(1.0);
            let price = item.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let total = item.get("total").and_then(|v| v.as_f64()).unwrap_or(qty * price);
            
            // Format numbers nicely
            let qty_str = if qty.fract() == 0.0 { format!("{}", qty) } else { format!("{:.2}", qty) };
            let price_str = format!("{:.2}", price);
            let total_str = format!("{:.2}", total);

            esc.item_row(name, &qty_str, &price_str, &total_str, cols);
        }
    }
    esc.divider(width);

    // --- TOTALS (Left/Right Aligned) ---
    if let Some(subtotal) = order.get("subTotal").and_then(|v| v.as_f64()) {
        esc.text_left_right("Subtotal:", &format!("{:.2}", subtotal), width);
    }
    if let Some(tax) = order.get("taxAmount").and_then(|v| v.as_f64()) {
        if tax > 0.0 {
            esc.text_left_right("Tax:", &format!("{:.2}", tax), width);
        }
    }
    if let Some(discount) = order.get("discountAmount").and_then(|v| v.as_f64()) {
        if discount > 0.0 {
            esc.text_left_right("Discount:", &format!("-{:.2}", discount), width);
        }
    }

    // Big Total Row
    if let Some(total) = order.get("total").and_then(|v| v.as_f64()) {
        esc.feed(1);
        esc.size(2, 2);
        esc.bold(true);
        // Because text is 2x wide, the character width for this line is halved
        let double_width = width / 2;
        esc.text_left_right("TOTAL:", &format!("{:.2}", total), double_width);
        
        // Reset styles
        esc.size(1, 1);
        esc.bold(false);
        esc.feed(1);
    }

    // Payment Methods
    if let Some(payments) = order.get("payments").and_then(|v| v.as_array()) {
        for p in payments {
            let method = p.get("method").and_then(|v| v.as_str()).unwrap_or("Payment");
            let amt = p.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
            esc.text_left_right(method, &format!("{:.2}", amt), width);
        }
    }

    // --- FOOTER & BARCODES (Center Aligned) ---
    esc.align(1);
    esc.feed(1);
    esc.divider(width);
    
    if let Some(msg) = config.get("customMessage").and_then(|v| v.as_str()) {
        if !msg.is_empty() { esc.text_line(msg); }
    } else {
        esc.text_line("Thank you for your business!");
    }
    esc.feed(1);

    // Render Survey QR if enabled
    if config.get("showSurveyQr").and_then(|v| v.as_bool()).unwrap_or(false) {
        if let Some(url) = config.get("surveyUrl").and_then(|v| v.as_str()) {
            esc.text_line("Scan to rate your experience:");
            esc.qr_code(url);
        }
    }

    // Render 1D Barcode if enabled
    if config.get("showBarcode").and_then(|v| v.as_bool()).unwrap_or(false) {
        if let Some(order_num) = order.get("orderNumber").and_then(|v| v.as_str()) {
            esc.barcode_1d(order_num);
        }
    }

    // Return policy / Disclaimer
    if config.get("showReturnPolicy").and_then(|v| v.as_bool()).unwrap_or(false) {
        if let Some(policy) = config.get("returnPolicyText").and_then(|v| v.as_str()) {
            esc.feed(1);
            esc.text_line(policy);
        }
    }

    // --- FINISH BUILDING COMMANDS ---
    esc.feed(4);
    esc.cut();

    // 1. EXTRACT RAW BYTES
    let bytes_to_print = esc.bytes;

    // 2. LOAD PRINTER CONFIGURATION
    let printer_config = get_printer_config(app.clone())
        .await
        .map_err(|e| format!("Failed to load printer config: {}", e))?;

    // 3. ROUTE TO THE CORRECT PRINTER HANDLER
    if let Some(printer) = printer_config.receipt_printer {
        match printer.method.as_str() {
            "network" => {
                print_network_raw_bytes(printer.target, printer.port, bytes_to_print)
                    .await
                    .map_err(|e| format!("Network print failed: {:?}", e))?;
                
                Ok("Printed natively to network printer".into())
            }
            "system" | _ => {
                print_system_raw_bytes(printer.target, bytes_to_print)
                    .await
                    .map_err(|e| format!("System raw print failed: {:?}", e))?;

                Ok("Printed natively to system printer".into())
            }
        }
    } else {
        Err("No receipt printer configured".into())
    }
}

pub async fn print_network_raw_bytes(ip: String, port: Option<u16>, data: Vec<u8>) -> Result<String, PrinterError> {
    let port = port.unwrap_or(9100);
    let addr = format!("{}:{}", ip, port);
    let mut stream = TcpStream::connect(addr).await
        .map_err(|e| PrinterError::ConnectionFailed(e.to_string()))?;
        
    stream.write_all(&data).await
        .map_err(|e| PrinterError::SystemError(format!("Failed to write to printer: {}", e)))?;
        
    Ok("Sent to network printer".into())
}


#[cfg(target_os = "windows")]
pub async fn print_system_raw_bytes(
    printer_name: String,
    data: Vec<u8>,
) -> Result<String, PrinterError> {
    // use std::os::windows::ffi::OsStrExt;
    // use windows::core::PCWSTR;
    // Remove `use windows::Win32::Foundation::HANDLE;`
    use windows::Win32::Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter, OpenPrinterW, StartDocPrinterW,
        StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_HANDLE, // <-- Added PRINTER_HANDLE here
    };
    use windows::core::{PCWSTR, PWSTR};

    // Windows API requires UTF-16 wide strings with null terminators
    let printer_name_wide: Vec<u16> = printer_name.encode_utf16().chain(std::iter::once(0)).collect();
    let doc_name_wide: Vec<u16> = "Receipt\0".encode_utf16().collect();
    let data_type_wide: Vec<u16> = "RAW\0".encode_utf16().collect();

    unsafe {
    // 1. Use PRINTER_HANDLE instead of HANDLE
    let mut h_printer = PRINTER_HANDLE::default(); 
    let printer_name_wide: Vec<u16> = printer_name.encode_utf16().chain(std::iter::once(0)).collect();

    if OpenPrinterW(PCWSTR(printer_name_wide.as_ptr()), &mut h_printer, None).is_err() {
        return Err(PrinterError::SystemError("Failed to open printer".into()));
    }

    // 2. Make string buffers mutable so we can pass PWSTR (mutable pointer)
    let mut doc_name_wide: Vec<u16> = "Raw Print Job".encode_utf16().chain(std::iter::once(0)).collect();
    let mut data_type_wide: Vec<u16> = "RAW".encode_utf16().chain(std::iter::once(0)).collect();

    // 3. Use PWSTR(mut_ptr) instead of PCWSTR
    let doc_info = DOC_INFO_1W {
        pDocName: PWSTR(doc_name_wide.as_mut_ptr()),
        pOutputFile: PWSTR(std::ptr::null_mut()),
        pDatatype: PWSTR(data_type_wide.as_mut_ptr()),
    };

    // 4. Pass the pointer correctly without the extra `as *const u8`
    let job_id = StartDocPrinterW(h_printer, 1, &doc_info as *const DOC_INFO_1W);
    if job_id == 0 {
        let _ = ClosePrinter(h_printer);
        return Err(PrinterError::SystemError("Failed to start document".into()));
    }

    // 5. Use .ok().is_err() because StartPagePrinter returns a BOOL, not a Result
    if StartPagePrinter(h_printer).ok().is_err() {
        let _ = ClosePrinter(h_printer);
        return Err(PrinterError::SystemError("Failed to start page".into()));
    }

    let mut bytes_written: u32 = 0;
    let write_ok = WritePrinter(
        h_printer,
        data.as_ptr() as *const std::ffi::c_void,
        data.len() as u32,
        &mut bytes_written,
    );

    // 6. Same here, check .ok().is_err()
    if write_ok.ok().is_err() || bytes_written != data.len() as u32 {
        let _ = EndPagePrinter(h_printer);
        let _ = EndDocPrinter(h_printer);
        let _ = ClosePrinter(h_printer);
        return Err(PrinterError::SystemError("Failed to write to printer".into()));
    }

    let _ = EndPagePrinter(h_printer);
    let _ = EndDocPrinter(h_printer);
    let _ = ClosePrinter(h_printer);
}

    Ok("Sent raw bytes natively to Windows print spooler".into())
}

#[cfg(not(target_os = "windows"))]
pub async fn print_system_raw_bytes(
    printer_name: String,
    data: Vec<u8>,
) -> Result<String, PrinterError> {
    use std::io::Write;
    
    // Linux/macOS: Write the raw ESC/POS bytes to a temporary binary file
    let mut temp_file = tempfile::Builder::new()
        .suffix(".bin")
        .tempfile()
        .map_err(|e| PrinterError::SystemError(format!("Temp file creation failed: {}", e)))?;

    temp_file.write_all(&data).map_err(|e| {
        PrinterError::SystemError(format!("Failed to write to temp file: {}", e))
    })?;

    let (_, path) = temp_file.keep().map_err(|e| {
        PrinterError::SystemError(format!("Failed to persist temp file: {}", e))
    })?;
    let file_path = path.to_string_lossy().to_string();

    // Use CUPS (lp) with the "-o raw" flag to bypass driver formatting
    let output = std::process::Command::new("lp")
        .arg("-d")
        .arg(&printer_name)
        .arg("-o")
        .arg("raw")
        .arg(&file_path)
        .output()
        .map_err(|e| PrinterError::SystemError(format!("Failed to execute lp: {}", e)))?;

    // Clean up temp file
    let _ = std::fs::remove_file(path);

    if output.status.success() {
        Ok("Sent raw bytes to CUPS successfully".into())
    } else {
        Err(PrinterError::SystemError(format!(
            "CUPS raw print failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )))
    }
}


#[tauri::command]
pub async fn print_kitchen_native(
    _app: tauri::AppHandle,
    order: Value,
    settings: Value,
    branch_name: Option<String>,
) -> Result<String, String> {
    let mut esc = EscPosBuilder::new();

    // 1. Setup layout constraints based on Paper Size
    let config = settings.get("kitchenTicketConfig").unwrap_or(&Value::Null);
    let paper_size = config.get("paperSize").and_then(|v| v.as_str()).unwrap_or("80mm");
    let is_58mm = paper_size == "58mm";
    let width = if is_58mm { 32 } else { 48 };

    // Kitchen Config Flags
    let show_time = config.get("showTime").and_then(|v| v.as_bool()).unwrap_or(true);
    let show_order_type = config.get("showOrderType").and_then(|v| v.as_bool()).unwrap_or(true);
    let show_customer_name = config.get("showCustomerName").and_then(|v| v.as_bool()).unwrap_or(true);
    let show_table = config.get("showTable").and_then(|v| v.as_bool()).unwrap_or(true);
    let show_prices = config.get("showPrices").and_then(|v| v.as_bool()).unwrap_or(false);
    let show_notes = config.get("showNotes").and_then(|v| v.as_bool()).unwrap_or(true);

    // --- HEADER ---
    esc.align(1); // Center

    let shop_name = config.get("shopName").and_then(|v| v.as_str())
        .or(branch_name.as_deref())
        .unwrap_or("RESTAURANT NAME");
    
    esc.bold(true);
    esc.size(2, 2);
    esc.text_line(&shop_name.to_uppercase());
    esc.size(1, 1);
    esc.bold(false);

    // Ticket Type
    let ticket_type = config.get("ticketType").and_then(|v| v.as_str()).unwrap_or("KITCHEN");
    esc.feed(1);
    esc.text_line(&format!("- {} TICKET -", ticket_type.to_uppercase()));
    esc.divider(width);

    // --- ORDER NUMBER ---
    if let Some(order_num) = order.get("orderNumber").and_then(|v| v.as_str()) {
        esc.feed(1);
        esc.text_line("ORDER #");
        esc.bold(true);
        esc.size(3, 3);
        esc.text_line(order_num);
        esc.size(1, 1);
        esc.bold(false);
        esc.feed(1);
    }

    esc.divider(width);

    // --- META GRID ---
    esc.align(0); // Left align
    
    if show_order_type {
        if let Some(order_type) = order.get("orderType").and_then(|v| v.as_str()) {
            esc.text_line(&format!("TYPE: {}", order_type.to_uppercase()));
        }
    }
    if show_time {
        let created_at = order.get("createdAt").and_then(|v| v.as_str()).unwrap_or("");
        esc.text_line(&format!("TIME: {}", created_at));
    }
    if let Some(user_name) = order.get("userName").and_then(|v| v.as_str()) {
        esc.text_line(&format!("SERVER: {}", user_name.to_uppercase()));
    }
    if show_customer_name {
        if let Some(customer) = order.get("customerName").and_then(|v| v.as_str()) {
            esc.text_line(&format!("CUSTOMER: {}", customer.to_uppercase()));
        }
    }

    // --- TABLE BOX ---
    if show_table {
        if let Some(table) = order.get("tableName").and_then(|v| v.as_str()) {
            esc.feed(1);
            esc.align(1);
            esc.inverse(true); // Black background with white text for visibility
            esc.size(2, 2);
            esc.text_line(&format!(" TABLE {} ", table.to_uppercase()));
            esc.inverse(false);
            esc.size(1, 1);
            esc.feed(1);
        }
    }

    esc.align(0);
    esc.divider(width);

    // --- ITEMS LIST ---
    // Column widths
    let q_w = if is_58mm { 4 } else { 6 };
    let p_w = if show_prices { if is_58mm { 8 } else { 10 } } else { 0 };
    let i_w = width - q_w - p_w;

    // Headers
    esc.bold(true);
    let mut header = format!("{:<i_w$}{:>q_w$}", "ITEM", "QTY", i_w = i_w, q_w = q_w);
    if show_prices {
        header.push_str(&format!("{:>p_w$}", "PRICE", p_w = p_w));
    }
    esc.text_line(&header);
    esc.bold(false);
    esc.divider(width);

    let mut total_items = 0.0;

    if let Some(items) = order.get("items").and_then(|v| v.as_array()) {
        for item in items {
            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown");
            let qty = item.get("quantity").and_then(|v| v.as_f64()).unwrap_or(1.0);
            total_items += qty;
            
            let qty_str = format!("{}", qty);
            
            // Truncate name safely to avoid line breaking on large names
            let mut name_str = name.to_uppercase();
            if name_str.chars().count() > i_w {
                name_str = name_str.chars().take(i_w - 1).collect::<String>();
            }

            esc.bold(true);
            esc.size(1, 2); // Taller text to make items pop (like in standard KDS)
            
            let mut line = format!("{:<i_w$}{:>q_w$}", name_str, qty_str, i_w = i_w, q_w = q_w);
            if show_prices {
                let price = item.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
                line.push_str(&format!("{:>p_w$.2}", price, p_w = p_w));
            }
            esc.text_line(&line);
            esc.size(1, 1);
            esc.bold(false);

            // Variant / Modifiers block
            let variant_name = item.get("variantName").and_then(|v| v.as_str()).unwrap_or("Default Variant");
            let unit_name = item.get("selectedUnit").and_then(|v| v.get("unitName")).and_then(|v| v.as_str());

            if variant_name != "Default Variant" || unit_name.is_some() {
                let mut var_str = String::from("  • ");
                if variant_name != "Default Variant" {
                    var_str.push_str(variant_name);
                    var_str.push_str(" ");
                }
                if let Some(un) = unit_name {
                    var_str.push_str(&format!("({})", un));
                }
                esc.text_line(&var_str);
            }
            esc.feed(1); // Space between items
        }
    }

    // --- SPECIAL INSTRUCTIONS ---
    if show_notes {
        if let Some(instructions) = order.get("instructions").and_then(|v| v.as_str()) {
            if !instructions.trim().is_empty() {
                esc.divider(width);
                esc.align(1);
                esc.bold(true);
                esc.text_line("SPECIAL INSTRUCTIONS");
                esc.bold(false);
                
                esc.inverse(true);
                esc.text_line(&format!(" {} ", instructions.to_uppercase()));
                esc.inverse(false);
                esc.feed(1);
            }
        }
    }

    esc.align(0);
    esc.divider(width);

    // --- FOOTER SUMMARY ---
    esc.align(1);
    esc.text_line(&format!("Total Items: {}", total_items));
    
    // Add current print timestamp
    let current_time = chrono::Local::now().format("%m/%d/%Y %H:%M:%S").to_string();
    esc.text_line(&format!("Printed: {}", current_time));

    esc.feed(1);
    esc.bold(true);
    esc.text_line("- END OF TICKET -");
    esc.bold(false);

    esc.feed(4); // Advance paper enough so the tear/cut clears the printhead
    esc.cut();

    // Encode standard output to be handled by printer methods or UI
    let base64_str = general_purpose::STANDARD.encode(&esc.bytes);
    Ok(base64_str)
}