-- スクリム / 大会 を区別するカラムを追加
-- ※ Supabase ダッシュボードの SQL Editor で実行するか、supabase db push で適用してください
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'scrim';

-- 大会の「試合結果」用（例: 優勝, 2位 など）
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS result_summary text;

COMMENT ON COLUMN public.reviews.record_type IS 'scrim=スクリム, tournament=大会';
COMMENT ON COLUMN public.reviews.result_summary IS '大会の試合結果（任意）';
