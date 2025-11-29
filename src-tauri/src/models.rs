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
pub struct OscArg {
    pub value: String,
    pub arg_type: String, // "string", "int", "float"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomButton {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
    pub mode: String, // "momentary" | "toggle"

    pub device_ids: Vec<String>, // 複数デバイスに送信可能

    pub address: String,
    pub args: Vec<OscArg>,

    pub address_off: Option<String>,
    pub args_off: Option<Vec<OscArg>>,

    pub periodic_interval: Option<u64>, // ms
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OscFlowEvent {
    pub id: String,
    pub timestamp: u64,
    pub direction: String, // "tx" | "rx"
    pub source_ip: String,
    pub source_port: u16,
    pub dest_ip: String,
    pub dest_port: u16,
    pub address: String,
    pub args: String,
}
