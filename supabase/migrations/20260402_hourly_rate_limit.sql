CREATE TABLE IF NOT EXISTS public.hourly_upload_limits (
  key_hash TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hourly_limits_reset ON public.hourly_upload_limits(reset_at);

ALTER TABLE public.hourly_upload_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hourly_limits_service_select ON public.hourly_upload_limits;
DROP POLICY IF EXISTS hourly_limits_service_insert ON public.hourly_upload_limits;
DROP POLICY IF EXISTS hourly_limits_service_update ON public.hourly_upload_limits;

CREATE POLICY hourly_limits_service_select ON public.hourly_upload_limits
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY hourly_limits_service_insert ON public.hourly_upload_limits
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY hourly_limits_service_update ON public.hourly_upload_limits
  FOR UPDATE USING (auth.role() = 'service_role');
