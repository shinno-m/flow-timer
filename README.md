# Flow

朝のタスク管理 + ポモドーロタイマー。黒背景・iOS時計アプリ風・セージグリーンのアクセント。

- タスクを複数行で貼り付けて1日のセットを作成
- タップで 25分集中 → 5分休憩 を自動切替、手動で次のタスクへ
- ★ で最優先（リスト先頭へ）
- 完了タスクは完了エリアへ移動し所要時間（積算）を記録
- 完了タスクの長押し（約2.5秒）で未完了に復活
- データは localStorage に保存（リロードしても消えない）
- PWA 対応：ホーム画面に追加でアプリ起動、Service Worker でオフライン起動可能
- iPhone Safari 向けに片手操作しやすいレイアウト（safe-area 対応・操作ボタンを下部に固定）

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm run build    # 本番ビルド (dist/)
npm run preview  # ビルド結果をプレビュー
```

## 公開

`main` ブランチへ push すると GitHub Actions が自動ビルドして GitHub Pages へデプロイします
（リポジトリ設定 → Pages → Source を "GitHub Actions" に設定）。

公開 URL: `https://<user>.github.io/flow-timer/`

ベースパスは `vite.config.js` の `BASE`（`/flow-timer/`）。リポジトリ名を変える場合はここも合わせて変更してください。
