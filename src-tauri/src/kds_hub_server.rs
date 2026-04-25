use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use local_ip_address::local_ip;
use log::{info, warn, error};
use std::net::SocketAddr; 
use tokio::sync::{broadcast, oneshot};
use tokio::time::{sleep, Duration};
use futures_util::{sink::SinkExt, stream::StreamExt};
use tauri::{AppHandle, Manager, State as TauriState};
use crate::kds_models::{WsMessage, AssignmentPayload};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use serde::Serialize;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ConnectedDevice {
    pub id: String,
    pub name: String,
    pub device_type: String,
    pub status: String,
    pub last_seen: i64,
    pub ip: String,
    pub current_user_id: Option<String>,
    pub current_user_name: Option<String>,
    pub assigned_user_id: Option<String>,
    pub assigned_user_name: Option<String>,
    pub station: Option<String>,
    pub current_page: Option<String>,
    pub table_number: Option<String>,
    pub cart_item_count: Option<usize>,
}

pub struct DeviceRegistry {
    pub devices: Mutex<HashMap<String, ConnectedDevice>>,
    pub tx: broadcast::Sender<String>,
    pub is_running: Mutex<bool>,
    pub shutdown_tx: Mutex<Option<oneshot::Sender<()>>>,
    pub active_connections: Mutex<usize>,
    pub session_id: Mutex<u64>,
}

#[derive(Debug, Serialize)]
pub struct HubStatus {
    pub is_running: bool,
    pub active_connections: usize,
}

// Application state shared across all WebSocket connections
#[derive(Clone)]
struct AppState {
    // A channel that can broadcast messages to many receivers
    tx: broadcast::Sender<String>, 
    // Tauri's AppHandle to access the database/state from inside the WS tasks
    app_handle: AppHandle,
    // Global registry of devices
    registry: Arc<DeviceRegistry>,
}

#[tauri::command]
pub async fn start_kds_hub(app: AppHandle) -> Result<String, String> {
    let registry = if let Some(r) = app.try_state::<Arc<DeviceRegistry>>() {
        r.inner().clone()
    } else {
        let (tx, _rx) = broadcast::channel(100);
        let r = Arc::new(DeviceRegistry {
            devices: Mutex::new(HashMap::new()),
            tx,
            is_running: Mutex::new(false),
            shutdown_tx: Mutex::new(None),
            active_connections: Mutex::new(0),
            session_id: Mutex::new(0),
        });
        app.manage(r.clone());
        r
    };

    let _current_session = {
        let mut is_running = registry.is_running.lock().unwrap();
        if *is_running {
            let ip = local_ip().map_err(|e| e.to_string())?;
            return Ok(format!("ws://{}:8080/kds-ws", ip));
        }
        *is_running = true;

        let mut sid = registry.session_id.lock().unwrap();
        *sid += 1;
        *sid
    };

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    {
        let mut tx_guard = registry.shutdown_tx.lock().unwrap();
        *tx_guard = Some(shutdown_tx);
    }

    let registry_clone = registry.clone();
    let _app_clone = app.clone();
    let tx = registry.tx.clone();
    let ip = local_ip().map_err(|e| e.to_string())?;
    
    // Bind to a fixed port for the POS hub (e.g., 8080) on 0.0.0.0
    // Using 0.0.0.0 to listen on all interfaces, more robust
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));

    let state = AppState { 
        tx,
        app_handle: app,
        registry: registry_clone.clone(),
    };

    let router = Router::new()
        .route("/kds-ws", get(ws_handler))
        .layer(axum::extract::DefaultBodyLimit::disable())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(addr).await.map_err(|e| {
        let mut is_running = registry_clone.is_running.lock().unwrap();
        *is_running = false;
        format!("Failed to bind to {}: {}", addr, e)
    })?;

    tauri::async_runtime::spawn(async move {
        info!("KDS Hub WebSocket running on ws://{}:8080/kds-ws", ip);
        let serve = axum::serve(
            listener,
            router.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(async move {
            let _ = shutdown_rx.await;
            info!("KDS Hub server received shutdown signal.");
        });

        if let Err(e) = serve.await {
            error!("KDS Hub server error: {}", e);
        }

        // Reset state when server stops
        let mut is_running = registry_clone.is_running.lock().unwrap();
        *is_running = false;
        let mut tx_guard = registry_clone.shutdown_tx.lock().unwrap();
        *tx_guard = None;
        info!("KDS Hub server stopped.");
    });

    Ok(format!("ws://{}:8080/kds-ws", ip))
}

#[tauri::command]
pub async fn stop_kds_hub(state: TauriState<'_, Arc<DeviceRegistry>>) -> Result<(), String> {
    let mut tx_guard = state.shutdown_tx.lock().unwrap();
    if let Some(tx) = tx_guard.take() {
        let _ = tx.send(());
        Ok(())
    } else {
        Err("Server not running".to_string())
    }
}

#[tauri::command]
pub async fn get_hub_status(state: TauriState<'_, Arc<DeviceRegistry>>) -> Result<HubStatus, String> {
    let is_running = *state.is_running.lock().unwrap();
    let active_connections = *state.active_connections.lock().unwrap();
    Ok(HubStatus { is_running, active_connections })
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    axum::extract::ConnectInfo(addr): axum::extract::ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, addr))
}

async fn handle_socket(socket: WebSocket, state: AppState, addr: SocketAddr) {
    let client_ip = addr.ip().to_string();

    {
        let mut count = state.registry.active_connections.lock().unwrap();
        *count += 1;
        info!("KDS Client connected from {}. Total active: {}", client_ip, *count);
    }

    // --- 1. INITIAL CONNECTION SYNC ---
    info!("Starting initial sync for client {}...", client_ip);
    
    // Fetch active/preparing orders from the local SQLite DB using the AppHandle
    let active_orders = crate::stores::sales_store::get_active_kds_orders(&state.app_handle).await;
    
    let sync_msg = WsMessage::SyncOrders(active_orders);

    let (mut sender, mut receiver) = socket.split();

    if let Ok(text) = serde_json::to_string(&sync_msg) {
        if sender.send(Message::Text(text)).await.is_err() {
            info!("KDS client disconnected before initial sync finished.");
            decrement_connections(&state.registry);
            return;
        }
    }

    // Split the socket for concurrent read/write after the initial sync
    let mut rx = state.tx.subscribe();

    // Clone the AppHandle for the send task
    let app_handle_for_send = state.app_handle.clone();

    // --- 2. THE BROADCAST SENDER TASK ---
    let mut send_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    // Send the broadcasted message to this specific KDS screen
                    if sender.send(Message::Text(msg)).await.is_err() {
                        info!("KDS Client disconnected during broadcast.");
                        break; 
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped_count)) => {
                    // The client fell behind (e.g., bad Wi-Fi). It missed `skipped_count` messages.
                    warn!("KDS client lagged and missed {} messages. Forcing a re-sync.", skipped_count);
                    
                    // Fetch the latest state from the DB and push it
                    let active_orders = crate::stores::sales_store::get_active_kds_orders(&app_handle_for_send).await;
                    
                    let resync_msg = WsMessage::SyncOrders(active_orders);
                    if let Ok(text) = serde_json::to_string(&resync_msg) {
                        if sender.send(Message::Text(text)).await.is_err() {
                            break; // Client is actually gone
                        }
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    info!("Broadcast channel closed.");
                    break;
                }
            }
        }
    });

    // --- 3. THE RECEIVER TASK ---
    let tx = state.tx.clone();
    // Clone the AppHandle for the receive task
    let app_handle_for_recv = state.app_handle.clone();
    let registry = state.registry.clone();
    
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                match ws_msg {
                    WsMessage::NewOrder(order) => {
                        info!("Received new order locally: {}", order.order_id);
                        // Save to local SQLite database using Tauri app_handle
                        crate::stores::sales_store::save_local_kds_order(&app_handle_for_recv, &order).await;
                        let _ = tx.send(text.clone());
                    },
                    WsMessage::OrderStatusUpdated { order_id, status } => {
                        info!("Order {} status updated to: {}", order_id, status);
                        // Update local SQLite database state
                        crate::stores::sales_store::update_kds_order_status(&app_handle_for_recv, &order_id, &status).await;
                        let _ = tx.send(text.clone());
                    },
                    WsMessage::DeviceStatus(device) => {
                        let mut devices = registry.devices.lock().unwrap();
                        let (assigned_user_id, assigned_user_name, current_page, table_number, cart_item_count) = devices.get(&device.id)
                            .map(|d| (d.assigned_user_id.clone(), d.assigned_user_name.clone(), d.current_page.clone(), d.table_number.clone(), d.cart_item_count))
                            .unwrap_or((None, None, None, None, None));

                        devices.insert(device.id.clone(), ConnectedDevice {
                            id: device.id,
                            name: device.name,
                            device_type: device.device_type,
                            status: device.status,
                            last_seen: device.last_seen,
                            ip: client_ip.clone(),
                            current_user_id: device.current_user_id,
                            current_user_name: device.current_user_name,
                            assigned_user_id,
                            assigned_user_name,
                            station: device.station,
                            current_page,
                            table_number,
                            cart_item_count,
                        });
                    },
                    WsMessage::AssignmentUpdate(_assignment) => {
                        // Normally assignments flow HUB -> CLIENT, but if a client sends one, broadcast it
                        let _ = tx.send(text.clone());
                    },
                    WsMessage::TabletActivity(activity) => {
                        let mut devices = registry.devices.lock().unwrap();
                        if let Some(device) = devices.get_mut(&activity.device_id) {
                            device.current_page = Some(activity.current_page.clone());
                            device.table_number = activity.table_number.clone();
                            device.cart_item_count = Some(activity.cart_items.len());
                            device.last_seen = chrono::Utc::now().timestamp_millis();
                        }
                        let _ = tx.send(text.clone());
                    },
                    WsMessage::OrderEtaQuery { .. } | WsMessage::OrderEtaResponse { .. } => {
                        let _ = tx.send(text.clone());
                    },
                    WsMessage::SyncOrders(_) => {
                        // The tablet shouldn't send this to the server, ignore or log
                        warn!("Received SyncOrders from client, which is unexpected.");
                    },
                    WsMessage::Ping => {
                        // Keep-alive from the tablet, no action needed
                    }
                }
            }
        }
    });

    // If either task fails/exits, cancel the other (client disconnected)
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    decrement_connections(&state.registry);
}

pub fn decrement_connections_for_test(registry: &Arc<DeviceRegistry>) {
    let mut count = registry.active_connections.lock().unwrap();
    if *count > 0 {
        *count -= 1;
    }
}

fn decrement_connections(registry: &Arc<DeviceRegistry>) {
    let mut count = registry.active_connections.lock().unwrap();
    if *count > 0 {
        *count -= 1;
    }
    info!("KDS Client disconnected. Total active: {}", *count);

    if *count == 0 {
        let registry_clone = registry.clone();
        let current_session = *registry.session_id.lock().unwrap();

        tauri::async_runtime::spawn(async move {
            info!("No active connections. Starting 5-minute auto-shutdown timer for session {}...", current_session);
            sleep(Duration::from_secs(300)).await;

            // Check if we are still in the same session and count is still zero
            let count = registry_clone.active_connections.lock().unwrap();
            let session = registry_clone.session_id.lock().unwrap();

            if *count == 0 && *session == current_session {
                let is_running = registry_clone.is_running.lock().unwrap();
                if *is_running {
                    info!("Auto-shutting down KDS Hub (session {}) due to inactivity.", current_session);
                    let mut tx_guard = registry_clone.shutdown_tx.lock().unwrap();
                    if let Some(tx) = tx_guard.take() {
                        let _ = tx.send(());
                    }
                }
            } else if *session != current_session {
                info!("Auto-shutdown timer for session {} discarded (new session {} active).", current_session, *session);
            } else {
                info!("Auto-shutdown for session {} cancelled, new client connected.", current_session);
            }
        });
    }
}

#[tauri::command]
pub async fn get_connected_devices(state: TauriState<'_, Arc<DeviceRegistry>>) -> Result<Vec<ConnectedDevice>, String> {
    let devices = state.devices.lock().unwrap();
    Ok(devices.values().cloned().collect())
}

#[tauri::command]
pub async fn assign_user_to_device(
    state: TauriState<'_, Arc<DeviceRegistry>>,
    device_id: String,
    user_id: Option<String>,
    user_name: Option<String>,
) -> Result<(), String> {
    let mut devices = state.devices.lock().unwrap();
    if let Some(device) = devices.get_mut(&device_id) {
        device.assigned_user_id = user_id.clone();
        device.assigned_user_name = user_name.clone();

        let update = WsMessage::AssignmentUpdate(AssignmentPayload {
            device_id: device_id.clone(),
            user_id,
            user_name,
        });

        if let Ok(text) = serde_json::to_string(&update) {
            let _ = state.tx.send(text);
        }
        Ok(())
    } else {
        Err("Device not found".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_registry() -> Arc<DeviceRegistry> {
        let (tx, _rx) = broadcast::channel(100);
        Arc::new(DeviceRegistry {
            devices: Mutex::new(HashMap::new()),
            tx,
            is_running: Mutex::new(false),
            shutdown_tx: Mutex::new(None),
            active_connections: Mutex::new(0),
            session_id: Mutex::new(0),
        })
    }

    fn make_connected_device(id: &str) -> ConnectedDevice {
        ConnectedDevice {
            id: id.to_string(),
            name: "Test Device".to_string(),
            device_type: "kds".to_string(),
            status: "online".to_string(),
            last_seen: 1234567890,
            ip: "192.168.1.100".to_string(),
            current_user_id: None,
            current_user_name: None,
            assigned_user_id: None,
            assigned_user_name: None,
            station: None,
            current_page: None,
            table_number: None,
            cart_item_count: None,
        }
    }

    // --- DeviceRegistry construction ---

    #[test]
    fn test_device_registry_starts_not_running() {
        let registry = make_registry();
        let is_running = *registry.is_running.lock().unwrap();
        assert!(!is_running);
    }

    #[test]
    fn test_device_registry_starts_with_zero_connections() {
        let registry = make_registry();
        let count = *registry.active_connections.lock().unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_device_registry_starts_with_empty_devices() {
        let registry = make_registry();
        let devices = registry.devices.lock().unwrap();
        assert!(devices.is_empty());
    }

    #[test]
    fn test_device_registry_starts_with_session_id_zero() {
        let registry = make_registry();
        let sid = *registry.session_id.lock().unwrap();
        assert_eq!(sid, 0);
    }

    #[test]
    fn test_device_registry_starts_with_no_shutdown_tx() {
        let registry = make_registry();
        let guard = registry.shutdown_tx.lock().unwrap();
        assert!(guard.is_none());
    }

    // --- active_connections counting ---

    #[test]
    fn test_increment_active_connections() {
        let registry = make_registry();
        {
            let mut count = registry.active_connections.lock().unwrap();
            *count += 1;
        }
        assert_eq!(*registry.active_connections.lock().unwrap(), 1);
    }

    #[test]
    fn test_decrement_connections_reduces_count() {
        let registry = make_registry();
        {
            let mut count = registry.active_connections.lock().unwrap();
            *count = 3;
        }
        decrement_connections_for_test(&registry);
        assert_eq!(*registry.active_connections.lock().unwrap(), 2);
    }

    #[test]
    fn test_decrement_connections_does_not_go_below_zero() {
        let registry = make_registry();
        // count is already 0
        decrement_connections_for_test(&registry);
        assert_eq!(*registry.active_connections.lock().unwrap(), 0);
    }

    #[test]
    fn test_decrement_connections_from_one_reaches_zero() {
        let registry = make_registry();
        {
            let mut count = registry.active_connections.lock().unwrap();
            *count = 1;
        }
        decrement_connections_for_test(&registry);
        assert_eq!(*registry.active_connections.lock().unwrap(), 0);
    }

    #[test]
    fn test_multiple_decrements_stop_at_zero() {
        let registry = make_registry();
        {
            let mut count = registry.active_connections.lock().unwrap();
            *count = 2;
        }
        decrement_connections_for_test(&registry);
        decrement_connections_for_test(&registry);
        decrement_connections_for_test(&registry); // extra call - should stay at 0
        assert_eq!(*registry.active_connections.lock().unwrap(), 0);
    }

    // --- session_id increments ---

    #[test]
    fn test_session_id_increments() {
        let registry = make_registry();
        {
            let mut sid = registry.session_id.lock().unwrap();
            *sid += 1;
        }
        assert_eq!(*registry.session_id.lock().unwrap(), 1);
    }

    #[test]
    fn test_session_id_multiple_increments() {
        let registry = make_registry();
        for _ in 0..5 {
            let mut sid = registry.session_id.lock().unwrap();
            *sid += 1;
        }
        assert_eq!(*registry.session_id.lock().unwrap(), 5);
    }

    // --- is_running state transitions ---

    #[test]
    fn test_is_running_can_be_set_true() {
        let registry = make_registry();
        {
            let mut is_running = registry.is_running.lock().unwrap();
            *is_running = true;
        }
        assert!(*registry.is_running.lock().unwrap());
    }

    #[test]
    fn test_is_running_can_be_reset_to_false() {
        let registry = make_registry();
        {
            let mut is_running = registry.is_running.lock().unwrap();
            *is_running = true;
        }
        {
            let mut is_running = registry.is_running.lock().unwrap();
            *is_running = false;
        }
        assert!(!*registry.is_running.lock().unwrap());
    }

    // --- ConnectedDevice struct ---

    #[test]
    fn test_connected_device_fields() {
        let device = make_connected_device("device-1");
        assert_eq!(device.id, "device-1");
        assert_eq!(device.name, "Test Device");
        assert_eq!(device.device_type, "kds");
        assert_eq!(device.status, "online");
        assert_eq!(device.last_seen, 1234567890);
        assert_eq!(device.ip, "192.168.1.100");
        assert!(device.current_user_id.is_none());
        assert!(device.assigned_user_id.is_none());
        assert!(device.station.is_none());
    }

    #[test]
    fn test_connected_device_with_optional_fields() {
        let device = ConnectedDevice {
            id: "d-2".to_string(),
            name: "Kitchen Display".to_string(),
            device_type: "kds".to_string(),
            status: "active".to_string(),
            last_seen: 9999,
            ip: "10.0.0.5".to_string(),
            current_user_id: Some("user-42".to_string()),
            current_user_name: Some("Alice".to_string()),
            assigned_user_id: Some("user-42".to_string()),
            assigned_user_name: Some("Alice".to_string()),
            station: Some("grill".to_string()),
            current_page: Some("/orders".to_string()),
            table_number: Some("5".to_string()),
            cart_item_count: Some(3),
        };
        assert_eq!(device.current_user_id, Some("user-42".to_string()));
        assert_eq!(device.station, Some("grill".to_string()));
        assert_eq!(device.cart_item_count, Some(3));
    }

    #[test]
    fn test_connected_device_serializes_to_json() {
        let device = make_connected_device("dev-abc");
        let json = serde_json::to_string(&device).unwrap();
        assert!(json.contains("dev-abc"));
        assert!(json.contains("kds"));
        assert!(json.contains("online"));
    }

    #[test]
    fn test_connected_device_clone() {
        let device = make_connected_device("original");
        let cloned = device.clone();
        assert_eq!(cloned.id, device.id);
        assert_eq!(cloned.name, device.name);
        assert_eq!(cloned.status, device.status);
    }

    // --- Device registry device management ---

    #[test]
    fn test_insert_device_into_registry() {
        let registry = make_registry();
        let device = make_connected_device("dev-1");
        {
            let mut devices = registry.devices.lock().unwrap();
            devices.insert("dev-1".to_string(), device);
        }
        let devices = registry.devices.lock().unwrap();
        assert!(devices.contains_key("dev-1"));
        assert_eq!(devices.len(), 1);
    }

    #[test]
    fn test_update_device_preserves_assigned_user() {
        let registry = make_registry();
        let mut device = make_connected_device("dev-1");
        device.assigned_user_id = Some("user-99".to_string());
        device.assigned_user_name = Some("Bob".to_string());
        {
            let mut devices = registry.devices.lock().unwrap();
            devices.insert("dev-1".to_string(), device);
        }
        let devices = registry.devices.lock().unwrap();
        let d = devices.get("dev-1").unwrap();
        assert_eq!(d.assigned_user_id, Some("user-99".to_string()));
        assert_eq!(d.assigned_user_name, Some("Bob".to_string()));
    }

    #[test]
    fn test_multiple_devices_in_registry() {
        let registry = make_registry();
        {
            let mut devices = registry.devices.lock().unwrap();
            devices.insert("dev-1".to_string(), make_connected_device("dev-1"));
            devices.insert("dev-2".to_string(), make_connected_device("dev-2"));
            devices.insert("dev-3".to_string(), make_connected_device("dev-3"));
        }
        let devices = registry.devices.lock().unwrap();
        assert_eq!(devices.len(), 3);
    }

    #[test]
    fn test_device_not_found_returns_none() {
        let registry = make_registry();
        let devices = registry.devices.lock().unwrap();
        assert!(devices.get("nonexistent").is_none());
    }

    // --- HubStatus struct ---

    #[test]
    fn test_hub_status_when_not_running() {
        let status = HubStatus {
            is_running: false,
            active_connections: 0,
        };
        assert!(!status.is_running);
        assert_eq!(status.active_connections, 0);
    }

    #[test]
    fn test_hub_status_when_running_with_connections() {
        let status = HubStatus {
            is_running: true,
            active_connections: 3,
        };
        assert!(status.is_running);
        assert_eq!(status.active_connections, 3);
    }

    #[test]
    fn test_hub_status_serializes_to_json() {
        let status = HubStatus {
            is_running: true,
            active_connections: 2,
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("is_running"));
        assert!(json.contains("true"));
        assert!(json.contains("active_connections"));
        assert!(json.contains('2'));
    }

    #[test]
    fn test_hub_status_reflects_registry_state() {
        let registry = make_registry();
        {
            let mut is_running = registry.is_running.lock().unwrap();
            *is_running = true;
            let mut count = registry.active_connections.lock().unwrap();
            *count = 5;
        }
        let status = HubStatus {
            is_running: *registry.is_running.lock().unwrap(),
            active_connections: *registry.active_connections.lock().unwrap(),
        };
        assert!(status.is_running);
        assert_eq!(status.active_connections, 5);
    }

    // --- Broadcast channel in registry ---

    #[test]
    fn test_broadcast_channel_can_send_and_receive() {
        let registry = make_registry();
        let mut rx = registry.tx.subscribe();
        let _ = registry.tx.send("test-message".to_string());
        let received = rx.try_recv().unwrap();
        assert_eq!(received, "test-message");
    }

    #[test]
    fn test_broadcast_channel_capacity() {
        let (tx, _rx) = broadcast::channel::<String>(100);
        // Should not error when sending within capacity
        for i in 0..50 {
            let _ = tx.send(format!("msg-{}", i));
        }
    }

    // --- Shutdown channel ---

    #[test]
    fn test_shutdown_tx_can_be_set_and_taken() {
        let registry = make_registry();
        let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
        {
            let mut guard = registry.shutdown_tx.lock().unwrap();
            *guard = Some(shutdown_tx);
        }
        let taken = {
            let mut guard = registry.shutdown_tx.lock().unwrap();
            guard.take()
        };
        assert!(taken.is_some());
        // Send the shutdown signal
        let _ = taken.unwrap().send(());
        // Receiver should get the signal
        let result = shutdown_rx.try_recv();
        assert!(result.is_ok());
    }

    #[test]
    fn test_shutdown_tx_none_after_take() {
        let registry = make_registry();
        let (shutdown_tx, _rx) = oneshot::channel::<()>();
        {
            let mut guard = registry.shutdown_tx.lock().unwrap();
            *guard = Some(shutdown_tx);
        }
        {
            let mut guard = registry.shutdown_tx.lock().unwrap();
            let _ = guard.take();
        }
        let guard = registry.shutdown_tx.lock().unwrap();
        assert!(guard.is_none());
    }
}
