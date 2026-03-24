use keyring::Entry;
use log::{error, info, warn};
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};

const KEYRING_SERVICE: &str = "dealio-desktop";

use crate::customer_store::CustomerState;

#[tauri::command]
pub async fn dangerously_clear_all_data(app: AppHandle) -> Result<(), String> {
    warn!("[DangerZone] Starting full data wipe...");

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
                    if let Err(e) = tokio::fs::remove_file(&path).await {
                        error!("[DangerZone] Failed to delete file {:?}: {}", path, e);
                    } else {
                        info!("[DangerZone] Deleted: {:?}", file);
                    }
                }
            }

            // Delete product images directory
            let images_dir = app_dir.join("product_images");
            if images_dir.exists() {
                if let Err(e) = tokio::fs::remove_dir_all(&images_dir).await {
                    error!("[DangerZone] Failed to delete images directory: {}", e);
                } else {
                    info!("[DangerZone] Deleted: product_images directory");
                }
            }
        }
    }

    // 2. Wipe Config Directory (Auth Store)
    if let Some(proj_dirs) = directories::ProjectDirs::from("com", "dealio", "pos") {
        let config_dir = proj_dirs.config_dir();
        let device_config_path = config_dir.join("device.json");
        if device_config_path.exists() {
            if let Err(e) = tokio::fs::remove_file(&device_config_path).await {
                error!("[DangerZone] Failed to delete device config: {}", e);
            } else {
                info!("[DangerZone] Deleted: device.json");
            }
        }
    }

    // 3. Clear Keyring Entries
    let keyring_keys = ["device-config", "customer_store_key", "sales_queue_key"];

    for key in keyring_keys {
        if let Ok(entry) = Entry::new(KEYRING_SERVICE, key) {
            if let Err(e) = entry.delete_password() {
                error!("[DangerZone] Failed to delete keyring key {}: {}", key, e);
            } else {
                info!("[DangerZone] Deleted Keyring: {}", key);
            }
        }
    }

    // 4. Reset SQLite Databases
    let instances = app.state::<DbInstances>();
    let guard = instances.0.read().await;

    if let Some(DbPool::Sqlite(pool)) = guard.get("sqlite:pos_main.db") {
        let _ = sqlx::query("DELETE FROM products").execute(pool).await;
        let _ = sqlx::query("DELETE FROM product_sync_meta").execute(pool).await;
        let _ = sqlx::query("DELETE FROM queued_sales").execute(pool).await;
        info!("[DangerZone] Cleared pos_main.db SQLite tables.");
    }
    
    if let Some(DbPool::Sqlite(pool)) = guard.get("sqlite:kds_orders.db") {
        let _ = sqlx::query("DELETE FROM kds_orders").execute(pool).await;
        info!("[DangerZone] Cleared kds_orders.db SQLite tables.");
    }

    // 5. Reset In-Memory State for Customers
    let customer_state = app.state::<CustomerState>();
    {
        let mut customers = customer_state
            .customers
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        customers.clear();
    }
    {
        let mut last_sync = customer_state
            .last_sync_token
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *last_sync = None;
    }

    info!("[DangerZone] Full data wipe completed (files, database, and memory).");
    Ok(())
}