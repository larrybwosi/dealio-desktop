use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SellableUnit {
    pub unit_id: String,
    pub unit_name: String,
    pub price: f64,
    pub conversion: f64,
    pub is_base_unit: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Variant {
    pub variant_id: String,
    pub variant_name: String,
    pub barcode: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PosProduct {
    pub product_id: String,
    pub product_name: String,
    pub variant_id: String,
    pub variant_name: String,
    pub category: String,
    pub sku: String,
    pub barcode: Option<String>,
    pub image_url: Option<String>,
    pub stock: f64,
    pub sellable_units: Vec<SellableUnit>,
    pub variants: Vec<Variant>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductsSyncResponse {
    pub products: Vec<PosProduct>,
    pub sync_timestamp: Option<String>,
}