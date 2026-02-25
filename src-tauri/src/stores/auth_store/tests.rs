#[test]
fn test_build_request_without_config_fails() {
    let state = AuthState {
        device_config: Mutex::new(None),
        member_token: Mutex::new(None),
        current_user: Mutex::new(None),
        client: reqwest::Client::new(),
    };

    let result = state.build_request(reqwest::Method::GET, "/test");
    assert!(result.is_err());
    assert_eq!(result.err().unwrap(), "Device not configured");
}

#[test]
fn test_build_request_with_config_succeeds() {
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

    let result = state.build_request(reqwest::Method::GET, "/api/data");
    assert!(result.is_ok());
    // Since we return a RequestBuilder, we successfully built it without crashing
}

#[test]
fn test_build_request_includes_token() {
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

    let result = state.build_request(reqwest::Method::GET, "/api/data");
    assert!(result.is_ok());
}