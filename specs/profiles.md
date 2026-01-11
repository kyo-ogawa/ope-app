# プロファイル機能仕様

## Summary

基本セッティング(設定画面)の全設定をプロファイルとして保存・読み込みし、案件ごとの切り替えを容易にする。

## Scope

- In-scope
  - 設定画面の全データをプロファイルとして保存
  - プロファイル一覧の取得と切り替え
  - GUIからの保存/読み込み操作
- Out-of-scope
  - プロファイルの共有/同期
  - 差分マージ

## UX

- 設定画面にプロファイル管理セクションを追加
- UI要素
  - プロファイル一覧(Select)
  - 保存ボタン
  - 読み込みボタン
  - 名前入力フィールド
- 読み込み時は現在の設定を置換し、即時反映する

## Data Model

### Profile

```json
{
  "name": "String",
  "config": "MonitorConfig"
}
```

- `config` は設定画面の全項目(= MonitorConfig)をそのまま保存
- ストレージ: `app_config_dir/profiles/<name>.json`

### Profile name validation

- 前後空白をトリム
- 空文字は不可
- パス区切り文字や制御文字を含まない

## Commands/Events

### list_profiles

- 戻り値: `string[]` (名前一覧、昇順)

### save_profile

- 引数: `name: string`, `config: MonitorConfig`
- 副作用: `profiles/<name>.json` を上書き保存

### load_profile

- 引数: `name: string`
- 戻り値: `MonitorConfig`

## Error Handling

- 不正な名前: 入力エラーとしてUIに表示
- 読み込み失敗: 既存設定は保持
- 保存失敗: 現在のフォーム状態は保持

## Acceptance

- 保存ボタンで現在の設定がプロファイルとして保存される
- 一覧から選択して読み込みを実行すると設定が反映される
- 既存プロファイルは一覧から選択可能
- 不正な名前の保存はエラーメッセージを表示する
- 既存の設定保存(load_config/save_config)と共存する
