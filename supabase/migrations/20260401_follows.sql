-- Day 9: follows + followers_count

CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_creator ON public.follows(creator_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);

ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS followers_count INT NOT NULL DEFAULT 0;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_select ON public.follows;
DROP POLICY IF EXISTS follows_insert ON public.follows;
DROP POLICY IF EXISTS follows_delete ON public.follows;

CREATE POLICY follows_select ON public.follows
  FOR SELECT USING (true);

CREATE POLICY follows_insert ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY follows_delete ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);
