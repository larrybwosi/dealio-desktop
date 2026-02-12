use axum::{
    extract::{DefaultBodyLimit, State},
    response::Html,
    routing::{get, post},
    Router,
};
use axum_typed_multipart::{TryFromMultipart, TypedMultipart};
use local_ip_address::local_ip;
use std::{fs::File, io::Write, net::SocketAddr, path::PathBuf, sync::OnceLock};
use tauri::{AppHandle, Emitter, Manager};

static DOWNLOAD_PATH: OnceLock<PathBuf> = OnceLock::new();
static SERVER_PORT: OnceLock<u16> = OnceLock::new(); // Store the active port

#[derive(Clone)]
struct AppState {
    app: AppHandle,
}

#[derive(TryFromMultipart)]
struct UploadForm {
    #[form_data(limit = "unlimited")]
    file: axum_typed_multipart::FieldData<axum::body::Bytes>,
}

async fn handle_upload(
    State(state): State<AppState>,
    TypedMultipart(UploadForm { file }): TypedMultipart<UploadForm>,
) -> Html<&'static str> {
    let file_name = file.metadata.file_name.unwrap_or("uploaded_file.bin".to_string());
    
    if let Some(save_dir) = DOWNLOAD_PATH.get() {
        let path = save_dir.join(&file_name);
        match File::create(&path) {
            Ok(mut f) => {
                if let Ok(_) = f.write_all(&file.contents) {
                    println!("File saved to: {:?}", path);
                    // Emit event to frontend
                    let _ = state.app.emit("file-received", &file_name);
                    // Return a simple success page for the phone
                    return Html(r#"
                        <div style="font-family: sans-serif; text-align: center; padding: 2rem;">
                            <h1 style="color: green;">Success!</h1>
                            <p>File sent to desktop.</p>
                            <a href="/" style="display: inline-block; padding: 10px 20px; background: #000; color: white; text-decoration: none; border-radius: 5px;">Send Another</a>
                        </div>
                    "#);
                }
            }
            Err(e) => println!("Error saving file: {}", e),
        }
    }
    Html("<h1>Upload Failed</h1>")
}

async fn show_upload_page() -> Html<&'static str> {
    Html(r#"
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Tauri File Transfer</title>
            <style>
                :root {
                    --gradient-start: #667eea;
                    --gradient-end: #764ba2;
                    --shadow-sm: 0 10px 40px rgba(0,0,0,0.1);
                    --shadow-lg: 0 20px 60px rgba(102, 126, 234, 0.25);
                    --border-radius: 24px;
                }
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
                    background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                }
                
                .card {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(10px);
                    padding: 3rem 2.5rem;
                    border-radius: var(--border-radius);
                    box-shadow: var(--shadow-sm);
                    text-align: center;
                    max-width: 450px;
                    width: 100%;
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.5);
                }
                
                .card:hover {
                    transform: translateY(-5px);
                    box-shadow: var(--shadow-lg);
                }
                
                h2 {
                    color: #2d3748;
                    margin-bottom: 0.75rem;
                    font-size: 2rem;
                    font-weight: 600;
                    letter-spacing: -0.02em;
                }
                
                .subtitle {
                    color: #718096;
                    margin-bottom: 2.5rem;
                    font-size: 1rem;
                    line-height: 1.5;
                }
                
                .file-input-wrapper {
                    margin-bottom: 2rem;
                    position: relative;
                }
                
                input[type="file"] {
                    width: 100%;
                    padding: 1rem;
                    border: 2px dashed #e2e8f0;
                    border-radius: 16px;
                    background: #f8fafc;
                    color: #2d3748;
                    font-size: 0.95rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                input[type="file"]:hover {
                    border-color: var(--gradient-start);
                    background: white;
                }
                
                input[type="file"]::file-selector-button {
                    background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    margin-right: 1rem;
                    cursor: pointer;
                    transition: opacity 0.2s ease;
                }
                
                input[type="file"]::file-selector-button:hover {
                    opacity: 0.9;
                }
                
                button {
                    background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 12px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    width: 100%;
                    letter-spacing: 0.5px;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.35);
                }
                
                button:hover {
                    transform: scale(1.02);
                    box-shadow: 0 7px 20px rgba(102, 126, 234, 0.4);
                }
                
                button:active {
                    transform: scale(0.98);
                }
                
                .icon {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                    display: inline-block;
                    background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                
                @media (max-width: 480px) {
                    .card {
                        padding: 2rem 1.5rem;
                    }
                    
                    h2 {
                        font-size: 1.75rem;
                    }
                }
                
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                }
                
                .floating {
                    animation: float 3s ease-in-out infinite;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon floating">📱 → 💻</div>
                <h2>Send to Desktop</h2>
                <p class="subtitle">Select a file to transfer instantly</p>
                <form action="/upload" method="post" enctype="multipart/form-data">
                    <div class="file-input-wrapper">
                        <input type="file" name="file" required>
                    </div>
                    <button type="submit">
                        Send File
                    </button>
                </form>
                <p style="margin-top: 1.5rem; font-size: 0.85rem; color: #a0aec0;">
                    Secure • Fast • Private
                </p>
            </div>
        </body>
        </html>
    "#)
}

#[tauri::command]
pub async fn start_file_server(app: AppHandle) -> Result<String, String> {
    let ip = local_ip().map_err(|e| e.to_string())?;

    // Initialize path if not set
    if DOWNLOAD_PATH.get().is_none() {
        let download_dir = app.path().download_dir().map_err(|e| e.to_string())?;
        let _ = DOWNLOAD_PATH.set(download_dir);
    }

    // 1. CHECK IF SERVER ALREADY RUNNING
    if let Some(port) = SERVER_PORT.get() {
        return Ok(format!("http://{}:{}", ip, port));
    }

    // 2. BIND TO PORT 0 (Random available port)
    let addr = SocketAddr::from((ip, 0));
    let listener = tokio::net::TcpListener::bind(addr).await.map_err(|e| e.to_string())?;
    
    // 3. GET THE ASSIGNED PORT
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let _ = SERVER_PORT.set(port);

    let app_handle = app.clone();
    
    tauri::async_runtime::spawn(async move {
        let state = AppState { app: app_handle };

        let router = Router::new()
            .route("/", get(show_upload_page))
            .route("/upload", post(handle_upload))
            .layer(DefaultBodyLimit::disable()) // Allow large files
            .with_state(state);

        println!("File server running on http://{}:{}", ip, port);
        
        let _ = axum::serve(listener, router).await;
    });

    Ok(format!("http://{}:{}", ip, port))
}