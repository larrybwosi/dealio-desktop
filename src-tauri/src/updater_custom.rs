use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

#[tauri::command]
pub async fn check_for_updates_with_endpoint<R: Runtime>(
    handle: AppHandle<R>,
    endpoint: String,
) -> Result<Option<serde_json::Value>, String> {
    let url = Url::parse(&endpoint).map_err(|e| e.to_string())?;
    let mut builder = handle.updater_builder();
    builder = builder.endpoints(vec![url]).map_err(|e| e.to_string())?;
    let updater = builder.build().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;

    if let Some(update) = update {
        let date = update.date.map(|d| d.to_string());
        let version = update.version.clone();
        let current_version = update.current_version.clone();
        let body = update.body.clone();
        let raw_json = update.raw_json.clone();

        let rid = handle.resources_table().add(update);

        Ok(Some(serde_json::json!({
            "rid": rid,
            "version": version,
            "currentVersion": current_version,
            "date": date,
            "body": body,
            "rawJson": raw_json,
        })))
    } else {
        Ok(None)
    }
}
