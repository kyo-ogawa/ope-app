# ネットワークスキャナー仕様

## 概要

ローカルネットワーク上のデバイスをARPベースで検出するサービス。

## 機能

### 1. インターフェース取得

```rust
pub fn get_network_interfaces() -> Result<Vec<NetworkInterface>, ScanError>
```

システムのネットワークインターフェース一覧を取得。

**NetworkInterface**:
```rust
pub struct NetworkInterface {
    pub name: String,      // インターフェース名
    pub ip: String,        // IPアドレス
    pub netmask: String,   // サブネットマスク
}
```

### 2. ネットワークスキャン

```rust
pub async fn scan_network(
    interface: &NetworkInterface,
    progress_callback: impl Fn(ScanProgress),
) -> Result<ScanResult, ScanError>
```

**スキャン方式**:
1. サブネットマスクからスキャン範囲を計算
2. 各IPアドレスに対してARP要求送信
3. 応答があったデバイスを記録
4. MACアドレスからベンダー情報を取得（オプション）

**ScanProgress**:
```rust
pub struct ScanProgress {
    pub current: u32,
    pub total: u32,
    pub current_ip: String,
}
```

**ScanResult**:
```rust
pub struct ScanResult {
    pub devices: Vec<ScannedDevice>,
    pub duration: u64,  // スキャン時間（ms）
}
```

**ScannedDevice**:
```rust
pub struct ScannedDevice {
    pub ip: String,
    pub mac: Option<String>,
    pub hostname: Option<String>,
    pub vendor: Option<String>,
}
```

## スキャンアルゴリズム

```
1. サブネットマスクを解析
   例: 192.168.1.0/24 → 192.168.1.1 ~ 192.168.1.254

2. 並列ARPスキャン
   - 同時実行数: 50
   - タイムアウト: 500ms/IP

3. ホスト名解決（オプション）
   - 逆引きDNS

4. MACベンダー解析
   - OUIデータベース参照
```

## エラー処理

```rust
#[derive(Debug)]
pub enum ScanError {
    InterfaceNotFound(String),
    PermissionDenied,
    InvalidNetmask(String),
    Timeout,
}
```

## プラットフォーム対応

| プラットフォーム | 方式 |
|---------------|------|
| macOS | `arp -a` コマンド実行 |
| Windows | WinAPI ARP |
| Linux | `/proc/net/arp` + arping |

## 権限

- macOS/Linux: 通常ユーザー権限で可（ARPキャッシュ参照）
- 詳細スキャン: 管理者権限が必要な場合あり

## 設定パラメータ

| パラメータ | デフォルト | 説明 |
|-----------|----------|------|
| timeout_per_ip | 500 | IP毎のタイムアウト（ms） |
| concurrent_scans | 50 | 並列スキャン数 |
| resolve_hostname | true | ホスト名解決有効 |
| lookup_vendor | true | ベンダー検索有効 |
