use tauri::{AppHandle, State};
// use tauri_plugin_aptabase::EventTracker;

use crate::models::Shift;
use crate::stores::auth_store::AuthState;
use crate::stores::shift_store::{self, ShiftState};

// --- SHIFT COMMANDS ---

#[tauri::command]
pub fn get_shift_command(state: State<'_, ShiftState>) -> Option<Shift> {
    shift_store::get_shift_status(&state)
}

#[tauri::command]
pub fn add_cash_drop_command(
    state: State<'_, ShiftState>,
    amount: f64,
    reason: String,
) -> Result<(), String> {
    shift_store::record_cash_drop(&state, amount, reason)
}

#[tauri::command]
pub fn record_shift_sale_command(state: State<'_, ShiftState>, amount: f64) -> Result<(), String> {
    shift_store::record_cash_sale(&state, amount)
}

#[tauri::command]
pub fn open_shift_command(
    app: AppHandle,
    state: State<'_, ShiftState>,
    card_id: String,
    pin: String,
    float_amount: f64,
) -> Result<Shift, String> {
    if card_id.is_empty() || pin.is_empty() {
        return Err("Credentials missing".to_string());
    }

    // Now passes card_id and pin individually to shift_store
    let result = shift_store::open_new_shift(&state, card_id.clone(), pin, float_amount);

    // --- Audit Logging ---
    if let Ok(ref shift) = result {
        let _ = crate::stores::audit_store::write_event(
            &app,
            crate::stores::audit_store::AuditLevel::Info,
            "SHIFT_OPENED",
            Some(card_id),
            None,
            None,
            None,
            serde_json::json!({ "shift_id": shift.id, "float": float_amount }),
        );

        /*
        let _ = app.track_event(
            "shift_opened",
            Some(serde_json::json!({
                "shift_id": shift.id,
                "float": float_amount
            })),
        );
        */
        crate::capture_event(
            "shift_opened",
            Some(serde_json::json!({
                "shift_id": shift.id,
                "float": float_amount
            })),
        );
    }

    result
}

#[tauri::command]
pub async fn close_shift_command(
    app: AppHandle,
    state: State<'_, ShiftState>,
    card_id: String,
    pin: String,
    actual_count: f64,
    printer_name: Option<String>,
) -> Result<Shift, String> {
    if card_id.is_empty() || pin.is_empty() {
        return Err("Credentials missing".to_string());
    }

    let closed_shift = shift_store::close_current_shift(&state, actual_count)?;

    // --- Audit Logging ---
    let _ = crate::stores::audit_store::write_event(
        &app,
        crate::stores::audit_store::AuditLevel::Info,
        "SHIFT_CLOSED",
        Some(card_id),
        None,
        None,
        None,
        serde_json::json!({
            "shift_id": closed_shift.id,
            "total_cash_sales": closed_shift.total_cash_sales,
            "actual_cash": closed_shift.actual_cash,
            "variance": closed_shift.variance
        }),
    );

    /*
    let _ = app.track_event(
        "shift_closed",
        Some(serde_json::json!({
            "shift_id": closed_shift.id,
            "total_cash_sales": closed_shift.total_cash_sales,
            "variance": closed_shift.variance
        })),
    );
    */
    crate::capture_event(
        "shift_closed",
        Some(serde_json::json!({
            "shift_id": closed_shift.id,
            "total_cash_sales": closed_shift.total_cash_sales,
            "variance": closed_shift.variance
        })),
    );

    let report_text = shift_store::generate_z_report_text(&closed_shift);

    if let Some(p_name) = printer_name {
        let _ = crate::printer_manager::print_system_receipt(app, p_name, report_text, false).await;
    }

    Ok(closed_shift)
}

#[tauri::command]
pub async fn sync_shifts_command(
    state: State<'_, ShiftState>,
    auth_state: State<'_, AuthState>,
) -> Result<String, String> {
    shift_store::sync_pending_shifts(&state, &auth_state).await
}