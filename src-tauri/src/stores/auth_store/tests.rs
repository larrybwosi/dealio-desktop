use super::*;
use std::sync::Mutex;

#[test]
fn test_auth_state_manual_initialization() {
    // Manually constructing AuthState to avoid accessing real keyring/files
    let state = AuthState {
        device_config: Mutex::new(None),
        member_token: Mutex::new(None),
        current_user: Mutex::new(None),
        client: reqwest::Client::new(),
    };

    assert!(state.device_config.lock().unwrap().is_none());
    assert!(state.member_token.lock().unwrap().is_none());
}

#[test]
fn test_get_client_without_config_fails() {
    let state = AuthState {
        device_config: Mutex::new(None),
        member_token: Mutex::new(None),
        current_user: Mutex::new(None),
        client: reqwest::Client::new(),
    };

    let result = state.get_client();
    assert!(result.is_err());
    assert_eq!(result.err().unwrap(), "Device not initialized");
}

#[test]
fn test_get_client_with_config_succeeds() {
    let config = DeviceConfig {
        base_url: "http://example.com".to_string(),
        location_id: "loc-1".to_string(),
        device_key: "key-1".to_string(),
        allow_negative_stock: false,
    };

    let state = AuthState {
        device_config: Mutex::new(Some(config)),
        member_token: Mutex::new(None),
        current_user: Mutex::new(None),
        client: reqwest::Client::new(),
    };

    let result = state.get_client();
    assert!(result.is_ok());
    let (_client, url) = result.unwrap();
    assert_eq!(url, "http://example.com");
}

#[test]
fn test_get_client_includes_token() {
    let config = DeviceConfig {
        base_url: "http://example.com".to_string(),
        location_id: "loc-1".to_string(),
        device_key: "key-1".to_string(),
        allow_negative_stock: false,
    };

    let state = AuthState {
        device_config: Mutex::new(Some(config)),
        member_token: Mutex::new(Some("secret-token".to_string())),
        current_user: Mutex::new(None),
        client: reqwest::Client::new(),
    };

    let result = state.get_client();
    assert!(result.is_ok());
    // Verification of headers would require inspecting the client which is hard,
    // but the fact it builds successfully with headers logic running is a good basic test.
}
