use crate::models::{CustomButton, CustomMonitor, LogEntry, MonitorArgValue, MonitorConfig, MonitorValueEvent, OscFlowEvent, PCStatus};
use crate::osc_service::OscService;
use local_ip_address::local_ip;
use rosc::OscType;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

struct MonitorHandle {
    running: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

pub struct MonitorService {
    monitor_handle: Arc<Mutex<Option<MonitorHandle>>>,
    osc_service: Arc<Mutex<OscService>>,
    config: Arc<Mutex<Option<MonitorConfig>>>,
    statuses: Arc<Mutex<HashMap<String, PCStatus>>>,
    app_handle: AppHandle,
    log_tx: Arc<Mutex<Option<mpsc::Sender<LogEntry>>>>,
    flow_tx: Arc<Mutex<Option<mpsc::Sender<OscFlowEvent>>>>,
    local_ip: Arc<Mutex<String>>,
    button_last_triggered: Arc<Mutex<HashMap<String, u64>>>,
    button_enabled: Arc<Mutex<HashMap<String, bool>>>,
}

impl MonitorService {
    pub fn new(app_handle: AppHandle) -> Self {
        // Get local IP address
        let local_ip_str = local_ip().map(|ip| ip.to_string()).unwrap_or_else(|_| "127.0.0.1".to_string());
        
        Self {
            monitor_handle: Arc::new(Mutex::new(None)),
            osc_service: Arc::new(Mutex::new(OscService::new())),
            config: Arc::new(Mutex::new(None)),
            statuses: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
            log_tx: Arc::new(Mutex::new(None)),
            flow_tx: Arc::new(Mutex::new(None)),
            local_ip: Arc::new(Mutex::new(local_ip_str)),
            button_last_triggered: Arc::new(Mutex::new(HashMap::new())),
            button_enabled: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start(&self, config: MonitorConfig) {
        // Stop existing monitor if running
        self.stop();
        
        // Create new running flag for this monitor instance
        let running = Arc::new(AtomicBool::new(true));

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
        let (flow_tx, mut flow_rx) = mpsc::channel::<OscFlowEvent>(100);

        // Spawn Log Emitter
        let app_handle_log = self.app_handle.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(entry) = log_rx.recv().await {
                app_handle_log.emit("log-event", entry).ok();
            }
        });

        // Spawn Flow Event Emitter
        let app_handle_flow = self.app_handle.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = flow_rx.recv().await {
                app_handle_flow.emit("osc-flow", event).ok();
            }
        });

        // Store log_tx and flow_tx
        {
            let mut log_tx_guard = self.log_tx.lock().unwrap();
            *log_tx_guard = Some(log_tx.clone());
        }
        {
            let mut flow_tx_guard = self.flow_tx.lock().unwrap();
            *flow_tx_guard = Some(flow_tx.clone());
        }

        let local_ip_str = self.local_ip.lock().unwrap().clone();
        {
            let mut osc = self.osc_service.lock().unwrap();
            osc.start_listener(config.local_port, tx, log_tx.clone(), flow_tx.clone(), local_ip_str.clone());
        }

        let running_clone = running.clone();
        let config_arc = self.config.clone();
        let statuses_arc = self.statuses.clone();
        let osc_service_arc = self.osc_service.clone();
        let app_handle = self.app_handle.clone();
        let button_last_triggered_arc = self.button_last_triggered.clone();
        let button_enabled_arc = self.button_enabled.clone();
        let flow_tx_arc = self.flow_tx.clone();
        let local_ip_arc = self.local_ip.clone();
        let monitor_handle_arc = self.monitor_handle.clone();

        // Spawn Monitor Loop
        let handle = thread::spawn(move || {
            let running = running_clone;
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
            let flow_tx_msg = flow_tx_arc.clone();
            let local_ip_msg = local_ip_arc.clone();

            let log_tx_msg = log_tx.clone();

            tauri::async_runtime::spawn(async move {
                while running_msg.load(Ordering::SeqCst) {
                    if let Some((address, args, addr)) = rx.recv().await {
                        handle_message(
                            address,
                            args,
                            addr,
                            &config_msg,
                            &statuses_msg,
                            &osc_service_msg,
                            &app_handle_msg,
                            &log_tx_msg,
                            &flow_tx_msg,
                            &local_ip_msg,
                        );
                    } else {
                        break;
                    }
                }
            });

            // Periodic Button Loop
            let running_periodic = running.clone();
            let config_periodic = config_arc.clone();
            let osc_service_periodic = osc_service_arc.clone();
            let app_handle_periodic = app_handle.clone();
            let log_tx_periodic = log_tx.clone();
            let flow_tx_periodic = flow_tx_arc.clone();
            let local_ip_periodic = local_ip_arc.clone();
            let button_last_triggered_periodic = button_last_triggered_arc.clone();
            let button_enabled_periodic = button_enabled_arc.clone();
            thread::spawn(move || {
                while running_periodic.load(Ordering::SeqCst) {
                    let now = current_time_ms();
                    let (buttons, devices) = {
                        let cfg_guard = config_periodic.lock().unwrap();
                        if let Some(cfg) = &*cfg_guard {
                            (
                                cfg.custom_buttons.clone().unwrap_or_default(),
                                cfg.devices.clone(),
                            )
                        } else {
                            (vec![], vec![])
                        }
                    };

                    for btn in buttons {
                        if btn.mode == "periodic" {
                            if let Some(interval) = btn.periodic_interval {
                                if interval > 0 {
                                    let mut last_triggered =
                                        button_last_triggered_periodic.lock().unwrap();
                                    let last = *last_triggered.get(&btn.id).unwrap_or(&0);

                                    if now - last >= interval {
                                        // Check if button is enabled
                                        let enabled_map = button_enabled_periodic.lock().unwrap();
                                        let is_enabled =
                                            *enabled_map.get(&btn.id).unwrap_or(&false);
                                        drop(enabled_map);

                                        if !is_enabled {
                                            continue;
                                        }

                                        // Trigger
                                        // println!("Periodic trigger for button: {}", btn.label);
                                        last_triggered.insert(btn.id.clone(), now);

                                        // Send OSC
                                        let target_devices: Vec<_> = devices
                                            .iter()
                                            .filter(|d| btn.device_ids.contains(&d.id))
                                            .collect();
                                        if !target_devices.is_empty() {
                                            let osc = osc_service_periodic.lock().unwrap();
                                            let args = convert_osc_args(&btn.args);
                                            let flow_tx_guard = flow_tx_periodic.lock().unwrap();
                                            let local_ip = local_ip_periodic.lock().unwrap().clone();
                                            for device in target_devices {
                                                osc.send(
                                                    &device.ip,
                                                    device.port,
                                                    &btn.address,
                                                    args.clone(),
                                                    Some(&log_tx_periodic),
                                                    flow_tx_guard.as_ref(),
                                                    &local_ip,
                                                );
                                            }
                                        }

                                        // Emit event
                                        app_handle_periodic
                                            .emit(
                                                "button-trigger",
                                                serde_json::json!({
                                                    "buttonId": btn.id,
                                                    "timestamp": now
                                                }),
                                            )
                                            .ok();
                                    }
                                }
                            }
                        }
                    }

                    thread::sleep(Duration::from_millis(100));
                }
            });

            // Interval Loop
            while running.load(Ordering::SeqCst) {
                let loop_start = std::time::Instant::now();

                let (
                    interval,
                    devices,
                    monitored_ids,
                    ping_addr,
                    ping_args,
                    timeout,
                    webhook_url,
                    alert_msg,
                    recovery_msg,
                    logics,
                    custom_buttons,
                ) = {
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
                let ping_args_vec = parse_string_args(&ping_args);
                {
                    let osc = osc_service_arc.lock().unwrap();
                    let flow_tx_guard = flow_tx_arc.lock().unwrap();
                    let local_ip = local_ip_arc.lock().unwrap().clone();
                    for device_id in &monitored_ids {
                        if let Some(device) = devices.iter().find(|d| d.id == *device_id) {
                            osc.send(
                                &device.ip,
                                device.port,
                                &ping_addr,
                                ping_args_vec.clone(),
                                Some(&log_tx),
                                flow_tx_guard.as_ref(),
                                &local_ip,
                            );
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
                        if device.is_none() {
                            continue;
                        }
                        let device = device.unwrap();

                        if let Some(status) = statuses.get_mut(device_id) {
                            if now - status.last_response > timeout {
                                if status.is_alive {
                                    status.is_alive = false;
                                    status_changed = true;

                                    // Alert
                                    let msg = alert_msg
                                        .clone()
                                        .unwrap_or("⚠️ Alert: {name} ({ip}) is DOWN!".to_string())
                                        .replace("{name}", &device.name)
                                        .replace("{ip}", &device.ip);
                                    send_slack_alert(&webhook_url, &msg);

                                    // Logic
                                    evaluate_logics(
                                        device_id,
                                        "offline",
                                        &logics,
                                        &custom_buttons,
                                        &devices,
                                        &osc_service_arc,
                                        &log_tx,
                                        &flow_tx_arc,
                                        &local_ip_arc,
                                    );
                                }
                            } else {
                                if !status.is_alive {
                                    status.is_alive = true;
                                    status_changed = true;

                                    // Recovery
                                    let msg = recovery_msg
                                        .clone()
                                        .unwrap_or("✅ Recovery: {name} ({ip}) is UP!".to_string())
                                        .replace("{name}", &device.name)
                                        .replace("{ip}", &device.ip);
                                    send_slack_alert(&webhook_url, &msg);

                                    // Logic
                                    evaluate_logics(
                                        device_id,
                                        "online",
                                        &logics,
                                        &custom_buttons,
                                        &devices,
                                        &osc_service_arc,
                                        &log_tx,
                                        &flow_tx_arc,
                                        &local_ip_arc,
                                    );
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

                // Sleep in small increments to allow quick response to stop signal
                let elapsed = loop_start.elapsed();
                let remaining = Duration::from_millis(interval).saturating_sub(elapsed);
                let sleep_chunk = Duration::from_millis(100);
                let mut slept = Duration::ZERO;
                
                while slept < remaining && running.load(Ordering::SeqCst) {
                    let to_sleep = std::cmp::min(sleep_chunk, remaining - slept);
                    thread::sleep(to_sleep);
                    slept += to_sleep;
                }
            }
        });

        // Store the handle
        {
            let mut handle_guard = monitor_handle_arc.lock().unwrap();
            *handle_guard = Some(MonitorHandle {
                running,
                thread: Some(handle),
            });
        }
    }

    pub fn stop(&self) {
        // Take the monitor handle
        let handle_opt = {
            let mut handle_guard = self.monitor_handle.lock().unwrap();
            handle_guard.take()
        };
        
        if let Some(mut handle) = handle_opt {
            // Signal this monitor to stop
            handle.running.store(false, Ordering::SeqCst);
            
            // Stop OSC listener
            {
                let mut osc = self.osc_service.lock().unwrap();
                osc.stop_listener();
            }
            
            // Wait for the monitor thread to finish
            if let Some(thread) = handle.thread.take() {
                let timeout = Duration::from_secs(2);
                let start = std::time::Instant::now();
                
                while !thread.is_finished() {
                    if start.elapsed() > timeout {
                        eprintln!("Warning: Monitor thread did not stop within timeout");
                        break;
                    }
                    thread::sleep(Duration::from_millis(100));
                }
                
                if thread.is_finished() {
                    let _ = thread.join();
                }
            }
        }
    }

    pub fn update_config(&self, config: MonitorConfig) {
        let mut cfg = self.config.lock().unwrap();
        *cfg = Some(config);
    }

    pub fn send_osc(&self, ip: &str, port: u16, address: &str, args: Vec<crate::models::OscArg>) {
        let osc = self.osc_service.lock().unwrap();
        let osc_args = convert_osc_args(&args);

        let log_tx_guard = self.log_tx.lock().unwrap();
        let flow_tx_guard = self.flow_tx.lock().unwrap();
        let local_ip = self.local_ip.lock().unwrap().clone();
        osc.send(ip, port, address, osc_args, log_tx_guard.as_ref(), flow_tx_guard.as_ref(), &local_ip);
    }

    fn broadcast_status(&self) {
        broadcast_status(&self.app_handle, &self.statuses);
    }

    pub fn toggle_periodic_button(&self, button_id: String) -> bool {
        let mut enabled_map = self.button_enabled.lock().unwrap();
        let current = *enabled_map.get(&button_id).unwrap_or(&false);
        let new_state = !current;
        enabled_map.insert(button_id, new_state);
        new_state
    }
}

fn statuses_msg_loop_access(
    statuses: &Arc<Mutex<HashMap<String, PCStatus>>>,
) -> std::sync::MutexGuard<'_, HashMap<String, PCStatus>> {
    statuses.lock().unwrap()
}

fn broadcast_status(app: &AppHandle, statuses: &Arc<Mutex<HashMap<String, PCStatus>>>) {
    let statuses = statuses.lock().unwrap();
    app.emit("status-update", &*statuses).ok();
}

fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

fn convert_osc_args(args: &[crate::models::OscArg]) -> Vec<OscType> {
    args.iter()
        .map(|arg| {
            match arg.arg_type.as_str() {
                "int" => {
                    if let Ok(i) = arg.value.parse::<i32>() {
                        OscType::Int(i)
                    } else {
                        OscType::String(arg.value.clone()) // Fallback
                    }
                }
                "float" => {
                    if let Ok(f) = arg.value.parse::<f32>() {
                        OscType::Float(f)
                    } else {
                        OscType::String(arg.value.clone()) // Fallback
                    }
                }
                _ => OscType::String(arg.value.clone()),
            }
        })
        .collect()
}

// Rename original parse_args to parse_string_args for Ping/Pong
fn parse_string_args(args_str: &str) -> Vec<OscType> {
    args_str
        .split(',')
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
    log_tx: &mpsc::Sender<LogEntry>,
    flow_tx: &Arc<Mutex<Option<mpsc::Sender<OscFlowEvent>>>>,
    local_ip: &Arc<Mutex<String>>,
) {
    let (
        pong_addr,
        pong_args,
        devices,
        monitored_ids,
        webhook_url,
        recovery_msg,
        logics,
        custom_buttons,
        custom_monitors,
    ) = {
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
                cfg.custom_monitors.clone().unwrap_or_default(),
            )
        } else {
            return;
        }
    };

    // Find target device by IP
    let ip = addr.ip().to_string();
    let target_device = devices.iter().find(|d| d.ip == ip).cloned();

    // Check for custom monitors first
    if let Some(ref device) = target_device {
        for monitor in &custom_monitors {
            // Check if this monitor is enabled, targets this device, and matches the address
            if monitor.enabled && monitor.device_ids.contains(&device.id) && monitor.address == address {
                // Process custom monitor
                let event = process_custom_monitor(
                    &device.id,
                    &device.name,
                    monitor,
                    &args,
                    &webhook_url,
                );
                app_handle.emit("monitor-value", event).ok();
            }
        }
    }

    // Handle pong for status monitoring
    if address != pong_addr {
        return;
    }

    // Check args if configured
    if !pong_args.is_empty() {
        let expected = parse_string_args(&pong_args);
        if args.len() < expected.len() {
            return;
        }
        // Simple comparison (string representation)
        for (i, exp) in expected.iter().enumerate() {
            // This comparison is a bit loose, but sufficient for now
            if format!("{:?}", args[i]) != format!("{:?}", exp) {
                return;
            }
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
                    let msg = recovery_msg
                        .clone()
                        .unwrap_or("✅ Recovery: {name} ({ip}) is UP!".to_string())
                        .replace("{name}", &device.name)
                        .replace("{ip}", &device.ip);
                    send_slack_alert(&webhook_url, &msg);

                    // Logic
                    evaluate_logics(
                        &device.id,
                        "online",
                        &logics,
                        &custom_buttons,
                        &devices,
                        osc_service,
                        log_tx,
                        flow_tx,
                        local_ip,
                    );
                }
            }
        }

        if status_changed {
            broadcast_status(app_handle, statuses);
        }
    }
}

fn process_custom_monitor(
    device_id: &str,
    device_name: &str,
    monitor: &CustomMonitor,
    osc_args: &[OscType],
    webhook_url: &str,
) -> MonitorValueEvent {
    let mut arg_values = Vec::new();

    for (i, arg_def) in monitor.args.iter().enumerate() {
        let raw_value = osc_args.get(i);
        
        // Extract value based on type
        let (value, numeric_value): (serde_json::Value, Option<f64>) = match raw_value {
            Some(OscType::Int(v)) => (serde_json::Value::Number((*v).into()), Some(*v as f64)),
            Some(OscType::Float(v)) => {
                let n = serde_json::Number::from_f64(*v as f64).unwrap_or(serde_json::Number::from(0));
                (serde_json::Value::Number(n), Some(*v as f64))
            }
            Some(OscType::String(v)) => (serde_json::Value::String(v.clone()), None),
            Some(OscType::Bool(v)) => (serde_json::Value::Bool(*v), None),
            _ => (serde_json::Value::Null, None),
        };

        // Determine display value (with mapping for strings)
        let display_value = match &value {
            serde_json::Value::String(s) => {
                if let Some(mapping) = &arg_def.value_mapping {
                    mapping.get(s).cloned().unwrap_or_else(|| s.clone())
                } else {
                    s.clone()
                }
            }
            serde_json::Value::Number(n) => {
                let mut s = n.to_string();
                if let Some(unit) = &arg_def.unit {
                    s.push_str(unit);
                }
                s
            }
            serde_json::Value::Bool(b) => if *b { "true".to_string() } else { "false".to_string() },
            _ => "N/A".to_string(),
        };

        // Determine status based on thresholds
        let status = if let Some(num_val) = numeric_value {
            let mut s = "normal";
            
            // Check warning threshold
            if let (Some(threshold), Some(condition)) = (arg_def.warning_threshold, arg_def.warning_condition.as_ref()) {
                let exceeded = match condition.as_str() {
                    "below" => num_val < threshold,
                    "above" => num_val > threshold,
                    _ => false,
                };
                if exceeded {
                    s = "warning";
                    
                    // Send Slack notification
                    if arg_def.enable_slack_notification.unwrap_or(false) && !webhook_url.is_empty() {
                        let msg = arg_def.slack_message_template.clone()
                            .unwrap_or("⚠️ {device}: {value}{unit} ({status})".to_string())
                            .replace("{device}", device_name)
                            .replace("{value}", &num_val.to_string())
                            .replace("{unit}", arg_def.unit.as_deref().unwrap_or(""))
                            .replace("{status}", "warning");
                        send_slack_alert(webhook_url, &msg);
                    }
                }
            }
            
            // Check critical threshold (overrides warning)
            if let (Some(threshold), Some(condition)) = (arg_def.critical_threshold, arg_def.critical_condition.as_ref()) {
                let exceeded = match condition.as_str() {
                    "below" => num_val < threshold,
                    "above" => num_val > threshold,
                    _ => false,
                };
                if exceeded {
                    s = "critical";
                    
                    // Send Slack notification
                    if arg_def.enable_slack_notification.unwrap_or(false) && !webhook_url.is_empty() {
                        let msg = arg_def.slack_message_template.clone()
                            .unwrap_or("🔴 {device}: {value}{unit} ({status})".to_string())
                            .replace("{device}", device_name)
                            .replace("{value}", &num_val.to_string())
                            .replace("{unit}", arg_def.unit.as_deref().unwrap_or(""))
                            .replace("{status}", "critical");
                        send_slack_alert(webhook_url, &msg);
                    }
                }
            }
            
            s.to_string()
        } else {
            "normal".to_string()
        };

        arg_values.push(MonitorArgValue {
            value,
            display_value,
            status,
        });
    }

    MonitorValueEvent {
        device_id: device_id.to_string(),
        monitor_id: monitor.id.clone(),
        args: arg_values,
        timestamp: current_time_ms(),
    }
}

fn evaluate_logics(
    target_id: &str,
    status: &str,
    logics: &[crate::models::LogicRule],
    buttons: &[CustomButton],
    devices: &[crate::models::Device],
    osc_service: &Arc<Mutex<OscService>>,
    log_tx: &mpsc::Sender<LogEntry>,
    flow_tx: &Arc<Mutex<Option<mpsc::Sender<OscFlowEvent>>>>,
    local_ip: &Arc<Mutex<String>>,
) {
    for logic in logics {
        if !logic.enabled {
            continue;
        }
        if logic.trigger_status != status {
            continue;
        }
        if !logic.target_ids.contains(&target_id.to_string()) {
            continue;
        }

        // Execute Action
        if let Some(btn) = buttons.iter().find(|b| b.id == logic.action_button_id) {
            // Resolve target devices (複数デバイス対応)
            let target_devices: Vec<_> = devices
                .iter()
                .filter(|d| btn.device_ids.contains(&d.id))
                .collect();
            if !target_devices.is_empty() {
                let osc = osc_service.lock().unwrap();
                let args = convert_osc_args(&btn.args);
                let flow_tx_guard = flow_tx.lock().unwrap();
                let local_ip_str = local_ip.lock().unwrap().clone();
                for device in target_devices {
                    println!(
                        "Executing Logic: {} -> {} ({})",
                        logic.name, btn.label, device.name
                    );
                    osc.send(
                        &device.ip,
                        device.port,
                        &btn.address,
                        args.clone(),
                        Some(log_tx),
                        flow_tx_guard.as_ref(),
                        &local_ip_str,
                    );
                }
            }
        }
    }
}

fn send_slack_alert(webhook_url: &str, message: &str) {
    if webhook_url.is_empty() {
        return;
    }
    let client = reqwest::blocking::Client::new();
    let _ = client
        .post(webhook_url)
        .json(&serde_json::json!({ "text": message }))
        .send();
}
