-- 課題ページ（一覧 + 詳細スライドパネル用）
CREATE TABLE IF NOT EXISTS public.issue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '未着手',
  progress integer NOT NULL DEFAULT 0,
  CONSTRAINT issue_items_progress_range CHECK (progress >= 0 AND progress <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.issue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon issue_items"
  ON public.issue_items
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for authenticated issue_items"
  ON public.issue_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.issue_items IS '課題管理。1行が1課題。';
COMMENT ON COLUMN public.issue_items.progress IS '進捗 0〜100';
