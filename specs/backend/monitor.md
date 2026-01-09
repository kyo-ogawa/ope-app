# 死活監視サービス仕様

## 概要

OSC Ping/Pongによるデバイスの死活監視を行うサービス。
ステータス変化時にSlack通知とロジック実行を行う。

## 監視フロー

```
┌─────────────────────────────────────────────────────┐
│                   監視ループ                         │
│  ┌─────────────────────────────────────────────┐   │
│  │ 1. 全デバイスにPing送信                       │   │
│  │ 2. interval時間待機                          │   │
│  │ 3. Pong応答をチェック                         │   │
│  │ 4. timeout超過デバイスをOffline判定           │   │
│  │ 5. ステータス変化があれば:                     │   │
│  │    - イベント発行                             │   │
│  │    - Slack通知                               │   │
│  │    - ロジック実行                             │   │
│  │ 6. 1に戻る                                   │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## 状態管理

```rust
pub struct MonitorState {
    /// デバイスID -> ステータス
    pub statuses: HashMap<String, PCStatus>,
    /// 監視実行中フラグ
    pub is_running: bool,
    /// 停止シグナル
    pub stop_signal: Option<oneshot::Sender<()>>,
}
```

## API

### start_monitoring

```rust
pub async fn start_monitoring(
    config: MonitorConfig,
    state: Arc<Mutex<MonitorState>>,
    app_handle: AppHandle,
) -> Result<(), MonitorError>
```

**処理フロー**:
1. 既存の監視があれば停止
2. ローカルポートでOSCリスナー開始
3. Pongハンドラ登録
4. 監視ループ開始（別タスク）

### stop_monitoring

```rust
pub async fn stop_monitoring(
    state: Arc<Mutex<MonitorState>>,
) -> Result<(), MonitorError>
```

## ステータス判定ロジック

```rust
fn update_status(
    device_id: &str,
    last_response: Option<Instant>,
    timeout_ms: u64,
) -> PCStatus {
    match last_response {
        Some(time) if time.elapsed().as_millis() < timeout_ms => {
            PCStatus {
                lastResponse: Some(time.as_millis()),
                isAlive: true,
            }
        }
        _ => PCStatus {
            lastResponse: None,
            isAlive: false,
        }
    }
}
```

## Slack通知

### 通知条件

| 状態変化 | 通知メッセージ |
|---------|--------------|
| Online → Offline | alertMessage（デフォルト: "Device {name} is offline"） |
| Offline → Online | recoveryMessage（デフォルト: "Device {name} is back online"） |

### Webhook送信

```rust
async fn send_slack_notification(
    webhook_url: &str,
    message: &str,
) -> Result<(), reqwest::Error> {
    let client = reqwest::Client::new();
    client.post(webhook_url)
        .json(&json!({ "text": message }))
        .send()
        .await?;
    Ok(())
}
```

## ロジック実行

ステータス変化時に条件に合致するLogicRuleを実行。

```rust
async fn execute_matching_logics(
    device_id: &str,
    new_status: bool, // true=online, false=offline
    config: &MonitorConfig,
) {
    for logic in config.logics.iter().filter(|l| l.enabled) {
        if logic.target_ids.contains(device_id) {
            let trigger_matches = match logic.trigger_status {
                "online" => new_status,
                "offline" => !new_status,
            };
            if trigger_matches {
                execute_button_action(&logic.action_button_id, config).await;
            }
        }
    }
}
```

## 設定パラメータ

| パラメータ | 型 | デフォルト | 説明 |
|-----------|---|----------|------|
| interval | u64 | 5000 | 監視間隔（ms） |
| timeout | u64 | 3000 | タイムアウト（ms） |
| localPort | u16 | 9000 | ローカル受信ポート |
| pingAddress | String | "/ping" | Pingアドレス |
| pongAddress | String | "/pong" | Pongアドレス |

## エラー処理

```rust
#[derive(Debug)]
pub enum MonitorError {
    AlreadyRunning,
    NotRunning,
    OscError(OscError),
    ConfigError(String),
}
```

## イベント発行

| イベント | タイミング | ペイロード |
|---------|-----------|-----------|
| `status_update` | 毎インターバル | 全デバイスステータス |
| `log_entry` | ステータス変化時 | ログメッセージ |
