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
use log::info; 
use std::net::SocketAddr; 
use tokio::sync::broadcast;
use futures_util::{sink::SinkExt, stream::StreamExt};
use tauri::AppHandle;
use crate::kds_models::WsMessage;

// Application state shared across all WebSocket connections
#[derive(Clone)]
struct AppState {
    // A channel that can broadcast messages to many receivers
    tx: broadcast::Sender<String>, 
}

#[tauri::command]
pub async fn start_kds_hub(_app: AppHandle) -> Result<String, String> {
    let ip = local_ip().map_err(|e| e.to_string())?;
    
    // Create a broadcast channel with a capacity of 100 messages
    let (tx, _rx) = broadcast::channel(100);
    
    let state = AppState { tx };

    // Bind to a fixed port for the POS hub (e.g., 8080) on 0.0.0.0
    let addr = SocketAddr::from((ip, 8080));
    
    let router = Router::new()
        .route("/kds-ws", get(ws_handler))
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
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}


async fn handle_socket(mut socket: WebSocket, state: AppState) {
    // --- 1. INITIAL CONNECTION SYNC ---
    info!("New KDS client connected. Starting initial sync...");
    
    // TODO: Fetch ONLY active/preparing orders from your local SQLite DB
    // let active_orders = crate::stores::sales_store::get_active_kds_orders(&state.app).await;
    let active_orders: Vec<crate::kds_models::KdsOrderPayload> = vec![]; // Placeholder
    
    let sync_msg = WsMessage::SyncOrders(active_orders);
    if let Ok(text) = serde_json::to_string(&sync_msg) {
        if socket.send(Message::Text(text)).await.is_err() {
            info!("KDS client disconnected before initial sync finished.");
            return;
        }
    }

    // Split the socket for concurrent read/write after the initial sync
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

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
                    // FIX: The client fell behind (e.g., bad Wi-Fi). It missed `skipped_count` messages.
                    log::warn!("KDS client lagged and missed {} messages. Forcing a re-sync.", skipped_count);
                    
                    // Instead of dropping the client, fetch the latest state from the DB and push it.
                    // let active_orders = crate::stores::sales_store::get_active_kds_orders(&app_handle_for_send).await;
                    let active_orders = vec![]; // Placeholder
                    
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
    
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                match ws_msg {
                    WsMessage::NewOrder(order) => {
                        info!("Received new order locally: {}", order.order_id);
                        // TODO: Save to local SQLite database using Tauri app_handle
                        // crate::stores::sales_store::save_local_kds_order(&app_handle, &order).await;
                        let _ = tx.send(text.clone());
                    },
                    WsMessage::OrderStatusUpdated { order_id, new_status } => {
                        info!("Order {} status updated to: {}", order_id, new_status);
                        // TODO: Update local SQLite database state
                        // crate::stores::sales_store::update_kds_order_status(&app_handle, &order_id, &new_status).await;
                        let _ = tx.send(text.clone());
                    },
                    WsMessage::SyncOrders(_) => {
                        // The tablet shouldn't send this to the server, ignore or log
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