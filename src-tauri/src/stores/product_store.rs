use crate::models::{PosProduct, ProductsSyncResponse, ProductSearchResponse};
use anyhow::{Context, Result};
use log::{error, info};
use reqwest::header::{HeaderMap, HeaderValue};
use sqlx::{Row, SqlitePool};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};
use tokio::fs as async_fs;

use crate::auth_store::AuthState;

const TIMEOUT_SECONDS: u64 = 60;
const MAIN_DB_NAME: &str = "sqlite:pos_main.db";

// --- State Management ---
// We no longer need to hold thousands of products in RAM. 
// The DB is the single source of truth.
pub struct ProductState;

impl ProductState {
    pub fn new() -> Self {
        Self
    }
}

// --- DB Helper ---
async fn get_db_pool(app: &AppHandle) -> Result<SqlitePool, String> {
    let instances = app.state::<DbInstances>();
    let guard = instances.0.read().await;

    if let Some(DbPool::Sqlite(pool)) = guard.get(MAIN_DB_NAME) {
        Ok(pool.clone())
    } else {
        Err(format!(
            "Database {} not found. Ensure it is preloaded via tauri.conf.json.",
            MAIN_DB_NAME
        ))
    }
}

// --- Initialization & Migration ---
pub async fn init_state(app: &AppHandle) {
    let pool = match get_db_pool(app).await {
        Ok(p) => p,
        Err(e) => {
            error!("[ProductStore] Failed to get main DB pool: {}", e);
            return;
        }
    };

    // 1. Create Products Table
    let create_products_table = r#"
        CREATE TABLE IF NOT EXISTS products (
            product_id TEXT,
            location_id TEXT,
            category TEXT,
            product_name TEXT,
            search_text TEXT,
            payload TEXT,
            PRIMARY KEY (product_id, location_id)
        )
    "#;

    // 2. Create Sync Metadata Table
    let create_sync_table = r#"
        CREATE TABLE IF NOT EXISTS product_sync_meta (
            location_id TEXT PRIMARY KEY,
            last_sync TEXT
        )
    "#;

    let _ = sqlx::query(create_products_table).execute(&pool).await;
    let _ = sqlx::query(create_sync_table).execute(&pool).await;

    // 3. One-Time Migration from old JSON files
    let _ = migrate_legacy_files_to_db(app, &pool).await;
}

async fn migrate_legacy_files_to_db(app: &AppHandle, pool: &SqlitePool) -> Result<()> {
    let app_dir = app.path().app_data_dir().context("No App Data Dir")?;
    
    // Read all files in the app data dir looking for products_loc_*.json
    let mut entries = tokio::fs::read_dir(&app_dir).await?;
    
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        let filename = path.file_name().unwrap_or_default().to_string_lossy();
        
        if filename.starts_with("products_loc_") && filename.ends_with(".json") {
            let location_id = filename
                .replace("products_loc_", "")
                .replace(".json", "");
            
            info!("[ProductStore] Found legacy product file for location {}. Migrating...", location_id);
            
            let content = tokio::fs::read_to_string(&path).await?;
            if let Ok((last_sync, products)) = serde_json::from_str::<(Option<String>, Vec<PosProduct>)>(&content) {
                
                // Start a transaction for speed
                let mut tx = pool.begin().await?;
                
                for product in products {
                    let search_text = build_search_text(&product);
                    let payload = serde_json::to_string(&product).unwrap_or_default();
                    
                    let _ = sqlx::query(
                        "INSERT OR IGNORE INTO products (product_id, location_id, category, product_name, search_text, payload) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
                    )
                    .bind(&product.product_id)
                    .bind(&location_id)
                    .bind(&product.category)
                    .bind(&product.product_name)
                    .bind(search_text)
                    .bind(payload)
                    .execute(&mut *tx)
                    .await;
                }

                if let Some(ts) = last_sync {
                    let _ = sqlx::query("INSERT OR REPLACE INTO product_sync_meta (location_id, last_sync) VALUES (?1, ?2)")
                        .bind(&location_id)
                        .bind(ts)
                        .execute(&mut *tx)
                        .await;
                }

                tx.commit().await?;
                info!("[ProductStore] Migration complete for location {}. Deleting old file.", location_id);
                let _ = tokio::fs::remove_file(&path).await;
            }
        }
    }
    Ok(())
}

fn build_search_text(product: &PosProduct) -> String {
    let mut search_terms = vec![product.product_name.to_lowercase()];
    for variant in &product.variants {
        search_terms.push(variant.sku.to_lowercase());
        if let Some(barcode) = &variant.barcode {
            search_terms.push(barcode.to_lowercase());
        }
        search_terms.push(variant.variant_name.to_lowercase());
    }
    search_terms.join(" ")
}

// --- Helper: Cache Single Image ---
async fn get_images_dir(app: &AppHandle) -> Result<PathBuf> {
    let app_dir = app.path().app_data_dir().context("Failed to resolve App Data Directory")?;
    let images_dir = app_dir.join("product_images");

    if !images_dir.exists() {
        tokio::fs::create_dir_all(&images_dir).await.context("Failed to create Images Directory")?;
    }
    Ok(images_dir)
}

async fn cache_image(app: &AppHandle, url: &str) -> Option<String> {
    if url.trim().is_empty() { return None; }

    let clean_name = url.replace("https://", "").replace("http://", "").replace('/', "_").replace(':', "").replace('?', "_");
    let filename = if clean_name.contains('.') { clean_name } else { format!("{}.jpg", clean_name) };

    let images_dir = match get_images_dir(app).await {
        Ok(d) => d,
        Err(_) => return Some(url.to_string()),
    };

    let file_path = images_dir.join(&filename);
    let file_path_str = file_path.to_string_lossy().to_string();

    if file_path.exists() {
        if let Ok(metadata) = tokio::fs::metadata(&file_path).await {
            if metadata.len() > 0 { return Some(file_path_str); }
        }
        let _ = async_fs::remove_file(&file_path).await;
    }

    match reqwest::get(url).await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(bytes) = resp.bytes().await {
                if async_fs::write(&file_path, &bytes).await.is_ok() {
                    if let Ok(metadata) = tokio::fs::metadata(&file_path).await {
                        if metadata.len() > 0 { return Some(file_path_str); }
                    }
                }
            }
            Some(url.to_string())
        }
        _ => Some(url.to_string()),
    }
}

// --- 1. Load Data on Startup ---
pub async fn load_products_from_disk(
    _app: &AppHandle,
    _state: &ProductState,
    _location_id: &str,
) -> Result<()> {
    // With SQLite, data is implicitly available on disk. No memory pre-loading needed.
    Ok(())
}

// --- 2. Sync Engine ---
pub async fn run_sync(
    app: AppHandle,
    _state: &ProductState,
    auth_state: &AuthState,
    force_full_sync: bool,
) -> Result<usize> {
    let pool = get_db_pool(&app).await.map_err(|e| anyhow::anyhow!(e))?;

    let (base_url, location_id, device_key) = {
        let config_guard = auth_state.device_config.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        let config = config_guard.as_ref().ok_or_else(|| anyhow::anyhow!("Device not configured"))?;
        (config.base_url.clone(), config.location_id.clone(), config.device_key.clone())
    };

    let (member_token, member_id) = {
        let token_guard = auth_state.member_token.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        let user_guard = auth_state.current_user.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
        (token_guard.clone(), user_guard.as_ref().map(|u| u.id.clone()))
    };

    if base_url.is_empty() { return Err(anyhow::anyhow!("Base URL is empty")); }

    let target_url = format!("{}/{}", base_url.trim_end_matches('/'), crate::api_config::routes::PRODUCTS);

    // Get last sync time from DB
    let last_sync_time: Option<String> = if force_full_sync {
        None
    } else {
        let row = sqlx::query("SELECT last_sync FROM product_sync_meta WHERE location_id = ?1")
            .bind(&location_id)
            .fetch_optional(&pool)
            .await?;
        row.map(|r| r.get("last_sync"))
    };

    let mut headers = HeaderMap::new();
    let mut val = HeaderValue::from_str(&device_key).map_err(|_| anyhow::anyhow!("Invalid Device Key"))?;
    val.set_sensitive(true);
    headers.insert("X-API-KEY", val);

    if let Some(token) = member_token {
        let mut val = HeaderValue::from_str(&token).unwrap();
        val.set_sensitive(true);
        headers.insert("X-MEMBER-TOKEN", val);
    }


    let client = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(TIMEOUT_SECONDS))
        .build()?;

    let mut query_params = vec![
        ("locationId", location_id.clone()),
        ("page", "1".to_string()),
        ("limit", "2000".to_string()),
        ("categoryId", "all".to_string()),
    ];

    if let Some(ts) = &last_sync_time {
        query_params.push(("lastSync", ts.clone()));
    }

    let response = client.get(&target_url).query(&query_params).send().await?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!("Server returned error: {}", response.status()));
    }

    let v2_resp = response.json::<crate::models::V2Response<ProductsSyncResponse>>().await?;
    let mut res_body = v2_resp.data;

    // Download images concurrently or sequentially
    for product in &mut res_body.products {
        if let Some(url) = &product.image_url {
            if !url.starts_with('/') && !url.starts_with("C:") && url.starts_with("http") {
                product.image_url = cache_image(&app, url).await;
            }
        }
    }

    let incoming_count = res_body.products.len();
    let new_sync_time = v2_resp.meta
        .and_then(|m| m.get("syncTimestamp").and_then(|t| t.as_str().map(|s| s.to_string())))
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    // --- SQLite UPSERT in Transaction ---
    let mut tx = pool.begin().await?;

    for product in res_body.products {
        let search_text = build_search_text(&product);
        let payload = serde_json::to_string(&product)?;

        let query = r#"
            INSERT INTO products (product_id, location_id, category, product_name, search_text, payload)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(product_id, location_id) DO UPDATE SET
                category = excluded.category,
                product_name = excluded.product_name,
                search_text = excluded.search_text,
                payload = excluded.payload
        "#;

        sqlx::query(query)
            .bind(&product.product_id)
            .bind(&location_id)
            .bind(&product.category)
            .bind(&product.product_name)
            .bind(search_text)
            .bind(payload)
            .execute(&mut *tx)
            .await?;
    }

    // Update Sync Time
    sqlx::query("INSERT OR REPLACE INTO product_sync_meta (location_id, last_sync) VALUES (?1, ?2)")
        .bind(&location_id)
        .bind(new_sync_time)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(incoming_count)
}

// --- 3. Stock Management ---
pub async fn deduct_stock(
    app: AppHandle,
    _state: &ProductState,
    location_id: &str,
    cart_items: &Vec<serde_json::Value>,
    allow_negative: bool,
) -> Result<()> {
    let pool = get_db_pool(&app).await.map_err(|e| anyhow::anyhow!(e))?;

    let mut tx = pool.begin().await?;

    for item in cart_items {
        let product_id = item.get("productId").and_then(|v| v.as_str());
        let variant_id = item.get("variantId").and_then(|v| v.as_str());
        let unit_id = item.get("sellingUnitId").and_then(|v| v.as_str());
        let quantity = item.get("quantity").and_then(|v| v.as_f64()).unwrap_or(0.0) as i32;

        if let (Some(p_id), Some(v_id)) = (product_id, variant_id) {
            
            // 1. Fetch exactly the ONE product we are modifying
            let row = sqlx::query("SELECT payload FROM products WHERE product_id = ?1 AND location_id = ?2")
                .bind(p_id)
                .bind(location_id)
                .fetch_optional(&mut *tx)
                .await?;

            if let Some(r) = row {
                let payload_str: String = r.get("payload");
                let mut product: PosProduct = serde_json::from_str(&payload_str)?;

                let mut updated = false;

                // 2. Modify the struct in memory
                if let Some(variant) = product.variants.iter_mut().find(|v| v.variant_id == v_id) {
                    let conversion = if let Some(u_id) = unit_id {
                        variant.sellable_units.iter().find(|u| u.unit_id == u_id).map(|u| u.conversion).unwrap_or(1.0)
                    } else {
                        1.0
                    };

                    let deducted_qty = (quantity as f64 * conversion) as i32;

                    if !allow_negative && variant.stock < deducted_qty {
                        return Err(anyhow::anyhow!(
                            "Insufficient stock for {}: requested {}, available {}",
                            product.product_name, deducted_qty, variant.stock
                        ));
                    }

                    variant.stock -= deducted_qty;
                    if let Some(total) = product.total_stock.as_mut() {
                        *total -= deducted_qty;
                    }
                    updated = true;
                }

                // 3. Save only this product back to DB
                if updated {
                    let new_payload = serde_json::to_string(&product)?;
                    sqlx::query("UPDATE products SET payload = ?1 WHERE product_id = ?2 AND location_id = ?3")
                        .bind(new_payload)
                        .bind(p_id)
                        .bind(location_id)
                        .execute(&mut *tx)
                        .await?;
                }
            }
        }
    }

    tx.commit().await?;
    Ok(())
}

// --- 4. Search Logic ---
pub async fn search_local(
    app: &AppHandle,
    _state: &ProductState,
    location_id: &str,
    query: String,
    category: String,
    page: Option<usize>,
    page_size: Option<usize>,
) -> ProductSearchResponse {
    let pool = match get_db_pool(app).await {
        Ok(p) => p,
        Err(_) => return ProductSearchResponse { products: vec![], total_count: 0 },
    };

    let p = page.unwrap_or(1).max(1);
    let ps = page_size.unwrap_or(50);
    let offset = (p - 1) * ps;

    let filter_category = category != "all" && !category.is_empty();
    let lower_query = format!("%{}%", query.trim().to_lowercase());

    // Build Dynamic Query
    let (count_sql, data_sql) = if filter_category {
        (
            "SELECT COUNT(*) as count FROM products WHERE location_id = ?1 AND category = ?2 AND search_text LIKE ?3",
            "SELECT payload FROM products WHERE location_id = ?1 AND category = ?2 AND search_text LIKE ?3 LIMIT ?4 OFFSET ?5"
        )
    } else {
        (
            "SELECT COUNT(*) as count FROM products WHERE location_id = ?1 AND search_text LIKE ?2",
            "SELECT payload FROM products WHERE location_id = ?1 AND search_text LIKE ?2 LIMIT ?3 OFFSET ?4"
        )
    };

    // Execute Count
    let mut total_count = 0;
    if filter_category {
        if let Ok(row) = sqlx::query(count_sql).bind(location_id).bind(&category).bind(&lower_query).fetch_one(&pool).await {
            total_count = row.get::<i32, _>("count") as usize;
        }
    } else {
        if let Ok(row) = sqlx::query(count_sql).bind(location_id).bind(&lower_query).fetch_one(&pool).await {
            total_count = row.get::<i32, _>("count") as usize;
        }
    }

    // Execute Fetch
    let rows = if filter_category {
        sqlx::query(data_sql).bind(location_id).bind(&category).bind(&lower_query).bind(ps as i32).bind(offset as i32).fetch_all(&pool).await
    } else {
        sqlx::query(data_sql).bind(location_id).bind(&lower_query).bind(ps as i32).bind(offset as i32).fetch_all(&pool).await
    };

    let mut products = Vec::new();
    if let Ok(rows) = rows {
        for row in rows {
            let payload: String = row.get("payload");
            if let Ok(product) = serde_json::from_str::<PosProduct>(&payload) {
                products.push(product);
            }
        }
    }

    ProductSearchResponse { products, total_count }
}

pub async fn get_products_by_ids(
    app: &AppHandle,
    _state: &ProductState,
    location_id: &str,
    ids: Vec<String>,
) -> Vec<PosProduct> {
    if ids.is_empty() { return Vec::new(); }
    
    let pool = match get_db_pool(app).await {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    // We fetch all payloads for the location and filter (Alternative: Dynamic SQL `IN` clause)
    // Since this usually looks up a few cart items, a direct fetch of the whole JSON is fine,
    // but a proper `IN` clause is faster. SQLite has limits on params, so we handle it simply:
    let mut products = Vec::new();
    for id in ids {
        let query = "SELECT payload FROM products WHERE location_id = ?1 AND (product_id = ?2 OR search_text LIKE ?3)";
        let like_id = format!("%{}%", id);
        
        if let Ok(row) = sqlx::query(query).bind(location_id).bind(&id).bind(&like_id).fetch_optional(&pool).await {
            if let Some(r) = row {
                let payload: String = r.get("payload");
                if let Ok(product) = serde_json::from_str::<PosProduct>(&payload) {
                    products.push(product);
                }
            }
        }
    }

    products
}

// --- 5. Location Switch Command ---
#[tauri::command]
pub async fn switch_location(
    app: AppHandle,
    state: tauri::State<'_, ProductState>,
    _auth_state: tauri::State<'_, AuthState>,
    new_location_id: String,
) -> Result<Vec<PosProduct>, String> {
    
    // 1. Return cached products immediately from DB (First 50 items to load UI fast)
    let search_res = search_local(&app, &state, &new_location_id, "".to_string(), "all".to_string(), Some(1), Some(50)).await;
    let cached = search_res.products;

    // 2. Trigger background sync (delta if we have lastSync, full if first visit)
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let state_inner = app_clone.state::<ProductState>();
        let auth_inner = app_clone.state::<AuthState>();
        let _ = run_sync(app_clone.clone(), &state_inner, &auth_inner, false).await;
    });

    Ok(cached)
}