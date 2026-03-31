ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS transcript text,
ADD COLUMN IF NOT EXISTS summary text,
ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'zh-CN';
