# OSCサービス仕様

## 概要

OSC (Open Sound Control) メッセージの送受信を担当するサービス。
`rosc` クレートを使用。

## 機能

### 1. メッセージ送信

UDP経由でOSCメッセージを送信。

```rust
pub async fn send_osc_message(
    ip: &str,
    port: u16,
    address: &str,
    args: &[OscArg],
) -> Result<(), OscError>
```

#### 引数の型変換

| OscArg.argType | rosc::OscType |
|----------------|---------------|
| "int" | OscType::Int(i32) |
| "float" | OscType::Float(f32) |
| "string" | OscType::String(String) |

### 2. メッセージ受信

指定ポートでOSCメッセージをリッスン。

```rust
pub async fn start_listener(
    port: u16,
    callback: impl Fn(OscMessage, SocketAddr),
) -> Result<ListenerHandle, OscError>
```

### 3. Ping/Pong

死活監視用のPing送信とPong受信。

```rust
// Ping送信
pub async fn send_ping(
    device: &Device,
    ping_address: &str,
    ping_args: &[OscArg],
) -> Result<(), OscError>

// Pongハンドラ登録
pub fn register_pong_handler(
    pong_address: &str,
    callback: impl Fn(String), // デバイスIP
)
```

## エラー処理

```rust
#[derive(Debug)]
pub enum OscError {
    SocketBindError(String),
    SendError(String),
    ParseError(String),
    InvalidArgType(String),
}
```

## 設定

| 項目 | デフォルト | 説明 |
|-----|----------|------|
| Pingアドレス | `/ping` | 死活監視用Ping |
| Pongアドレス | `/pong` | 死活監視用Pong応答 |
| ソケットタイムアウト | 1000ms | UDP送信タイムアウト |

## 実装ポイント

1. **ソケット再利用**: 送信用ソケットはプールして再利用
2. **非同期処理**: Tokio UDPソケットを使用
3. **バッファサイズ**: 受信バッファは4096バイト
4. **マルチキャスト対応**: 将来的な拡張として考慮
