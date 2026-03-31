-- Day 10: 评论独立表 + 点赞独立表
-- 从 video_interactions 拆分为独立一级实体

-- ========== 评论表 ==========
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_key_hash TEXT,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  viewer_type TEXT NOT NULL DEFAULT 'human' CHECK (viewer_type IN ('human', 'ai')),
  viewer_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_video ON public.comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id);

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0;

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_human" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ========== 点赞表 ==========
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_key_hash TEXT,
  viewer_type TEXT NOT NULL DEFAULT 'human' CHECK (viewer_type IN ('human', 'ai')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT likes_unique_human UNIQUE (video_id, user_id),
  CONSTRAINT likes_unique_ai UNIQUE (video_id, agent_key_hash)
);
CREATE INDEX IF NOT EXISTS idx_likes_video ON public.likes(video_id);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_human" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_human" ON public.likes FOR DELETE USING (auth.uid() = user_id);
