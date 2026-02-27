use tauri::{AppHandle, State};

use crate::models;
use crate::stores::auth_store::AuthState;
use crate::stores::customer_store::{self, CustomerState};
use crate::stores::product_store::{self, ProductState};
use crate::stores::sales_store::{self, SalesState};

#[tauri::command]
pub async fn sync_products_command(
    app: AppHandle,
    state: State<'_, ProductState>,
    auth_state: State<'_, AuthState>,
) -> Result<String, String> {
    match product_store::run_sync(app, &state, &auth_state, false).await {
        Ok(count) => Ok(format!("Synced {} products", count)),
        Err(e) => {
            // We still convert the error to a string so the frontend can display it
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub fn search_products_command(
    state: State<'_, ProductState>,
    auth_state: State<'_, AuthState>,
    query: String,
    category: String,
    page: Option<usize>,
    page_size: Option<usize>,
) -> models::ProductSearchResponse {
    // Get current location from auth state
    let location_id = {
        let config_guard = auth_state
            .device_config
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        config_guard
            .as_ref()
            .map(|c| c.location_id.clone())
            .unwrap_or_default()
    };
    product_store::search_local(&state, &location_id, query, category, page, page_size)
}

#[tauri::command]
pub fn search_global_command(
    product_state: State<'_, ProductState>,
    customer_state: State<'_, CustomerState>,
    sales_state: State<'_, SalesState>,
    auth_state: State<'_, AuthState>,
    query: String,
) -> models::GlobalSearchResult {
    // 1. Search Products
    let location_id = {
        let config_guard = auth_state
            .device_config
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        config_guard
            .as_ref()
            .map(|c| c.location_id.clone())
            .unwrap_or_default()
    };

    let products = product_store::search_local(
        &product_state,
        &location_id,
        query.clone(),
        "All".to_string(),
        Some(1),
        Some(5),
    )
    .products;

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
        sales,
    }
}

#[tauri::command]
pub fn get_products_by_ids_command(
    state: State<'_, ProductState>,
    auth_state: State<'_, AuthState>,
    ids: Vec<String>,
) -> Vec<models::PosProduct> {
    // Get current location from auth state
    let location_id = {
        let config_guard = auth_state
            .device_config
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        config_guard
            .as_ref()
            .map(|c| c.location_id.clone())
            .unwrap_or_default()
    };
    product_store::get_products_by_ids(&state, &location_id, ids)
}
