# フロントエンド仕様

## 概要

React 19 + TypeScript によるシングルページアプリケーション。
Tauri IPC を通じてバックエンドと通信。

## 技術スタック

- **フレームワーク**: React 19
- **ビルドツール**: Vite 7
- **UIライブラリ**: Shadcn/ui (Radix UI ベース)
- **スタイリング**: Tailwind CSS
- **状態管理**: React useState/useEffect（ローカルステート）
- **IPC**: @tauri-apps/api

## ページ構成

| ページ | コンポーネント | 説明 |
|--------|--------------|------|
| ダッシュボード | Dashboard.tsx | メイン画面、監視状態表示 |
| 設定 | ConfigForm.tsx | デバイス・監視設定 |
| IPスキャナー | NetworkScanner.tsx | ネットワークデバイス検出 |
| フロー | FlowViewer.tsx | OSCメッセージ可視化 |
| ログ | LogViewer.tsx | システムログ表示 |

## コンポーネント仕様

- [ダッシュボード](./dashboard.md)
- [設定画面](./config-form.md)
- [IPスキャナー](./network-scanner.md)
- [フロー可視化](./flow-viewer.md)
- [システムログ](./log-viewer.md)

## 共通パターン

### Tauri IPC 呼び出し

```typescript
import { invoke } from "@tauri-apps/api/core";

// コマンド呼び出し
const result = await invoke<ReturnType>("command_name", { param1, param2 });

// イベント購読
import { listen } from "@tauri-apps/api/event";
const unlisten = await listen<PayloadType>("event_name", (event) => {
  console.log(event.payload);
});
```

### エラーハンドリング

```typescript
try {
  await invoke("command");
} catch (error) {
  console.error("Command failed:", error);
  // UIにエラー表示
}
```

### テーマ対応

ThemeProvider.tsx により light/dark テーマをサポート。
`data-theme` 属性でスタイル切替。

## ディレクトリ構造

```
src/
├── App.tsx              # ルートコンポーネント、ルーティング
├── types.ts             # 型定義
├── components/
│   ├── Dashboard.tsx
│   ├── ConfigForm.tsx
│   ├── NetworkScanner.tsx
│   ├── FlowViewer.tsx
│   ├── LogViewer.tsx
│   ├── StatusCard.tsx
│   ├── ThemeProvider.tsx
│   └── ui/              # Shadcn/ui コンポーネント
└── main.tsx             # エントリーポイント
```
