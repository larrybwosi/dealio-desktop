#[cfg(test)]
use crate::models::{PosProduct, PosCustomer};

#[cfg(test)]
pub fn create_mock_product(id: &str, _price: f64) -> PosProduct {
    PosProduct {
        product_id: id.to_string(),
        product_name: format!("Mock Product {}", id),
        category: "General".to_string(),
        image_url: None,
        total_stock: Some(10),
        variants: vec![],
    }
}

#[cfg(test)]
pub fn create_mock_customer(id: &str) -> PosCustomer {
    PosCustomer {
        id: id.to_string(),
        name: format!("Mock Customer {}", id),
        email: Some(format!("customer{}@test.com", id)),
        phone: None,
        customer_type: Some("B2C".to_string()),
        company: None,
        business_account_id: None,
        loyalty_points: Some(0.0),
        primary_address: None,
        addresses: None,
        updated_at: chrono::Utc::now().to_rfc3339(),
    }
}
