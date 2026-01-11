# Tauri IPC コマンド仕様

## 概要

フロントエンドから呼び出し可能なTauriコマンドの仕様。

## 設定関連

### load_config

設定ファイルを読み込む。

```rust
#[tauri::command]
fn load_config() -> Result<MonitorConfig, String>
```

**戻り値**: MonitorConfig または エラーメッセージ

### save_config

設定をファイルに保存。

```rust
#[tauri::command]
fn save_config(config: MonitorConfig) -> Result<(), String>
```

**引数**: 
- `config`: 保存する設定

## プロファイル関連

### list_profiles

保存済みプロファイル一覧を取得。

```rust
#[tauri::command]
fn list_profiles(app: AppHandle) -> Result<Vec<String>, String>
```

**戻り値**: プロファイル名の配列

### save_profile

プロファイルを保存。

```rust
#[tauri::command]
fn save_profile(app: AppHandle, name: String, config: MonitorConfig) -> Result<(), String>
```

**引数**:
- `name`: プロファイル名
- `config`: 保存する設定

### load_profile

プロファイルを読み込み。

```rust
#[tauri::command]
fn load_profile(app: AppHandle, name: String) -> Result<MonitorConfig, String>
```

**引数**:
- `name`: プロファイル名

## 監視関連

### start_monitoring

死活監視を開始。

```rust
#[tauri::command]
async fn start_monitoring(config: MonitorConfig, app: AppHandle) -> Result<(), String>
```

**引数**:
- `config`: 監視設定

**副作用**:
- 監視ループを開始
- `status_update` イベントを定期発行
- ステータス変化時に `log_entry` イベント発行
- 条件に応じてSlack通知

### stop_monitoring

監視を停止。

```rust
#[tauri::command]
async fn stop_monitoring() -> Result<(), String>
```

### get_statuses

現在のデバイスステータスを取得。

```rust
#[tauri::command]
fn get_statuses() -> Result<HashMap<String, PCStatus>, String>
```

**戻り値**: デバイスID -> ステータス のマップ

## OSC関連

### send_osc

OSCメッセージを送信。

```rust
#[tauri::command]
async fn send_osc(
    ip: String,
    port: u16,
    address: String,
    args: Vec<OscArg>
) -> Result<(), String>
```

**引数**:
- `ip`: 送信先IPアドレス
- `port`: 送信先ポート
- `address`: OSCアドレス（例: "/control/play"）
- `args`: OSC引数配列

### send_osc_to_devices

複数デバイスにOSCメッセージを送信。

```rust
#[tauri::command]
async fn send_osc_to_devices(
    device_ids: Vec<String>,
    address: String,
    args: Vec<OscArg>,
    config: MonitorConfig
) -> Result<(), String>
```

## ネットワーク関連

### get_network_interfaces

利用可能なネットワークインターフェースを取得。

```rust
#[tauri::command]
fn get_network_interfaces() -> Result<Vec<NetworkInterface>, String>
```

### scan_network

ネットワークスキャンを実行。

```rust
#[tauri::command]
async fn scan_network(
    interface: NetworkInterface,
    app: AppHandle
) -> Result<ScanResult, String>
```

**副作用**:
- スキャン中は `scan_progress` イベントを発行

## フロー関連

### start_flow_capture

OSCフローキャプチャを開始。

```rust
#[tauri::command]
async fn start_flow_capture(local_port: u16, app: AppHandle) -> Result<(), String>
```

**副作用**:
- `osc_flow` イベントでメッセージを発行

### stop_flow_capture

フローキャプチャを停止。

```rust
#[tauri::command]
async fn stop_flow_capture() -> Result<(), String>
```

## ロジック関連

### execute_logic

ロジックルールを手動実行。

```rust
#[tauri::command]
async fn execute_logic(
    logic_id: String,
    config: MonitorConfig
) -> Result<(), String>
```

## イベント一覧

### status_update

デバイスステータス更新。

```typescript
interface StatusUpdatePayload {
  [deviceId: string]: PCStatus;
}
```

### log_entry

ログエントリ追加。

```typescript
interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}
```

### osc_flow

OSCメッセージフロー。

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

### scan_progress

ネットワークスキャン進捗。

```typescript
interface ScanProgress {
  current: number;
  total: number;
  currentIp: string;
}
```

### monitor_value

カスタムモニター値更新。

```typescript
interface MonitorValueEvent {
  deviceId: string;
  monitorId: string;
  values: MonitorArgValue[];
}
```
