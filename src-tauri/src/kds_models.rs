use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderItem {
    pub id: String, // Client-generated UUID
    pub product_name: String,
    pub quantity: u32,
    pub modifiers: Vec<String>, // e.g., ["No Onions", "Extra Cheese"]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KdsOrderPayload {
    pub order_id: String, // Client-generated UUID (Idempotency key)
    pub table_number: Option<String>,
    pub waiter_name: String,
    pub items: Vec<OrderItem>,
    pub status: String, // "NEW", "PREPARING", "READY"
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceStatusPayload {
    pub id: String,
    pub name: String,
    pub device_type: String,
    pub status: String,
    pub last_seen: i64,
    pub current_user_id: Option<String>,
    pub current_user_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignmentPayload {
    pub device_id: String,
    pub user_id: Option<String>,
    pub user_name: Option<String>,
}

// Wrapper for WebSocket messages to allow different message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsMessage {
    NewOrder(KdsOrderPayload),
    OrderStatusUpdated { order_id: String, new_status: String },
    SyncOrders(Vec<KdsOrderPayload>), // <-- ADD THIS for initial syncs
    DeviceStatus(DeviceStatusPayload),
    AssignmentUpdate(AssignmentPayload),
    Ping, 
}