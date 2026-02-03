use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use keyring::Entry;

const KEYRING_SERVICE: &str = "dealio-desktop";

#[tauri::command]
pub fn dangerously_clear_all_data(app: AppHandle) -> Result<(), String> {
    println!("[DangerZone] Starting full data wipe...");

    // 1. Wipe App Data Directory Files
    if let Ok(app_dir) = app.path().app_data_dir() {
        if app_dir.exists() {
            let files_to_delete = [
                "dealio_products.json",
                "secure_customers.bin",
                "secure_sales_queue.bin",
                "secure_pricing.bin",
                "notification-history.json",
                "scanner-config.json",
            ];

            for file in files_to_delete {
                let path = app_dir.join(file);
                if path.exists() {
                    if let Err(e) = fs::remove_file(&path) {
                        eprintln!("[DangerZone] Failed to delete file {:?}: {}", path, e);
                    } else {
                        println!("[DangerZone] Deleted: {:?}", file);
                    }
                }
            }

            // Delete product images directory
            let images_dir = app_dir.join("product_images");
            if images_dir.exists() {
                if let Err(e) = fs::remove_dir_all(&images_dir) {
                    eprintln!("[DangerZone] Failed to delete images directory: {}", e);
                } else {
                    println!("[DangerZone] Deleted: product_images directory");
                }
            }
        }
    }

    // 2. Wipe Config Directory (Auth Store)
    if let Some(proj_dirs) = directories::ProjectDirs::from("com", "dealio", "pos") {
        let config_dir = proj_dirs.config_dir();
        let device_config_path = config_dir.join("device.json");
        if device_config_path.exists() {
            if let Err(e) = fs::remove_file(&device_config_path) {
                eprintln!("[DangerZone] Failed to delete device config: {}", e);
            } else {
                println!("[DangerZone] Deleted: device.json");
            }
        }
    }

    // 3. Clear Keyring Entries
    let keyring_keys = [
        "device-config",
        "customer_store_key",
        "sales_queue_key",
    ];

    for key in keyring_keys {
        if let Ok(entry) = Entry::new(KEYRING_SERVICE, key) {
            if let Err(e) = entry.delete_password() {
                eprintln!("[DangerZone] Failed to delete keyring key {}: {}", key, e);
            } else {
                println!("[DangerZone] Deleted Keyring: {}", key);
            }
        }
    }

    println!("[DangerZone] Full data wipe completed.");
    Ok(())
}
