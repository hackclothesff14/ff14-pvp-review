-- 許可されたメールアドレスを管理するテーブル
-- ここに登録されているメールのユーザーのみがアプリにアクセスできる
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email text PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS を有効化
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーが「自分のメールがリストに含まれるか」だけ確認できる
-- （自分の行だけ読める＝許可されているかチェックできる）
CREATE POLICY "Users can check own email in allowed list"
  ON public.allowed_emails
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt() ->> 'email');

-- 追加・削除はダッシュボード（service_role）からのみ行う想定
-- anon / authenticated からは INSERT/UPDATE/DELETE 不可（ポリシーなし＝拒否）

-- コメント
COMMENT ON TABLE public.allowed_emails IS 'ログインを許可するメールアドレス一覧。ここに登録されたユーザーのみがアプリを利用できる。';
