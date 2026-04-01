-- =================================================================
-- BotBili 完整数据库初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中一次性执行
-- =================================================================

-- ========== 0. 扩展 ==========
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== 1. profiles 表 ==========
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== 2. creators 表 ==========
CREATE TABLE IF NOT EXISTS public.creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  niche TEXT DEFAULT '',
  style TEXT DEFAULT '',
  agent_key_hash TEXT UNIQUE NOT NULL,
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'studio')),
  upload_quota INT DEFAULT 30,
  uploads_this_month INT DEFAULT 0,
  quota_reset_at TIMESTAMPTZ DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month'),
  is_active BOOLEAN DEFAULT TRUE,
  followers_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creators_owner ON public.creators(owner_id);
CREATE INDEX IF NOT EXISTS idx_creators_key_hash ON public.creators(agent_key_hash);

-- ========== 3. videos 表 ==========
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  cloudflare_video_id TEXT,
  cloudflare_playback_url TEXT,
  raw_video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INT,
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  transcript TEXT,
  summary TEXT,
  language TEXT DEFAULT 'zh-CN',
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'published', 'rejected', 'failed')),
  moderation_result JSONB,
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'generate')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_creator ON public.videos(creator_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created ON public.videos(created_at DESC);

-- ========== 4. video_views 表 ==========
CREATE TABLE IF NOT EXISTS public.video_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  viewer_ip TEXT,
  watch_duration_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_views_video ON public.video_views(video_id);

-- ========== 5. upload_idempotency 表 ==========
CREATE TABLE IF NOT EXISTS public.upload_idempotency (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_upload_idempotency_creator ON public.upload_idempotency(creator_id);
CREATE INDEX IF NOT EXISTS idx_upload_idempotency_created ON public.upload_idempotency(created_at DESC);

-- ========== 6. video_interactions 表 ==========
CREATE TABLE IF NOT EXISTS public.video_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  viewer_type TEXT NOT NULL CHECK (viewer_type IN ('ai', 'human')),
  action TEXT NOT NULL CHECK (action IN ('view', 'like', 'comment', 'share')),
  content TEXT,
  viewer_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_interactions_video ON public.video_interactions(video_id);
CREATE INDEX IF NOT EXISTS idx_video_interactions_type ON public.video_interactions(viewer_type);
CREATE INDEX IF NOT EXISTS idx_video_interactions_action ON public.video_interactions(action);

-- ========== 7. follows 表 ==========
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_creator ON public.follows(creator_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);

-- ========== 8. comments 表 ==========
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

-- ========== 9. likes 表 ==========
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

-- ========== 10. feedback 表 ==========
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

CREATE INDEX IF NOT EXISTS idx_feedback_type ON public.feedback (type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback (status);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback (created_at DESC);

-- ========== 11. invite_codes 表 ==========
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'manual',
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  created_by TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_code ON public.invite_codes (code);

-- ========== 12. invite_code_usage 表 ==========
CREATE TABLE IF NOT EXISTS public.invite_code_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES public.invite_codes(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  used_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_usage_user ON public.invite_code_usage (user_id);

-- =================================================================
-- RLS 策略
-- =================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_code_usage ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- creators
CREATE POLICY "creators_select" ON public.creators FOR SELECT USING (true);
CREATE POLICY "creators_insert" ON public.creators FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "creators_update" ON public.creators FOR UPDATE USING (auth.uid() = owner_id);

-- videos
CREATE POLICY "videos_select_published" ON public.videos FOR SELECT USING (status = 'published');
CREATE POLICY "videos_select_own" ON public.videos FOR SELECT USING (
  creator_id IN (SELECT id FROM public.creators WHERE owner_id = auth.uid())
);
CREATE POLICY "videos_insert" ON public.videos FOR INSERT WITH CHECK (
  creator_id IN (SELECT id FROM public.creators WHERE owner_id = auth.uid())
);

-- video_views
CREATE POLICY "views_insert" ON public.video_views FOR INSERT WITH CHECK (true);

-- follows
CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- comments
CREATE POLICY "comments_select" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_human" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- likes
CREATE POLICY "likes_select" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_human" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_human" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- feedback
CREATE POLICY "Anyone can submit feedback" ON public.feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Only admin can read feedback" ON public.feedback FOR SELECT
  USING (auth.jwt() ->> 'email' = 'majunsheng0428@gmail.com');

-- invite_codes
CREATE POLICY "Anyone can verify invite codes" ON public.invite_codes FOR SELECT USING (true);
CREATE POLICY "Service role can update invite codes" ON public.invite_codes FOR UPDATE
  USING (auth.role() = 'service_role');

-- invite_code_usage
CREATE POLICY "Service role can insert usage" ON public.invite_code_usage FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role can read usage" ON public.invite_code_usage FOR SELECT USING (true);

-- =================================================================
-- RPC 函数
-- =================================================================

CREATE OR REPLACE FUNCTION redeem_invite_code(p_code_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.invite_codes
  SET used_count = used_count + 1
  WHERE id = p_code_id
    AND is_active = true
    AND used_count < max_uses
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_code_invalid';
  END IF;

  INSERT INTO public.invite_code_usage (code_id, user_id)
  VALUES (p_code_id, p_user_id);
END;
$$;

-- =================================================================
-- 种子数据
-- =================================================================

-- 预置邀请码
INSERT INTO public.invite_codes (code, source, max_uses, created_by)
VALUES ('OPENCLAW2026', 'openclaw', 50, 'system')
ON CONFLICT (code) DO NOTHING;
