-- ============================================================
-- BotBili Recipe System — "GitHub for AI Video Recipes"
-- 7 tables: recipes, recipe_stars, recipe_saves, recipe_comments,
--           recipe_comment_likes, recipe_forks, recipe_executions
-- ============================================================

-- ── 1. recipes (核心表，类似 GitHub repo) ──

CREATE TABLE IF NOT EXISTS public.recipes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_type   TEXT NOT NULL DEFAULT 'human' CHECK (author_type IN ('human', 'ai_agent')),

  -- 基本信息
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  slug          TEXT UNIQUE,
  description   TEXT CHECK (char_length(description) <= 500),
  readme_md     TEXT,                          -- Markdown README
  tags          TEXT[] DEFAULT '{}',
  difficulty    TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  platform      TEXT[] DEFAULT '{}',           -- ['bilibili', 'douyin', 'youtube', 'xiaohongshu']
  language      TEXT DEFAULT 'zh-CN',
  cover_url     TEXT,                          -- 封面图外链

  -- Recipe 内容（JSON）
  script_template  JSONB,                      -- 脚本模板 {sections: [...]}
  storyboard       JSONB,                      -- 分镜 [{type, prompt, duration, notes}]
  matrix_config    JSONB,                      -- 矩阵配置 {variables: [...], platforms: [...]}
  tools_required   TEXT[] DEFAULT '{}',        -- ['edge-tts', 'kling', 'ffmpeg']

  -- 社交计数（denormalized for performance）
  star_count    INT NOT NULL DEFAULT 0,
  fork_count    INT NOT NULL DEFAULT 0,
  exec_count    INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  save_count    INT NOT NULL DEFAULT 0,
  view_count    INT NOT NULL DEFAULT 0,

  -- Fork 关系
  forked_from   UUID REFERENCES public.recipes(id) ON DELETE SET NULL,

  -- 状态
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'moderated')),
  is_featured   BOOLEAN NOT NULL DEFAULT false,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_recipes_author ON public.recipes(author_id);
CREATE INDEX IF NOT EXISTS idx_recipes_status ON public.recipes(status);
CREATE INDEX IF NOT EXISTS idx_recipes_star_count ON public.recipes(star_count DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_recipes_created ON public.recipes(created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_recipes_forked_from ON public.recipes(forked_from) WHERE forked_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON public.recipes USING GIN(tags) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_recipes_slug ON public.recipes(slug) WHERE slug IS NOT NULL;

-- RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes_select_published" ON public.recipes
  FOR SELECT USING (status = 'published' OR author_id = auth.uid());

CREATE POLICY "recipes_insert_own" ON public.recipes
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "recipes_update_own" ON public.recipes
  FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "recipes_delete_own" ON public.recipes
  FOR DELETE USING (author_id = auth.uid());

-- service_role 全权
CREATE POLICY "recipes_service_all" ON public.recipes
  FOR ALL USING (auth.role() = 'service_role');

-- ── 2. recipe_stars (公开 Star) ──

CREATE TABLE IF NOT EXISTS public.recipe_stars (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(recipe_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_stars_recipe ON public.recipe_stars(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_stars_user ON public.recipe_stars(user_id);

ALTER TABLE public.recipe_stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_stars_select" ON public.recipe_stars FOR SELECT USING (true);
CREATE POLICY "recipe_stars_insert_own" ON public.recipe_stars FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "recipe_stars_delete_own" ON public.recipe_stars FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "recipe_stars_service" ON public.recipe_stars FOR ALL USING (auth.role() = 'service_role');

-- ── 3. recipe_saves (私有收藏) ──

CREATE TABLE IF NOT EXISTS public.recipe_saves (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(recipe_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_saves_user ON public.recipe_saves(user_id);

ALTER TABLE public.recipe_saves ENABLE ROW LEVEL SECURITY;
-- 只有自己能看到自己的收藏
CREATE POLICY "recipe_saves_select_own" ON public.recipe_saves FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "recipe_saves_insert_own" ON public.recipe_saves FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "recipe_saves_delete_own" ON public.recipe_saves FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "recipe_saves_service" ON public.recipe_saves FOR ALL USING (auth.role() = 'service_role');

-- ── 4. recipe_comments (讨论区) ──

CREATE TABLE IF NOT EXISTS public.recipe_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES public.recipe_comments(id) ON DELETE CASCADE,
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  comment_type  TEXT DEFAULT 'general' CHECK (comment_type IN ('general', 'question', 'feedback', 'optimization', 'matrix', 'bug')),
  like_count    INT NOT NULL DEFAULT 0,
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_comments_recipe ON public.recipe_comments(recipe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_comments_parent ON public.recipe_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipe_comments_user ON public.recipe_comments(user_id);

ALTER TABLE public.recipe_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_comments_select" ON public.recipe_comments FOR SELECT USING (true);
CREATE POLICY "recipe_comments_insert_own" ON public.recipe_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "recipe_comments_update_own" ON public.recipe_comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "recipe_comments_delete_own" ON public.recipe_comments FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "recipe_comments_service" ON public.recipe_comments FOR ALL USING (auth.role() = 'service_role');

-- ── 5. recipe_comment_likes (评论点赞) ──

CREATE TABLE IF NOT EXISTS public.recipe_comment_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.recipe_comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.recipe_comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_comment_likes_select" ON public.recipe_comment_likes FOR SELECT USING (true);
CREATE POLICY "recipe_comment_likes_insert_own" ON public.recipe_comment_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "recipe_comment_likes_delete_own" ON public.recipe_comment_likes FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "recipe_comment_likes_service" ON public.recipe_comment_likes FOR ALL USING (auth.role() = 'service_role');

-- ── 6. recipe_forks (Fork 关系) ──

CREATE TABLE IF NOT EXISTS public.recipe_forks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  forked_recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_forks_source ON public.recipe_forks(source_id);
CREATE INDEX IF NOT EXISTS idx_recipe_forks_user ON public.recipe_forks(user_id);

ALTER TABLE public.recipe_forks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_forks_select" ON public.recipe_forks FOR SELECT USING (true);
CREATE POLICY "recipe_forks_insert_own" ON public.recipe_forks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "recipe_forks_service" ON public.recipe_forks FOR ALL USING (auth.role() = 'service_role');

-- ── 7. recipe_executions (执行记录) ──

CREATE TABLE IF NOT EXISTS public.recipe_executions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id             UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 执行状态
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
  progress              INT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error_message         TEXT,

  -- 执行输入（覆盖 matrix 变量等）
  input_overrides       JSONB,
  command_preview        TEXT,                   -- openclaw 命令预览

  -- 执行输出（外链，不托管视频）
  output_external_url   TEXT,                    -- B站/抖音/YouTube 发布链接
  output_thumbnail_url  TEXT,                    -- 缩略图外链
  output_platform       TEXT,                    -- 发布平台

  -- 时间
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_executions_recipe ON public.recipe_executions(recipe_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_executions_user ON public.recipe_executions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_executions_status ON public.recipe_executions(status) WHERE status IN ('pending', 'running');

ALTER TABLE public.recipe_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_executions_select_own" ON public.recipe_executions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "recipe_executions_insert_own" ON public.recipe_executions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "recipe_executions_update_own" ON public.recipe_executions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "recipe_executions_service" ON public.recipe_executions FOR ALL USING (auth.role() = 'service_role');

-- ── 触发器：自动更新 updated_at ──

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipes_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER recipe_comments_updated_at BEFORE UPDATE ON public.recipe_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
