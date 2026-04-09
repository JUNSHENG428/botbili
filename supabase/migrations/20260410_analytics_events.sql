CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  properties jsonb DEFAULT '{}'::jsonb,
  page_url text,
  referrer text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_name_idx
  ON public.analytics_events(event_name);

CREATE INDEX IF NOT EXISTS analytics_events_created_idx
  ON public.analytics_events(created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'analytics_events'
      AND policyname = 'allow_insert'
  ) THEN
    CREATE POLICY "allow_insert"
      ON public.analytics_events
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;
