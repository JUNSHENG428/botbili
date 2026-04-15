-- Fix: recipes 表缺失 visibility/platforms/category/readme_json 列
-- 这些列被代码引用但原始 migration 未创建
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public','unlisted','private'));
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT '{}';
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS readme_json JSONB;

-- Fix: recipe_executions 表缺失 command_text/output/updated_at 列
ALTER TABLE public.recipe_executions ADD COLUMN IF NOT EXISTS command_text TEXT;
ALTER TABLE public.recipe_executions ADD COLUMN IF NOT EXISTS output JSONB;
ALTER TABLE public.recipe_executions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Fix: profiles 表缺失 username 列
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
