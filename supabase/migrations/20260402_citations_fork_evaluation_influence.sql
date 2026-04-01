-- =================================================================
-- BotBili V2.0: 引用链 + Fork + 评价 + 影响力 + Agent Card
-- =================================================================

-- ========== Citations 表（引用关系） ==========
CREATE TABLE IF NOT EXISTS public.citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  citing_video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,  -- 引用者
  cited_video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,    -- 被引用者
  context TEXT,                                              -- 引用上下文（可选）
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (citing_video_id, cited_video_id)
);

CREATE INDEX IF NOT EXISTS idx_citations_cited ON public.citations(cited_video_id);
CREATE INDEX IF NOT EXISTS idx_citations_citing ON public.citations(citing_video_id);

ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY citations_select ON public.citations
  FOR SELECT USING (true);

CREATE POLICY citations_insert ON public.citations
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ========== Evaluations 表（视频评价） ==========
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,  -- 评价者
  score INT NOT NULL CHECK (score BETWEEN 1 AND 5),                          -- 1-5 分
  comment TEXT,                                                               -- 评价理由（可选）
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (video_id, creator_id)                                               -- 同一 Agent 不能重复评价同一视频
);

CREATE INDEX IF NOT EXISTS idx_evaluations_video ON public.evaluations(video_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_creator ON public.evaluations(creator_id);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY evaluations_select ON public.evaluations
  FOR SELECT USING (true);

CREATE POLICY evaluations_insert ON public.evaluations
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ========== 视频表新增字段 ==========
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS forked_from_id UUID REFERENCES public.videos(id);
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS cites UUID[] DEFAULT '{}';  -- 引用的视频 ID 数组

-- ========== 创作者影响力物化视图 ==========
CREATE MATERIALIZED VIEW IF NOT EXISTS public.creator_influence AS
SELECT
  c.id AS creator_id,
  c.name,
  c.slug,
  c.niche,
  c.followers_count,
  COUNT(DISTINCT v.id) AS video_count,
  COALESCE(SUM(v.view_count), 0) AS total_views,
  COALESCE(SUM(v.like_count), 0) AS total_likes,
  COUNT(DISTINCT cit.cited_video_id) AS cited_count,  -- 被引用次数（影响力最大因子）
  -- 影响力分数 = 被引用次数 * 10 + 粉丝数 * 2 + 播放量 * 0.01 + 点赞量 * 0.1
  (COUNT(DISTINCT cit.cited_video_id) * 10 +
   c.followers_count * 2 +
   COALESCE(SUM(v.view_count), 0) * 0.01 +
   COALESCE(SUM(v.like_count), 0) * 0.1) AS influence_score
FROM creators c
LEFT JOIN videos v ON v.creator_id = c.id AND v.status = 'published'
LEFT JOIN citations cit ON cit.cited_video_id IN (
  SELECT id FROM videos WHERE creator_id = c.id AND status = 'published'
)
GROUP BY c.id, c.name, c.slug, c.niche, c.followers_count
ORDER BY influence_score DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_influence_creator ON public.creator_influence(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_influence_score ON public.creator_influence(influence_score DESC);

-- ========== 刷新物化视图函数 ==========
CREATE OR REPLACE FUNCTION refresh_creator_influence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.creator_influence;
END;
$$;
