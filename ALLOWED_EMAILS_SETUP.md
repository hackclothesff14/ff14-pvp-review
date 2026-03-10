# 許可メールアドレス制限の設定

このアプリは、**allowed_emails テーブルに登録されたメールアドレス**のユーザーだけが閲覧・利用できます。  
まず Supabase でテーブルを作成し、あなたのメールを1件登録してください。

---

## 1. Supabase でテーブルを作成

1. **Supabase ダッシュボード** を開き、対象プロジェクトを選択する。
2. 左メニュー **「SQL Editor」** を開く。
3. **「New query」** で新しいクエリを開く。
4. 次の SQL をコピーして貼り付け、**「Run」** で実行する。

```sql
-- 許可されたメールアドレスを管理するテーブル
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

5. エラーが出ずに完了すれば、**allowed_emails** テーブルが作成されています。

---

## 2. 自分のメールアドレスを1件登録する

1. 左メニュー **「Table Editor」** を開く。
2. **「allowed_emails」** テーブルを選択する。
3. **「Insert」** → **「Insert row」** をクリックする。
4. **email** の欄に、**あなたの Google ログイン用メールアドレス** を入力する（例: `yourname@gmail.com`）。
5. **「Save」** で保存する。

これで、そのメールでログインしたときだけアプリにアクセスできるようになります。

---

## 3. あとから他のメンバーを追加する

- **Table Editor** で **allowed_emails** を開き、**「Insert row」** で **email** を追加するだけです。
- 追加したメールアドレスで Google ログインしているユーザーは、次回からアプリを利用できるようになります。

---

## 4. 動作確認

1. 開発サーバーでアプリを起動し、**http://localhost:3000/login** または **http://localhost:3001/login** を開く。
2. **Google でログイン** する。
3. **allowed_emails に登録したメール**でログインしている場合 → トップ（または元のページ）に進む。
4. **登録していないメール**でログインしている場合 → **「アクセスできません」** のページ（/access-denied）にリダイレクトされる。

「アクセスできません」と出る場合は、Supabase の **allowed_emails** に、そのログイン中のメールアドレスを1件追加してください。
