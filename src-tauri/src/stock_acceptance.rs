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
use log::info;

// --- Data Structures ---

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryItem {
    pub variant_id: String,
    pub quantity: i32,
    pub unit_cost: f64,
    pub batch_number: Option<String>,
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
    pub purchase_id: Option<String>,
    pub location_id: String,
    pub received_date: String,
    pub items: Vec<DeliveryItem>,
    pub notes: String,
}

// --- Public Functions ---

/// Saves a base64 encoded file to the AppData/documents directory
#[tauri::command]
pub fn save_document_locally(
    app: AppHandle,
    filename: String, 
    file_type: String, 
    base64_data: String
) -> Result<DocumentMetadata, String> {
    
    // Helper closure to map errors easily
    let run_save = || -> anyhow::Result<DocumentMetadata> {
        // 1. Resolve storage path
        let app_dir = app.path().app_data_dir().context("No App Data Dir")?;
        let docs_dir = app_dir.join("documents");
        
        if !docs_dir.exists() {
            fs::create_dir_all(&docs_dir).map_err(|e| anyhow::anyhow!("FS Error: {}", e))?;
        }

        // 2. Security: Sanitize filename and generate UUID
        let unique_id = Uuid::now_v7().to_string();
        let sanitized_name = filename.replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '-', "_");
        let safe_filename = format!("{}_{}", unique_id, sanitized_name);
        let file_path = docs_dir.join(&safe_filename);

        // 3. Decode Base64
        let bytes = general_purpose::STANDARD
            .decode(&base64_data)
            .map_err(|e| anyhow::anyhow!("Base64 decode failed: {}", e))?;

        // 4. Write to disk
        fs::write(&file_path, &bytes)
            .map_err(|e| anyhow::anyhow!("Write failed: {}", e))?;

        info!("[DeliveryStore] Saved document: {}", safe_filename);

        Ok(DocumentMetadata {
            id: unique_id,
            name: filename,
            doc_type: file_type,
            path: file_path.to_string_lossy().to_string(),
            size: bytes.len() as u64,
        })
    };

    // Convert internal anyhow error to String for frontend
    run_save().map_err(|e: anyhow::Error| e.to_string())
}

/// Syncs the delivery data with the external API using robust auth headers
#[tauri::command]
pub async fn submit_delivery(
    auth_state: State<'_, AuthState>,
    payload: DeliveryPayload
) -> Result<serde_json::Value, String> { 
    
    let run_submit = async || -> anyhow::Result<serde_json::Value> {
        // 1. Auth & Config Setup
        let (base_url, device_key) = {
            let config_guard = auth_state.device_config.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
            let config = config_guard.as_ref().ok_or_else(|| anyhow::anyhow!("Device not configured"))?;
            (config.base_url.clone(), config.device_key.clone())
        };

        let (token, member_id) = {
            let token_guard = auth_state.member_token.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
            let user_guard = auth_state.current_user.lock().map_err(|_| anyhow::anyhow!("Lock error"))?;
            (token_guard.clone(), user_guard.as_ref().map(|u| u.id.clone()))
        };

        let clean_base = base_url.trim_end_matches('/');
        let url = format!("{}/api/v1/stock/delivery", clean_base);

        // 2. Prepare Multipart Form
        let mut form = Form::new();

        // A. Attach the JSON data
        let json_part = serde_json::to_string(&payload)
            .map_err(|e| anyhow::anyhow!("Failed to serialize payload: {}", e))?;
        
        form = form.text("data", json_part);

        // 3. Build Client & Headers
        let mut headers = HeaderMap::new();
        
        let mut val = HeaderValue::from_str(&device_key)
            .map_err(|_| anyhow::anyhow!("Invalid Device Key"))?;
        val.set_sensitive(true);
        headers.insert("X-Device-Api-Key", val);

        if let Some(t) = token {
            let auth_val = format!("Bearer {}", t);
            let mut val = HeaderValue::from_str(&auth_val)
                .map_err(|_| anyhow::anyhow!("Invalid Token"))?;
            val.set_sensitive(true);
            headers.insert(AUTHORIZATION, val);
        }
        
        if let Some(mid) = member_id {
            let val = HeaderValue::from_str(&mid)
                .map_err(|_| anyhow::anyhow!("Invalid Member ID"))?;
            headers.insert("X-Member-Id", val);
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(60))
            .build()?;

        info!("[DeliveryStore] Uploading delivery for supplier {}...", payload.supplier_id);

        let resp = client.post(&url)
            .multipart(form) 
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Network request failed: {}", e))?;
        
        let status = resp.status();
        if status.is_success() {
            let body = resp.json().await.map_err(|e| anyhow::anyhow!("Failed to parse response: {}", e))?;
            Ok(body)
        } else {
            let err = resp.text().await.unwrap_or_default();
            Err(anyhow::anyhow!("Server Error {}: {}", status, err))
        }
    };

    run_submit().await.map_err(|e| e.to_string())
}