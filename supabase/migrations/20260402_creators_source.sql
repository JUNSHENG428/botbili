ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'human';

CREATE INDEX IF NOT EXISTS idx_creators_source_date
  ON public.creators (source, created_at);
