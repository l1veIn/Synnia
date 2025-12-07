use actix_web::{get, web, App, HttpServer, HttpRequest, Error, middleware};
use actix_files::NamedFile;
use actix_cors::Cors;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use std::net::TcpListener;

// Shared state for Actix
pub struct ServerState {
    pub current_project_path: Arc<Mutex<Option<String>>>,
}

#[get("/assets/{filename:.*}")]
async fn serve_asset(
    _req: HttpRequest,
    filename: web::Path<String>,
    data: web::Data<ServerState>,
) -> Result<NamedFile, Error> {
    let project_path_opt = {
        let guard = data.current_project_path.lock().unwrap();
        guard.clone()
    };

    if let Some(project_path_str) = project_path_opt {
        let project_path = PathBuf::from(project_path_str);
        
        // Resolve Project Root (Handle .json file case)
        let project_root = if project_path.extension().is_some() {
            project_path.parent().unwrap_or(&project_path).to_path_buf()
        } else {
            project_path
        };

        let assets_dir = project_root.join("assets");
        
        // Decode URL components (e.g. %20 -> space) is handled by actix path? 
        // filename is decoded.
        
        let file_path = assets_dir.join(filename.into_inner());

        // println!("[FileServer] Request: {:?}", file_path);

        match NamedFile::open(file_path) {
            Ok(file) => Ok(file),
            Err(_) => Err(actix_web::error::ErrorNotFound("File not found")),
        }
    } else {
        Err(actix_web::error::ErrorNotFound("No project loaded"))
    }
}

pub fn init(current_project_path: Arc<Mutex<Option<String>>>) -> u16 {
    // 1. Find a free port
    let port = {
        let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind random port");
        listener.local_addr().unwrap().port()
    }; 
    // listener drops here, releasing port. 
    // Race condition exists but is rare on localhost.

    let server_state = web::Data::new(ServerState {
        current_project_path,
    });

    // 2. Start Actix Server in a separate thread
    let server = HttpServer::new(move || {
        App::new()
            .wrap(Cors::permissive()) 
            .wrap(middleware::DefaultHeaders::new().add(("Cross-Origin-Resource-Policy", "cross-origin")))
            .app_data(server_state.clone())
            .service(serve_asset)
    })
    .bind(("127.0.0.1", port))
    .expect("Failed to bind Actix server")
    .run();

    // Tauri async runtime spawn (Tokio)
    tauri::async_runtime::spawn(server);

    println!("[FileServer] Started on http://127.0.0.1:{}/assets/", port);
    port
}
