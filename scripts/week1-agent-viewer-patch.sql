-- Week1 patch: upload 扩展字段 + 幂等表 + AI/Human 互动表

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'zh-CN';

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
