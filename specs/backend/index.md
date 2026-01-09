# バックエンド仕様

## 概要

Tauri 2.x + Rust によるデスクトップアプリケーションバックエンド。
OSC通信、死活監視、ネットワークスキャン機能を提供。

## 技術スタック

- **フレームワーク**: Tauri 2.x
- **言語**: Rust
- **OSCライブラリ**: rosc
- **HTTPクライアント**: reqwest
- **非同期ランタイム**: Tokio

## モジュール構成

| モジュール | ファイル | 説明 |
|-----------|---------|------|
| メイン | main.rs | アプリケーションエントリ、コマンド登録 |
| OSCサービス | osc_service.rs | OSC送受信 |
| 監視 | monitor.rs | 死活監視ループ |
| ネットワーク | network_scanner.rs | IPスキャン |
| モデル | models.rs | データ構造定義 |

## 仕様ドキュメント

- [Tauri IPCコマンド](./commands.md)
- [OSCサービス](./osc-service.md)
- [死活監視](./monitor.md)
- [ネットワークスキャナー](./network-scanner.md)

## アーキテクチャ

```
┌─────────────────────────────────────────┐
│              Frontend (React)            │
└─────────────────┬───────────────────────┘
                  │ Tauri IPC
┌─────────────────▼───────────────────────┐
│              main.rs                     │
│         (コマンドハンドラ)                │
├─────────────────────────────────────────┤
│  osc_service.rs  │  monitor.rs          │
│  (OSC送受信)      │  (死活監視)           │
├─────────────────────────────────────────┤
│           network_scanner.rs             │
│           (ネットワークスキャン)           │
└─────────────────────────────────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │  External OSC   │
        │    Devices      │
        └─────────────────┘
```

## 状態管理

グローバル状態は `Arc<Mutex<T>>` または `tauri::State` で管理。

```rust
// 監視状態の例
pub struct MonitorState {
    pub statuses: HashMap<String, PCStatus>,
    pub is_running: bool,
}

// Tauriの状態として登録
app.manage(Arc::new(Mutex::new(MonitorState::default())));
```

## イベント発行

フロントエンドへの非同期通知は Tauri イベントを使用。

```rust
use tauri::Emitter;

// イベント発行
app_handle.emit("status_update", &payload)?;
app_handle.emit("log_entry", &log)?;
app_handle.emit("osc_flow", &flow_event)?;
```

## エラーハンドリング

```rust
// Result型でエラーを返す
#[tauri::command]
fn my_command() -> Result<Data, String> {
    do_something().map_err(|e| e.to_string())
}
```

## ディレクトリ構造

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── build.rs
└── src/
    ├── main.rs
    ├── lib.rs
    ├── models.rs
    ├── osc_service.rs
    ├── monitor.rs
    └── network_scanner.rs
```
