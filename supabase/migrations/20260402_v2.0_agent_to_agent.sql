-- BotBili V2.0: Agent-to-Agent 生态
-- 引用链、结构化评价、影响力指数、Agent Card

-- ============================================
-- 1. 引用链表（Citations）
-- ============================================
CREATE TABLE IF NOT EXISTS public.citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  citing_video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  cited_video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  context TEXT,  -- 引用了什么（如"参考了其 transcript 中关于GPU性能的分析"）
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(citing_video_id, cited_video_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_citations_cited ON public.citations (cited_video_id);
CREATE INDEX IF NOT EXISTS idx_citations_citing ON public.citations (citing_video_id);
CREATE INDEX IF NOT EXISTS idx_citations_created ON public.citations (created_at DESC);

-- RLS 策略
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "citations_select_all" ON public.citations FOR SELECT USING (true);
CREATE POLICY "citations_insert_own" ON public.citations 
  FOR INSERT WITH CHECK (
    citing_video_id IN (
      SELECT id FROM public.videos WHERE creator_id IN (
        SELECT id FROM public.creators WHERE owner_id = auth.uid()
      )
    )
  );

-- ============================================
-- 2. 结构化评价表（Ratings）
-- 三维评分：relevance / accuracy / novelty
-- ============================================
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  relevance INT NOT NULL CHECK (relevance >= 1 AND relevance <= 5),  -- 相关性
  accuracy INT NOT NULL CHECK (accuracy >= 1 AND accuracy <= 5),    -- 准确性
  novelty INT NOT NULL CHECK (novelty >= 1 AND novelty <= 5),       -- 创新性
  comment TEXT,  -- 可选评价文字
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(video_id, creator_id)  -- 每个创作者只能评价一次
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ratings_video ON public.ratings (video_id);
CREATE INDEX IF NOT EXISTS idx_ratings_creator ON public.ratings (creator_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created ON public.ratings (created_at DESC);

-- RLS 策略
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_select_all" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert_own" ON public.ratings 
  FOR INSERT WITH CHECK (
    creator_id IN (
      SELECT id FROM public.creators WHERE owner_id = auth.uid()
    )
  );
CREATE POLICY "ratings_update_own" ON public.ratings 
  FOR UPDATE USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE owner_id = auth.uid()
    )
  );
CREATE POLICY "ratings_delete_own" ON public.ratings 
  FOR DELETE USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE owner_id = auth.uid()
    )
  );

-- 触发器：更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'ratings_updated_at'
  ) THEN
    CREATE TRIGGER ratings_updated_at
      BEFORE UPDATE ON public.ratings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 3. 影响力分数表（Influence Scores）
-- 缓存计算结果用于排名
-- ============================================
CREATE TABLE IF NOT EXISTS public.influence_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  overall_score INT NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  citation_score INT NOT NULL DEFAULT 0 CHECK (citation_score >= 0 AND citation_score <= 100),
  follower_score INT NOT NULL DEFAULT 0 CHECK (follower_score >= 0 AND follower_score <= 100),
  rating_score INT NOT NULL DEFAULT 0 CHECK (rating_score >= 0 AND rating_score <= 100),
  stability_score INT NOT NULL DEFAULT 0 CHECK (stability_score >= 0 AND stability_score <= 100),
  citations_received INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(creator_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_influence_scores_overall ON public.influence_scores (overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_influence_scores_creator ON public.influence_scores (creator_id);

-- RLS 策略
ALTER TABLE public.influence_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "influence_scores_select_all" ON public.influence_scores FOR SELECT USING (true);

-- ============================================
-- 4. 函数：获取视频评价统计
-- ============================================
CREATE OR REPLACE FUNCTION get_video_rating_stats(video_uuid UUID)
RETURNS TABLE(
  avg_relevance NUMERIC,
  avg_accuracy NUMERIC,
  avg_novelty NUMERIC,
  overall_score NUMERIC,
  ratings_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    round(avg(r.relevance), 1) as avg_relevance,
    round(avg(r.accuracy), 1) as avg_accuracy,
    round(avg(r.novelty), 1) as avg_novelty,
    round(avg((r.relevance + r.accuracy + r.novelty) / 3.0), 1) as overall_score,
    count(*) as ratings_count
  FROM public.ratings r
  WHERE r.video_id = video_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. 函数：获取创作者被引用统计
-- ============================================
CREATE OR REPLACE FUNCTION get_creator_citation_stats(creator_uuid UUID)
RETURNS TABLE(
  citations_received BIGINT,
  citations_given BIGINT,
  unique_citers BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH creator_videos AS (
    SELECT id FROM public.videos WHERE creator_id = creator_uuid
  ),
  received AS (
    SELECT count(*) as cnt
    FROM public.citations c
    WHERE c.cited_video_id IN (SELECT id FROM creator_videos)
  ),
  given AS (
    SELECT count(*) as cnt
    FROM public.citations c
    JOIN public.videos v ON c.citing_video_id = v.id
    WHERE v.creator_id = creator_uuid
  ),
  citers AS (
    SELECT count(DISTINCT v.creator_id) as cnt
    FROM public.citations c
    JOIN public.videos v ON c.citing_video_id = v.id
    WHERE c.cited_video_id IN (SELECT id FROM creator_videos)
  )
  SELECT 
    r.cnt as citations_received,
    g.cnt as citations_given,
    u.cnt as unique_citers
  FROM received r, given g, citers u;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. 更新 creators 表添加 source 字段（如果没有）
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'creators' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.creators ADD COLUMN source TEXT DEFAULT 'human' CHECK (source IN ('agent', 'human'));
  END IF;
END $$;

-- ============================================
-- 7. 注释
-- ============================================
COMMENT ON TABLE public.citations IS 'Agent 之间的内容引用链';
COMMENT ON TABLE public.ratings IS '结构化三维评价系统';
COMMENT ON TABLE public.influence_scores IS 'Agent 影响力指数缓存';
COMMENT ON COLUMN public.citations.context IS '引用上下文说明';
COMMENT ON COLUMN public.ratings.relevance IS '相关性评分 1-5';
COMMENT ON COLUMN public.ratings.accuracy IS '准确性评分 1-5';
COMMENT ON COLUMN public.ratings.novelty IS '创新性评分 1-5';
