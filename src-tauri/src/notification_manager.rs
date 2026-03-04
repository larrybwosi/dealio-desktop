use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::RwLock;
use tauri::{AppHandle, Emitter};

const MAX_NOTIFICATIONS: usize = 100;
const AUTO_CLEAR_DAYS: i64 = 7;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NotificationType {
    Info,
    Success,
    Warning,
    Error,
    Sale,
    Sync,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NotificationPriority {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationAction {
    pub label: String,
    pub action_type: String,
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppNotification {
    pub id: String,
    pub notification_type: NotificationType,
    pub priority: NotificationPriority,
    pub title: String,
    pub body: String,
    pub timestamp: DateTime<Utc>,
    pub read: bool,
    pub persistent: bool,
    pub action: Option<NotificationAction>,
    pub sound_enabled: bool,
}

impl AppNotification {
    #[allow(dead_code)]
    pub fn new(
        notification_type: NotificationType,
        priority: NotificationPriority,
        title: String,
        body: String,
    ) -> Self {
        Self {
            id: uuid::Uuid::now_v7().to_string(),
            notification_type,
            priority,
            title,
            body,
            timestamp: Utc::now(),
            read: false,
            persistent: true,
            action: None,
            sound_enabled: true,
        }
    }
}

// ─── State – uses RwLock so concurrent reads don't block each other ───────────
pub struct NotificationState {
    notifications: RwLock<VecDeque<AppNotification>>,
}

impl NotificationState {
    pub fn new() -> Self {
        Self {
            notifications: RwLock::new(VecDeque::new()),
        }
    }

    fn read_lock(&self) -> std::sync::RwLockReadGuard<'_, VecDeque<AppNotification>> {
        self.notifications
            .read()
            .unwrap_or_else(|e| e.into_inner())
    }

    fn write_lock(&self) -> std::sync::RwLockWriteGuard<'_, VecDeque<AppNotification>> {
        self.notifications
            .write()
            .unwrap_or_else(|e| e.into_inner())
    }

    /// Add a notification. Duplicates (same `id`) are silently ignored.
    pub fn add_notification(&self, notification: AppNotification) {
        let mut notifications = self.write_lock();

        // ── Deduplication: reject if we already have this ID ──────────────────
        if notifications.iter().any(|n| n.id == notification.id) {
            log::debug!(
                "[NotificationState] Duplicate notification suppressed: {}",
                notification.id
            );
            return;
        }

        // Auto-clear old read notifications before inserting
        self.auto_clear_old(&mut notifications);

        // Insert newest first
        notifications.push_front(notification);

        // Enforce maximum size
        if notifications.len() > MAX_NOTIFICATIONS {
            notifications.truncate(MAX_NOTIFICATIONS);
        }
    }

    pub fn get_all(&self) -> Vec<AppNotification> {
        self.read_lock().iter().cloned().collect()
    }

    pub fn get_unread_count(&self) -> usize {
        self.read_lock().iter().filter(|n| !n.read).count()
    }

    pub fn mark_read(&self, id: &str) -> bool {
        let mut notifications = self.write_lock();
        if let Some(notification) = notifications.iter_mut().find(|n| n.id == id) {
            notification.read = true;
            return true;
        }
        false
    }

    pub fn mark_all_read(&self) {
        let mut notifications = self.write_lock();
        for notification in notifications.iter_mut() {
            notification.read = true;
        }
    }

    pub fn delete_notification(&self, id: &str) -> bool {
        let mut notifications = self.write_lock();
        if let Some(pos) = notifications.iter().position(|n| n.id == id) {
            notifications.remove(pos);
            return true;
        }
        false
    }

    pub fn clear_all(&self) {
        self.write_lock().clear();
    }

    pub fn load_from_store(&self, app: &AppHandle) -> Result<(), String> {
        use tauri_plugin_store::StoreExt;

        let store = app
            .store("notification-history.json")
            .map_err(|e| format!("Failed to open store: {}", e))?;

        if let Some(value) = store.get("notifications") {
            if let Ok(loaded_notifications) =
                serde_json::from_value::<Vec<AppNotification>>(value.clone())
            {
                let mut notifications = self.write_lock();
                notifications.clear();
                notifications.extend(loaded_notifications);
            }
        }

        Ok(())
    }

    pub fn save_to_store(&self, app: &AppHandle) -> Result<(), String> {
        use tauri_plugin_store::StoreExt;

        let store = app
            .store("notification-history.json")
            .map_err(|e| format!("Failed to open store: {}", e))?;

        let notifications = self.get_all();
        let value = serde_json::to_value(&notifications)
            .map_err(|e| format!("Failed to serialize notifications: {}", e))?;

        store.set("notifications", value);
        store
            .save()
            .map_err(|e| format!("Failed to save store: {}", e))?;

        Ok(())
    }

    fn auto_clear_old(&self, notifications: &mut VecDeque<AppNotification>) {
        let cutoff = Utc::now() - Duration::days(AUTO_CLEAR_DAYS);
        notifications.retain(|n| {
            // Keep unread notifications or those newer than cutoff
            !n.read || n.timestamp > cutoff
        });
    }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn send_native_notification(
    app: AppHandle,
    state: tauri::State<'_, NotificationState>,
    notification: AppNotification,
) -> Result<String, String> {
    use tauri_plugin_notification::NotificationExt;

    let id = notification.id.clone();

    // Add to in-memory state (dedup check inside)
    state.add_notification(notification.clone());

    // Persist
    if let Err(e) = state.save_to_store(&app) {
        log::warn!("[NotificationState] save_to_store failed: {}", e);
    }

    // Send native OS notification (best-effort)
    let builder = app
        .notification()
        .builder()
        .title(&notification.title)
        .body(&notification.body);

    if let Err(e) = builder.show() {
        log::warn!("[NotificationState] Native notification show failed: {}", e);
        // Do NOT return an error – the in-app notification already fires from the frontend
    }

    // Emit event to frontend (so the notification center updates)
    app.emit("notification-received", &notification)
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    // Update tray badge
    update_tray_badge(&app, &state)?;

    Ok(id)
}

#[tauri::command]
pub fn get_notification_history(
    state: tauri::State<'_, NotificationState>,
) -> Vec<AppNotification> {
    state.get_all()
}

#[tauri::command]
pub fn get_unread_notification_count(state: tauri::State<'_, NotificationState>) -> usize {
    state.get_unread_count()
}

#[tauri::command]
pub fn mark_notification_read(
    app: AppHandle,
    state: tauri::State<'_, NotificationState>,
    id: String,
) -> Result<bool, String> {
    let result = state.mark_read(&id);

    if result {
        if let Err(e) = state.save_to_store(&app) {
            log::warn!("[NotificationState] save_to_store after mark_read failed: {}", e);
        }
        update_tray_badge(&app, &state)?;
    }

    Ok(result)
}

#[tauri::command]
pub fn mark_all_notifications_read(
    app: AppHandle,
    state: tauri::State<'_, NotificationState>,
) -> Result<(), String> {
    state.mark_all_read();
    if let Err(e) = state.save_to_store(&app) {
        log::warn!("[NotificationState] save_to_store after mark_all_read failed: {}", e);
    }
    update_tray_badge(&app, &state)?;
    Ok(())
}

#[tauri::command]
pub fn delete_notification(
    app: AppHandle,
    state: tauri::State<'_, NotificationState>,
    id: String,
) -> Result<bool, String> {
    let result = state.delete_notification(&id);

    if result {
        if let Err(e) = state.save_to_store(&app) {
            log::warn!("[NotificationState] save_to_store after delete failed: {}", e);
        }
        update_tray_badge(&app, &state)?;
    }

    Ok(result)
}

#[tauri::command]
pub fn clear_all_notifications(
    app: AppHandle,
    state: tauri::State<'_, NotificationState>,
) -> Result<(), String> {
    state.clear_all();
    if let Err(e) = state.save_to_store(&app) {
        log::warn!("[NotificationState] save_to_store after clear_all failed: {}", e);
    }
    update_tray_badge(&app, &state)?;
    Ok(())
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

fn update_tray_badge(app: &AppHandle, state: &NotificationState) -> Result<(), String> {
    let unread_count = state.get_unread_count();

    app.emit("notification-badge-update", unread_count)
        .map_err(|e| format!("Failed to emit badge update: {}", e))?;

    Ok(())
}

// Initialize notification state from store on app startup
pub fn init_notification_state(app: &AppHandle, state: &NotificationState) {
    if let Err(e) = state.load_from_store(app) {
        log::error!("[NotificationState] Failed to load notification history: {}", e);
    }
}
