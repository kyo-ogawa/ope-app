# ope-app 仕様書

## 概要

OSC (Open Sound Control) を使用した統合監視・制御アプリケーション。
ターゲットデバイスの死活監視、OSCメッセージによる制御、ネットワークスキャン、フロー可視化、Slack通知機能を提供。

## 仕様ドキュメント構成

```
specs/
├── index.md                    # この文書（仕様概要）
├── profiles.md                 # プロファイル機能
├── shared/
│   └── models.md               # 共通データモデル・型定義
├── frontend/
│   ├── index.md                # フロントエンド仕様概要
│   ├── dashboard.md            # ダッシュボード機能
│   ├── config-form.md          # 設定画面
│   ├── network-scanner.md      # IPスキャナー
│   ├── flow-viewer.md          # フロー可視化
│   └── log-viewer.md           # システムログ
└── backend/
    ├── index.md                # バックエンド仕様概要
    ├── osc-service.md          # OSC送受信サービス
    ├── monitor.md              # 死活監視サービス
    ├── network-scanner.md      # ネットワークスキャン
    └── commands.md             # Tauri IPC コマンド
```

## 技術スタック

### フロントエンド
- React 19 + TypeScript
- Vite 7
- Shadcn/ui (Radix UI)
- Tailwind CSS

### バックエンド
- Tauri 2.x
- Rust
- rosc (OSC)
- reqwest (HTTP)

## 主要機能

1. **死活監視** - OSC Ping/Pongによるデバイス監視
2. **カスタムボタン** - Momentary/Toggle/Periodic/Value モード
3. **カスタムモニター** - OSCメッセージのリアルタイム監視
4. **IPスキャナー** - ARP ベースのデバイス検出
5. **フロー可視化** - メッセージフローの可視化
6. **ロジック** - ステータス変化トリガーによる自動実行
7. **Slack通知** - Webhook による通知

## 関連ドキュメント

- [共通データモデル](./shared/models.md)
- [フロントエンド仕様](./frontend/index.md)
- [バックエンド仕様](./backend/index.md)
