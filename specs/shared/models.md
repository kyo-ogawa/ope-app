# 共通データモデル仕様

## 概要

フロントエンド（TypeScript）とバックエンド（Rust）で共有されるデータモデルの仕様。
両者は同一の構造を持ち、JSON シリアライズで IPC 通信を行う。

## 基本モデル

### Device（デバイス）

監視・制御対象のデバイス定義。

```typescript
interface Device {
  id: string;        // 一意識別子（UUID推奨）
  name: string;      // 表示名
  ip: string;        // IPアドレス
  port: number;      // OSCポート番号
}
```

### PCStatus（デバイスステータス）

デバイスの死活状態。

```typescript
interface PCStatus {
  lastResponse: number | null;  // 最終応答時刻（Unix ms）、null=未応答
  isAlive: boolean;             // 生存フラグ
}
```

## カスタムボタン

### ButtonMode（ボタンモード）

```typescript
type ButtonMode = "momentary" | "toggle" | "periodic" | "value";
```

| モード | 説明 |
|--------|------|
| momentary | クリック時に1回送信 |
| toggle | ON/OFF切替（2状態） |
| periodic | 一定間隔で自動送信 |
| value | スライダー等で値を送信 |

### OscArg（OSC引数）

```typescript
interface OscArg {
  value: string;                           // 値（文字列表現）
  argType: "int" | "float" | "string";     // 型
}
```

### CustomButton（カスタムボタン）

```typescript
interface CustomButton {
  id: string;
  label: string;
  description?: string;
  mode: ButtonMode;
  deviceIds: string[];           // 送信先デバイスID配列
  address: string;               // OSCアドレス（例: "/control/play"）
  args: OscArg[];                // ON時の引数
  
  // Toggle モード用
  addressOff?: string;           // OFF時のアドレス（省略時はaddressを使用）
  argsOff?: OscArg[];            // OFF時の引数
  
  // Periodic モード用
  periodicInterval?: number;     // 送信間隔（ms）
  
  // Value モード用
  valueType?: "int" | "float";
  valueMin?: number;
  valueMax?: number;
  valueDefault?: number;
  valueStep?: number;
}
```

## カスタムモニター

### CustomMonitor（カスタムモニター）

OSCメッセージを監視し、値を表示する。

```typescript
interface CustomMonitor {
  id: string;
  name: string;
  address: string;              // 監視対象OSCアドレス
  args: MonitorArgDefinition[]; // 引数定義
  deviceIds: string[];          // 対象デバイス
  enabled: boolean;
}
```

### MonitorArgDefinition（監視引数定義）

```typescript
interface MonitorArgDefinition {
  name: string;
  argType: "int" | "float" | "string" | "bool";
  unit?: string;                           // 単位（例: "dB", "%"）
  valueMapping?: Record<string, string>;   // 値マッピング（例: {"0": "OFF", "1": "ON"}）
  warningThreshold?: number;               // 警告閾値
  criticalThreshold?: number;              // 危険閾値
  enableSlackNotification?: boolean;       // Slack通知有効
  slackMessageTemplate?: string;           // 通知テンプレート
}
```

### MonitorArgValue / MonitorValue

```typescript
interface MonitorArgValue {
  name: string;
  value: string;
  argType: "int" | "float" | "string" | "bool";
}

interface MonitorValue {
  monitorId: string;
  values: MonitorArgValue[];
}
```

## ロジック

### LogicRule（ロジックルール）

デバイスステータス変化時に自動でボタンアクションを実行。

```typescript
interface LogicRule {
  id: string;
  name: string;
  targetIds: string[];                      // 監視対象デバイスID
  triggerStatus: "online" | "offline";      // トリガー条件
  actionButtonId: string;                   // 実行するボタンID
  enabled: boolean;
}
```

## 設定

### MonitorConfig（監視設定）

アプリケーション全体の設定。

```typescript
interface MonitorConfig {
  devices: Device[];
  monitoredDeviceIds: string[];
  localPort: number;                // ローカル受信ポート
  interval: number;                 // 監視間隔（ms）
  timeout: number;                  // タイムアウト（ms）
  webhookUrl: string;               // Slack Webhook URL
  alertMessage?: string;            // オフライン通知メッセージ
  recoveryMessage?: string;         // 復旧通知メッセージ
  pingAddress?: string;             // Pingアドレス（デフォルト: /ping）
  pingArgs?: OscArg[];
  pongAddress?: string;             // Pongアドレス（デフォルト: /pong）
  pongArgs?: OscArg[];
  customButtons?: CustomButton[];
  logics?: LogicRule[];
  customMonitors?: CustomMonitor[];
}
```

## イベント

### LogEntry（ログエントリ）

```typescript
interface LogEntry {
  timestamp: string;              // ISO 8601形式
  level: "info" | "warn" | "error";
  message: string;
}
```

### OscFlowEvent（OSCフローイベント）

フロー可視化用のメッセージイベント。

```typescript
interface OscFlowEvent {
  id: string;
  timestamp: number;
  direction: "incoming" | "outgoing";
  sourceIp?: string;
  sourcePort?: number;
  destIp?: string;
  destPort?: number;
  address: string;
  args: string[];
}
```

## ネットワークスキャン

### NetworkInterface / ScannedDevice / ScanProgress / ScanResult

```typescript
interface NetworkInterface {
  name: string;
  ip: string;
  netmask: string;
}

interface ScannedDevice {
  ip: string;
  mac?: string;
  hostname?: string;
  vendor?: string;
}

interface ScanProgress {
  current: number;
  total: number;
  currentIp: string;
}

interface ScanResult {
  devices: ScannedDevice[];
  duration: number;
}
```

## 実装時の注意

1. **ID生成**: すべての `id` フィールドは UUID v4 を使用
2. **JSON命名規則**: Rust側は `#[serde(rename_all = "camelCase")]` で camelCase に変換
3. **Optional フィールド**: `?` 付きフィールドは Rust側で `Option<T>` + `#[serde(skip_serializing_if = "Option::is_none")]`
4. **型の一貫性**: TypeScript の `number` は Rust の `i32` または `f64` に対応
