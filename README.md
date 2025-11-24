# OSC Alive Monitoring App

OSC (Open Sound Control) を使用した死活監視アプリケーションです。
ターゲットPCへのPing送信による監視、OSCメッセージによる制御、Slackへの通知機能を備えています。

## 機能

- **死活監視**: 設定されたターゲットPCに対して定期的にPing (OSCメッセージ) を送信し、応答がない場合にOFFLINEと判定します。
- **OSC制御**: カスタムボタンを作成し、任意のOSCメッセージを送信できます。
- **ロジック機能**: ターゲットのステータス変化（ONLINE/OFFLINE）をトリガーとして、自動的にOSCメッセージを送信できます。
- **Slack通知**: ステータス変化時にSlackへ通知を送信できます。
- **モダンなUI**: React + Shadcn/ui + Tailwind CSS による使いやすいインターフェース。

## 必要要件

- Node.js (v20以上推奨)
- Rust (最新の安定版)
  - インストール: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

## インストールと起動

1.  **リポジトリのクローン**:
    ```bash
    git clone <repository-url>
    cd DeadAliveMonitoringApp
    ```

2.  **依存関係のインストール**:
    ```bash
    npm install
    ```

3.  **開発モードで起動**:
    ```bash
    npm run tauri dev
    ```

4.  **本番ビルド**:
    ```bash
    npm run tauri build
    ```
    ビルドされたアプリケーションは `src-tauri/target/release/bundle` 配下に生成されます。

## 使い方

### 1. デバイス登録 (Devices)
- 「Devices」タブで、管理対象のデバイス（PCや機器）を登録します。
- 名前、IPアドレス、ポート番号を入力して追加します。
- リスト最上部には、このアプリを実行しているPCのローカルIPが表示されます。

### 2. 監視ターゲット設定 (Targets)
- 「Targets」タブで、登録済みデバイスの中から監視したい対象にチェックを入れます。
- チェックを入れたデバイスに対してのみ、Ping送信と死活監視が行われます。

### 3. 設定 (Settings)
- **Local Port**: アプリがOSCを受信するためのポート番号を設定します（デフォルト: 9000）。
- **Interval**: Pingを送信する間隔（ミリ秒）。
- **Timeout**: 応答がない場合にOFFLINEと判定するまでの時間（ミリ秒）。
- **Ping/Pong**: 監視に使用するOSCアドレスと引数をカスタマイズできます。
- **Slack Notification**: Webhook URLと通知メッセージのテンプレートを設定できます。

### 4. カスタムボタン (Buttons)
- 「Buttons」タブで、手動でOSCメッセージを送信するためのボタンを作成できます。
- 送信先は登録済みデバイスから選択します。
- Momentary（押した時のみ）とToggle（ON/OFF切り替え）のモードが選べます。

### 5. ロジック (Logics)
- 「Logics」タブで、自動化ルールを設定できます。
- 例: 「PC1がOFFLINEになったら、Button A（予備機への切り替えコマンド）を実行する」といった設定が可能です。

## 技術スタック

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn/ui
- **Backend**: Rust (Tauri), rosc (OSC library), reqwest (HTTP client)
- **Build Tool**: Tauri CLI

## ライセンス

MIT
