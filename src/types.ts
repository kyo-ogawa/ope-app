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

export type ButtonMode = 'momentary' | 'toggle';

export interface CustomButton {
    id: string;
    label: string;
    description?: string;
    mode: ButtonMode;

    // Common
    deviceId: string;
    // targetIp: string; // Removed
    // targetPort: number; // Removed

    // Momentary or Toggle ON
    address: string;
    args: string; // Comma separated values

    // Toggle OFF
    addressOff?: string;
    argsOff?: string;
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
