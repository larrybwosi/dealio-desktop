// src-tauri/src/api_config.rs

pub mod routes {
    // --- Auth ---
    pub const CHECK_IN: &str = "api/v2/pos/check-in";
    pub const CHECK_OUT: &str = "api/v2/pos/check-out";
    pub const LOCATIONS: &str = "api/v2/pos/locations";
    pub const ABLY_AUTH: &str = "api/v2/pos/ably-auth";
    pub const MPESA_INITIATE: &str = "api/mpesa/initiate";
    // pub const DEVICE_REGISTER: &str = "api/v2/devices/register";

    // --- Inventory / Stock ---
    pub const INVENTORY_TRANSFERS: &str = "api/v2/pos/inventory/transfers";
    pub const INVENTORY_PROCESS: &str = "api/v2/pos/inventory/process";
    pub const INCOMING_SHIPMENTS: &str = "api/v2/pos/incoming";

    pub fn purchase_receive(id: &str) -> String {
        format!("api/v2/pos/purchases/{}/receive", id)
    }

    pub fn transfer_receive(id: &str) -> String {
        format!("api/v2/pos/inventory/transfers/{}/receive", id)
    }

    // --- Sales ---

    pub const SALE_PROCESS: &str = "api/v2/pos/sale";
    pub const SALE_BASE: &str = "api/v2/pos/sale";
    pub const SALE_PAYMENTS: &str = "api/v2/pos/sale/payments";
    pub const TRANSACTION_SCAN: &str = "api/v2/pos/transaction/scan";
    pub const ORDERS: &str = "api/v2/pos/orders";

    // --- Products & Pricing ---
    pub const PRODUCTS: &str = "api/v2/pos/products";
    pub const PRICING: &str = "api/v2/pos/pricing";
    pub const PRICING_SYNC: &str = "api/v2/pos/pricing/sync";

    // --- Customers ---
    pub const CUSTOMERS: &str = "api/v2/pos/customers";

    // --- Shifts ---
    pub const SHIFT_SYNC: &str = "api/v2/pos/shifts/sync";

    // --- Delivery ---
    pub const DRIVERS: &str = "api/v2/drivers";
    pub const DELIVERY_DISPATCH: &str = "api/v2/pos/deliveries/dispatch";
    pub const DELIVERY_RECONCILE: &str = "api/v2/pos/deliveries/reconcile-pod";
}

#[cfg(test)]
mod tests {
    use super::routes;

    // --- Route constants correctness ---

    #[test]
    fn test_check_in_route() {
        assert_eq!(routes::CHECK_IN, "api/v2/pos/check-in");
    }

    #[test]
    fn test_check_out_route() {
        assert_eq!(routes::CHECK_OUT, "api/v2/pos/check-out");
    }

    #[test]
    fn test_locations_route() {
        assert_eq!(routes::LOCATIONS, "api/v2/pos/locations");
    }

    #[test]
    fn test_ably_auth_route() {
        assert_eq!(routes::ABLY_AUTH, "api/v2/pos/ably-auth");
    }

    #[test]
    fn test_mpesa_initiate_route() {
        assert_eq!(routes::MPESA_INITIATE, "api/mpesa/initiate");
    }

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

    #[test]
    fn test_customers_route() {
        assert_eq!(routes::CUSTOMERS, "api/v2/pos/customers");
    }

    #[test]
    fn test_shift_sync_route() {
        assert_eq!(routes::SHIFT_SYNC, "api/v2/pos/shifts/sync");
    }

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
        assert_eq!(routes::DELIVERY_RECONCILE, "api/v2/pos/deliveries/reconcile-pod");
    }

    // --- Dynamic route builders ---

    #[test]
    fn test_purchase_receive_formats_id_into_path() {
        let result = routes::purchase_receive("abc123");
        assert_eq!(result, "api/v2/pos/purchases/abc123/receive");
    }

    #[test]
    fn test_purchase_receive_with_uuid_like_id() {
        let result = routes::purchase_receive("550e8400-e29b-41d4-a716-446655440000");
        assert_eq!(result, "api/v2/pos/purchases/550e8400-e29b-41d4-a716-446655440000/receive");
    }

    #[test]
    fn test_purchase_receive_with_empty_id() {
        let result = routes::purchase_receive("");
        assert_eq!(result, "api/v2/pos/purchases//receive");
    }

    #[test]
    fn test_purchase_receive_with_numeric_id() {
        let result = routes::purchase_receive("42");
        assert_eq!(result, "api/v2/pos/purchases/42/receive");
    }

    #[test]
    fn test_transfer_receive_formats_id_into_path() {
        let result = routes::transfer_receive("transfer-001");
        assert_eq!(result, "api/v2/pos/inventory/transfers/transfer-001/receive");
    }

    #[test]
    fn test_transfer_receive_with_uuid_like_id() {
        let result = routes::transfer_receive("550e8400-e29b-41d4-a716-446655440000");
        assert_eq!(result, "api/v2/pos/inventory/transfers/550e8400-e29b-41d4-a716-446655440000/receive");
    }

    #[test]
    fn test_transfer_receive_with_empty_id() {
        let result = routes::transfer_receive("");
        assert_eq!(result, "api/v2/pos/inventory/transfers//receive");
    }

    #[test]
    fn test_transfer_receive_with_numeric_id() {
        let result = routes::transfer_receive("99");
        assert_eq!(result, "api/v2/pos/inventory/transfers/99/receive");
    }

    // --- Route prefix consistency ---

    #[test]
    fn test_all_auth_routes_use_v2_prefix() {
        assert!(routes::CHECK_IN.starts_with("api/v2/"));
        assert!(routes::CHECK_OUT.starts_with("api/v2/"));
        assert!(routes::LOCATIONS.starts_with("api/v2/"));
        assert!(routes::ABLY_AUTH.starts_with("api/v2/"));
    }

    #[test]
    fn test_all_sales_routes_use_v2_prefix() {
        assert!(routes::SALE_PROCESS.starts_with("api/v2/"));
        assert!(routes::SALE_PAYMENTS.starts_with("api/v2/"));
        assert!(routes::TRANSACTION_SCAN.starts_with("api/v2/"));
        assert!(routes::ORDERS.starts_with("api/v2/"));
    }

    #[test]
    fn test_no_routes_have_leading_slash() {
        assert!(!routes::CHECK_IN.starts_with('/'));
        assert!(!routes::CHECK_OUT.starts_with('/'));
        assert!(!routes::SALE_PROCESS.starts_with('/'));
        assert!(!routes::PRODUCTS.starts_with('/'));
        assert!(!routes::CUSTOMERS.starts_with('/'));
    }

    #[test]
    fn test_purchase_receive_starts_with_api_v2() {
        let result = routes::purchase_receive("x");
        assert!(result.starts_with("api/v2/"));
    }

    #[test]
    fn test_transfer_receive_starts_with_api_v2() {
        let result = routes::transfer_receive("x");
        assert!(result.starts_with("api/v2/"));
    }
}
