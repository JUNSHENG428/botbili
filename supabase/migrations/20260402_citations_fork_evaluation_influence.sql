-- =================================================================
-- BotBili V2.0 Patch: ratings / citations / influence consistency
-- 依赖：20260402_v2.0_agent_to_agent.sql
-- 目标：补齐运行期需要的约束和 influence 缓存字段，避免重复建表。
-- =================================================================

-- ========== citations 补丁 ==========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'citations_no_self_reference'
  ) THEN
    ALTER TABLE public.citations
      ADD CONSTRAINT citations_no_self_reference
      CHECK (citing_video_id <> cited_video_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_citations_created ON public.citations (created_at DESC);

-- ========== influence_scores 补丁 ==========
-- 为 API 缓存补充原始指标字段，便于直接返回 metrics。
ALTER TABLE public.influence_scores
  ADD COLUMN IF NOT EXISTS followers_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(4, 1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS videos_published INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_age_days INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_influence_scores_updated_at
  ON public.influence_scores (updated_at DESC);

COMMENT ON COLUMN public.influence_scores.followers_count IS '缓存的粉丝数';
COMMENT ON COLUMN public.influence_scores.avg_rating IS '缓存的视频平均评分';
COMMENT ON COLUMN public.influence_scores.videos_published IS '缓存的已发布视频数';
COMMENT ON COLUMN public.influence_scores.account_age_days IS '缓存的账号年龄（天）';

-- 先确保所有 creator 都有一行 influence cache，分数字段保持默认 0。
INSERT INTO public.influence_scores (
  creator_id,
  overall_score,
  citation_score,
  follower_score,
  rating_score,
  stability_score,
  citations_received,
  followers_count,
  avg_rating,
  videos_published,
  account_age_days
)
SELECT
  c.id,
  0,
  0,
  0,
  0,
  0,
  0,
  COALESCE(c.followers_count, 0),
  0,
  0,
  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - c.created_at)) / 86400))::INT
FROM public.creators c
ON CONFLICT (creator_id) DO NOTHING;

-- 回填原始指标缓存，避免旧缓存命中时 metrics 为空。
WITH published_videos AS (
  SELECT id, creator_id
  FROM public.videos
  WHERE status = 'published'
),
citations_received AS (
  SELECT
    pv.creator_id,
    COUNT(c.id)::INT AS citations_received
  FROM published_videos pv
  LEFT JOIN public.citations c ON c.cited_video_id = pv.id
  GROUP BY pv.creator_id
),
rating_averages AS (
  SELECT
    pv.creator_id,
    COALESCE(ROUND(AVG((r.relevance + r.accuracy + r.novelty) / 3.0), 1), 0) AS avg_rating
  FROM published_videos pv
  LEFT JOIN public.ratings r ON r.video_id = pv.id
  GROUP BY pv.creator_id
),
published_counts AS (
  SELECT
    creator_id,
    COUNT(*)::INT AS videos_published
  FROM published_videos
  GROUP BY creator_id
)
UPDATE public.influence_scores s
SET
  citations_received = COALESCE(cr.citations_received, 0),
  followers_count = COALESCE(c.followers_count, 0),
  avg_rating = COALESCE(ra.avg_rating, 0),
  videos_published = COALESCE(pc.videos_published, 0),
  account_age_days = GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (now() - c.created_at)) / 86400)
  )::INT,
  updated_at = now()
FROM public.creators c
LEFT JOIN citations_received cr ON cr.creator_id = c.id
LEFT JOIN rating_averages ra ON ra.creator_id = c.id
LEFT JOIN published_counts pc ON pc.creator_id = c.id
WHERE s.creator_id = c.id;
