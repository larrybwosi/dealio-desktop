use hidapi::HidApi;
use tauri::{AppHandle, Emitter};
use std::thread;
use std::time::Duration;
use pcsc::{Context, Protocols, ReaderState, Scope, ShareMode, State as PcscState, PNP_NOTIFICATION};
use std::net::{TcpListener, TcpStream};
use std::io::{Write, BufReader, BufRead};

#[derive(Clone, serde::Serialize)]
struct ScanPayload {
    message: String,
    source: String, // Added source to distinguish USB vs Network
}

// ----------------------------------------------------------------
// SECTION 1: USB HID (Wired Scanners / HID Mode)
// ----------------------------------------------------------------

#[tauri::command]
pub fn list_hid_devices() -> Result<Vec<(u16, u16, String)>, String> {
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

#[tauri::command]
pub fn start_scan(app: AppHandle, vid_hex: String, pid_hex: String) -> Result<String, String> {
    let vid = u16::from_str_radix(vid_hex.trim_start_matches("0x"), 16)
        .map_err(|_| "Invalid Vendor ID format")?;
    let pid = u16::from_str_radix(pid_hex.trim_start_matches("0x"), 16)
        .map_err(|_| "Invalid Product ID format")?;

    println!("[USB Scanner] Connecting to VID: {:04X}, PID: {:04X}", vid, pid);

    tauri::async_runtime::spawn(async move {
        let api = match HidApi::new() {
            Ok(api) => api,
            Err(e) => {
                eprintln!("[USB Scanner] HID API Init Error: {}", e);
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

        let _ = app.emit("scanner-status", "Connected (USB)");
        println!("[USB Scanner] Device connected.");

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
                            for part in parts.iter().take(parts.len() - 1) {
                                let code = part.trim();
                                if !code.is_empty() {
                                    println!("[USB Scanner] Code detected: {}", code);
                                    let _ = app.emit("scanner-data", ScanPayload { 
                                        message: code.to_string(),
                                        source: "USB".to_string()
                                    });
                                }
                            }
                            string_buffer = parts.last().unwrap_or(&"").to_string();
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[USB Scanner] Read Error: {}", e);
                    let _ = app.emit("scanner-status", "Disconnected (USB)");
                    break;
                }
            }
        }
    });

    Ok("USB Scanner listener started successfully".to_string())
}

// ----------------------------------------------------------------
// SECTION 2: NETWORK SCANNERS (TCP Listener)
// ----------------------------------------------------------------

#[tauri::command]
pub fn start_network_scan_server(app: AppHandle, port: u16) -> Result<String, String> {
    // Bind to 0.0.0.0 to allow connections from external devices (scanners)
    let listener = TcpListener::bind(format!("0.0.0.0:{}", port))
        .map_err(|e| format!("Failed to bind to port {}: {}", port, e))?;

    println!("[Net Scanner] Server started on port {}", port);
    // Notify frontend
    let _ = app.emit("scanner-status", format!("Network Server Listening on :{}", port));

    // Spawn a dedicated thread for accepting connections
    thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    println!("[Net Scanner] New scanner connected: {:?}", stream.peer_addr());
                    let app_clone = app.clone();

                    // Handle each scanner connection in its own thread
                    thread::spawn(move || {
                        let mut reader = BufReader::new(stream);
                        let mut line = String::new();

                        // Continuously read lines (barcodes typically end in \n)
                        while match reader.read_line(&mut line) {
                            Ok(bytes) => bytes > 0,
                            Err(_) => false,
                        } {
                            let code = line.trim().to_string();
                            if !code.is_empty() {
                                println!("[Net Scanner] Code received: {}", code);
                                let _ = app_clone.emit("scanner-data", ScanPayload { 
                                    message: code,
                                    source: "Network".to_string()
                                });
                            }
                            line.clear();
                        }
                        println!("[Net Scanner] Connection closed");
                    });
                }
                Err(e) => {
                    eprintln!("[Net Scanner] Connection failed: {}", e);
                }
            }
        }
    });

    Ok(format!("Network scanner server running on port {}", port))
}

// ----------------------------------------------------------------
// SECTION 3: NETWORK PRINTERS (Raw TCP)
// ----------------------------------------------------------------

#[tauri::command]
pub fn print_to_network(ip: String, port: String, payload: String) -> Result<String, String> {
    let address = format!("{}:{}", ip, port);
    
    // Connect with a timeout (handled by OS default here, or wrapping with simple connect)
    let mut stream = TcpStream::connect(&address)
        .map_err(|e| format!("Failed to connect to printer at {}: {}", address, e))?;

    // Send the raw bytes (ZPL / ESC/POS / Text)
    stream.write_all(payload.as_bytes())
        .map_err(|e| format!("Failed to send data: {}", e))?;

    stream.flush().map_err(|_| "Failed to flush stream")?;

    Ok("Print job sent successfully".to_string())
}

// ----------------------------------------------------------------
// SECTION 4: NFC (PC/SC)
// ----------------------------------------------------------------

#[tauri::command]
pub fn start_nfc_listener(app: AppHandle) {
    thread::spawn(move || {
        let ctx = match Context::establish(Scope::User) {
            Ok(ctx) => ctx,
            Err(_) => return, 
        };

        let mut readers_buf = [0; 2048];
        let mut reader_states = vec![
            ReaderState::new(PNP_NOTIFICATION(), PcscState::UNAWARE),
        ];

        loop {
            if ctx.get_status_change(Some(Duration::from_millis(1000)), &mut reader_states).is_ok() {
                if let Ok(readers) = ctx.list_readers(&mut readers_buf) {
                    for reader in readers {
                        if let Ok(card) = ctx.connect(reader, ShareMode::Shared, Protocols::ANY) {
                            let apdu = [0xFF, 0xCA, 0x00, 0x00, 0x00];
                            let mut rapdu_buf = [0; 256];

                            if let Ok(rapdu) = card.transmit(&apdu, &mut rapdu_buf) {
                                let uid: String = rapdu.iter()
                                    .map(|b| format!("{:02X}", b))
                                    .collect();
                                
                                let clean_uid = &uid[0..uid.len()-4]; 

                                app.emit("nfc-read", clean_uid).unwrap();
                                thread::sleep(Duration::from_secs(2));
                            }
                        }
                    }
                }
            }
        }
    });
}