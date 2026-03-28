use crate::auth_store::AuthState;
use crate::models::{CashMovement, Shift, ShiftSyncPayload};
use chrono::Utc;
use reqwest::header::{HeaderMap, HeaderValue};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use uuid::Uuid;

// The State container
pub struct ShiftState {
    pub current_shift: Mutex<Option<Shift>>,
    pub movements: Mutex<Vec<CashMovement>>,
}

impl Default for ShiftState {
    fn default() -> Self {
        Self::new()
    }
}

impl ShiftState {
    pub fn new() -> Self {
        Self {
            current_shift: Mutex::new(None),
            movements: Mutex::new(Vec::new()),
        }
    }
}

// --- LOGIC FUNCTIONS ---

pub fn open_new_shift(
    state: &ShiftState,
    card_id: String,
    pin: String,
    float_amount: f64,
    device_id: Option<String>,
) -> Result<Shift, String> {
    let mut shift_lock = state
        .current_shift
        .lock()
        .map_err(|_| "Failed to lock shift state")?;

    if shift_lock.is_some() {
        return Err("A shift is already open. Close it first.".to_string());
    }

    let new_shift = Shift {
        id: Uuid::now_v7().to_string(),
        opened_at: Utc::now(),
        closed_at: None,

        // Fix 1: Wrap String in Some() for Option fields
        operator_id: Some(card_id.clone()),
        operator_card_id: Some(card_id),
        operator_pin: Some(pin),

        starting_float: float_amount,
        total_cash_sales: 0.0,
        total_cash_drops: 0.0,
        total_cash_refunds: 0.0,
        expected_cash: float_amount,
        actual_cash: None,
        variance: None,
        device_id,
    };

    *shift_lock = Some(new_shift.clone());

    // Clear old movements on new shift open
    if let Ok(mut moves) = state.movements.lock() {
        moves.clear();
    }

    Ok(new_shift)
}

pub fn record_cash_sale(state: &ShiftState, amount: f64) -> Result<(), String> {
    let mut shift_lock = state.current_shift.lock().map_err(|_| "Lock error")?;

    if let Some(ref mut shift) = *shift_lock {
        shift.total_cash_sales += amount;
        shift.expected_cash += amount;
        Ok(())
    } else {
        Err("No active shift found".to_string())
    }
}

pub fn record_cash_drop(state: &ShiftState, amount: f64, reason: String) -> Result<(), String> {
    let mut shift_lock = state.current_shift.lock().map_err(|_| "Lock error")?;

    if let Some(ref mut shift) = *shift_lock {
        shift.total_cash_drops += amount;
        shift.expected_cash -= amount;

        let mut moves = state
            .movements
            .lock()
            .map_err(|_| "Lock error on movements")?;
        moves.push(CashMovement {
            amount,
            reason,
            timestamp: Utc::now(),
            movement_type: "DROP".to_string(),
        });

        Ok(())
    } else {
        Err("No active shift found".to_string())
    }
}

pub fn close_current_shift(state: &ShiftState, actual_count: f64) -> Result<Shift, String> {
    let mut shift_lock = state.current_shift.lock().map_err(|_| "Lock error")?;

    if let Some(ref mut shift) = *shift_lock {
        shift.closed_at = Some(Utc::now());
        shift.actual_cash = Some(actual_count);
        shift.variance = Some(actual_count - shift.expected_cash);

        let closed_shift = shift.clone();

        *shift_lock = None;
        Ok(closed_shift)
    } else {
        Err("No active shift to close".to_string())
    }
}

pub fn get_shift_status(state: &ShiftState) -> Option<Shift> {
    let lock = state
        .current_shift
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    lock.clone()
}

// --- RECEIPT GENERATION ---

pub fn generate_z_report_text(shift: &Shift) -> String {
    let date_str = shift
        .closed_at
        .unwrap_or(Utc::now())
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    let op = shift.operator_id.clone().unwrap_or("Unknown".to_string());

    format!(
        "
      Z-REPORT (SHIFT END)
--------------------------------
Date: {}
Operator: {}
Shift ID: {}
--------------------------------
OPENING FLOAT:      {:.2}
(+) CASH SALES:     {:.2}
(-) DROPS/PAYOUTS:  {:.2}
(-) REFUNDS:        {:.2}
--------------------------------
EXPECTED CASH:      {:.2}
ACTUAL COUNT:       {:.2}
--------------------------------
VARIANCE:           {:.2}
--------------------------------
",
        date_str,
        op,
        &shift.id[0..8],
        shift.starting_float,
        shift.total_cash_sales,
        shift.total_cash_drops,
        shift.total_cash_refunds,
        shift.expected_cash,
        shift.actual_cash.unwrap_or(0.0),
        shift.variance.unwrap_or(0.0)
    )
}

pub async fn sync_pending_shifts(
    state: &ShiftState,
    auth_state: &AuthState,
) -> Result<String, String> {
    // 1. Get Config/Auth from State
    let (base_url, location_id, device_key) = {
        let config_guard = auth_state
            .device_config
            .lock()
            .map_err(|_| "Lock error".to_string())?;
        let config = config_guard
            .as_ref()
            .ok_or("Device not configured".to_string())?;
        (
            config.base_url.clone(),
            config.location_id.clone(),
            config.device_key.clone(),
        )
    };

    let member_token = {
        let token_guard = auth_state
            .member_token
            .lock()
            .map_err(|_| "Lock error".to_string())?;
        token_guard.clone()
    };

    let shift_opt = {
        let lock = state
            .current_shift
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        lock.clone()
    };

    if let Some(shift) = shift_opt {
        if shift.closed_at.is_none() {
            return Ok("Shift is still open, not syncing yet.".to_string());
        }

        let hashed_pin = if let Some(pin) = shift.operator_pin.as_ref() {
            let mut hasher = Sha256::new();
            hasher.update(pin.as_bytes());
            format!("{:x}", hasher.finalize())
        } else {
            String::new()
        };

        let payload = ShiftSyncPayload {
            location_id: location_id.clone(),
            shift_id: shift.id,
            opened_at: shift.opened_at.to_rfc3339(),
            closed_at: shift.closed_at.map(|t| t.to_rfc3339()),

            operator_card_id: shift.operator_card_id.unwrap_or_default(),
            operator_pin: hashed_pin,

            starting_float: shift.starting_float,
            total_cash_sales: shift.total_cash_sales,
            total_cash_drops: shift.total_cash_drops,
            actual_cash_count: shift.actual_cash,
            variance: shift.variance,
        };

        // --- BUILD HEADERS ---
        let mut headers = HeaderMap::new();

        let mut val =
            HeaderValue::from_str(&device_key).map_err(|_| "Invalid Device Key".to_string())?;
        val.set_sensitive(true);
        headers.insert("X-API-KEY", val);

        if let Some(token) = member_token {
            let mut val =
                HeaderValue::from_str(&token).map_err(|_| "Invalid Token".to_string())?;
            val.set_sensitive(true);
            headers.insert("X-MEMBER-TOKEN", val);
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|e| e.to_string())?;

        let clean_base_url = base_url.trim_end_matches('/');
        let res = client
            .post(format!(
                "{}/{}",
                clean_base_url,
                crate::api_config::routes::SHIFT_SYNC
            )) // Updated endpoint path to match standard
            .json(&payload)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if res.status().is_success() {
            return Ok("Shift synced successfully".to_string());
        } else {
            if res.status() == 401 || res.status() == 403 {
                return Err("Sync Failed: Invalid Credentials (Buddy Punch Detected)".to_string());
            }
            return Err(format!("Server error: {}", res.status()));
        }
    }

    Ok("No pending shifts to sync".to_string())
}