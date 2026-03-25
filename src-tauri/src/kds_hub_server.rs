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
use log::{info, warn}; 
use std::net::SocketAddr; 
use tokio::sync::broadcast;
use futures_util::{sink::SinkExt, stream::StreamExt};
use tauri::{AppHandle, Manager, State as TauriState};
use crate::kds_models::{WsMessage, AssignmentPayload};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

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
}

pub struct DeviceRegistry {
    pub devices: Mutex<HashMap<String, ConnectedDevice>>,
    pub tx: broadcast::Sender<String>,
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
    if app.try_state::<Arc<DeviceRegistry>>().is_none() {
        let (tx, _rx) = broadcast::channel(100);
        app.manage(Arc::new(DeviceRegistry {
            devices: Mutex::new(HashMap::new()),
            tx,
        }));
    }

    let registry = app.state::<Arc<DeviceRegistry>>().inner().clone();
    let tx = registry.tx.clone();
    let ip = local_ip().map_err(|e| e.to_string())?;
    
    // Inject the AppHandle into our Axum state
    let state = AppState { 
        tx,
        app_handle: app,
        registry,
    };

    // Bind to a fixed port for the POS hub (e.g., 8080) on 0.0.0.0
    let addr = SocketAddr::from((ip, 8080));
    
    let router = Router::new()
        .route("/kds-ws", get(ws_handler))
        .layer(axum::extract::DefaultBodyLimit::disable())
        .with_state(state);

    tauri::async_runtime::spawn(async move {
        let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
        info!("KDS Hub WebSocket running on ws://{}:8080/kds-ws", ip);
        let _ = axum::serve(listener, router).await;
    });

    Ok(format!("ws://{}:8080/kds-ws", ip))
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
    // --- 1. INITIAL CONNECTION SYNC ---
    info!("New KDS client connected from {}. Starting initial sync...", client_ip);
    
    // Fetch active/preparing orders from the local SQLite DB using the AppHandle
    let active_orders = crate::stores::sales_store::get_active_kds_orders(&state.app_handle).await;
    
    let sync_msg = WsMessage::SyncOrders(active_orders);

    let (mut sender, mut receiver) = socket.split();

    if let Ok(text) = serde_json::to_string(&sync_msg) {
        if sender.send(Message::Text(text)).await.is_err() {
            info!("KDS client disconnected before initial sync finished.");
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
                    WsMessage::OrderStatusUpdated { order_id, new_status } => {
                        info!("Order {} status updated to: {}", order_id, new_status);
                        // Update local SQLite database state
                        crate::stores::sales_store::update_kds_order_status(&app_handle_for_recv, &order_id, &new_status).await;
                        let _ = tx.send(text.clone());
                    },
                    WsMessage::DeviceStatus(device) => {
                        let mut devices = registry.devices.lock().unwrap();
                        let (assigned_user_id, assigned_user_name) = devices.get(&device.id)
                            .map(|d| (d.assigned_user_id.clone(), d.assigned_user_name.clone()))
                            .unwrap_or((None, None));

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
                        });
                    },
                    WsMessage::AssignmentUpdate(assignment) => {
                        // Normally assignments flow HUB -> CLIENT, but if a client sends one, broadcast it
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
