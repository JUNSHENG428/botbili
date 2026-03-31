-- Day 8: OAuth + owner 体系迁移

-- 1) creators.owner_email -> creators.owner_id
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS owner_id UUID;

-- 2) 尝试通过 profiles.email 回填 owner_id（仅当历史数据可匹配）
UPDATE public.creators AS c
SET owner_id = p.id
FROM public.profiles AS p
WHERE c.owner_id IS NULL
  AND c.owner_email IS NOT NULL
  AND lower(c.owner_email) = lower(p.email);

-- 3) 约束与外键
ALTER TABLE public.creators
  ALTER COLUMN owner_id SET NOT NULL;

ALTER TABLE public.creators
  ADD CONSTRAINT creators_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4) 删除历史字段
ALTER TABLE public.creators
  DROP COLUMN IF EXISTS owner_email;

-- 5) RLS 示例（如已存在策略，请按需调整后再执行）
-- DROP POLICY IF EXISTS creators_insert ON public.creators;
-- DROP POLICY IF EXISTS creators_update ON public.creators;
-- CREATE POLICY creators_insert ON public.creators
--   FOR INSERT WITH CHECK (auth.uid() = owner_id);
-- CREATE POLICY creators_update ON public.creators
--   FOR UPDATE USING (auth.uid() = owner_id);
