#[cfg(test)]
use crate::models::{PosProduct, PosCustomer, SaleItem};
#[cfg(test)]
use uuid::Uuid;

#[cfg(test)]
pub fn create_mock_product(id: &str, price: f64) -> PosProduct {
    PosProduct {
        id: id.to_string(),
        name: format!("Mock Product {}", id),
        barcode: Some(format!("BARCODE_{}", id)),
        price_sell: price,
        organization_id: "org-1".to_string(),
        image: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        cost_price: None,
        stock_level: Some(10.0),
        tax_ids: None,
        category_id: None,
        is_active: true,
        description: None,
    }
}

#[cfg(test)]
pub fn create_mock_customer(id: &str) -> PosCustomer {
    PosCustomer {
        id: id.to_string(),
        name: format!("Mock Customer {}", id),
        email: Some(format!("customer{}@test.com", id)),
        phone: None,
        organization_id: "org-1".to_string(),
        is_active: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        address: None,
        city: None,
        note: None,
        state: None,
        zip: None,
    }
}
