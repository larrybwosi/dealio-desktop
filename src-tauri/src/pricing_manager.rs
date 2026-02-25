use tauri::{AppHandle, State};

use crate::models;
use crate::stores::auth_store::AuthState;
use crate::stores::pricing_store::{self, PricingState};

#[derive(serde::Deserialize)]
pub struct BatchPricingRequest {
    pub variant_id: String,
    pub unit_id: Option<String>,
    pub is_base_unit: bool,
}

#[tauri::command]
pub async fn sync_pricing_command(
    app: AppHandle,
    state: State<'_, PricingState>,
    auth_state: State<'_, AuthState>,
) -> Result<String, String> {
    match pricing_store::run_sync(app, &state, &auth_state).await {
        Ok(timestamp) => Ok(timestamp),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn resolve_price_batch_command(
    state: State<'_, PricingState>,
    customer_id: Option<String>,
    requests: Vec<BatchPricingRequest>,
) -> Vec<Option<f64>> {
    let mut results = Vec::new();
    for req in requests {
        let price = pricing_store::resolve_price(
            &state,
            customer_id.clone(),
            req.variant_id,
            req.unit_id,
            req.is_base_unit,
        );
        results.push(price);
    }
    results
}

#[tauri::command]
pub fn get_pos_pricing_command(state: State<'_, PricingState>) -> models::PosPricingData {
    pricing_store::get_all_pricing(&state)
}