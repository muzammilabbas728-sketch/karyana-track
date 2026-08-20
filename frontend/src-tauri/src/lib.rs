use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Manager, RunEvent};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

type ServerChild = Arc<Mutex<Option<Child>>>;

fn is_server_ready(addr: &str) -> bool {
    TcpStream::connect(addr).is_ok()
}

fn wait_for_server(addr: &str, timeout_secs: u64) -> bool {
    let start = Instant::now();
    let timeout = Duration::from_secs(timeout_secs);
    while start.elapsed() < timeout {
        if is_server_ready(addr) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    false
}

fn find_database_path(app: &tauri::App) -> Option<PathBuf> {
    if let Ok(env_path) = std::env::var("DATABASE_PATH") {
        if !env_path.is_empty() {
            return Some(PathBuf::from(env_path));
        }
    }

    let mut candidates = Vec::new();

    // 1. Check relative to current executable (works in debug/target and installed app)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("karyana_track.db"));
            let mut cur = parent;
            for _ in 0..6 {
                candidates.push(cur.join("backend").join("karyana_track.db"));
                candidates.push(cur.join("karyana_track.db"));
                if let Some(p) = cur.parent() {
                    cur = p;
                } else {
                    break;
                }
            }
        }
    }

    // 2. Production resource directory candidates
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("karyana_track.db"));
        candidates.push(resource_dir.join("backend").join("karyana_track.db"));
    }

    // 3. Development working directory candidates
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("..").join("backend").join("karyana_track.db"));
        candidates.push(cwd.join("backend").join("karyana_track.db"));
        candidates.push(cwd.join("karyana_track.db"));
        candidates.push(cwd.join("..").join("..").join("backend").join("karyana_track.db"));
    }

    for candidate in candidates {
        if candidate.exists() && candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

fn find_server_exe(app: &tauri::App) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    // 1. Check relative to current executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("server.exe"));
            candidates.push(parent.join("server").join("server.exe"));
            let mut cur = parent;
            for _ in 0..6 {
                candidates.push(cur.join("backend").join("dist").join("server").join("server.exe"));
                candidates.push(cur.join("dist").join("server").join("server.exe"));
                if let Some(p) = cur.parent() {
                    cur = p;
                } else {
                    break;
                }
            }
        }
    }

    // 2. Production bundle resource directory
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("server.exe"));
        candidates.push(resource_dir.join("server").join("server.exe"));
        candidates.push(resource_dir.join("backend").join("dist").join("server").join("server.exe"));
        candidates.push(resource_dir.join("dist").join("server").join("server.exe"));
    }

    // 3. Relative paths from current working directory (development mode)
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("..").join("backend").join("dist").join("server").join("server.exe"));
        candidates.push(cwd.join("backend").join("dist").join("server").join("server.exe"));
        candidates.push(cwd.join("dist").join("server").join("server.exe"));
        candidates.push(cwd.join("..").join("..").join("backend").join("dist").join("server").join("server.exe"));
    }

    for candidate in candidates {
        if candidate.exists() && candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

fn start_sidecar(app: &tauri::App) -> Option<Child> {
    const SERVER_ADDR: &str = "127.0.0.1:8000";

    // If server is already running (e.g. separate dev server), reuse it
    if is_server_ready(SERVER_ADDR) {
        println!("[Tauri] Backend server already running on http://{}", SERVER_ADDR);
        return None;
    }

    let exe_path = match find_server_exe(app) {
        Some(path) => path,
        None => {
            eprintln!("[Tauri] Warning: server.exe not found in search paths");
            return None;
        }
    };

    println!("[Tauri] Launching backend sidecar: {:?}", exe_path);

    let working_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));

    let mut command = Command::new(&exe_path);
    command.current_dir(working_dir);
    command.env("HOST", "127.0.0.1");
    command.env("PORT", "8000");

    if let Some(db_path) = find_database_path(app) {
        println!("[Tauri] Configured DATABASE_PATH: {:?}", db_path);
        command.env("DATABASE_PATH", db_path.to_string_lossy().to_string());
    }

    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    match command.spawn() {
        Ok(child) => {
            println!("[Tauri] Backend process started (PID: {}). Waiting for readiness...", child.id());
            if wait_for_server(SERVER_ADDR, 15) {
                println!("[Tauri] Backend server is ready and accepting connections on http://{}", SERVER_ADDR);
            } else {
                eprintln!("[Tauri] Warning: Backend server did not become ready within timeout.");
            }
            Some(child)
        }
        Err(err) => {
            eprintln!("[Tauri] Failed to spawn backend process: {}", err);
            None
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let server_child: ServerChild = Arc::new(Mutex::new(None));
    let server_child_clone = server_child.clone();

    tauri::Builder::default()
        .setup(move |app| {
            if cfg!(debug_assertions) {
                let _ = app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                );
            }

            let child = start_sidecar(app);
            if let Ok(mut guard) = server_child_clone.lock() {
                *guard = child;
            }

            Ok(())
        })
        .manage(server_child.clone())
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let RunEvent::Exit = event {
                if let Ok(mut guard) = server_child.lock() {
                    if let Some(mut child) = guard.take() {
                        println!("[Tauri] Terminating backend sidecar process (PID: {})...", child.id());
                        let _ = child.kill();
                    }
                }
            }
        });
}
