use std::fs;
use std::time::Duration;
use tauri::{AppHandle, Manager, State}; 
use crate::auth_store::AuthState; 
use anyhow::Context; 
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::multipart::Form; 
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};
use uuid::Uuid;
use log::{info, error};

// --- Error Handling Structures ---

#[derive(Debug, Serialize)]
pub enum ErrorKind {
    Authentication,
    Network,
    FileSystem,
    Serialization,
    Server,
    Validation,
    Configuration,
    Unknown,
}

#[derive(Debug, Serialize)]
pub struct CommandError {
    pub kind: ErrorKind,
    pub message: String,
    pub details: Option<String>,
}

impl CommandError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }
}

// Helper to map anyhow errors to CommandError
impl From<anyhow::Error> for CommandError {
    fn from(err: anyhow::Error) -> Self {
        // We log the full stack trace/context here for backend debugging
        error!("Internal Error: {:?}", err);
        CommandError::new(ErrorKind::Unknown, err.to_string())
    }
}

// --- Data Structures ---

// Existing Delivery Structures
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryItem {
    pub variant_id: String,
    pub quantity: i32,
    pub unit_cost: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiry_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocumentMetadata {
    pub id: String,
    pub name: String,
    pub doc_type: String, 
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryPayload {
    pub supplier_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub purchase_id: Option<String>,
    pub location_id: String,
    pub received_date: String,
    pub items: Vec<DeliveryItem>,
    pub notes: String,
}

// --- NEW: Stock Acceptance Structures ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StockBatchProduct {
    pub name: String,
    pub sku: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StockBatchVariant {
    pub product: StockBatchProduct,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StockBatchPurchaseItem {
    pub purchase_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StockBatch {
    pub id: String,
    pub organization_id: String,
    pub location_id: String,
    pub quality_check_status: String, // "PENDING", "PASSED", "FAILED"
    pub received_date: String,
    pub initial_quantity: String, 
    pub current_quantity: String,
    pub variant: StockBatchVariant,
    pub purchase_item: Option<StockBatchPurchaseItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StockBatchMeta {
    pub total: i32,
    pub page: i32,
    pub limit: i32,
    pub total_pages: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StockBatchResponse {
    pub data: Vec<StockBatch>,
    pub meta: StockBatchMeta,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StockProcessRequest {
    pub batch_id: String,
    pub location_id: String,
    pub action: String, // "ACCEPT", "REJECT", "PARTIAL"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accepted_quantity: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rejected_quantity: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

// --- Internal Helpers ---

/// Helper function to construct authenticated client
fn build_client(
    auth_state: &State<'_, AuthState>,
) -> Result<(reqwest::Client, String), CommandError> {
    
    let (base_url, device_key) = {
        let config_guard = auth_state.device_config.lock()
            .map_err(|_| CommandError::new(ErrorKind::Configuration, "Failed to lock device config"))?;
        
        let config = config_guard.as_ref()
            .ok_or_else(|| CommandError::new(ErrorKind::Configuration, "Device is not configured"))?;
        
        (config.base_url.clone(), config.device_key.clone())
    };

    let (token, member_id) = {
        let token_guard = auth_state.member_token.lock()
            .map_err(|_| CommandError::new(ErrorKind::Authentication, "Failed to lock token store"))?;
        
        let user_guard = auth_state.current_user.lock()
            .map_err(|_| CommandError::new(ErrorKind::Authentication, "Failed to lock user store"))?;
        
        (
            token_guard.clone(), 
            user_guard.as_ref().map(|u| u.id.clone())
        )
    };

    let clean_base = base_url.trim_end_matches('/').to_string();
    let mut headers = HeaderMap::new();
    
    // 1. Device Key
    let mut val = HeaderValue::from_str(&device_key)
        .map_err(|e| CommandError::new(ErrorKind::Configuration, format!("Invalid Device Key format: {}", e)))?;
    val.set_sensitive(true);
    headers.insert("X-Device-Api-Key", val);

    // 2. Auth Token
    if let Some(t) = &token {
        let auth_val = format!("Bearer {}", t);
        let mut val = HeaderValue::from_str(&auth_val)
            .map_err(|e| CommandError::new(ErrorKind::Authentication, format!("Invalid Token format: {}", e)))?;
        val.set_sensitive(true);
        headers.insert(AUTHORIZATION, val);
    }
    
    // 3. Member ID
    if let Some(mid) = &member_id {
        let val = HeaderValue::from_str(mid)
            .map_err(|e| CommandError::new(ErrorKind::Authentication, format!("Invalid Member ID format: {}", e)))?;
        headers.insert("X-Member-Id", val);
    }

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| CommandError::new(ErrorKind::Configuration, format!("Failed to build HTTP client: {}", e)))?;

    Ok((client, clean_base))
}

/// Helper to handle HTTP responses centrally
async fn handle_response<T: for<'de> Deserialize<'de>>(
    response: reqwest::Response, 
    context: &str
) -> Result<T, CommandError> {
    let status = response.status();
    
    if status.is_success() {
        return response.json::<T>().await.map_err(|e| {
            error!("[{}] JSON Parse Error: {}", context, e);
            CommandError::new(ErrorKind::Serialization, "Failed to process server response")
                .with_details(e.to_string())
        });
    }

    // Handle Errors
    let error_body = response.text().await.unwrap_or_else(|_| "No content".to_string());
    error!("[{}] API Error {}: {}", context, status, error_body);

    match status.as_u16() {
        401 | 403 => Err(CommandError::new(ErrorKind::Authentication, "Session expired or unauthorized")
            .with_details(error_body)),
        400 | 422 => Err(CommandError::new(ErrorKind::Validation, "Invalid request data")
            .with_details(error_body)),
        404 => Err(CommandError::new(ErrorKind::Server, "Resource not found")
            .with_details(error_body)),
        500..=599 => Err(CommandError::new(ErrorKind::Server, "Remote server error")
            .with_details(error_body)),
        _ => Err(CommandError::new(ErrorKind::Unknown, format!("Unexpected status: {}", status))
            .with_details(error_body)),
    }
}

// --- Public Functions ---

/// Saves a base64 encoded file to the AppData/documents directory
#[tauri::command]
pub fn save_document_locally(
    app: AppHandle,
    filename: String, 
    file_type: String, 
    base64_data: String
) -> Result<DocumentMetadata, CommandError> {
    
    let run_save = || -> anyhow::Result<DocumentMetadata> {
        let app_dir = app.path().app_data_dir()
            .context("Could not resolve App Data Directory")?;
        
        let docs_dir = app_dir.join("documents");
        
        if !docs_dir.exists() {
            fs::create_dir_all(&docs_dir)
                .context("Failed to create documents directory")?;
        }

        let unique_id = Uuid::now_v7().to_string();
        // Sanitize filename to prevent path traversal
        let sanitized_name = filename.replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '-', "_");
        let safe_filename = format!("{}_{}", unique_id, sanitized_name);
        let file_path = docs_dir.join(&safe_filename);

        let bytes = general_purpose::STANDARD
            .decode(&base64_data)
            .map_err(|e| anyhow::anyhow!("Invalid Base64 data: {}", e))?;

        fs::write(&file_path, &bytes)
            .with_context(|| format!("Failed to write file to {:?}", file_path))?;

        info!("[DeliveryStore] Saved document: {}", safe_filename);

        Ok(DocumentMetadata {
            id: unique_id,
            name: filename,
            doc_type: file_type,
            path: file_path.to_string_lossy().to_string(),
            size: bytes.len() as u64,
        })
    };

    run_save().map_err(|e| {
        error!("[SaveDocument] Error: {:?}", e);
        // Distinguish errors based on content
        let msg = e.to_string();
        if msg.contains("Base64") {
            CommandError::new(ErrorKind::Validation, "File encoding error").with_details(msg)
        } else {
            CommandError::new(ErrorKind::FileSystem, "Failed to save file locally").with_details(msg)
        }
    })
}

/// Syncs the delivery data with the external API
#[tauri::command]
pub async fn submit_delivery(
    auth_state: State<'_, AuthState>,
    payload: DeliveryPayload
) -> Result<serde_json::Value, CommandError> { 
    
    let (client, base_url) = build_client(&auth_state)?;
    let url = format!("{}/api/v1/pos/inventory/delivery", base_url);

    let mut form = Form::new();
    let json_part = serde_json::to_string(&payload)
        .map_err(|e| CommandError::new(ErrorKind::Serialization, "Failed to prepare delivery data").with_details(e.to_string()))?;
    
    form = form.text("data", json_part);

    info!("[DeliveryStore] Uploading delivery for supplier {}...", payload.supplier_id);

    let resp = client.post(&url)
        .multipart(form) 
        .send()
        .await
        .map_err(|e| CommandError::new(ErrorKind::Network, "Failed to connect to server").with_details(e.to_string()))?;
    
    handle_response(resp, "SubmitDelivery").await
}

/// Fetch pending stock batches for quality check
#[tauri::command]
pub async fn fetch_pending_stock(
    auth_state: State<'_, AuthState>,
    location_id: String,
    page: Option<i32>,
    limit: Option<i32>
) -> Result<StockBatchResponse, CommandError> {

    let (client, base_url) = build_client(&auth_state)?;
    let url = format!("{}/api/v1/pos/inventory/pending", base_url);

    let page_str = page.unwrap_or(1).to_string();
    let limit_str = limit.unwrap_or(50).to_string();

    let params = [
        ("locationId", &location_id),
        ("page", &page_str),
        ("limit", &limit_str),
    ];

    info!("[StockAcceptance] Fetching pending batches for location {}", location_id);

    let resp = client.get(&url)
        .query(&params)
        .send()
        .await
        .map_err(|e| CommandError::new(ErrorKind::Network, "Failed to retrieve stock list").with_details(e.to_string()))?;

    handle_response(resp, "FetchPendingStock").await
}

/// Submit a stock processing decision (Accept/Reject/Partial)
#[tauri::command]
pub async fn submit_stock_process(
    auth_state: State<'_, AuthState>,
    payload: StockProcessRequest
) -> Result<serde_json::Value, CommandError> {

    let (client, base_url) = build_client(&auth_state)?;
    let url = format!("{}/api/v1/pos/inventory/process", base_url);

    info!("[StockAcceptance] Submitting process for batch {} - Action: {}", payload.batch_id, payload.action);

    let resp = client.post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| CommandError::new(ErrorKind::Network, "Failed to submit decision").with_details(e.to_string()))?;

    handle_response(resp, "SubmitStockProcess").await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stock_process_request_serialization() {
        let request = StockProcessRequest {
            batch_id: "batch-123".to_string(),
            location_id: "loc-456".to_string(),
            action: "ACCEPT".to_string(),
            accepted_quantity: Some(10.0),
            rejected_quantity: None,
            reason: None,
            notes: Some("Looks good".to_string()),
        };

        let serialized = serde_json::to_value(&request).unwrap();
        
        assert_eq!(serialized["batchId"], "batch-123");
        assert_eq!(serialized["locationId"], "loc-456");
        assert_eq!(serialized["action"], "ACCEPT");
        assert_eq!(serialized["acceptedQuantity"], 10.0);
        assert_eq!(serialized["notes"], "Looks good");
        
        // These should NOT be present
        assert!(serialized.get("rejectedQuantity").is_none(), "rejectedQuantity should be omitted");
        assert!(serialized.get("reason").is_none(), "reason should be omitted");
    }

    #[test]
    fn test_delivery_payload_serialization() {
        let item = DeliveryItem {
            variant_id: "var-1".to_string(),
            quantity: 5,
            unit_cost: 100.0,
            batch_number: None,
            expiry_date: None,
        };

        let payload = DeliveryPayload {
            supplier_id: "sup-1".to_string(),
            purchase_id: None,
            location_id: "loc-1".to_string(),
            received_date: "2024-01-01".to_string(),
            items: vec![item],
            notes: "Test".to_string(),
        };

        let serialized = serde_json::to_value(&payload).unwrap();
        
        assert_eq!(serialized["supplierId"], "sup-1");
        assert!(serialized.get("purchaseId").is_none());
        
        let serialized_item = &serialized["items"][0];
        assert_eq!(serialized_item["variantId"], "var-1");
        assert!(serialized_item.get("batchNumber").is_none());
        assert!(serialized_item.get("expiryDate").is_none());
    }
}
