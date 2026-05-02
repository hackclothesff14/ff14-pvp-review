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

COMMENT ON TABLE public.tactics_documents IS '戦術ページの編集内容。doc_key=main の1ドキュメント運用。';
COMMENT ON COLUMN public.tactics_documents.doc_key IS 'ドキュメント識別子（現状 main 固定）';
COMMENT ON COLUMN public.tactics_documents.basic_sections IS '基本戦術セクション配列 JSON';
COMMENT ON COLUMN public.tactics_documents.map_tactics IS 'マップ別戦術 JSON（key=mapName, value=text）';
