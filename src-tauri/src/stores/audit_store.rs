use anyhow::Result;
use chrono::Utc;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

// ============================================================
// Data Structures
// ============================================================

/// Severity level of an audit event.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum AuditLevel {
    Info,
    Warning,
    Critical,
}

/// A single, immutable audit trail record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub timestamp: String,
    pub level: AuditLevel,
    pub action: String,
    pub actor_id: Option<String>,
    pub actor_name: Option<String>,
    pub location_id: Option<String>,
    pub device_id: Option<String>,
    pub details: serde_json::Value,
}

/// Filter options for querying audit logs.
#[derive(Debug, Deserialize)]
pub struct AuditFilter {
    pub action: Option<String>,
    pub actor_id: Option<String>,
    pub level: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

// ============================================================
// Internal helpers
// ============================================================

fn get_audit_log_path(app: &AppHandle) -> Result<PathBuf> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data dir: {}", e))?;
    let logs_dir = app_data_dir.join("logs");
    fs::create_dir_all(&logs_dir)?;
    Ok(logs_dir.join("audit.jsonl"))
}

// ============================================================
// Public API
// ============================================================

/// Append a single structured audit event to the JSONL log file.
pub fn write_event(
    app: &AppHandle,
    level: AuditLevel,
    action: impl Into<String>,
    actor_id: Option<String>,
    actor_name: Option<String>,
    location_id: Option<String>,
    device_id: Option<String>,
    details: serde_json::Value,
) -> Result<()> {
    let path = get_audit_log_path(app)?;

    let event = AuditEvent {
        id: uuid::Uuid::now_v7().to_string(),
        timestamp: Utc::now().to_rfc3339(),
        level,
        action: action.into(),
        actor_id,
        actor_name,
        location_id,
        device_id,
        details,
    };

    // Also emit to the structured system log so it appears in log files
    info!(
        "[AUDIT] {} | {:?} | {}",
        event.timestamp, event.action, event.details
    );

    let json_line = serde_json::to_string(&event)?;

    let mut file = OpenOptions::new().create(true).append(true).open(&path)?;

    writeln!(file, "{}", json_line)?;

    Ok(())
}

/// Read audit events from the JSONL file with optional filtering.
pub fn read_events(app: &AppHandle, filter: AuditFilter) -> Result<Vec<AuditEvent>> {
    let path = get_audit_log_path(app)?;

    if !path.exists() {
        return Ok(vec![]);
    }

    let file = fs::File::open(&path)?;
    let reader = BufReader::new(file);

    let mut events: Vec<AuditEvent> = reader
        .lines()
        .filter_map(|line| {
            let line = line.ok()?;
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }
            match serde_json::from_str::<AuditEvent>(trimmed) {
                Ok(ev) => Some(ev),
                Err(e) => {
                    warn!(
                        "[AUDIT] Failed to parse audit line: {} — error: {}",
                        trimmed, e
                    );
                    None
                }
            }
        })
        .collect();

    // Latest first
    events.reverse();

    // Apply filters
    if let Some(action_filter) = &filter.action {
        events.retain(|e| {
            e.action
                .to_lowercase()
                .contains(&action_filter.to_lowercase())
        });
    }
    if let Some(actor_filter) = &filter.actor_id {
        events.retain(|e| {
            e.actor_id
                .as_deref()
                .map(|a| a == actor_filter.as_str())
                .unwrap_or(false)
        });
    }
    if let Some(level_filter) = &filter.level {
        let target = level_filter.to_uppercase();
        events.retain(|e| {
            let lev = match &e.level {
                AuditLevel::Info => "INFO",
                AuditLevel::Warning => "WARNING",
                AuditLevel::Critical => "CRITICAL",
            };
            lev == target.as_str()
        });
    }

    // Pagination
    let offset = filter.offset.unwrap_or(0);
    let limit = filter.limit.unwrap_or(200);
    let paginated = events.into_iter().skip(offset).take(limit).collect();

    Ok(paginated)
}

/// Get the path to the current system log directory.
fn get_system_log_path(app: &AppHandle) -> Result<PathBuf> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data dir: {}", e))?;
    // tauri-plugin-log writes to this location
    Ok(app_data_dir.join("logs"))
}

/// Read the most recent N lines from the system application log.
pub fn read_system_log(app: &AppHandle, lines: usize) -> Result<String> {
    let log_dir = get_system_log_path(app)?;

    // Find the latest .log file (tauri-plugin-log uses rotating files)
    let mut log_files: Vec<PathBuf> = fs::read_dir(&log_dir)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().map(|ext| ext == "log").unwrap_or(false))
        .collect();

    // Sort by modification time, latest first
    log_files.sort_by(|a, b| {
        let ta = fs::metadata(a).and_then(|m| m.modified()).ok();
        let tb = fs::metadata(b).and_then(|m| m.modified()).ok();
        tb.cmp(&ta)
    });

    if log_files.is_empty() {
        return Ok("No log files found yet.".to_string());
    }

    let latest = &log_files[0];
    let content = fs::read_to_string(latest)?;

    let collected_lines: Vec<&str> = content.lines().collect();
    let tail: Vec<&str> = collected_lines
        .iter()
        .rev()
        .take(lines)
        .cloned()
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();

    Ok(tail.join("\n"))
}

// ============================================================
// Tauri Commands
// ============================================================

/// Write an arbitrary audit event from the frontend.
#[tauri::command]
pub fn write_audit_log(
    app: AppHandle,
    action: String,
    level: Option<String>,
    actor_id: Option<String>,
    actor_name: Option<String>,
    location_id: Option<String>,
    device_id: Option<String>,
    details: Option<serde_json::Value>,
) -> Result<(), String> {
    let lvl = match level.as_deref().unwrap_or("INFO").to_uppercase().as_str() {
        "WARNING" | "WARN" => AuditLevel::Warning,
        "CRITICAL" | "ERROR" => AuditLevel::Critical,
        _ => AuditLevel::Info,
    };

    write_event(
        &app,
        lvl,
        action,
        actor_id,
        actor_name,
        location_id,
        device_id,
        details.unwrap_or(serde_json::Value::Null),
    )
    .map_err(|e| e.to_string())
}

/// Get audit log entries with optional filters.
#[tauri::command]
pub fn get_audit_logs(
    app: AppHandle,
    action: Option<String>,
    actor_id: Option<String>,
    level: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<AuditEvent>, String> {
    let filter = AuditFilter {
        action,
        actor_id,
        level,
        limit,
        offset,
    };
    read_events(&app, filter).map_err(|e| e.to_string())
}

/// Read recent system log lines (for developers / support).
#[tauri::command]
pub fn get_system_logs(app: AppHandle, lines: Option<usize>) -> Result<String, String> {
    read_system_log(&app, lines.unwrap_or(500)).map_err(|e| e.to_string())
}
