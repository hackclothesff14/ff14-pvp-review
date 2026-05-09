-- 戦術ページ：対戦チーム別の戦略・対策メモ
CREATE TABLE IF NOT EXISTS public.opponent_team_tactics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.opponent_team_tactics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon opponent_team_tactics"
  ON public.opponent_team_tactics
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for authenticated opponent_team_tactics"
  ON public.opponent_team_tactics
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.opponent_team_tactics IS '戦術ページの対戦チーム別メモ。1行が1チーム。';
COMMENT ON COLUMN public.opponent_team_tactics.team_name IS '表示名（一覧に出すチーム名）';
COMMENT ON COLUMN public.opponent_team_tactics.content IS '戦略・対策などの本文';
