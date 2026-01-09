# システムログ仕様

## 概要

アプリケーションのログをリアルタイム表示する画面。

## 機能要件

### 1. ログ表示

- タイムスタンプ
- ログレベル（Info/Warn/Error）
- メッセージ

### 2. フィルタリング

- ログレベルでフィルタ
- キーワード検索

### 3. 自動スクロール

新しいログが追加されたら自動で最下部にスクロール。
トグルで無効化可能。

## UI構成

```
┌─────────────────────────────────────────────────┐
│  システムログ              [クリア] [⬇️ 自動スクロール] │
├─────────────────────────────────────────────────┤
│  レベル: [All ▼]  検索: [______________]        │
├─────────────────────────────────────────────────┤
│  10:30:45 [INFO]  監視を開始しました             │
│  10:30:46 [INFO]  Device1: Online               │
│  10:31:00 [WARN]  Device2: 応答なし              │
│  10:31:05 [ERROR] Device2: Offline              │
│  10:31:05 [INFO]  Slack通知を送信しました        │
└─────────────────────────────────────────────────┘
```

## データ構造

```typescript
interface LogEntry {
  timestamp: string;  // ISO 8601
  level: "info" | "warn" | "error";
  message: string;
}
```

## Tauri IPC

### イベント

| イベント | ペイロード |
|---------|-----------|
| `log_entry` | LogEntry |

## 状態管理

```typescript
const [logs, setLogs] = useState<LogEntry[]>([]);
const [filter, setFilter] = useState({
  level: "all",
  keyword: "",
});
const [autoScroll, setAutoScroll] = useState(true);
```

## スタイリング

| レベル | 色 |
|-------|---|
| info | 通常テキスト |
| warn | 黄色/オレンジ |
| error | 赤 |

## パフォーマンス

- 最大保持件数: 500件
- 仮想スクロール推奨
