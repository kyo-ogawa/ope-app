# フロー可視化仕様

## 概要

OSCメッセージの送受信をリアルタイムで可視化する画面。

## 機能要件

### 1. フローキャプチャ

送受信されるOSCメッセージをキャプチャしてリスト表示。

### 2. フィルタリング

- 方向（Incoming/Outgoing/All）
- アドレスパターン
- 送信元/送信先IP

### 3. メッセージ詳細

選択したメッセージの詳細表示。

### 4. クリア・エクスポート

- ログクリア
- CSV/JSONエクスポート

## UI構成

```
┌─────────────────────────────────────────────────┐
│  フロー可視化                    [開始/停止] [クリア] │
├─────────────────────────────────────────────────┤
│  フィルタ: [All ▼] [アドレス: ________]          │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐   │
│  │ ← 192.168.1.10:9000  /status [1, "ok"]  │   │
│  │ → 192.168.1.20:8000  /play [1]          │   │
│  │ ← 192.168.1.10:9000  /pong []           │   │
│  │ → 192.168.1.20:8000  /ping []           │   │
│  └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│  詳細:                                          │
│  Timestamp: 2024-01-15 10:30:45.123            │
│  Direction: Incoming                            │
│  Source: 192.168.1.10:9000                     │
│  Address: /status                               │
│  Args: [Int(1), String("ok")]                  │
└─────────────────────────────────────────────────┘
```

## データ構造

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

## Tauri IPC

### コマンド

| コマンド | 説明 |
|---------|------|
| `start_flow_capture` | キャプチャ開始 |
| `stop_flow_capture` | キャプチャ停止 |

### イベント

| イベント | ペイロード |
|---------|-----------|
| `osc_flow` | OscFlowEvent |

## 状態管理

```typescript
const [isCapturing, setIsCapturing] = useState(false);
const [events, setEvents] = useState<OscFlowEvent[]>([]);
const [filter, setFilter] = useState({
  direction: "all",
  addressPattern: "",
});
const [selectedEvent, setSelectedEvent] = useState<OscFlowEvent | null>(null);
```

## パフォーマンス考慮

- 最大保持件数: 1000件（古いものから削除）
- 仮想スクロール実装
- フィルタリングはメモ化
