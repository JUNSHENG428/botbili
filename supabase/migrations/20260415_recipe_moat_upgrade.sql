-- =================================================================
-- Recipe moat upgrade:
-- 1. recipe_executions 执行闭环字段
-- 2. recipes 效果统计字段
-- 3. 贡献者声誉体系
-- 4. Fork 链路补全
-- =================================================================

-- 1) recipe_executions 执行闭环字段

ALTER TABLE public.recipe_executions
  ADD COLUMN IF NOT EXISTS duration_seconds INT,
  ADD COLUMN IF NOT EXISTS output_video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS output_metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS fork_depth INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_execution_id UUID REFERENCES public.recipe_executions(id) ON DELETE SET NULL;

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.recipe_executions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE FORMAT('ALTER TABLE public.recipe_executions DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;
END $$;

ALTER TABLE public.recipe_executions
  ADD CONSTRAINT recipe_executions_status_check
  CHECK (
    status IN (
      'pending',
      'running',
      'script_done',
      'edit_done',
      'publishing',
      'success',
      'completed',
      'failed',
      'cancelled'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recipe_executions_fork_depth_check'
      AND conrelid = 'public.recipe_executions'::regclass
  ) THEN
    ALTER TABLE public.recipe_executions
      ADD CONSTRAINT recipe_executions_fork_depth_check
      CHECK (fork_depth BETWEEN 0 AND 10);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recipe_executions_recipe_id ON public.recipe_executions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_executions_user_id ON public.recipe_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_executions_status_all ON public.recipe_executions(status);

COMMENT ON COLUMN public.recipe_executions.duration_seconds IS '执行耗时（秒）';
COMMENT ON COLUMN public.recipe_executions.output_video_id IS 'BotBili 内部视频记录，供执行结果和视频资产关联';
COMMENT ON COLUMN public.recipe_executions.output_metrics IS '执行产出效果数据，默认不对公开接口返回商业敏感字段';
COMMENT ON COLUMN public.recipe_executions.notes IS '执行备注，例如用户改了哪些参数';
COMMENT ON COLUMN public.recipe_executions.fork_depth IS '执行链路的 Fork 深度';
COMMENT ON COLUMN public.recipe_executions.parent_execution_id IS '当前执行从哪次历史执行演化而来';

-- 2) recipes 效果统计字段

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS execution_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_rate NUMERIC(4, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_duration_seconds INT,
  ADD COLUMN IF NOT EXISTS effect_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forked_from_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fork_depth INT NOT NULL DEFAULT 0;

UPDATE public.recipes
SET forked_from_id = forked_from
WHERE forked_from_id IS NULL
  AND forked_from IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recipes_fork_depth_check'
      AND conrelid = 'public.recipes'::regclass
  ) THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT recipes_fork_depth_check
      CHECK (fork_depth BETWEEN 0 AND 10);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recipes_effect_score ON public.recipes(effect_score DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_execution_count ON public.recipes(execution_count DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_success_rate ON public.recipes(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_last_executed_at ON public.recipes(last_executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_forked_from_id ON public.recipes(forked_from_id) WHERE forked_from_id IS NOT NULL;

-- 3) 贡献者声誉体系

CREATE TABLE IF NOT EXISTS public.user_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INT NOT NULL DEFAULT 0,
  recipe_points INT NOT NULL DEFAULT 0,
  execution_points INT NOT NULL DEFAULT 0,
  review_points INT NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'newcomer'
    CHECK (level IN ('newcomer', 'contributor', 'expert', 'master', 'legend')),
  level_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.reputation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INT NOT NULL,
  reason TEXT NOT NULL,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_user ON public.user_reputation(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_total ON public.user_reputation(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_log_user ON public.reputation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_log_reason ON public.reputation_log(reason);
CREATE INDEX IF NOT EXISTS idx_reputation_log_created_at ON public.reputation_log(created_at DESC);

ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reputation_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_reputation'
      AND policyname = 'user_reputation_select_public'
  ) THEN
    CREATE POLICY "user_reputation_select_public" ON public.user_reputation
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_reputation'
      AND policyname = 'user_reputation_service_all'
  ) THEN
    CREATE POLICY "user_reputation_service_all" ON public.user_reputation
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reputation_log'
      AND policyname = 'reputation_log_select_own'
  ) THEN
    CREATE POLICY "reputation_log_select_own" ON public.reputation_log
      FOR SELECT USING (user_id = auth.uid() OR auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reputation_log'
      AND policyname = 'reputation_log_service_all'
  ) THEN
    CREATE POLICY "reputation_log_service_all" ON public.reputation_log
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'user_reputation_updated_at'
      AND tgrelid = 'public.user_reputation'::regclass
  ) THEN
    CREATE TRIGGER user_reputation_updated_at
      BEFORE UPDATE ON public.user_reputation
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- 4) Fork 链路补全

ALTER TABLE public.recipe_forks
  ADD COLUMN IF NOT EXISTS forked_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.recipe_forks
SET forked_by = user_id
WHERE forked_by IS NULL
  AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_forks_original_forked_unique
  ON public.recipe_forks(original_recipe_id, forked_recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_forks_forked_recipe ON public.recipe_forks(forked_recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_forks_forked_by ON public.recipe_forks(forked_by);

COMMENT ON COLUMN public.recipes.execution_count IS '非取消状态的执行总数';
COMMENT ON COLUMN public.recipes.success_rate IS '完成率，范围 0.000 ~ 1.000';
COMMENT ON COLUMN public.recipes.avg_duration_seconds IS '完成执行的平均耗时（秒）';
COMMENT ON COLUMN public.recipes.effect_score IS 'Recipe 综合效果分，驱动效果榜与推荐';
COMMENT ON COLUMN public.recipes.last_executed_at IS '最近一次执行时间';
COMMENT ON COLUMN public.recipes.forked_from_id IS 'Fork 链路的直接上游 Recipe';
COMMENT ON COLUMN public.recipes.fork_depth IS 'Recipe Fork 深度，最大值 10';
