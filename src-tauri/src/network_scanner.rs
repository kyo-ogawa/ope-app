use futures::stream::{self, StreamExt};
use local_ip_address::list_afinet_netifas;
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

// Global cancel flag for scan operation
static SCAN_CANCELLED: AtomicBool = AtomicBool::new(false);

pub fn cancel_scan() {
    SCAN_CANCELLED.store(true, Ordering::SeqCst);
}

pub fn reset_scan_cancel() {
    SCAN_CANCELLED.store(false, Ordering::SeqCst);
}

fn is_scan_cancelled() -> bool {
    SCAN_CANCELLED.load(Ordering::SeqCst)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedDevice {
    pub ip: String,
    pub hostname: Option<String>,
    pub is_reachable: bool,
    pub response_time_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterface {
    pub name: String,
    pub ip: String,
    pub subnet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub current: u32,
    pub total: u32,
    pub current_ip: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub devices: Vec<ScannedDevice>,
    pub scan_time_ms: u64,
}

/// Get list of network interfaces
pub fn get_network_interfaces() -> Vec<NetworkInterface> {
    let mut interfaces = Vec::new();

    if let Ok(network_interfaces) = list_afinet_netifas() {
        for (name, ip) in network_interfaces {
            if let IpAddr::V4(ipv4) = ip {
                if !ipv4.is_loopback() {
                    // Assume /24 subnet for simplicity
                    let subnet = format!("{}.0/24", {
                        let octets = ipv4.octets();
                        format!("{}.{}.{}", octets[0], octets[1], octets[2])
                    });

                    interfaces.push(NetworkInterface {
                        name,
                        ip: ipv4.to_string(),
                        subnet,
                    });
                }
            }
        }
    }

    interfaces
}

/// Ping a single IP address using system ping command (async)
async fn ping_host(ip: &Ipv4Addr, timeout_ms: u64) -> (bool, Option<u64>) {
    #[cfg(target_os = "windows")]
    {
        // CREATE_NO_WINDOW flag to prevent console window from appearing
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        
        let output = Command::new("ping")
            .args(["-n", "1", "-w", &timeout_ms.to_string(), &ip.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .await;

        match output {
            Ok(output) => {
                let success = output.status.success();
                let response_time = if success {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    parse_ping_time_windows(&stdout)
                } else {
                    None
                };
                (success, response_time)
            }
            Err(_) => (false, None),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let timeout_sec = (timeout_ms as f64 / 1000.0).max(1.0);
        
        let output = Command::new("ping")
            .args([
                "-c",
                "1",
                "-W",
                &format!("{:.0}", timeout_sec),
                &ip.to_string(),
            ])
            .output()
            .await;

        match output {
            Ok(output) => {
                let success = output.status.success();
                let response_time = if success {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    parse_ping_time_unix(&stdout)
                } else {
                    None
                };
                (success, response_time)
            }
            Err(_) => (false, None),
        }
    }
}

/// Parse ping response time from Unix output (macOS/Linux)
#[cfg(not(target_os = "windows"))]
fn parse_ping_time_unix(output: &str) -> Option<u64> {
    // macOS/Linux format: "time=X.XXX ms" or "time=X ms"
    if let Some(time_idx) = output.find("time=") {
        let after_time = &output[time_idx + 5..];
        if let Some(ms_idx) = after_time.find(" ms") {
            let time_str = &after_time[..ms_idx];
            if let Ok(time) = time_str.parse::<f64>() {
                return Some(time as u64);
            }
        }
    }
    None
}

/// Parse ping response time from Windows output
#[cfg(target_os = "windows")]
fn parse_ping_time_windows(output: &str) -> Option<u64> {
    // Windows English format: "time=XXms" or "time<1ms"
    // Windows Japanese format: "時間 =XXms" or "時間 <1ms"
    
    // Try English format first
    if let Some(time_idx) = output.find("time=") {
        let after_time = &output[time_idx + 5..];
        if let Some(ms_idx) = after_time.find("ms") {
            let time_str = after_time[..ms_idx].trim();
            if let Ok(time) = time_str.parse::<u64>() {
                return Some(time);
            }
        }
    }
    
    // Try "time<1ms" format (very fast response)
    if output.contains("time<1ms") || output.contains("時間 <1ms") {
        return Some(0);
    }
    
    // Try Japanese format: "時間 =XXms"
    if let Some(time_idx) = output.find("時間") {
        let after_time = &output[time_idx..];
        if let Some(eq_idx) = after_time.find('=') {
            let after_eq = &after_time[eq_idx + 1..];
            if let Some(ms_idx) = after_eq.find("ms") {
                let time_str = after_eq[..ms_idx].trim();
                if let Ok(time) = time_str.parse::<u64>() {
                    return Some(time);
                }
            }
        }
    }
    
    None
}

/// Try to resolve hostname for an IP address (async)
async fn resolve_hostname(ip: Ipv4Addr) -> Option<String> {
    use dns_lookup::lookup_addr;
    use std::net::IpAddr;

    // Run blocking DNS lookup in a separate thread
    tokio::task::spawn_blocking(move || {
        match lookup_addr(&IpAddr::V4(ip)) {
            Ok(hostname) => {
                // Skip if hostname is just the IP address
                if hostname != ip.to_string() {
                    Some(hostname)
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    })
    .await
    .unwrap_or(None)
}

/// Scan a network range
pub async fn scan_network(
    app: AppHandle,
    base_ip: String,
    start: u8,
    end: u8,
    timeout_ms: u64,
    concurrent_scans: usize,
) -> ScanResult {
    let start_time = std::time::Instant::now();
    
    // Reset cancel flag at start
    reset_scan_cancel();

    // Parse base IP
    let base_octets: Vec<u8> = base_ip
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();

    if base_octets.len() < 3 {
        return ScanResult {
            devices: Vec::new(),
            scan_time_ms: 0,
        };
    }

    let total = (end - start + 1) as u32;
    let scanned_count = Arc::new(AtomicU32::new(0));

    // Create list of IPs to scan
    let ips: Vec<Ipv4Addr> = (start..=end)
        .map(|i| Ipv4Addr::new(base_octets[0], base_octets[1], base_octets[2], i))
        .collect();

    // Scan with concurrency limit
    let devices: Vec<ScannedDevice> = stream::iter(ips.into_iter())
        .map(|ip| {
            let app_clone = app.clone();
            let scanned_count = scanned_count.clone();
            async move {
                // Check if cancelled
                if is_scan_cancelled() {
                    return None;
                }

                let (is_reachable, response_time_ms) = ping_host(&ip, timeout_ms).await;

                // Check again after ping
                if is_scan_cancelled() {
                    return None;
                }

                // Update progress
                let current = scanned_count.fetch_add(1, Ordering::SeqCst) + 1;
                let _ = app_clone.emit(
                    "scan-progress",
                    ScanProgress {
                        current,
                        total,
                        current_ip: ip.to_string(),
                    },
                );

                if is_reachable {
                    let hostname = resolve_hostname(ip).await;
                    let device = ScannedDevice {
                        ip: ip.to_string(),
                        hostname,
                        is_reachable,
                        response_time_ms,
                    };
                    
                    // Emit device found immediately
                    let _ = app_clone.emit("device-found", &device);
                    
                    Some(device)
                } else {
                    None
                }
            }
        })
        .buffer_unordered(concurrent_scans)
        .filter_map(|result| async { result })
        .collect()
        .await;

    let scan_time_ms = start_time.elapsed().as_millis() as u64;

    // Emit completion (with cancelled status)
    let _ = app.emit("scan-complete", is_scan_cancelled());

    ScanResult {
        devices,
        scan_time_ms,
    }
}

