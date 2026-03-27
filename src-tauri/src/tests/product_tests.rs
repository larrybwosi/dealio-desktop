use crate::models::{PosProduct, Variant, SellableUnit};
use crate::stores::product_store::{build_search_text};

fn create_mock_product(id: &str, name: &str, sku: &str, barcode: Option<&str>) -> PosProduct {
    PosProduct {
        product_id: id.to_string(),
        product_name: name.to_string(),
        category: "Test".to_string(),
        image_url: None,
        total_stock: Some(10),
        variants: vec![
            Variant {
                variant_id: format!("{}_v1", id),
                variant_name: "Standard".to_string(),
                sku: sku.to_string(),
                barcode: barcode.map(|s| s.to_string()),
                stock: 10,
                sellable_units: vec![
                    SellableUnit {
                        unit_id: "u1".to_string(),
                        unit_name: "Piece".to_string(),
                        price: 100.0,
                        wholesale_price: None,
                        conversion: 1.0,
                        is_base_unit: true,
                        pricing: None,
                    }
                ],
            }
        ],
    }
}

#[test]
fn test_build_search_text() {
    let product = create_mock_product("p1", "Gorgonzola Cheese", "SKU123", Some("789456"));
    let search_text = build_search_text(&product);

    assert!(search_text.contains("gorgonzola cheese"));
    assert!(search_text.contains("sku123"));
    assert!(search_text.contains("789456"));
    assert!(search_text.contains("standard"));
}

#[test]
fn test_build_search_text_case_insensitive() {
    let product = create_mock_product("p1", "APPLE", "sku-abc", None);
    let search_text = build_search_text(&product);

    assert!(search_text.contains("apple"));
    assert!(search_text.contains("sku-abc"));
}
