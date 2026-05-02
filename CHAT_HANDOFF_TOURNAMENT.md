# チャット引き継ぎ（現状 + 次の機能案 / Stella Note）

このドキュメントは、次のエージェントが **現状を正確に把握**し、すぐに開発へ入れるようにまとめた引き継ぎメモです。

## 現状（ここまでで実現できていること）

TOP画面で「スクリム」と「大会」をタブ切り替えでき、`大会` タブでは大会用の入力体験になっている。

- TOP: タブ（`スクリム` / `大会`）
- 新規追加: `大会` タブ時は `reviews/new?type=tournament` に遷移
- 大会フォーム:
  - 「+ 対戦相手を追加」で **対戦相手入力 + 試合1件**がセットで増える
  - 対戦相手ごとに外枠（カード）でセクション分け
  - 「+ 試合を追加」は **自動引き継ぎしない**（引き継ぎは「前の試合を引き継ぐ」押下時のみ）
  - フォーム下部に「大会結果」（`result_summary`）入力欄
- TOP（大会一覧）:
  - 「試合結果（勝ち数/試合数）」と「大会結果（`result_summary`）」を別列で表示
- 離脱確認:
  - 未変更の状態で戻る場合は確認を出さない（誤検知しないよう改善）

## 実装の要点（ファイル別）

### TOP画面

- `src/app/page.tsx`
  - 取得結果を `record_type` で `scrimReviews` / `tournamentReviews` に分岐
  - `TopPageWithTabs` を使用
- `src/app/TopPageWithTabs.tsx`
  - タブ UI（スクリム / 大会）
  - `大会` タブの一覧は「試合結果」と「大会結果」を別列で表示

### 大会モード判定・保存（ReviewForm）

- `src/app/reviews/ReviewForm.tsx`
  - `?type=tournament` または `initial.record_type === 'tournament'` を `isTournamentMode` として判定
  - 保存時: `payload.record_type` を付与
  - 大会: `tournamentGroups`（対戦相手 + matches）で管理し、保存時はフラット化して `matches` に保存
  - 大会結果: `result_summary` に保存
  - 未保存判定: contentEditable の正規化差などで誤検知しないよう baseline 比較
  - `+ 試合を追加`: `getDefaultMatch()`（自動でメンバー引き継ぎしない）

### 新規追加ページ

- `src/app/reviews/new/page.tsx`
  - Next.js 16 の `searchParams`（Promise）を `async/await` で展開
  - `tournamentMode` を `ReviewForm` に渡す

### データモデル（Supabase）

- `supabase/migrations/004_reviews_record_type.sql`
  - `reviews` に `record_type`（`scrim` / `tournament`）と `result_summary` を追加
- `src/lib/types.ts`
  - `Review` に `record_type` / `result_summary` を追加
- `src/lib/constants.ts`
  - `MatchResult` に `opponent_name` を含める（大会用）
  - `parseMatchResults` / `serializeMatchResults` で `opponent_name` を保存・復元

## 重要: Supabase 側の反映（必須）

`record_type` / `result_summary` が無い DB だと保存時にエラーになる。

- エラー例: `Could not find the 'record_type' column of 'reviews' in the schema cache`
- 対処: Supabase の SQL Editor で `supabase/migrations/004_reviews_record_type.sql` を実行（もしくは CLI の `supabase db push`）

## ローカル開発の注意

- まず全 `next dev` を止める（Ctrl+C）
- 次に「1つのポートだけ」で起動する

---

## 次の機能案（保留）: スケジュール管理ツール

スケジュール管理ツールはアイデアとしては有望だが、**いったん保留**にして別の機能開発を優先する。
次のエージェントは、ここは着手せず、別途指示された機能から進めること。

### 目標（メモ）

- メンバーがツール上でスケジュール入力
- リーダーが活動日を確定
- 確定したら Discord にメッセージが飛ぶ
- カレンダー表示で活動日が確認できる

※「調整さん」連携も選択肢。ただし外部依存（API有無/仕様変更）リスクがあるので、MVPは自前が安全。

### MVP（参考・後回し）

1. イベント作成（候補日を複数登録、締切 optional）
2. メンバーが各候補日に「参加可/不可/未定」を入力
3. 集計表示（参加人数順）
4. リーダーが 1 つを確定
5. 確定時に Discord Webhook 通知
6. アプリ内カレンダー（月表示など）に確定日を表示

### 画面案（参考・後回し）

- `/schedule`（カレンダー / 確定済み一覧）
- `/schedule/new`（イベント作成）
- `/schedule/[id]`（候補日への投票/入力）
- `/schedule/[id]/manage`（リーダー用: 集計と確定）

### データ設計案（参考・後回し）

- `schedule_events`
  - `id uuid pk`
  - `title text`
  - `description text`（任意）
  - `created_at timestamptz`
  - `created_by uuid`（Auth 使うなら）
  - `status text`（`draft|open|finalized|cancelled` など）
  - `finalized_candidate_id uuid null`
  - `discord_channel_name text null`（表示用。実際の送信は webhook）
- `schedule_candidates`
  - `id uuid pk`
  - `event_id uuid fk`
  - `starts_at timestamptz`（or `date + time`）
  - `ends_at timestamptz null`
- `schedule_votes`
  - `id uuid pk`
  - `event_id uuid fk`
  - `candidate_id uuid fk`
  - `member_name text`（現状アプリの雰囲気に合わせて簡易に）
  - `availability text`（`yes|no|maybe`）
  - `comment text null`
  - unique 制約: `(candidate_id, member_name)` など

※ 認証を入れるなら `member_name` を `user_id` に置換。

### Discord 通知（参考・後回し）

- Discord Webhook URL を環境変数で持つ（例: `DISCORD_SCHEDULE_WEBHOOK_URL`）
- 確定 API（Route Handler）で webhook POST
- まずは「確定しました」通知だけでOK（後で編集/取り消し通知も追加可能）

### 未確定事項（参考・後回し）

- 単発イベントのみか、毎週固定（定期）も扱うか
- タイムゾーン（JST固定でOKか）
- リーダー判定方法（メール許可制 / 役職 / 固定メンバーなど）
- 確定後の再調整を許可するか（再通知が必要）

### 次のエージェントが着手する順番（参考・後回し）

1. Supabase テーブル作成（マイグレーション）
2. イベント作成フォーム
3. 投票 UI（候補日一覧）
4. 管理 UI（集計 + 確定）
5. Discord webhook 通知
6. カレンダー表示

