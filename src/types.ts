export interface Device {
    id: string;
    name: string;
    ip: string;
    port: number;
}

// Deprecated: Use Device instead
export interface PCConfig {
    id: string;
    ip: string;
    port: number;
    name: string;
}

export type ButtonMode = 'momentary' | 'toggle' | 'periodic' | 'value';

export interface OscArg {
    value: string;
    argType: 'string' | 'int' | 'float';
}

export interface CustomButton {
    id: string;
    label: string;
    description?: string;
    mode: ButtonMode;

    // Common - 複数デバイスに送信可能
    deviceIds: string[];

    // Momentary or Toggle ON
    address: string;
    args: OscArg[];

    // Toggle OFF
    addressOff?: string;
    argsOff?: OscArg[];

    // Periodic
    periodicInterval?: number; // ms

    // Value mode
    valueType?: 'int' | 'float';
    valueMin?: number;
    valueMax?: number;
    valueDefault?: number;
    valueStep?: number; // スライダーのステップ値
}

export interface LogicRule {
    id: string;
    name: string;
    targetIds: string[];
    triggerStatus: 'online' | 'offline';
    actionButtonId: string;
    enabled: boolean;
}

export interface MonitorConfig {
    devices: Device[];
    monitoredDeviceIds: string[];
    // targets: PCConfig[]; // Removed
    localPort: number;
    interval: number;
    timeout: number;
    webhookUrl: string;
    alertMessage?: string;
    recoveryMessage?: string;

    pingAddress?: string;
    pingArgs?: string;

    pongAddress?: string;
    pongArgs?: string;

    customButtons?: CustomButton[];
    logics?: LogicRule[];
    
    // Custom Monitors - 任意OSC監視
    customMonitors?: CustomMonitor[];
    
    // Auto start monitoring on app launch
    autoStart?: boolean;
}

export interface PCStatus {
    lastResponse: number;
    isAlive: boolean;
}

export interface LogicInfo {
    id: string;
    name: string;
    triggerStatus: 'online' | 'offline';
    actionName: string;
}

export interface LogEntry {
    timestamp: number;
    level: 'info' | 'error' | 'rx' | 'tx';
    message: string;
}

// Network Scanner types
export interface ScannedDevice {
    ip: string;
    hostname: string | null;
    isReachable: boolean;
    responseTimeMs: number | null;
}

export interface NetworkInterface {
    name: string;
    ip: string;
    subnet: string;
}

export interface ScanProgress {
    current: number;
    total: number;
    currentIp: string;
}

export interface ScanResult {
    devices: ScannedDevice[];
    scanTimeMs: number;
}

// OSC Flow visualization types
export type OscFlowDirection = 'tx' | 'rx';

export interface OscFlowEvent {
    id: string;
    timestamp: number;
    direction: OscFlowDirection;
    sourceIp: string;
    sourcePort: number;
    destIp: string;
    destPort: number;
    address: string;
    args: string;
    // Optional: デバイス名（設定から解決）
    sourceName?: string;
    destName?: string;
}

// Custom Monitor types - デバイスからの任意のOSCメッセージを監視
export type MonitorArgType = 'int' | 'float' | 'string' | 'bool';

export interface MonitorArgDefinition {
    name: string;           // 引数の表示名（例: "Battery Level", "Temperature"）
    argType: MonitorArgType;
    unit?: string;          // 単位（例: "%", "℃"）
    valueMapping?: Record<string, string>;  // 値のマッピング（例: { "normal": "✅ Normal", "serious": "⚠️ Serious" }）
    
    // しきい値アラート
    warningThreshold?: number;
    warningCondition?: 'below' | 'above';
    criticalThreshold?: number;
    criticalCondition?: 'below' | 'above';
    
    // Slack通知
    enableSlackNotification?: boolean;
    slackMessageTemplate?: string;  // 例: "🔋 Battery low on {device}: {value}%"
}

export interface CustomMonitor {
    id: string;
    name: string;           // 表示名（例: "Battery Status"）
    address: string;        // OSCアドレス（例: "/battery"）
    args: MonitorArgDefinition[];  // 複数引数対応
    deviceIds: string[];    // 対象デバイスのID（複数選択可）
    enabled: boolean;
}

// 受信した値を保持する型
export interface MonitorArgValue {
    value: string | number | boolean;
    displayValue: string;   // マッピング後の表示値
    status: 'normal' | 'warning' | 'critical';
}

export interface MonitorValue {
    args: MonitorArgValue[];
    lastUpdated: number;    // timestamp
}

// MonitorValueイベント（バックエンドから送信）
export interface MonitorValueEvent {
    deviceId: string;
    monitorId: string;
    args: MonitorArgValue[];
    timestamp: number;
}
