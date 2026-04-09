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

-- ============================================================
-- Alignment patch: keep existing schema compatible, then补齐 Prompt 02 所需字段
-- ============================================================

-- ── recipes 字段补齐 ──

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS readme_json JSONB,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT '{}'::TEXT[];

UPDATE public.recipes
SET readme_json = to_jsonb(readme_md)
WHERE readme_json IS NULL
  AND readme_md IS NOT NULL;

UPDATE public.recipes
SET platforms = COALESCE(platform, '{}'::TEXT[])
WHERE platforms IS NULL
   OR cardinality(platforms) = 0;

UPDATE public.recipes
SET slug = CONCAT('recipe-', SUBSTRING(id::TEXT FROM 1 FOR 8))
WHERE slug IS NULL OR BTRIM(slug) = '';

UPDATE public.recipes
SET status = 'archived'
WHERE status = 'moderated';

ALTER TABLE public.recipes
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN visibility SET DEFAULT 'public',
  ALTER COLUMN platforms SET DEFAULT '{}'::TEXT[];

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.recipes'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%author_type%'
        OR pg_get_constraintdef(oid) ILIKE '%difficulty%'
        OR pg_get_constraintdef(oid) ILIKE '%status%'
        OR pg_get_constraintdef(oid) ILIKE '%visibility%'
      )
  LOOP
    EXECUTE FORMAT('ALTER TABLE public.recipes DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recipes_author_type_check'
      AND conrelid = 'public.recipes'::regclass
  ) THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT recipes_author_type_check
      CHECK (author_type IN ('human', 'ai_agent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recipes_status_check'
      AND conrelid = 'public.recipes'::regclass
  ) THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT recipes_status_check
      CHECK (status IN ('draft', 'published', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recipes_visibility_check'
      AND conrelid = 'public.recipes'::regclass
  ) THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT recipes_visibility_check
      CHECK (visibility IN ('public', 'unlisted', 'private'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recipes_difficulty_check'
      AND conrelid = 'public.recipes'::regclass
  ) THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT recipes_difficulty_check
      CHECK (difficulty IN ('beginner', 'intermediate', 'advanced'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recipes_visibility ON public.recipes(visibility);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON public.recipes(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipes_platforms ON public.recipes USING GIN(platforms);

-- ── recipe_stars / recipe_saves 已有唯一约束，无需结构补齐 ──

-- ── recipe_forks 字段补齐 ──

ALTER TABLE public.recipe_forks
  ADD COLUMN IF NOT EXISTS original_recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE;

UPDATE public.recipe_forks
SET original_recipe_id = source_id
WHERE original_recipe_id IS NULL
  AND source_id IS NOT NULL;

ALTER TABLE public.recipe_forks
  ALTER COLUMN original_recipe_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recipe_forks_original_recipe ON public.recipe_forks(original_recipe_id);

-- ── recipe_comments 字段/约束补齐 ──

UPDATE public.recipe_comments
SET comment_type = 'question'
WHERE comment_type IS NULL
   OR comment_type NOT IN ('question', 'feedback', 'optimization', 'matrix', 'bug');

ALTER TABLE public.recipe_comments
  ALTER COLUMN comment_type SET DEFAULT 'question';

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.recipe_comments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%comment_type%'
  LOOP
    EXECUTE FORMAT('ALTER TABLE public.recipe_comments DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recipe_comments_comment_type_check'
      AND conrelid = 'public.recipe_comments'::regclass
  ) THEN
    ALTER TABLE public.recipe_comments
      ADD CONSTRAINT recipe_comments_comment_type_check
      CHECK (comment_type IN ('question', 'feedback', 'optimization', 'matrix', 'bug'));
  END IF;
END $$;

-- ── recipe_executions 字段/约束补齐 ──

ALTER TABLE public.recipe_executions
  ADD COLUMN IF NOT EXISTS progress_pct INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS command_text TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.recipe_executions
SET progress_pct = COALESCE(progress, 0)
WHERE progress_pct IS NULL;

UPDATE public.recipe_executions
SET command_text = command_preview
WHERE command_text IS NULL
  AND command_preview IS NOT NULL;

UPDATE public.recipe_executions
SET status = 'failed'
WHERE status = 'cancelled';

ALTER TABLE public.recipe_executions
  ALTER COLUMN progress_pct SET DEFAULT 0,
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.recipe_executions'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%status%'
        OR pg_get_constraintdef(oid) ILIKE '%progress%'
      )
  LOOP
    EXECUTE FORMAT('ALTER TABLE public.recipe_executions DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recipe_executions_status_check'
      AND conrelid = 'public.recipe_executions'::regclass
  ) THEN
    ALTER TABLE public.recipe_executions
      ADD CONSTRAINT recipe_executions_status_check
      CHECK (status IN ('pending', 'running', 'script_done', 'edit_done', 'publishing', 'success', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recipe_executions_progress_pct_check'
      AND conrelid = 'public.recipe_executions'::regclass
  ) THEN
    ALTER TABLE public.recipe_executions
      ADD CONSTRAINT recipe_executions_progress_pct_check
      CHECK (progress_pct BETWEEN 0 AND 100);
  END IF;
END $$;

-- ── updated_at 触发器补齐（executions 额外补齐，便于轮询） ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'recipe_executions_updated_at'
      AND tgrelid = 'public.recipe_executions'::regclass
  ) THEN
    CREATE TRIGGER recipe_executions_updated_at
      BEFORE UPDATE ON public.recipe_executions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ── 计数器触发函数 ──

CREATE OR REPLACE FUNCTION public.handle_recipe_stars_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recipes
    SET star_count = star_count + 1
    WHERE id = NEW.recipe_id;
    RETURN NEW;
  END IF;

  UPDATE public.recipes
  SET star_count = GREATEST(star_count - 1, 0)
  WHERE id = OLD.recipe_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_recipe_saves_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recipes
    SET save_count = save_count + 1
    WHERE id = NEW.recipe_id;
    RETURN NEW;
  END IF;

  UPDATE public.recipes
  SET save_count = GREATEST(save_count - 1, 0)
  WHERE id = OLD.recipe_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_recipe_forks_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recipes
    SET fork_count = fork_count + 1
    WHERE id = NEW.original_recipe_id;
    RETURN NEW;
  END IF;

  UPDATE public.recipes
  SET fork_count = GREATEST(fork_count - 1, 0)
  WHERE id = OLD.original_recipe_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_recipe_comments_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recipes
    SET comment_count = comment_count + 1
    WHERE id = NEW.recipe_id;
    RETURN NEW;
  END IF;

  UPDATE public.recipes
  SET comment_count = GREATEST(comment_count - 1, 0)
  WHERE id = OLD.recipe_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_recipe_comment_likes_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recipe_comments
    SET like_count = like_count + 1
    WHERE id = NEW.comment_id;
    RETURN NEW;
  END IF;

  UPDATE public.recipe_comments
  SET like_count = GREATEST(like_count - 1, 0)
  WHERE id = OLD.comment_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_recipe_execution_success_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' AND COALESCE(OLD.status, '') <> 'success' THEN
    UPDATE public.recipes
    SET exec_count = exec_count + 1
    WHERE id = NEW.recipe_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 计数器触发器 ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'recipe_stars_counter_trigger'
      AND tgrelid = 'public.recipe_stars'::regclass
  ) THEN
    CREATE TRIGGER recipe_stars_counter_trigger
      AFTER INSERT OR DELETE ON public.recipe_stars
      FOR EACH ROW EXECUTE FUNCTION public.handle_recipe_stars_counter();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'recipe_saves_counter_trigger'
      AND tgrelid = 'public.recipe_saves'::regclass
  ) THEN
    CREATE TRIGGER recipe_saves_counter_trigger
      AFTER INSERT OR DELETE ON public.recipe_saves
      FOR EACH ROW EXECUTE FUNCTION public.handle_recipe_saves_counter();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'recipe_forks_counter_trigger'
      AND tgrelid = 'public.recipe_forks'::regclass
  ) THEN
    CREATE TRIGGER recipe_forks_counter_trigger
      AFTER INSERT OR DELETE ON public.recipe_forks
      FOR EACH ROW EXECUTE FUNCTION public.handle_recipe_forks_counter();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'recipe_comments_counter_trigger'
      AND tgrelid = 'public.recipe_comments'::regclass
  ) THEN
    CREATE TRIGGER recipe_comments_counter_trigger
      AFTER INSERT OR DELETE ON public.recipe_comments
      FOR EACH ROW EXECUTE FUNCTION public.handle_recipe_comments_counter();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'recipe_comment_likes_counter_trigger'
      AND tgrelid = 'public.recipe_comment_likes'::regclass
  ) THEN
    CREATE TRIGGER recipe_comment_likes_counter_trigger
      AFTER INSERT OR DELETE ON public.recipe_comment_likes
      FOR EACH ROW EXECUTE FUNCTION public.handle_recipe_comment_likes_counter();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'recipe_execution_success_counter_trigger'
      AND tgrelid = 'public.recipe_executions'::regclass
  ) THEN
    CREATE TRIGGER recipe_execution_success_counter_trigger
      AFTER UPDATE OF status ON public.recipe_executions
      FOR EACH ROW EXECUTE FUNCTION public.handle_recipe_execution_success_counter();
  END IF;
END $$;

-- ── RLS 对齐补丁 ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipes'
      AND policyname = 'recipes_select_public_visible_restrictive'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "recipes_select_public_visible_restrictive"
      ON public.recipes
      AS RESTRICTIVE
      FOR SELECT
      USING (
        author_id = auth.uid()
        OR (status = 'published' AND visibility = 'public')
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipes'
      AND policyname = 'recipes_author_all'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "recipes_author_all"
      ON public.recipes
      FOR ALL
      USING (author_id = auth.uid())
      WITH CHECK (author_id = auth.uid())
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_stars'
      AND policyname = 'recipe_stars_all_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "recipe_stars_all_own"
      ON public.recipe_stars
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_saves'
      AND policyname = 'recipe_saves_all_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "recipe_saves_all_own"
      ON public.recipe_saves
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_comments'
      AND policyname = 'recipe_comments_select_public_recipes'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "recipe_comments_select_public_recipes"
      ON public.recipe_comments
      AS RESTRICTIVE
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.recipes recipe_row
          WHERE recipe_row.id = recipe_comments.recipe_id
            AND (
              recipe_row.author_id = auth.uid()
              OR (recipe_row.status = 'published' AND recipe_row.visibility = 'public')
            )
        )
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_comments'
      AND policyname = 'recipe_comments_all_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "recipe_comments_all_own"
      ON public.recipe_comments
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_executions'
      AND policyname = 'recipe_executions_all_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "recipe_executions_all_own"
      ON public.recipe_executions
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_comment_likes'
      AND policyname = 'recipe_comment_likes_all_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "recipe_comment_likes_all_own"
      ON public.recipe_comment_likes
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())
    $policy$;
  END IF;
END $$;
