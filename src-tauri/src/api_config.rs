// src-tauri/src/api_config.rs

pub mod routes {
    // --- Auth ---
    pub const CHECK_IN: &str = "api/v1/pos/check-in";
    pub const CHECK_OUT: &str = "api/v1/pos/check-out";
    pub const LOCATIONS: &str = "api/v1/pos/locations";
    pub const ABLY_AUTH: &str = "api/v1/pos/ably-auth";
    pub const MPESA_INITIATE: &str = "api/mpesa/initiate";

    // --- Inventory / Stock ---
    pub const INVENTORY_TRANSFERS: &str = "api/v1/pos/inventory/transfers";
    pub const INVENTORY_PROCESS: &str = "api/v1/pos/inventory/process";
    pub const INCOMING_SHIPMENTS: &str = "api/v1/pos/incoming";

    pub fn purchase_receive(id: &str) -> String {
        format!("api/v1/pos/purchases/{}/receive", id)
    }

    pub fn transfer_receive(id: &str) -> String {
        format!("api/v1/pos/inventory/transfers/{}/receive", id)
    }

    // --- Sales ---
    pub const SALE_PROCESS: &str = "api/v1/pos/sale/process";
    pub const SALE_BASE: &str = "api/v1/pos/sale";
    pub const SALE_PAYMENTS: &str = "api/v1/pos/sale/payments";
    pub const TRANSACTION_SCAN: &str = "api/v1/pos/transaction/scan";
    pub const ORDERS: &str = "api/v1/pos/orders";

    // --- Products & Pricing ---
    pub const PRODUCTS: &str = "api/v1/pos/products";
    pub const PRICING: &str = "api/v1/pos/pricing";
    pub const PRICING_SYNC: &str = "api/v1/pos/pricing/sync";

    // --- Customers ---
    pub const CUSTOMERS: &str = "api/v1/pos/customers";

    // --- Shifts ---
    pub const SHIFT_SYNC: &str = "api/v1/pos/shifts/sync";

    // --- Delivery ---
    pub const DRIVERS: &str = "api/v1/drivers";
    pub const DELIVERY_DISPATCH: &str = "api/v1/pos/deliveries/dispatch";
    pub const DELIVERY_RECONCILE: &str = "api/v1/pos/deliveries/reconcile-pod";
}
