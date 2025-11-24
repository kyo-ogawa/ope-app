use crate::models::{MonitorConfig, PCStatus, CustomButton, LogEntry};
use crate::osc_service::OscService;
use rosc::OscType;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

pub struct MonitorService {
    running: Arc<AtomicBool>,
    osc_service: Arc<Mutex<OscService>>,
    config: Arc<Mutex<Option<MonitorConfig>>>,
    statuses: Arc<Mutex<HashMap<String, PCStatus>>>,
    app_handle: AppHandle,
    log_tx: Arc<Mutex<Option<mpsc::Sender<LogEntry>>>>,
}

impl MonitorService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            osc_service: Arc::new(Mutex::new(OscService::new())),
            config: Arc::new(Mutex::new(None)),
            statuses: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
            log_tx: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start(&self, config: MonitorConfig) {
        self.stop();
        self.running.store(true, Ordering::SeqCst);

        // Update config
        {
            let mut cfg = self.config.lock().unwrap();
            *cfg = Some(config.clone());
        }

        // Reset statuses
        {
            let mut statuses = self.statuses.lock().unwrap();
            statuses.clear();
            // Initialize status for all monitored devices
            for device_id in &config.monitored_device_ids {
                statuses.insert(
                    device_id.clone(),
                    PCStatus {
                        last_response: current_time_ms(),
                        is_alive: true,
                    },
                );
            }
        }
        self.broadcast_status();

        // Start OSC Listener & Logger
        let (tx, mut rx) = mpsc::channel(100);
        let (log_tx, mut log_rx) = mpsc::channel(100);
        
        // Spawn Log Emitter
        let app_handle_log = self.app_handle.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(entry) = log_rx.recv().await {
                app_handle_log.emit("log-event", entry).ok();
            }
        });

        // Store log_tx
        {
            let mut log_tx_guard = self.log_tx.lock().unwrap();
            *log_tx_guard = Some(log_tx.clone());
        }

        {
            let mut osc = self.osc_service.lock().unwrap();
            osc.start_listener(config.local_port, tx, log_tx.clone());
        }

        let running = self.running.clone();
        let config_arc = self.config.clone();
        let statuses_arc = self.statuses.clone();
        let osc_service_arc = self.osc_service.clone();
        let app_handle = self.app_handle.clone();

        // Spawn Monitor Loop
        thread::spawn(move || {
            // We need to handle both OSC messages and Interval loop.
            // Since we use a channel for OSC, we can use a loop that checks channel and time.
            // Or separate threads.
            // Let's use a separate thread for message handling to be responsive, 
            // and this thread for interval loop.
            
            // Spawn Message Handler
            let running_msg = running.clone();
            let config_msg = config_arc.clone();
            let statuses_msg = statuses_arc.clone();
            let osc_service_msg = osc_service_arc.clone();
            let app_handle_msg = app_handle.clone();
            
            let log_tx_msg = log_tx.clone();
            
            tauri::async_runtime::spawn(async move {
                while running_msg.load(Ordering::SeqCst) {
                    if let Some((address, args, addr)) = rx.recv().await {
                        handle_message(address, args, addr, &config_msg, &statuses_msg, &osc_service_msg, &app_handle_msg, &log_tx_msg);
                    } else {
                        break;
                    }
                }
            });

            // Interval Loop
            while running.load(Ordering::SeqCst) {
                let loop_start = std::time::Instant::now();
                
                let (interval, devices, monitored_ids, ping_addr, ping_args, timeout, webhook_url, alert_msg, recovery_msg, logics, custom_buttons) = {
                    let cfg_guard = config_arc.lock().unwrap();
                    if let Some(cfg) = &*cfg_guard {
                        (
                            cfg.interval,
                            cfg.devices.clone(),
                            cfg.monitored_device_ids.clone(),
                            cfg.ping_address.clone().unwrap_or("/ping".to_string()),
                            cfg.ping_args.clone().unwrap_or("".to_string()),
                            cfg.timeout,
                            cfg.webhook_url.clone(),
                            cfg.alert_message.clone(),
                            cfg.recovery_message.clone(),
                            cfg.logics.clone().unwrap_or_default(),
                            cfg.custom_buttons.clone().unwrap_or_default(),
                        )
                    } else {
                        thread::sleep(Duration::from_millis(100));
                        continue;
                    }
                };

                // Send Pings
                let ping_args_vec = parse_args(&ping_args);
                {
                    let osc = osc_service_arc.lock().unwrap();
                    for device_id in &monitored_ids {
                        if let Some(device) = devices.iter().find(|d| d.id == *device_id) {
                            osc.send(&device.ip, device.port, &ping_addr, ping_args_vec.clone(), Some(&log_tx));
                        }
                    }
                }

                // Check Timeouts
                let now = current_time_ms();
                let mut status_changed = false;
                
                {
                    let mut statuses = statuses_msg_loop_access(&statuses_arc);
                    for device_id in &monitored_ids {
                        let device = devices.iter().find(|d| d.id == *device_id);
                        if device.is_none() { continue; }
                        let device = device.unwrap();

                        if let Some(status) = statuses.get_mut(device_id) {
                            if now - status.last_response > timeout {
                                if status.is_alive {
                                    status.is_alive = false;
                                    status_changed = true;
                                    
                                    // Alert
                                    let msg = alert_msg.clone().unwrap_or("⚠️ Alert: {name} ({ip}) is DOWN!".to_string())
                                        .replace("{name}", &device.name)
                                        .replace("{ip}", &device.ip);
                                    send_slack_alert(&webhook_url, &msg);

                                    // Logic
                                    evaluate_logics(device_id, "offline", &logics, &custom_buttons, &devices, &osc_service_arc, &log_tx);
                                }
                            } else {
                                if !status.is_alive {
                                    status.is_alive = true;
                                    status_changed = true;
                                    
                                    // Recovery
                                    let msg = recovery_msg.clone().unwrap_or("✅ Recovery: {name} ({ip}) is UP!".to_string())
                                        .replace("{name}", &device.name)
                                        .replace("{ip}", &device.ip);
                                    send_slack_alert(&webhook_url, &msg);

                                    // Logic
                                    evaluate_logics(device_id, "online", &logics, &custom_buttons, &devices, &osc_service_arc, &log_tx);
                                }
                            }
                        }
                    }
                }

                if status_changed {
                    broadcast_status(&app_handle, &statuses_arc);
                } else {
                     // Broadcast periodically anyway? Or just on change?
                     // Electron app broadcasted every loop.
                     broadcast_status(&app_handle, &statuses_arc);
                }

                let elapsed = loop_start.elapsed();
                if elapsed < Duration::from_millis(interval) {
                    thread::sleep(Duration::from_millis(interval) - elapsed);
                }
            }
        });
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        let osc = self.osc_service.lock().unwrap();
        osc.stop_listener();
    }

    pub fn send_osc(&self, ip: &str, port: u16, address: &str, args: Vec<String>) {
        let osc = self.osc_service.lock().unwrap();
        // Convert string args to OscType
        // We try to parse as int or float, otherwise string
        let osc_args: Vec<OscType> = args.iter().map(|arg| {
            if let Ok(i) = arg.parse::<i32>() {
                OscType::Int(i)
            } else if let Ok(f) = arg.parse::<f32>() {
                OscType::Float(f)
            } else {
                OscType::String(arg.clone())
            }
        }).collect();
        
        let log_tx_guard = self.log_tx.lock().unwrap();
        osc.send(ip, port, address, osc_args, log_tx_guard.as_ref());
    }

    fn broadcast_status(&self) {
        broadcast_status(&self.app_handle, &self.statuses);
    }
}

fn statuses_msg_loop_access(statuses: &Arc<Mutex<HashMap<String, PCStatus>>>) -> std::sync::MutexGuard<'_, HashMap<String, PCStatus>> {
    statuses.lock().unwrap()
}

fn broadcast_status(app: &AppHandle, statuses: &Arc<Mutex<HashMap<String, PCStatus>>>) {
    let statuses = statuses.lock().unwrap();
    app.emit("status-update", &*statuses).ok();
}

fn current_time_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64
}

fn parse_args(args_str: &str) -> Vec<OscType> {
    args_str.split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| {
            if let Ok(i) = s.parse::<i32>() {
                OscType::Int(i)
            } else if let Ok(f) = s.parse::<f32>() {
                OscType::Float(f)
            } else {
                OscType::String(s.to_string())
            }
        })
        .collect()
}

fn handle_message(
    address: String, 
    args: Vec<OscType>, 
    addr: std::net::SocketAddr, 
    config: &Arc<Mutex<Option<MonitorConfig>>>,
    statuses: &Arc<Mutex<HashMap<String, PCStatus>>>,
    osc_service: &Arc<Mutex<OscService>>,
    app_handle: &AppHandle,
    log_tx: &mpsc::Sender<LogEntry>
) {
    let (pong_addr, pong_args, devices, monitored_ids, webhook_url, recovery_msg, logics, custom_buttons) = {
        let cfg_guard = config.lock().unwrap();
        if let Some(cfg) = &*cfg_guard {
            (
                cfg.pong_address.clone().unwrap_or("/pong".to_string()),
                cfg.pong_args.clone().unwrap_or("".to_string()),
                cfg.devices.clone(),
                cfg.monitored_device_ids.clone(),
                cfg.webhook_url.clone(),
                cfg.recovery_message.clone(),
                cfg.logics.clone().unwrap_or_default(),
                cfg.custom_buttons.clone().unwrap_or_default(),
            )
        } else {
            return;
        }
    };

    if address != pong_addr {
        return;
    }

    // Check args if configured
    if !pong_args.is_empty() {
        let expected = parse_args(&pong_args);
        if args.len() < expected.len() { return; }
        // Simple comparison (string representation)
        for (i, exp) in expected.iter().enumerate() {
            // This comparison is a bit loose, but sufficient for now
            if format!("{:?}", args[i]) != format!("{:?}", exp) {
                return;
            }
        }
    }


    // Find target by IP
    let ip = addr.ip().to_string();
    
    let mut target_device = None;
    for device in &devices {
        if device.ip == ip {
            target_device = Some(device.clone());
            break;
        }
    }

    if let Some(device) = target_device {
        // Only process if it is monitored
        if !monitored_ids.contains(&device.id) {
            return;
        }

        let mut status_changed = false;
        {
            let mut statuses_map = statuses.lock().unwrap();
            if let Some(status) = statuses_map.get_mut(&device.id) {
                let was_offline = !status.is_alive;
                status.last_response = current_time_ms();
                
                if was_offline {
                    status.is_alive = true;
                    status_changed = true;

                    // Recovery Alert
                    let msg = recovery_msg.clone().unwrap_or("✅ Recovery: {name} ({ip}) is UP!".to_string())
                        .replace("{name}", &device.name)
                        .replace("{ip}", &device.ip);
                    send_slack_alert(&webhook_url, &msg);

                    // Logic
                    evaluate_logics(&device.id, "online", &logics, &custom_buttons, &devices, osc_service, log_tx);
                }
            }
        }
        
        if status_changed {
            broadcast_status(app_handle, statuses);
        }
    }
}

fn evaluate_logics(
    target_id: &str, 
    status: &str, 
    logics: &[crate::models::LogicRule], 
    buttons: &[CustomButton], 
    devices: &[crate::models::Device],
    osc_service: &Arc<Mutex<OscService>>,
    log_tx: &mpsc::Sender<LogEntry>
) {
    for logic in logics {
        if !logic.enabled { continue; }
        if logic.trigger_status != status { continue; }
        if !logic.target_ids.contains(&target_id.to_string()) { continue; }

        // Execute Action
        if let Some(btn) = buttons.iter().find(|b| b.id == logic.action_button_id) {
            // Resolve target device
            if let Some(device) = devices.iter().find(|d| d.id == btn.device_id) {
                let osc = osc_service.lock().unwrap();
                let args = parse_args(&btn.args);
                println!("Executing Logic: {} -> {} ({})", logic.name, btn.label, device.name);
                osc.send(&device.ip, device.port, &btn.address, args, Some(log_tx));
            }
        }
    }
}

fn send_slack_alert(webhook_url: &str, message: &str) {
    if webhook_url.is_empty() { return; }
    let client = reqwest::blocking::Client::new();
    let _ = client.post(webhook_url)
        .json(&serde_json::json!({ "text": message }))
        .send();
}
