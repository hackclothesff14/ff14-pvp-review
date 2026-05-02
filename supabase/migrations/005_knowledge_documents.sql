-- 知識ページの共有メモ（タイトル + 本文の行配列）
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_key text NOT NULL UNIQUE,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon knowledge"
  ON public.knowledge_documents
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for authenticated knowledge"
  ON public.knowledge_documents
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.knowledge_documents IS '知識ページの共有メモ。doc_key=main の1ドキュメント運用。';
COMMENT ON COLUMN public.knowledge_documents.entries IS '行配列 JSON: [{ id, title, body }, ...]';
