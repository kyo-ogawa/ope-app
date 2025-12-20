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
