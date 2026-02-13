use hidapi::HidApi;
use tauri::{AppHandle, Emitter};
use std::thread;
use std::time::Duration;
use pcsc::{Context, Protocols, ReaderState, Scope, ShareMode, State as PcscState, PNP_NOTIFICATION};

#[derive(Clone, serde::Serialize)]
struct ScanPayload {
    message: String,
}

// Helper command to list devices
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

// The Main Scanner Command
#[tauri::command]
pub fn start_scan(app: AppHandle, vid_hex: String, pid_hex: String) -> Result<String, String> {
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
pub fn start_nfc_listener(app: AppHandle) {
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