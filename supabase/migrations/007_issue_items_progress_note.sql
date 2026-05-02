-- 課題の進捗状況（自由記述）
ALTER TABLE public.issue_items
  ADD COLUMN IF NOT EXISTS progress_note text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.issue_items.progress_note IS '進捗の状況をテキストで記録';
