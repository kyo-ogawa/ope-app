use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
}

// Keep PCConfig for backward compatibility if needed, or remove it.
// We will replace it with Device in MonitorConfig.
// But for now, let's remove PCConfig and use Device.


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomButton {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
    pub mode: String, // "momentary" | "toggle"

    pub device_id: String,
    // pub target_ip: String, // Removed
    // pub target_port: u16, // Removed

    pub address: String,
    pub args: String,

    pub address_off: Option<String>,
    pub args_off: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogicRule {
    pub id: String,
    pub name: String,
    pub target_ids: Vec<String>,
    pub trigger_status: String, // "online" | "offline"
    pub action_button_id: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorConfig {
    pub devices: Vec<Device>,
    pub monitored_device_ids: Vec<String>,
    // pub targets: Vec<PCConfig>, // Removed
    pub local_port: u16,
    pub interval: u64,
    pub timeout: u64,
    pub webhook_url: String,
    pub alert_message: Option<String>,
    pub recovery_message: Option<String>,

    pub ping_address: Option<String>,
    pub ping_args: Option<String>,

    pub pong_address: Option<String>,
    pub pong_args: Option<String>,

    pub custom_buttons: Option<Vec<CustomButton>>,
    pub logics: Option<Vec<LogicRule>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PCStatus {
    pub last_response: u64, // timestamp in ms
    pub is_alive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp: u64,
    pub level: String, // "info", "error", "rx", "tx"
    pub message: String,
}
