-- 試合ごとの結果を保存するカラムを追加（JSON 文字列）
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS matches text NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.reviews.matches IS '試合結果の配列 JSON: [{ map, result, crystal_self, crystal_opponent, ot_situation, end_minutes, end_seconds, is_ot }, ...]';
