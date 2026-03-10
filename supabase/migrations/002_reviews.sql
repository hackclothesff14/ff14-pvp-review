-- 反省会記録用テーブル
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

-- RLS を有効化
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 現状: URL を知っていれば誰でも閲覧・編集可能
-- 認証を有効にしたら、このポリシーを「allowed_emails のユーザーのみ」に差し替える
CREATE POLICY "Allow all for anon (public access)"
  ON public.reviews
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 認証済みユーザーも同様に全操作を許可（ログイン有効時用）
CREATE POLICY "Allow all for authenticated"
  ON public.reviews
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.reviews IS 'PVP反省会の記録。日付・対戦相手・メンバー・ジョブ・反省内容・動画URL。';
COMMENT ON COLUMN public.reviews.review_date IS '試合日付';
COMMENT ON COLUMN public.reviews.opponent IS '対戦相手';
COMMENT ON COLUMN public.reviews.members IS 'メンバー（カンマ区切りなど）';
COMMENT ON COLUMN public.reviews.jobs IS 'ジョブ（カンマ区切りなど）';
COMMENT ON COLUMN public.reviews.content IS '反省内容';
COMMENT ON COLUMN public.reviews.video_url IS '動画URL';
