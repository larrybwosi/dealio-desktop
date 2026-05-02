use crate::auth_store::AuthState;
use crate::models::{Shift, ShiftSyncPayload};
use chrono::Utc;
use log::error;
use reqwest::header::{HeaderMap, HeaderValue};
use sha2::{Digest, Sha256};
use sqlx::{Row, SqlitePool};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};
use uuid::Uuid;

const MAIN_DB_NAME: &str = "sqlite:pos_main.db";

// The State container
pub struct ShiftState {
    pub current_shift: Mutex<Option<Shift>>,
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
        }
    }
}

// --- DB Helper ---
async fn get_db_pool(app: &AppHandle) -> Result<SqlitePool, String> {
    let instances = app.state::<DbInstances>();
    let guard = instances.0.read().await;

    let db_name = if cfg!(feature = "standalone") {
        "sqlite:pos_standalone.db"
    } else {
        MAIN_DB_NAME
    };

    if let Some(DbPool::Sqlite(pool)) = guard.get(db_name) {
        Ok(pool.clone())
    } else {
        Err(format!("Database {} not found.", db_name))
    }
}

pub async fn init_state(app: &AppHandle) {
    let pool = match get_db_pool(app).await {
        Ok(p) => p,
        Err(e) => {
            error!("[ShiftStore] Failed to get main DB pool: {}", e);
            return;
        }
    };

    let create_shifts_table = r#"
        CREATE TABLE IF NOT EXISTS shifts (
            id TEXT PRIMARY KEY,
            opened_at TEXT,
            closed_at TEXT,
            operator_id TEXT,
            operator_card_id TEXT,
            operator_pin TEXT,
            starting_float REAL,
            total_cash_sales REAL,
            total_cash_drops REAL,
            total_cash_refunds REAL,
            expected_cash REAL,
            actual_cash REAL,
            variance REAL,
            device_id TEXT,
            is_synced BOOLEAN DEFAULT 0
        )
    "#;

    let create_movements_table = r#"
        CREATE TABLE IF NOT EXISTS cash_movements (
            id TEXT PRIMARY KEY,
            shift_id TEXT,
            amount REAL,
            reason TEXT,
            timestamp TEXT,
            movement_type TEXT
        )
    "#;

    let _ = sqlx::query(create_shifts_table).execute(&pool).await;
    let _ = sqlx::query(create_movements_table).execute(&pool).await;

    // Load active shift into memory
    let shift_state = app.state::<ShiftState>();
    if let Ok(Some(row)) = sqlx::query("SELECT * FROM shifts WHERE closed_at IS NULL LIMIT 1").fetch_optional(&pool).await {
        let shift = Shift {
            id: row.get("id"),
            opened_at: row.get::<String, _>("opened_at").parse().unwrap_or(Utc::now()),
            closed_at: None,
            operator_id: row.get("operator_id"),
            operator_card_id: row.get("operator_card_id"),
            operator_pin: row.get("operator_pin"),
            starting_float: row.get("starting_float"),
            total_cash_sales: row.get("total_cash_sales"),
            total_cash_drops: row.get("total_cash_drops"),
            total_cash_refunds: row.get("total_cash_refunds"),
            expected_cash: row.get("expected_cash"),
            actual_cash: row.get("actual_cash"),
            variance: row.get("variance"),
            device_id: row.get("device_id"),
        };
        *shift_state.current_shift.lock().unwrap() = Some(shift);
    }
}

// --- LOGIC FUNCTIONS ---

pub async fn open_new_shift(
    app: AppHandle,
    state: &ShiftState,
    card_id: String,
    pin: String,
    float_amount: f64,
    device_id: Option<String>,
) -> Result<Shift, String> {
    {
        let shift_lock = state.current_shift.lock().map_err(|_| "Failed to lock shift state")?;
        if shift_lock.is_some() { return Err("A shift is already open.".to_string()); }
    }

    let pool = get_db_pool(&app).await?;
    let new_shift = Shift {
        id: Uuid::now_v7().to_string(),
        opened_at: Utc::now(),
        closed_at: None,
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

    sqlx::query("INSERT INTO shifts (id, opened_at, operator_id, operator_card_id, operator_pin, starting_float, total_cash_sales, total_cash_drops, total_cash_refunds, expected_cash, device_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)")
        .bind(&new_shift.id).bind(new_shift.opened_at.to_rfc3339()).bind(&new_shift.operator_id).bind(&new_shift.operator_card_id).bind(&new_shift.operator_pin).bind(new_shift.starting_float).bind(0.0).bind(0.0).bind(0.0).bind(new_shift.expected_cash).bind(&new_shift.device_id)
        .execute(&pool).await.map_err(|e| e.to_string())?;

    *state.current_shift.lock().unwrap() = Some(new_shift.clone());
    Ok(new_shift)
}

pub async fn record_cash_sale(app: &AppHandle, state: &ShiftState, amount: f64) -> Result<(), String> {
    let mut shift = {
        let lock = state.current_shift.lock().map_err(|_| "Lock error")?;
        lock.as_ref().ok_or("No active shift found")?.clone()
    };

    let pool = get_db_pool(app).await?;
    shift.total_cash_sales += amount;
    shift.expected_cash += amount;

    sqlx::query("UPDATE shifts SET total_cash_sales = ?1, expected_cash = ?2 WHERE id = ?3")
        .bind(shift.total_cash_sales).bind(shift.expected_cash).bind(&shift.id)
        .execute(&pool).await.map_err(|e| e.to_string())?;

    if let Some(ref mut s) = *state.current_shift.lock().unwrap() {
        s.total_cash_sales = shift.total_cash_sales;
        s.expected_cash = shift.expected_cash;
    }
    Ok(())
}

pub async fn record_cash_drop(app: &AppHandle, state: &ShiftState, amount: f64, reason: String) -> Result<(), String> {
    let mut shift = {
        let lock = state.current_shift.lock().map_err(|_| "Lock error")?;
        lock.as_ref().ok_or("No active shift found")?.clone()
    };

    let pool = get_db_pool(app).await?;
    shift.total_cash_drops += amount;
    shift.expected_cash -= amount;

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("UPDATE shifts SET total_cash_drops = ?1, expected_cash = ?2 WHERE id = ?3")
        .bind(shift.total_cash_drops).bind(shift.expected_cash).bind(&shift.id)
        .execute(&mut *tx).await.map_err(|e| e.to_string())?;

    sqlx::query("INSERT INTO cash_movements (id, shift_id, amount, reason, timestamp, movement_type) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
        .bind(Uuid::new_v4().to_string()).bind(&shift.id).bind(amount).bind(&reason).bind(Utc::now().to_rfc3339()).bind("DROP")
        .execute(&mut *tx).await.map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    if let Some(ref mut s) = *state.current_shift.lock().unwrap() {
        s.total_cash_drops = shift.total_cash_drops;
        s.expected_cash = shift.expected_cash;
    }
    Ok(())
}

pub async fn close_current_shift(app: &AppHandle, state: &ShiftState, actual_count: f64) -> Result<Shift, String> {
    let mut shift = {
        let lock = state.current_shift.lock().map_err(|_| "Lock error")?;
        lock.as_ref().ok_or("No active shift to close")?.clone()
    };

    let pool = get_db_pool(app).await?;
    shift.closed_at = Some(Utc::now());
    shift.actual_cash = Some(actual_count);
    shift.variance = Some(actual_count - shift.expected_cash);

    sqlx::query("UPDATE shifts SET closed_at = ?1, actual_cash = ?2, variance = ?3 WHERE id = ?4")
        .bind(shift.closed_at.unwrap().to_rfc3339()).bind(shift.actual_cash).bind(shift.variance).bind(&shift.id)
        .execute(&pool).await.map_err(|e| e.to_string())?;

    let closed_shift = shift.clone();
    *state.current_shift.lock().unwrap() = None;
    Ok(closed_shift)
}

pub fn get_shift_status(state: &ShiftState) -> Option<Shift> {
    let lock = state.current_shift.lock().unwrap_or_else(|e| e.into_inner());
    lock.clone()
}

// --- RECEIPT GENERATION ---

pub fn generate_z_report_text(shift: &Shift) -> String {
    let date_str = shift.closed_at.unwrap_or(Utc::now()).format("%Y-%m-%d %H:%M:%S").to_string();
    let op = shift.operator_id.clone().unwrap_or("Unknown".to_string());
    format!("
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
", date_str, op, &shift.id[0..8], shift.starting_float, shift.total_cash_sales, shift.total_cash_drops, shift.total_cash_refunds, shift.expected_cash, shift.actual_cash.unwrap_or(0.0), shift.variance.unwrap_or(0.0))
}

pub async fn sync_pending_shifts(
    app: AppHandle,
    state: &ShiftState,
    auth_state: &AuthState,
) -> Result<String, String> {
    if cfg!(feature = "standalone") {
        return Ok("Standalone mode: Sync skipped".to_string());
    }

    sync_pending_shifts_cloud(app, state, auth_state).await
}

pub async fn sync_pending_shifts_cloud(
    app: AppHandle,
    _state: &ShiftState,
    auth_state: &AuthState,
) -> Result<String, String> {
    let pool = get_db_pool(&app).await?;
    let rows = sqlx::query("SELECT * FROM shifts WHERE closed_at IS NOT NULL AND is_synced = 0").fetch_all(&pool).await.map_err(|e| e.to_string())?;

    if rows.is_empty() { return Ok("No pending shifts to sync".to_string()); }

    let (base_url, location_id, device_key) = {
        let config_guard = auth_state.device_config.lock().map_err(|_| "Lock error".to_string())?;
        let config = config_guard.as_ref().ok_or("Device not configured".to_string())?;
        (config.base_url.clone(), config.location_id.clone(), config.device_key.clone())
    };
    let member_token = auth_state.member_token.lock().map_err(|_| "Lock error".to_string())?.clone();

    for row in rows {
        let shift_id: String = row.get("id");
        let pin: String = row.get("operator_pin");
        let mut hasher = Sha256::new();
        hasher.update(pin.as_bytes());
        let hashed_pin = format!("{:x}", hasher.finalize());

        let payload = ShiftSyncPayload {
            location_id: location_id.clone(),
            shift_id: shift_id.clone(),
            opened_at: row.get("opened_at"),
            closed_at: Some(row.get("closed_at")),
            operator_card_id: row.get("operator_card_id"),
            operator_pin: hashed_pin,
            starting_float: row.get("starting_float"),
            total_cash_sales: row.get("total_cash_sales"),
            total_cash_drops: row.get("total_cash_drops"),
            actual_cash_count: row.get("actual_cash"),
            variance: row.get("variance"),
        };

        let mut headers = HeaderMap::new();
        headers.insert("X-API-KEY", HeaderValue::from_str(&device_key).map_err(|e| e.to_string())?);
        if let Some(token) = &member_token { headers.insert("X-MEMBER-TOKEN", HeaderValue::from_str(token).map_err(|e| e.to_string())?); }

        let client = reqwest::Client::builder().default_headers(headers).build().map_err(|e| e.to_string())?;
        let res = client.post(format!("{}/{}", base_url.trim_end_matches('/'), crate::api_config::routes::SHIFT_SYNC)).json(&payload).send().await.map_err(|e| e.to_string())?;

        if res.status().is_success() {
            sqlx::query("UPDATE shifts SET is_synced = 1 WHERE id = ?1").bind(&shift_id).execute(&pool).await.map_err(|e| e.to_string())?;
        } else if res.status() == 401 || res.status() == 403 {
            return Err(format!("Sync Failed for shift {}: Invalid Credentials", shift_id));
        }
    }

    Ok("Shifts synced successfully".to_string())
}
