# ダッシュボード仕様

## 概要

アプリケーションのメイン画面。デバイスの死活状態表示、カスタムボタン、カスタムモニターを提供。

## 機能要件

### 1. デバイスステータス表示

- 監視対象デバイスの一覧をカード形式で表示
- 各デバイスの状態（Online/Offline）をリアルタイム表示
- 最終応答時刻の表示
- 状態変化時の視覚的フィードバック（色変更、アニメーション）

### 2. カスタムボタン

設定されたカスタムボタンを表示し、クリックでOSCメッセージを送信。

| モード | 動作 |
|--------|------|
| Momentary | クリックで1回送信 |
| Toggle | クリックでON/OFF切替、状態を視覚表示 |
| Periodic | 開始/停止ボタン、実行中はインジケータ表示 |
| Value | スライダーUI、値変更時に送信 |

### 3. カスタムモニター

OSCメッセージを受信し、値をリアルタイム表示。

- 監視アドレスごとにカード表示
- 閾値超過時の警告表示
- 値のフォーマット（単位、マッピング）

### 4. 監視制御

- 監視開始/停止ボタン
- 監視状態のインジケータ

## UI構成

```
┌─────────────────────────────────────────────────┐
│  [監視開始/停止]                    [設定] [テーマ] │
├─────────────────────────────────────────────────┤
│  デバイスステータス                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Device 1 │ │ Device 2 │ │ Device 3 │         │
│  │ ● Online │ │ ○ Offline│ │ ● Online │         │
│  └──────────┘ └──────────┘ └──────────┘         │
├─────────────────────────────────────────────────┤
│  カスタムボタン                                   │
│  [Play] [Stop] [■ Toggle] [Slider: ====○===]    │
├─────────────────────────────────────────────────┤
│  カスタムモニター                                 │
│  ┌──────────────┐ ┌──────────────┐              │
│  │ CPU: 45%     │ │ Temp: 72°C   │              │
│  └──────────────┘ └──────────────┘              │
└─────────────────────────────────────────────────┘
```

## Tauri IPC

### 使用コマンド

| コマンド | 説明 |
|---------|------|
| `start_monitoring` | 監視開始 |
| `stop_monitoring` | 監視停止 |
| `get_statuses` | 現在のステータス取得 |
| `send_osc` | OSCメッセージ送信 |

### 購読イベント

| イベント | ペイロード | 説明 |
|---------|-----------|------|
| `status_update` | `Record<string, PCStatus>` | ステータス更新 |
| `monitor_value` | `MonitorValueEvent` | モニター値更新 |

## 状態管理

```typescript
// コンポーネント状態
const [statuses, setStatuses] = useState<Record<string, PCStatus>>({});
const [isMonitoring, setIsMonitoring] = useState(false);
const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({});
const [periodicRunning, setPeriodicRunning] = useState<Record<string, boolean>>({});
const [monitorValues, setMonitorValues] = useState<Record<string, MonitorValue>>({});
```

## 実装ポイント

1. **イベントリスナーのクリーンアップ**: useEffectのreturnでunlisten
2. **パフォーマンス**: 大量のステータス更新に対応するためのメモ化
3. **エラー表示**: OSC送信失敗時のトースト通知
