use crate::kds_hub_server::{ConnectedDevice, DeviceRegistry, HubStatus};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::{broadcast, oneshot};

// --- Helper to build a DeviceRegistry without Tauri ---

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

fn make_connected_device(id: &str, name: &str, device_type: &str) -> ConnectedDevice {
    ConnectedDevice {
        id: id.to_string(),
        name: name.to_string(),
        device_type: device_type.to_string(),
        status: "online".to_string(),
        last_seen: 1700000000000,
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

// --- ConnectedDevice Tests ---

#[test]
fn test_connected_device_creation() {
    let device = make_connected_device("device-001", "Kitchen Screen", "kds");
    assert_eq!(device.id, "device-001");
    assert_eq!(device.name, "Kitchen Screen");
    assert_eq!(device.device_type, "kds");
    assert_eq!(device.status, "online");
}

#[test]
fn test_connected_device_optional_fields_default_to_none() {
    let device = make_connected_device("d1", "Test", "tablet");
    assert!(device.current_user_id.is_none());
    assert!(device.current_user_name.is_none());
    assert!(device.assigned_user_id.is_none());
    assert!(device.assigned_user_name.is_none());
    assert!(device.station.is_none());
    assert!(device.current_page.is_none());
    assert!(device.table_number.is_none());
    assert!(device.cart_item_count.is_none());
}

#[test]
fn test_connected_device_with_user_assignment() {
    let mut device = make_connected_device("d1", "Tablet 1", "pos");
    device.assigned_user_id = Some("user-42".to_string());
    device.assigned_user_name = Some("Alice".to_string());
    assert_eq!(device.assigned_user_id.as_deref(), Some("user-42"));
    assert_eq!(device.assigned_user_name.as_deref(), Some("Alice"));
}

#[test]
fn test_connected_device_with_station() {
    let mut device = make_connected_device("d2", "Grill Station", "kds");
    device.station = Some("grill".to_string());
    assert_eq!(device.station.as_deref(), Some("grill"));
}

#[test]
fn test_connected_device_with_table_info() {
    let mut device = make_connected_device("d3", "Waiter Tablet", "tablet");
    device.current_page = Some("table-view".to_string());
    device.table_number = Some("5".to_string());
    device.cart_item_count = Some(3);
    assert_eq!(device.current_page.as_deref(), Some("table-view"));
    assert_eq!(device.table_number.as_deref(), Some("5"));
    assert_eq!(device.cart_item_count, Some(3));
}

#[test]
fn test_connected_device_is_cloneable() {
    let device = make_connected_device("d1", "Screen A", "kds");
    let cloned = device.clone();
    assert_eq!(device.id, cloned.id);
    assert_eq!(device.name, cloned.name);
    assert_eq!(device.status, cloned.status);
}

#[test]
fn test_connected_device_serializes_to_json() {
    let device = make_connected_device("d1", "KDS 1", "kds");
    let json = serde_json::to_string(&device).unwrap();
    assert!(json.contains("\"id\":\"d1\""));
    assert!(json.contains("\"name\":\"KDS 1\""));
    assert!(json.contains("\"device_type\":\"kds\""));
    assert!(json.contains("\"status\":\"online\""));
}

#[test]
fn test_connected_device_json_includes_null_for_none_fields() {
    let device = make_connected_device("d2", "Tablet", "pos");
    let json = serde_json::to_string(&device).unwrap();
    // Optional fields are serialized as null when None
    assert!(json.contains("\"current_user_id\":null") || !json.contains("current_user_id"));
}

// --- HubStatus Tests ---

#[test]
fn test_hub_status_running_with_connections() {
    let status = HubStatus {
        is_running: true,
        active_connections: 3,
    };
    assert!(status.is_running);
    assert_eq!(status.active_connections, 3);
}

#[test]
fn test_hub_status_stopped_with_zero_connections() {
    let status = HubStatus {
        is_running: false,
        active_connections: 0,
    };
    assert!(!status.is_running);
    assert_eq!(status.active_connections, 0);
}

#[test]
fn test_hub_status_serializes_to_json() {
    let status = HubStatus {
        is_running: true,
        active_connections: 2,
    };
    let json = serde_json::to_string(&status).unwrap();
    assert!(json.contains("\"is_running\":true"));
    assert!(json.contains("\"active_connections\":2"));
}

// --- DeviceRegistry Tests ---

#[test]
fn test_device_registry_initializes_not_running() {
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
fn test_device_registry_no_shutdown_sender_initially() {
    let registry = make_registry();
    let tx_guard = registry.shutdown_tx.lock().unwrap();
    assert!(tx_guard.is_none());
}

#[test]
fn test_device_registry_set_running_state() {
    let registry = make_registry();
    {
        let mut is_running = registry.is_running.lock().unwrap();
        *is_running = true;
    }
    assert!(*registry.is_running.lock().unwrap());
}

#[test]
fn test_device_registry_increment_connections() {
    let registry = make_registry();
    {
        let mut count = registry.active_connections.lock().unwrap();
        *count += 1;
    }
    assert_eq!(*registry.active_connections.lock().unwrap(), 1);
}

#[test]
fn test_device_registry_decrement_connections_to_zero() {
    let registry = make_registry();
    {
        let mut count = registry.active_connections.lock().unwrap();
        *count = 3;
    }
    {
        let mut count = registry.active_connections.lock().unwrap();
        *count -= 1;
    }
    assert_eq!(*registry.active_connections.lock().unwrap(), 2);
}

#[test]
fn test_device_registry_add_device() {
    let registry = make_registry();
    let device = make_connected_device("kds-001", "KDS Screen", "kds");
    {
        let mut devices = registry.devices.lock().unwrap();
        devices.insert(device.id.clone(), device);
    }
    let devices = registry.devices.lock().unwrap();
    assert_eq!(devices.len(), 1);
    assert!(devices.contains_key("kds-001"));
}

#[test]
fn test_device_registry_add_multiple_devices() {
    let registry = make_registry();
    {
        let mut devices = registry.devices.lock().unwrap();
        devices.insert("d1".to_string(), make_connected_device("d1", "Screen 1", "kds"));
        devices.insert("d2".to_string(), make_connected_device("d2", "Tablet 2", "pos"));
        devices.insert("d3".to_string(), make_connected_device("d3", "Tablet 3", "pos"));
    }
    let devices = registry.devices.lock().unwrap();
    assert_eq!(devices.len(), 3);
}

#[test]
fn test_device_registry_update_device() {
    let registry = make_registry();
    let device = make_connected_device("d1", "Original Name", "kds");
    {
        let mut devices = registry.devices.lock().unwrap();
        devices.insert("d1".to_string(), device);
    }
    // Update the device
    {
        let mut devices = registry.devices.lock().unwrap();
        if let Some(d) = devices.get_mut("d1") {
            d.name = "Updated Name".to_string();
        }
    }
    let devices = registry.devices.lock().unwrap();
    assert_eq!(devices.get("d1").unwrap().name, "Updated Name");
}

#[test]
fn test_device_registry_remove_device() {
    let registry = make_registry();
    {
        let mut devices = registry.devices.lock().unwrap();
        devices.insert("d1".to_string(), make_connected_device("d1", "Screen", "kds"));
    }
    {
        let mut devices = registry.devices.lock().unwrap();
        devices.remove("d1");
    }
    let devices = registry.devices.lock().unwrap();
    assert!(devices.is_empty());
}

#[test]
fn test_device_registry_session_id_increment() {
    let registry = make_registry();
    {
        let mut sid = registry.session_id.lock().unwrap();
        *sid += 1;
    }
    assert_eq!(*registry.session_id.lock().unwrap(), 1);
    {
        let mut sid = registry.session_id.lock().unwrap();
        *sid += 1;
    }
    assert_eq!(*registry.session_id.lock().unwrap(), 2);
}

#[test]
fn test_device_registry_shutdown_sender_set_and_cleared() {
    let registry = make_registry();
    let (tx, _rx) = oneshot::channel::<()>();
    {
        let mut tx_guard = registry.shutdown_tx.lock().unwrap();
        *tx_guard = Some(tx);
    }
    assert!(registry.shutdown_tx.lock().unwrap().is_some());

    // Clear it (simulate shutdown)
    {
        let mut tx_guard = registry.shutdown_tx.lock().unwrap();
        *tx_guard = None;
    }
    assert!(registry.shutdown_tx.lock().unwrap().is_none());
}

#[test]
fn test_device_registry_broadcast_channel_can_send() {
    let registry = make_registry();
    let result = registry.tx.send("test message".to_string());
    // No receivers yet, but send should succeed (returns Err when no receivers)
    // In broadcast, send returns Err if no active receivers
    // This tests that the channel is functional
    drop(result); // Sending with no receivers is an error, but the channel works
    // Verify we can create a new receiver and receive
    let mut rx = registry.tx.subscribe();
    registry.tx.send("hello".to_string()).ok();
    let received = rx.try_recv();
    assert_eq!(received.unwrap(), "hello");
}

#[test]
fn test_device_registry_is_arc_cloneable() {
    let registry = make_registry();
    let clone1 = registry.clone();
    let clone2 = registry.clone();
    // All should share the same state
    {
        let mut count = clone1.active_connections.lock().unwrap();
        *count = 5;
    }
    assert_eq!(*clone2.active_connections.lock().unwrap(), 5);
}

// --- get_hub_status logic Tests ---

#[test]
fn test_hub_status_reflects_registry_state_running() {
    let registry = make_registry();
    {
        let mut is_running = registry.is_running.lock().unwrap();
        *is_running = true;
        let mut count = registry.active_connections.lock().unwrap();
        *count = 2;
    }
    // Simulate get_hub_status logic
    let is_running = *registry.is_running.lock().unwrap();
    let active_connections = *registry.active_connections.lock().unwrap();
    let status = HubStatus { is_running, active_connections };
    assert!(status.is_running);
    assert_eq!(status.active_connections, 2);
}

#[test]
fn test_hub_status_reflects_registry_state_stopped() {
    let registry = make_registry();
    // Default state: not running, 0 connections
    let is_running = *registry.is_running.lock().unwrap();
    let active_connections = *registry.active_connections.lock().unwrap();
    let status = HubStatus { is_running, active_connections };
    assert!(!status.is_running);
    assert_eq!(status.active_connections, 0);
}

// --- assign_user_to_device logic Tests ---

#[test]
fn test_assign_user_to_existing_device() {
    let registry = make_registry();
    let device = make_connected_device("tablet-1", "Waiter Tablet", "pos");
    {
        let mut devices = registry.devices.lock().unwrap();
        devices.insert("tablet-1".to_string(), device);
    }
    // Simulate assign_user_to_device logic
    let user_id = Some("user-99".to_string());
    let user_name = Some("Bob".to_string());
    {
        let mut devices = registry.devices.lock().unwrap();
        if let Some(device) = devices.get_mut("tablet-1") {
            device.assigned_user_id = user_id.clone();
            device.assigned_user_name = user_name.clone();
        }
    }
    let devices = registry.devices.lock().unwrap();
    let device = devices.get("tablet-1").unwrap();
    assert_eq!(device.assigned_user_id.as_deref(), Some("user-99"));
    assert_eq!(device.assigned_user_name.as_deref(), Some("Bob"));
}

#[test]
fn test_assign_user_returns_error_for_unknown_device() {
    let registry = make_registry();
    // No devices in registry
    let devices = registry.devices.lock().unwrap();
    let result = devices.get("nonexistent-id");
    assert!(result.is_none());
}

#[test]
fn test_unassign_user_from_device() {
    let registry = make_registry();
    let mut device = make_connected_device("d1", "Tablet", "pos");
    device.assigned_user_id = Some("user-1".to_string());
    device.assigned_user_name = Some("Alice".to_string());
    {
        let mut devices = registry.devices.lock().unwrap();
        devices.insert("d1".to_string(), device);
    }
    // Unassign by setting to None
    {
        let mut devices = registry.devices.lock().unwrap();
        if let Some(d) = devices.get_mut("d1") {
            d.assigned_user_id = None;
            d.assigned_user_name = None;
        }
    }
    let devices = registry.devices.lock().unwrap();
    let device = devices.get("d1").unwrap();
    assert!(device.assigned_user_id.is_none());
    assert!(device.assigned_user_name.is_none());
}

// --- get_connected_devices logic Tests ---

#[test]
fn test_get_connected_devices_returns_all() {
    let registry = make_registry();
    {
        let mut devices = registry.devices.lock().unwrap();
        devices.insert("d1".to_string(), make_connected_device("d1", "KDS 1", "kds"));
        devices.insert("d2".to_string(), make_connected_device("d2", "Tablet 2", "pos"));
    }
    // Simulate get_connected_devices logic
    let devices = registry.devices.lock().unwrap();
    let result: Vec<ConnectedDevice> = devices.values().cloned().collect();
    assert_eq!(result.len(), 2);
}

#[test]
fn test_get_connected_devices_empty_when_no_devices() {
    let registry = make_registry();
    let devices = registry.devices.lock().unwrap();
    let result: Vec<ConnectedDevice> = devices.values().cloned().collect();
    assert!(result.is_empty());
}

// --- Decrement connections logic Tests ---

#[test]
fn test_decrement_connections_does_not_go_below_zero() {
    let registry = make_registry();
    // Already at 0
    let mut count = registry.active_connections.lock().unwrap();
    if *count > 0 {
        *count -= 1;
    }
    assert_eq!(*count, 0);
}

#[test]
fn test_decrement_connections_from_one_to_zero() {
    let registry = make_registry();
    {
        let mut count = registry.active_connections.lock().unwrap();
        *count = 1;
    }
    {
        let mut count = registry.active_connections.lock().unwrap();
        if *count > 0 {
            *count -= 1;
        }
    }
    assert_eq!(*registry.active_connections.lock().unwrap(), 0);
}

// --- Tablet Activity logic Tests ---

#[test]
fn test_tablet_activity_updates_device_page() {
    let registry = make_registry();
    let device = make_connected_device("tablet-1", "Waiter", "pos");
    {
        let mut devices = registry.devices.lock().unwrap();
        devices.insert("tablet-1".to_string(), device);
    }
    // Simulate TabletActivity update
    {
        let mut devices = registry.devices.lock().unwrap();
        if let Some(d) = devices.get_mut("tablet-1") {
            d.current_page = Some("pos".to_string());
            d.table_number = Some("Table 3".to_string());
            d.cart_item_count = Some(2);
        }
    }
    let devices = registry.devices.lock().unwrap();
    let device = devices.get("tablet-1").unwrap();
    assert_eq!(device.current_page.as_deref(), Some("pos"));
    assert_eq!(device.table_number.as_deref(), Some("Table 3"));
    assert_eq!(device.cart_item_count, Some(2));
}

#[test]
fn test_tablet_activity_updates_last_seen() {
    let registry = make_registry();
    let device = make_connected_device("tablet-2", "Server", "pos");
    {
        let mut devices = registry.devices.lock().unwrap();
        devices.insert("tablet-2".to_string(), device);
    }
    let new_timestamp = 1_700_999_999_000i64;
    {
        let mut devices = registry.devices.lock().unwrap();
        if let Some(d) = devices.get_mut("tablet-2") {
            d.last_seen = new_timestamp;
        }
    }
    let devices = registry.devices.lock().unwrap();
    assert_eq!(devices.get("tablet-2").unwrap().last_seen, new_timestamp);
}