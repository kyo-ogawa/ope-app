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
fn update_config(state: State<'_, AppState>, config: MonitorConfig) {
    state.monitor_service.update_config(config);
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

fn get_profiles_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    let profiles_dir = config_dir.join("profiles");
    if !profiles_dir.exists() {
        fs::create_dir_all(&profiles_dir).map_err(|e| e.to_string())?;
    }
    Ok(profiles_dir)
}

fn validate_profile_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Profile name is required".to_string());
    }
    if trimmed == "." || trimmed == ".." {
        return Err("Profile name is invalid".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Profile name cannot include path separators".to_string());
    }
    if trimmed.chars().any(|c| c.is_control()) {
        return Err("Profile name contains invalid characters".to_string());
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
fn list_profiles(app: AppHandle) -> Result<Vec<String>, String> {
    let profiles_dir = get_profiles_dir(&app)?;
    let mut profiles = Vec::new();
    let entries = fs::read_dir(profiles_dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        if let Some(stem) = path.file_stem().and_then(|name| name.to_str()) {
            profiles.push(stem.to_string());
        }
    }
    profiles.sort();
    Ok(profiles)
}

#[tauri::command]
fn save_profile(app: AppHandle, name: String, config: MonitorConfig) -> Result<(), String> {
    let safe_name = validate_profile_name(&name)?;
    let profiles_dir = get_profiles_dir(&app)?;
    let profile_path = profiles_dir.join(format!("{}.json", safe_name));
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(profile_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_profile(app: AppHandle, name: String) -> Result<MonitorConfig, String> {
    let safe_name = validate_profile_name(&name)?;
    let profiles_dir = get_profiles_dir(&app)?;
    let profile_path = profiles_dir.join(format!("{}.json", safe_name));
    let data = fs::read_to_string(profile_path).map_err(|e| e.to_string())?;
    let config: MonitorConfig = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
fn import_profile_from_file(app: AppHandle, path: String) -> Result<String, String> {
    let source_path = PathBuf::from(path);
    let file_stem = source_path
        .file_stem()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid profile file name".to_string())?;
    let safe_name = validate_profile_name(file_stem)?;
    let data = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;
    let config: MonitorConfig = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let profiles_dir = get_profiles_dir(&app)?;
    let profile_path = profiles_dir.join(format!("{}.json", safe_name));
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(profile_path, json).map_err(|e| e.to_string())?;
    Ok(safe_name)
}

#[tauri::command]
fn export_profile_to_file(app: AppHandle, name: String, path: String) -> Result<(), String> {
    let safe_name = validate_profile_name(&name)?;
    let profiles_dir = get_profiles_dir(&app)?;
    let profile_path = profiles_dir.join(format!("{}.json", safe_name));
    let data = fs::read_to_string(profile_path).map_err(|e| e.to_string())?;
    let config: MonitorConfig = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(PathBuf::from(path), json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_profile(app: AppHandle, name: String) -> Result<(), String> {
    let safe_name = validate_profile_name(&name)?;
    let profiles_dir = get_profiles_dir(&app)?;
    let profile_path = profiles_dir.join(format!("{}.json", safe_name));
    if !profile_path.exists() {
        return Err("Profile not found".to_string());
    }
    fs::remove_file(profile_path).map_err(|e| e.to_string())?;
    Ok(())
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
        .plugin(tauri_plugin_dialog::init())
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
            update_config,
            save_config,
            load_config,
            list_profiles,
            save_profile,
            load_profile,
            import_profile_from_file,
            export_profile_to_file,
            delete_profile,
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
