CREATE TABLE IF NOT EXISTS public.invite_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL,
  agent_framework TEXT DEFAULT 'unknown',
  purpose TEXT,
  contact_email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  invite_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invite_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invite_applications_insert ON public.invite_applications;
DROP POLICY IF EXISTS invite_applications_select_admin ON public.invite_applications;

CREATE POLICY invite_applications_insert
  ON public.invite_applications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY invite_applications_select_admin
  ON public.invite_applications
  FOR SELECT
  USING (auth.role() = 'service_role');
