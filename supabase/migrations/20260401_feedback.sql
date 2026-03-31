-- 反馈系统
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'partnership', 'general')),
  source TEXT NOT NULL DEFAULT 'human' CHECK (source IN ('human', 'agent')),

  name TEXT,
  email TEXT,
  agent_id TEXT,

  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  page_url TEXT,
  user_agent TEXT,

  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'closed')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only admin can read feedback"
  ON public.feedback FOR SELECT
  USING (auth.jwt() ->> 'email' = 'majunsheng0428@gmail.com');

CREATE INDEX IF NOT EXISTS idx_feedback_type ON public.feedback (type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback (status);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback (created_at DESC);
