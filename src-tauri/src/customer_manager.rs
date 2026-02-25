use tauri::{AppHandle, State};

use crate::models;
use crate::stores::auth_store::AuthState;
use crate::stores::customer_store::{self, CustomerState};

#[tauri::command]
pub async fn sync_customers_command(
    app: AppHandle,
    state: State<'_, CustomerState>,
    auth_state: State<'_, AuthState>,
) -> Result<String, String> {
    match customer_store::run_sync(app, &state, &auth_state).await {
        Ok(count) => Ok(format!("Synced {} customers", count)),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn create_customer_command(
    app: AppHandle,
    state: State<'_, CustomerState>,
    auth_state: State<'_, AuthState>,
    data: serde_json::Value,
) -> Result<models::PosCustomer, String> {
    customer_store::create_customer(app, &state, &auth_state, data)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_customers_command(
    state: State<'_, CustomerState>,
    query: String,
) -> Vec<models::PosCustomer> {
    customer_store::search_local(&state, query)
}

#[tauri::command]
pub fn get_customers_by_ids_command(
    state: State<'_, CustomerState>,
    ids: Vec<String>,
) -> Vec<models::PosCustomer> {
    customer_store::get_customers_by_ids(&state, ids)
}