use crate::api_config::routes;

// --- Auth Routes ---

#[test]
fn test_check_in_route_is_v2_pos() {
    assert_eq!(routes::CHECK_IN, "api/v2/pos/check-in");
}

#[test]
fn test_check_out_route_is_v2_pos() {
    assert_eq!(routes::CHECK_OUT, "api/v2/pos/check-out");
}

#[test]
fn test_locations_route_is_v2_pos() {
    assert_eq!(routes::LOCATIONS, "api/v2/pos/locations");
}

#[test]
fn test_ably_auth_route_is_v2_pos() {
    assert_eq!(routes::ABLY_AUTH, "api/v2/pos/ably-auth");
}

#[test]
fn test_mpesa_initiate_route() {
    assert_eq!(routes::MPESA_INITIATE, "api/mpesa/initiate");
}

// --- Inventory Routes ---

#[test]
fn test_inventory_transfers_route() {
    assert_eq!(routes::INVENTORY_TRANSFERS, "api/v2/pos/inventory/transfers");
}

#[test]
fn test_inventory_process_route() {
    assert_eq!(routes::INVENTORY_PROCESS, "api/v2/pos/inventory/process");
}

#[test]
fn test_incoming_shipments_route() {
    assert_eq!(routes::INCOMING_SHIPMENTS, "api/v2/pos/incoming");
}

// --- Dynamic Route: purchase_receive ---

#[test]
fn test_purchase_receive_formats_correctly() {
    assert_eq!(
        routes::purchase_receive("abc123"),
        "api/v2/pos/purchases/abc123/receive"
    );
}

#[test]
fn test_purchase_receive_with_uuid() {
    let id = "550e8400-e29b-41d4-a716-446655440000";
    let expected = format!("api/v2/pos/purchases/{}/receive", id);
    assert_eq!(routes::purchase_receive(id), expected);
}

#[test]
fn test_purchase_receive_with_empty_id() {
    assert_eq!(routes::purchase_receive(""), "api/v2/pos/purchases//receive");
}

#[test]
fn test_purchase_receive_with_numeric_id() {
    assert_eq!(
        routes::purchase_receive("42"),
        "api/v2/pos/purchases/42/receive"
    );
}

#[test]
fn test_purchase_receive_starts_with_api_v2() {
    let result = routes::purchase_receive("test-id");
    assert!(result.starts_with("api/v2/pos/purchases/"));
}

#[test]
fn test_purchase_receive_ends_with_receive() {
    let result = routes::purchase_receive("test-id");
    assert!(result.ends_with("/receive"));
}

// --- Dynamic Route: transfer_receive ---

#[test]
fn test_transfer_receive_formats_correctly() {
    assert_eq!(
        routes::transfer_receive("tr456"),
        "api/v2/pos/inventory/transfers/tr456/receive"
    );
}

#[test]
fn test_transfer_receive_with_uuid() {
    let id = "550e8400-e29b-41d4-a716-446655440001";
    let expected = format!("api/v2/pos/inventory/transfers/{}/receive", id);
    assert_eq!(routes::transfer_receive(id), expected);
}

#[test]
fn test_transfer_receive_with_empty_id() {
    assert_eq!(
        routes::transfer_receive(""),
        "api/v2/pos/inventory/transfers//receive"
    );
}

#[test]
fn test_transfer_receive_starts_with_inventory_transfers() {
    let result = routes::transfer_receive("any-id");
    assert!(result.starts_with("api/v2/pos/inventory/transfers/"));
}

#[test]
fn test_transfer_receive_ends_with_receive() {
    let result = routes::transfer_receive("any-id");
    assert!(result.ends_with("/receive"));
}

// --- Sales Routes ---

#[test]
fn test_sale_process_route() {
    assert_eq!(routes::SALE_PROCESS, "api/v2/pos/sale");
}

#[test]
fn test_sale_base_route() {
    assert_eq!(routes::SALE_BASE, "api/v2/pos/sale");
}

#[test]
fn test_sale_payments_route() {
    assert_eq!(routes::SALE_PAYMENTS, "api/v2/pos/sale/payments");
}

#[test]
fn test_transaction_scan_route() {
    assert_eq!(routes::TRANSACTION_SCAN, "api/v2/pos/transaction/scan");
}

#[test]
fn test_orders_route() {
    assert_eq!(routes::ORDERS, "api/v2/pos/orders");
}

// --- Products & Pricing Routes ---

#[test]
fn test_products_route() {
    assert_eq!(routes::PRODUCTS, "api/v2/pos/products");
}

#[test]
fn test_pricing_route() {
    assert_eq!(routes::PRICING, "api/v2/pos/pricing");
}

#[test]
fn test_pricing_sync_route() {
    assert_eq!(routes::PRICING_SYNC, "api/v2/pos/pricing/sync");
}

// --- Customers Route ---

#[test]
fn test_customers_route() {
    assert_eq!(routes::CUSTOMERS, "api/v2/pos/customers");
}

// --- Shifts Route ---

#[test]
fn test_shift_sync_route() {
    assert_eq!(routes::SHIFT_SYNC, "api/v2/pos/shifts/sync");
}

// --- Delivery Routes ---

#[test]
fn test_drivers_route() {
    assert_eq!(routes::DRIVERS, "api/v2/drivers");
}

#[test]
fn test_delivery_dispatch_route() {
    assert_eq!(routes::DELIVERY_DISPATCH, "api/v2/pos/deliveries/dispatch");
}

#[test]
fn test_delivery_reconcile_route() {
    assert_eq!(
        routes::DELIVERY_RECONCILE,
        "api/v2/pos/deliveries/reconcile-pod"
    );
}

// --- Consistency Tests ---

#[test]
fn test_all_pos_routes_start_with_api_v2_pos() {
    let pos_routes = [
        routes::CHECK_IN,
        routes::CHECK_OUT,
        routes::LOCATIONS,
        routes::ABLY_AUTH,
        routes::INVENTORY_TRANSFERS,
        routes::INVENTORY_PROCESS,
        routes::INCOMING_SHIPMENTS,
        routes::SALE_PROCESS,
        routes::SALE_BASE,
        routes::SALE_PAYMENTS,
        routes::TRANSACTION_SCAN,
        routes::ORDERS,
        routes::PRODUCTS,
        routes::PRICING,
        routes::PRICING_SYNC,
        routes::CUSTOMERS,
        routes::SHIFT_SYNC,
        routes::DELIVERY_DISPATCH,
        routes::DELIVERY_RECONCILE,
    ];
    for route in pos_routes {
        assert!(
            route.starts_with("api/v2/pos/") || route.starts_with("api/v2/"),
            "Route '{}' does not start with 'api/v2/'",
            route
        );
    }
}

#[test]
fn test_no_route_has_leading_slash() {
    let routes_to_check: &[&str] = &[
        routes::CHECK_IN,
        routes::CHECK_OUT,
        routes::SALE_PROCESS,
        routes::PRODUCTS,
        routes::CUSTOMERS,
        routes::DRIVERS,
    ];
    for route in routes_to_check {
        assert!(
            !route.starts_with('/'),
            "Route '{}' has a leading slash",
            route
        );
    }
}

#[test]
fn test_purchase_receive_and_transfer_receive_produce_distinct_paths() {
    let id = "same-id";
    assert_ne!(routes::purchase_receive(id), routes::transfer_receive(id));
}

#[test]
fn test_purchase_receive_contains_id_in_path() {
    let unique_id = "unique-test-id-xyz";
    let route = routes::purchase_receive(unique_id);
    assert!(route.contains(unique_id));
}

#[test]
fn test_transfer_receive_contains_id_in_path() {
    let unique_id = "unique-transfer-id-abc";
    let route = routes::transfer_receive(unique_id);
    assert!(route.contains(unique_id));
}