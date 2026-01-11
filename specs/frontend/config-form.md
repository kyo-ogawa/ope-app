# 設定画面仕様

## 概要

アプリケーションの全設定を管理するフォーム画面。

## 設定セクション

### 1. デバイス設定

監視・制御対象デバイスの登録・編集・削除。

| フィールド | 型 | 必須 | バリデーション |
|-----------|---|-----|---------------|
| name | string | Yes | 1-50文字 |
| ip | string | Yes | 有効なIPv4アドレス |
| port | number | Yes | 1-65535 |

**UI**:
- デバイス一覧テーブル
- 追加ボタン → モーダルダイアログ
- 編集・削除ボタン（各行）
- IPスキャナーから追加ボタン

### 2. 監視設定

| フィールド | 型 | デフォルト | 説明 |
|-----------|---|----------|------|
| monitoredDeviceIds | string[] | [] | 監視対象デバイス |
| localPort | number | 9000 | ローカル受信ポート |
| interval | number | 5000 | 監視間隔（ms） |
| timeout | number | 3000 | タイムアウト（ms） |
| pingAddress | string | "/ping" | Pingアドレス |
| pingArgs | OscArg[] | [] | Ping引数 |
| pongAddress | string | "/pong" | Pongアドレス |
| pongArgs | OscArg[] | [] | Pong引数 |

### 3. カスタムボタン設定

カスタムボタンの作成・編集。

**共通フィールド**:
| フィールド | 型 | 必須 |
|-----------|---|-----|
| label | string | Yes |
| description | string | No |
| mode | ButtonMode | Yes |
| deviceIds | string[] | Yes |
| address | string | Yes |
| args | OscArg[] | No |

**モード別フィールド**:

- **Toggle**: addressOff, argsOff
- **Periodic**: periodicInterval
- **Value**: valueType, valueMin, valueMax, valueDefault, valueStep

### 4. カスタムモニター設定

OSC監視ポイントの設定。

| フィールド | 型 | 必須 |
|-----------|---|-----|
| name | string | Yes |
| address | string | Yes |
| deviceIds | string[] | Yes |
| args | MonitorArgDefinition[] | Yes |
| enabled | boolean | Yes |

**MonitorArgDefinition**:
| フィールド | 型 | 説明 |
|-----------|---|------|
| name | string | 引数名 |
| argType | string | 型 |
| unit | string | 単位 |
| valueMapping | object | 値マッピング |
| warningThreshold | number | 警告閾値 |
| criticalThreshold | number | 危険閾値 |
| enableSlackNotification | boolean | Slack通知 |

### 5. ロジック設定

自動実行ルールの設定。

| フィールド | 型 | 説明 |
|-----------|---|------|
| name | string | ルール名 |
| targetIds | string[] | 監視対象デバイス |
| triggerStatus | string | トリガー条件（online/offline） |
| actionButtonId | string | 実行ボタン |
| enabled | boolean | 有効/無効 |

### 6. プロファイル管理

- プロファイル名入力
- 保存ボタン
- 読み込みボタン
- プロファイル一覧の選択

### 7. Slack設定

| フィールド | 型 | 説明 |
|-----------|---|------|
| webhookUrl | string | Slack Webhook URL |
| alertMessage | string | オフライン通知テンプレート |
| recoveryMessage | string | 復旧通知テンプレート |

## UI構成

```
┌─────────────────────────────────────────────────┐
│  設定                                [保存] [キャンセル] │
├─────────────────────────────────────────────────┤
│  [タブ: デバイス | 監視 | ボタン | モニター | ロジック | Slack] │
├─────────────────────────────────────────────────┤
│                                                 │
│  (選択されたタブの内容)                           │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Tauri IPC

| コマンド | 説明 |
|---------|------|
| `load_config` | 設定読み込み |
| `save_config` | 設定保存 |

## 状態管理

```typescript
const [config, setConfig] = useState<MonitorConfig | null>(null);
const [isDirty, setIsDirty] = useState(false);
const [activeTab, setActiveTab] = useState("devices");
```

## バリデーション

- IPアドレス: `/^(\d{1,3}\.){3}\d{1,3}$/` + 各オクテット0-255
- ポート: 1-65535の整数
- OSCアドレス: `/^\/\S+$/`
- Webhook URL: 有効なHTTPS URL

## 保存フロー

1. フォームバリデーション
2. `save_config` 呼び出し
3. 成功 → 設定画面を閉じる / ダッシュボードに戻る
4. 失敗 → エラーメッセージ表示
