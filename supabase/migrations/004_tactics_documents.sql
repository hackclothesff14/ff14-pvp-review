-- 戦術ページの保存データ（基本戦術 + マップ別戦術）
CREATE TABLE IF NOT EXISTS public.tactics_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_key text NOT NULL UNIQUE,
  basic_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  map_tactics jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tactics_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon tactics"
  ON public.tactics_documents
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for authenticated tactics"
  ON public.tactics_documents
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
