-- 20260402: 为 video_interactions 和 upload_idempotency 添加 RLS 策略

-- video_interactions RLS
ALTER TABLE public.video_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS video_interactions_select ON public.video_interactions;
DROP POLICY IF EXISTS video_interactions_insert ON public.video_interactions;

CREATE POLICY video_interactions_select ON public.video_interactions
  FOR SELECT USING (true);

CREATE POLICY video_interactions_insert ON public.video_interactions
  FOR INSERT WITH CHECK (true);

-- upload_idempotency RLS
ALTER TABLE public.upload_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS upload_idempotency_select ON public.upload_idempotency;
DROP POLICY IF EXISTS upload_idempotency_insert ON public.upload_idempotency;

CREATE POLICY upload_idempotency_select ON public.upload_idempotency
  FOR SELECT USING (true);

CREATE POLICY upload_idempotency_insert ON public.upload_idempotency
  FOR INSERT WITH CHECK (true);
