mod models;
mod monitor;
mod network_scanner;
mod osc_service;

use local_ip_address::local_ip;
use models::MonitorConfig;
use monitor::MonitorService;
use network_scanner::{cancel_scan, get_network_interfaces, scan_network, NetworkInterface, ScanResult};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

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
fn send_osc(
    state: State<'_, AppState>,
    ip: String,
    port: u16,
    address: String,
    args: Vec<models::OscArg>,
) {
    state.monitor_service.send_osc(&ip, port, &address, args);
}

#[tauri::command]
fn toggle_periodic_button(state: State<'_, AppState>, button_id: String) -> bool {
    state.monitor_service.toggle_periodic_button(button_id)
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
fn get_local_ip() -> Result<Vec<String>, String> {
    match local_ip_address::list_afinet_netifas() {
        Ok(network_interfaces) => {
            let ips: Vec<String> = network_interfaces
                .iter()
                .filter(|(_, ip)| !ip.is_loopback() && ip.is_ipv4())
                .map(|(_, ip)| ip.to_string())
                .collect();

            if ips.is_empty() {
                // Fallback if no non-loopback ipv4 found, try just local_ip
                match local_ip() {
                    Ok(ip) => Ok(vec![ip.to_string()]),
                    Err(e) => Err(e.to_string()),
                }
            } else {
                Ok(ips)
            }
        }
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

#[tauri::command]
fn get_interfaces() -> Vec<NetworkInterface> {
    get_network_interfaces()
}

#[tauri::command]
async fn scan_network_range(
    app: AppHandle,
    base_ip: String,
    start: u8,
    end: u8,
    timeout_ms: u64,
) -> ScanResult {
    // 並列度を150に設定（非同期なので多くても大丈夫）
    scan_network(app, base_ip, start, end, timeout_ms, 150).await
}

#[tauri::command]
fn stop_scan() {
    cancel_scan();
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
            send_osc,
            get_local_ip,
            toggle_periodic_button,
            get_interfaces,
            scan_network_range,
            stop_scan
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::WindowEvent {
                event: tauri::WindowEvent::CloseRequested { .. },
                ..
            } = event
            {
                app.exit(0);
            }
        });
}
