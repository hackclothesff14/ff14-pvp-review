# DB の準備（Supabase）

このアプリで使うテーブルは次の2つです。Supabase の **SQL Editor** で順に実行してください。

---

## 1. 許可メール用テーブル（allowed_emails）

すでに作成済みの場合はスキップしてかまいません。

```sql
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email text PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can check own email in allowed list"
  ON public.allowed_emails
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt() ->> 'email');

COMMENT ON TABLE public.allowed_emails IS 'ログインを許可するメールアドレス一覧。';
```

---

## 2. 反省会用テーブル（reviews）

**SQL Editor** で「New query」を開き、次の SQL だけを貼り付けて **Run** する（\`\`\` は含めない）。

```sql
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  review_date date NOT NULL,
  opponent text NOT NULL DEFAULT '',
  members text NOT NULL DEFAULT '',
  jobs text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  video_url text NOT NULL DEFAULT ''
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon (public access)"
  ON public.reviews
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for authenticated"
  ON public.reviews
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.reviews IS 'PVP反省会の記録。';
COMMENT ON COLUMN public.reviews.review_date IS '試合日付';
COMMENT ON COLUMN public.reviews.opponent IS '対戦相手';
COMMENT ON COLUMN public.reviews.members IS 'メンバー（カンマ区切りなど）';
COMMENT ON COLUMN public.reviews.jobs IS 'ジョブ（カンマ区切りなど）';
COMMENT ON COLUMN public.reviews.content IS '反省内容';
COMMENT ON COLUMN public.reviews.video_url IS '動画URL';
```

---

## 3. 試合結果用カラムの追加（reviews.matches）

すでに **reviews** テーブルがある場合、試合ごとの結果を保存するために次の SQL を実行してください。**\`\`\` は含めず**にコピーして Run します。

```sql
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS matches text NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.reviews.matches IS '試合結果の配列 JSON';
```

---

## テーブル一覧

| テーブル          | 用途 |
|-------------------|------|
| **allowed_emails** | ログインを許可するメールアドレス（認証制限を有効にするときに使用） |
| **reviews**        | 反省会の記録（日付・対戦相手・メンバー・ジョブ・反省内容・動画URL） |

### reviews のカラム

| カラム       | 型     | 説明 |
|--------------|--------|------|
| id           | uuid   | 主キー（自動採番） |
| created_at   | timestamptz | 作成日時 |
| review_date  | date   | 試合日付 |
| opponent     | text   | 対戦相手 |
| members      | text   | メンバー（複数はカンマ区切りなどで保存） |
| jobs         | text   | ジョブ（同様） |
| content      | text   | 反省内容 |
| video_url    | text   | 動画URL |
| matches      | text   | 試合結果の配列（JSON 文字列） |

---

## 注意

- 貼り付けるときは **\`\`\`sql と \`\`\` の行は含めず**、SQL の部分だけをコピーしてください。
- **reviews** は現状、RLS で「誰でも閲覧・編集可能」にしています。認証と許可メール制限を再度有効にしたあと、ポリシーを「allowed_emails のユーザーのみ」に変更する想定です。
