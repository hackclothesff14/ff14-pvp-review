# チャット引き継ぎ（大会タブ追加 / Stella Note）

このドキュメントは、チャットが長くなってきたため「これまでの状況と続き」を次のチャットで引き継ぐ目的で作成しています。

## 目的（いま実現したいこと）

TOP画面で「スクリム」と「大会」をタブ切り替えし、`大会` タブでは大会用の入力体験になるようにする。

- 「日付」の上あたりにタブ（`スクリム` / `大会`）を追加
- `分析` ボタンと `対戦相手でフィルタ` は（タブ分だけ）少し上に寄せる
- `スクリム` タブ: 既存どおりの一覧（日付・対戦相手・試合結果・操作）
- `大会` タブ: 日付・大会名・試合結果・操作を並べる
- `大会` タブから `新規追加` した先は大会モード（ただしフォームのベースはスクリム踏襲でOK）
- 大会モードの `ReviewForm`:
  - 「対戦相手を追加」ボタンを大会では使いやすい位置に出す（ユーザー要望: `各試合分析` の下ではなく、`試合` セクションの `+ 試合を追加` の直下 など）
  - 「対戦相手（この大会）」の下に試合（例: 試合1）が表示されること

## 実装済み（コード上の変更点）

### TOP画面
- `src/app/page.tsx`
  - TOP一覧の取得結果を `record_type` で `scrimReviews` / `tournamentReviews` に分岐
  - `TopPageWithTabs` を使用するように変更
- `src/app/TopPageWithTabs.tsx`
  - タブ UI（スクリム / 大会）を追加
  - `大会` タブでは大会一覧を表示（大会名は `opponent`、試合結果は `result_summary` / fallback で `matches` 集計）

### 大会モード判定・保存（ReviewForm）
- `src/app/reviews/ReviewForm.tsx`
  - `?type=tournament` または既存データの `initial.record_type === 'tournament'` を `isTournamentMode` として判定
  - 新規保存時に `payload.record_type = 'tournament'` を付与（URLの `type=tournament` を参照）
  - `MatchResult` に `opponent_name`（大会用の対戦相手名）を追加し、`matches` JSONの各試合に保存する方向で実装
  - 大会モードでは、`+ 対戦相手を追加` を押すまでは試合カードや分析の表示を隠す（`hidden` / ラッパー条件）形で安定化を試行中

### データモデル（Supabase / JSON形式）
- `app/supabase/migrations/004_reviews_record_type.sql`
  - `reviews` に `record_type`（`scrim` / `tournament`）と `result_summary` を追加
- `src/lib/types.ts`
  - `Review` に `record_type` / `result_summary` を追加（型対応）
- `src/lib/constants.ts`
  - `MatchResult` に `opponent_name?` を追加
  - `parseMatchResults` / `serializeMatchResults` で `opponent_name` を保存・復元するよう対応

## 重要: Supabase 側の反映状況

- 追加したマイグレーション `004_reviews_record_type.sql` は、現時点では「本番/開発DBに適用済みかどうか」が未確定です。
- 次のどちらかが必要です。
  - Supabase の SQL Editor で `004_reviews_record_type.sql` の内容を実行
  - もしくは `supabase db push` 等で適用

## ローカルでの注意（前提）

ローカル開発では `next dev` を複数ポートで起動してしまうと、古いビルドが見える/反映されない等が起きやすいです。

- まず全 `next dev` を止める
- 次に「1つのポートだけ」で起動する（例: `-p 3004` など）
- そのポートで `http://127.0.0.1:ポート/reviews/new?type=tournament` を確認する

## 現時点の「未確定/要調整」ポイント（引き継ぎのため残す）

- 大会モードの `ReviewForm` UI:
  - ユーザー要望どおりに「ボタンの位置」「対戦相手（この大会）の直下に試合1」が常に再現されるか（ローカルの起動状況に依存して見え方が変わり得る）
  - `各試合分析` の表示条件（`対戦相手を追加` しない間に非表示になっているか）

## 次にやること（このドキュメントを読んだ後）

1. まずローカルで大会モードを開く: `.../reviews/new?type=tournament`
2. `+ 対戦相手を追加` を押した後に
   - 「対戦相手（この大会）」が出る
   - その直下に「試合1」が出る
   - `各試合分析` が意図通りのタイミングで出る
   を確認する
3. その結果をもとに、UIの条件/配置（ボタンの位置や隠す範囲）を微調整する
4. 問題なければ、必要なマイグレーション反映→コミット→`main` push→本番反映

