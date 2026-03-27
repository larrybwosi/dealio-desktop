use crate::models::PosCustomer;
use crate::stores::customer_store::{CustomerState, search_local, get_customers_by_ids};
use std::sync::Mutex;

fn create_mock_customer(id: &str, name: &str, phone: Option<&str>) -> PosCustomer {
    PosCustomer {
        id: id.to_string(),
        name: name.to_string(),
        email: Some(format!("{}@example.com", id)),
        phone: phone.map(|s| s.to_string()),
        customer_type: Some("B2C".to_string()),
        company: None,
        loyalty_points: Some(0.0),
        city: None,
        primary_address: None,
        updated_at: None,
    }
}

#[test]
fn test_search_local_empty_query() {
    let state = CustomerState {
        customers: Mutex::new(vec![
            create_mock_customer("1", "Alice", None),
            create_mock_customer("2", "Bob", None),
        ]),
        last_sync_token: Mutex::new(None),
    };

    let results = search_local(&state, "".to_string());
    assert_eq!(results.len(), 2);
}

#[test]
fn test_search_local_by_name() {
    let state = CustomerState {
        customers: Mutex::new(vec![
            create_mock_customer("1", "Alice", None),
            create_mock_customer("2", "Bob", None),
        ]),
        last_sync_token: Mutex::new(None),
    };

    let results = search_local(&state, "Ali".to_string());
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].name, "Alice");
}

#[test]
fn test_search_local_by_phone() {
    let state = CustomerState {
        customers: Mutex::new(vec![
            create_mock_customer("1", "Alice", Some("123456")),
            create_mock_customer("2", "Bob", Some("789012")),
        ]),
        last_sync_token: Mutex::new(None),
    };

    let results = search_local(&state, "789".to_string());
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].name, "Bob");
}

#[test]
fn test_get_customers_by_ids() {
    let state = CustomerState {
        customers: Mutex::new(vec![
            create_mock_customer("1", "Alice", None),
            create_mock_customer("2", "Bob", None),
            create_mock_customer("3", "Charlie", None),
        ]),
        last_sync_token: Mutex::new(None),
    };

    let results = get_customers_by_ids(&state, vec!["1".to_string(), "3".to_string()]);
    assert_eq!(results.len(), 2);
    let names: Vec<String> = results.iter().map(|c| c.name.clone()).collect();
    assert!(names.contains(&"Alice".to_string()));
    assert!(names.contains(&"Charlie".to_string()));
}
