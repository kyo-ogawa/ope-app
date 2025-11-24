mod models;
mod monitor;
mod osc_service;

use models::MonitorConfig;
use monitor::MonitorService;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use local_ip_address::local_ip;

struct AppState {
    monitor_service: MonitorService,
}

#[tauri::command]
fn start_monitoring(state: State<'_, AppState>, config: MonitorConfig) {
    state.monitor_service.start(config);
}

#[tauri::command]
fn stop_monitoring(state: State<'_, AppState>) {
    state.monitor_service.stop();
}

#[tauri::command]
fn send_osc(state: State<'_, AppState>, ip: String, port: u16, address: String, args: Vec<String>) {
    state.monitor_service.send_osc(&ip, port, &address, args);
}

#[tauri::command]
fn save_config(app: AppHandle, config: MonitorConfig) -> Result<(), String> {
    let config_path = get_config_path(&app)?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_config(app: AppHandle) -> Result<Option<MonitorConfig>, String> {
    let config_path = get_config_path(&app)?;
    if !config_path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    let config: MonitorConfig = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(Some(config))
}

#[tauri::command]
fn get_local_ip() -> Result<String, String> {
    match local_ip() {
        Ok(ip) => Ok(ip.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

fn get_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    Ok(config_dir.join("config.json"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let monitor_service = MonitorService::new(handle);
            app.manage(AppState { monitor_service });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_monitoring,
            stop_monitoring,
            save_config,
            load_config,
            load_config,
            send_osc,
            get_local_ip
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
