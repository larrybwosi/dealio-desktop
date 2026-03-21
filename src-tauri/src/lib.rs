use dotenvy_macro::dotenv;
use log::error;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
use better_posthog::events::capture;

pub mod stores;

mod http_server;
mod models;
mod scanner_manager;
mod stock_acceptance;
mod stock_acceptance_models;
pub mod stock_transfer;

use stores::audit_store;
use stores::auth_store::{self, AuthState};
use stores::customer_store::{self, CustomerState};
use stores::delivery_store;
use stores::pricing_store::{self, PricingState};
use stores::product_store::{self, ProductState};
use stores::sales_store::{self, SalesState};
use stores::shift_store::{self, ShiftState};

mod customer_manager;
mod pricing_manager;
mod printer_manager;
mod product_manager;
mod sale_manager;
mod shift_manager;

mod api_config;
mod security;

mod notification_manager;
use notification_manager::NotificationState;

mod data_management;

mod network_monitor;
use network_monitor::NetworkState;

mod customer_screen_state;
use customer_screen_state::CustomerScreenState;

mod kds_models;
mod kds_hub_server;

pub fn capture_event(event_name: &str, properties: Option<serde_json::Value>) {
    log::info!("Analytics Event: {} - Properties: {:?}", event_name, properties);
    
    let mut builder = better_posthog::Event::builder()
        .event(event_name)
        .distinct_id("desktop_client");
        
    if let Some(serde_json::Value::Object(map)) = properties {
        for (key, value) in map {
            builder = builder.property(key, value);
        }
    }
    
    // Fire and forget. The background thread handles the rest.
    capture(builder.build());
}

#[cfg(test)]
mod tests;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap();
    let _guard = rt.enter();

    // --- POSTHOG INITIALIZATION (NEW) ---
    // Note: This must happen before Tauri builder, and _posthog_guard must be kept alive!
    let _posthog_guard = better_posthog::init(better_posthog::ClientOptions {
        api_key: Some(dotenv!("POSTHOG_API_KEY").into()),
        ..Default::default()
    });
    // ------------------------------------

    // --- SENTRY INITIALIZATION ---
    #[cfg(not(debug_assertions))]
    let client = sentry::init((
        dotenv!("SENTRY_DSN"),
        sentry::ClientOptions {
            release: sentry::release_name!(),
            auto_session_tracking: true,
            ..Default::default()
        },
    ));

    // Also combine the iOS check with the debug check
    #[cfg(all(not(debug_assertions), not(target_os = "ios")))]
    let _minidump_guard = tauri_plugin_sentry::minidump::init(&client);
    // -----------------------------

    #[cfg(not(debug_assertions))]
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_sentry::init(&client));

    #[cfg(debug_assertions)]
    let builder = tauri::Builder::default();

    builder
        .manage(ProductState::new())
        .manage(CustomerState::new())
        .manage(SalesState::new())
        .manage(PricingState::new())
        .manage(ShiftState::new())
        .manage(AuthState::new())
        .manage(NotificationState::new())
        .manage(NetworkState::new())
        .manage(CustomerScreenState::new())
        .manage(sales_store::SyncConfigState::new())
        .setup(|app| {
            
            // let _ = app.track_event("app_started", None);
            capture_event("app_started", None);
            // --- 1. Load Data (Existing Code) ---
            // Note: We can't load products at startup since we need location_id
            // Products will be loaded when the device is configured/location is set
            let state = app.state::<ProductState>();

            // Try to load products for the configured location if available
            let auth_state_init = app.state::<AuthState>();
            if let Some(location_id) = {
                let config_guard = auth_state_init
                    .device_config
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                config_guard.as_ref().map(|c| c.location_id.clone())
            } {
                if let Err(e) = tauri::async_runtime::block_on(
                    product_store::load_products_from_disk(app.handle(), &state, &location_id),
                ) {
                    error!(
                        "Failed to load initial data for location {}: {}",
                        location_id, e
                    );
                }
            }

            let cust_state = app.state::<CustomerState>();
            if let Err(e) = tauri::async_runtime::block_on(
                customer_store::load_customers_from_disk(app.handle(), &cust_state),
            ) {
                error!("Failed to load initial customer data: {}", e);
            }

            let sales_state = app.state::<SalesState>();
            tauri::async_runtime::block_on(sales_store::init_state(app.handle(), &sales_state));
            sales_store::start_auto_sync_task(app.handle().clone());

            let pricing_state = app.state::<PricingState>();
            if let Err(e) = tauri::async_runtime::block_on(
                pricing_store::load_pricing_from_disk(app.handle(), &pricing_state),
            ) {
                error!("Failed to load initial pricing data: {}", e);
            }

            let notification_state = app.state::<NotificationState>();
            notification_manager::init_notification_state(app.handle(), &notification_state);

            // Customer Screen State Loading
            let customer_screen_state = app.state::<CustomerScreenState>();
            if let Err(e) = tauri::async_runtime::block_on(
                customer_screen_state.load_from_store(app.handle()),
            ) {
                error!("Failed to load customer screen state: {}", e);
            }

            // Check for old pending sales and notify user
            let old_sales = tauri::async_runtime::block_on(
                sales_store::check_old_pending_sales(&sales_state, 3)
            );
            
            if !old_sales.is_empty() {
                let notification = notification_manager::AppNotification::new(
                    notification_manager::NotificationType::Warning,
                    notification_manager::NotificationPriority::High,
                    "Old Pending Sales Detected".to_string(),
                    format!(
                        "You have {} pending sales older than 3 days. Please connect to the internet to sync them and avoid data loss.",
                        old_sales.len()
                    ),
                );
                notification_state.add_notification(notification.clone());
                let _ = notification_state.save_to_store(app.handle());

                // Send native notification
                let _ = app.emit("old-sales-detected", old_sales.len());
            }

            // Check for failed sales and notify
            let failed_sales = tauri::async_runtime::block_on(
                sales_store::check_failed_sales(&sales_state, 5)
            );
            
            if !failed_sales.is_empty() {
                let _ = app.emit("failed-sales-detected", failed_sales);
            }

            // Start network monitoring
            let auth_state_ref = app.state::<AuthState>();
            let initial_base_url = {
                let config_guard = auth_state_ref
                    .device_config
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                config_guard.as_ref().map(|c| c.base_url.clone())
            };

            let network_state = app.state::<NetworkState>();
            if let Some(url) = initial_base_url {
                network_state.set_base_url(url);
            }

            // --- Customer Screen Auto-Open ---
            let customer_screen_state = app.state::<CustomerScreenState>();

            // Auto-open customer screen if enabled
            if customer_screen_state.is_enabled() {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = customer_screen_state::open_customer_screen(app_handle).await {
                        eprintln!("Failed to open customer screen on startup: {}", e);
                    }
                });
            }

            // --- 2. Startup Visibility Logic (NEW) ---
            // Get command line arguments
            let args: Vec<String> = std::env::args().collect();

            // We check if the flag "--minimized" is present.
            // If it is NOT present, we show the window.
            // If it IS present, we do nothing (window remains hidden per tauri.conf.json).
            if !args.contains(&"--minimized".to_string()) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            // --- 3. System Tray (Existing Code) ---
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Main Window", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Hide Main Window", true, None::<&str>)?;
            let customer_i =
                MenuItem::with_id(app, "customer", "Open Customer Display", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;

            let menu = Menu::with_items(app, &[&show_i, &hide_i, &customer_i, &sep, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "customer" => {
                        let app_handle = app.clone();
                        let state = app.state::<CustomerScreenState>();
                        if state.is_enabled() {
                            tauri::async_runtime::spawn(async move {
                                let _ = customer_screen_state::open_customer_screen(app_handle).await;
                            });
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                } else if window.label() == "customer" {
                    // Handle native customer window closing
                    let app_handle = window.app_handle().clone();
                    let state = app_handle.state::<CustomerScreenState>();
                    state.set_enabled(false);
                    
                    // Save asynchronously
                    tauri::async_runtime::spawn(async move {
                        let state = app_handle.state::<CustomerScreenState>();
                        let _ = state.save_to_store(&app_handle).await;
                    });
                }
            }
        })
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .max_file_size(5_000_000) // 5 MB per file
                .build(),
        )
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_hid::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_better_posthog::init())
        .invoke_handler(tauri::generate_handler![
            scanner_manager::start_scan,
            scanner_manager::list_hid_devices,
            scanner_manager::start_nfc_listener,
            scanner_manager::start_network_scan_server,
            scanner_manager::print_to_network,
            sale_manager::scan_transaction_code,
            customer_screen_state::open_customer_screen,
            customer_screen_state::close_customer_screen,
            customer_screen_state::set_customer_screen_enabled,
            customer_screen_state::get_customer_screen_state,
            product_manager::sync_products_command,
            product_manager::search_products_command,
            product_manager::search_global_command,
            product_manager::get_products_by_ids_command,
            product_store::switch_location,
            printer_manager::get_serial_ports,
            printer_manager::open_cash_drawer,
            customer_manager::sync_customers_command,
            customer_manager::search_customers_command,
            customer_manager::get_customers_by_ids_command,
            customer_manager::create_customer_command,
            sale_manager::process_sale_command,
            sale_manager::sync_sales_command,
            sale_manager::get_pending_sales_command,
            pricing_manager::sync_pricing_command,
            pricing_manager::resolve_price_batch_command,
            pricing_manager::get_pos_pricing_command,
            printer_manager::print_network_receipt,
            printer_manager::print_system_receipt,
            printer_manager::print_usb,
            printer_manager::get_system_printers,
            printer_manager::save_printer_config,
            printer_manager::get_printer_config,
            printer_manager::print_job,
            shift_manager::open_shift_command,
            shift_manager::get_shift_command,
            shift_manager::add_cash_drop_command,
            shift_manager::record_shift_sale_command,
            shift_manager::close_shift_command,
            shift_manager::sync_shifts_command,
            auth_store::set_device_config,
            auth_store::login_member,
            auth_store::logout_member,
            auth_store::get_device_config,
            auth_store::restore_member_session,
            auth_store::reset_device_config,
            auth_store::authenticated_api_request,
            auth_store::update_device_location,

            notification_manager::send_native_notification,

            notification_manager::get_notification_history,
            notification_manager::get_unread_notification_count,
            notification_manager::mark_notification_read,
            notification_manager::mark_all_notifications_read,
            notification_manager::delete_notification,
            notification_manager::clear_all_notifications,
            data_management::dangerously_clear_all_data,
            sale_manager::retry_sale_command,
            sale_manager::check_old_sales_command,
            sale_manager::check_failed_sales_command,
            sale_manager::delete_sale_command,
            network_monitor::get_network_status_command,
            network_monitor::update_network_status_command,
            sale_manager::create_order_command,
            sale_manager::get_invoice_blob_command,
            delivery_store::get_drivers_command,
            delivery_store::dispatch_order_command,
            delivery_store::reconcile_delivery_command,
            sales_store::get_sales_history_command,
            sales_store::record_payment_command,
            sales_store::initiate_mpesa_payment_command,
            sales_store::invalidate_sale_command,
            sales_store::set_sync_interval_command,
            auth_store::set_negative_stock_command,
            auth_store::get_locations_command,
            auth_store::get_ably_auth_token_command,
            auth_store::start_device_setup_command,
            stock_acceptance::save_document_locally,
            stock_acceptance::fetch_incoming_shipments,
            stock_acceptance::receive_purchase_order,
            stock_acceptance::receive_stock_transfer,
            stock_acceptance::submit_stock_process,
            stock_transfer::submit_stock_transfer,
            http_server::start_file_server,
            audit_store::write_audit_log,
            audit_store::get_audit_logs,
            audit_store::get_system_logs,

            kds_hub_server::start_kds_hub,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}