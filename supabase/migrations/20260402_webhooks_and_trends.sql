-- =================================================================
-- BotBili V1.5: Webhook 推送系统 + 趋势 API
-- =================================================================

-- ========== Webhooks 表 ==========
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{video.published}',
  secret TEXT,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_creator ON public.webhooks(creator_id, is_active);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON public.webhooks(is_active, failure_count);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhooks_select ON public.webhooks
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY webhooks_insert ON public.webhooks
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY webhooks_update ON public.webhooks
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY webhooks_delete ON public.webhooks
  FOR DELETE USING (auth.role() = 'service_role');

-- ========== 热门 tags 函数 ==========
CREATE OR REPLACE FUNCTION get_trending_tags(days INT DEFAULT 7)
RETURNS TABLE(tag TEXT, count BIGINT, growth NUMERIC) AS $$
  WITH current_period AS (
    SELECT unnest(tags) as tag, count(*) as cnt
    FROM videos
    WHERE created_at > now() - (days || ' days')::interval
      AND status = 'published'
    GROUP BY tag
  ),
  prev_period AS (
    SELECT unnest(tags) as tag, count(*) as cnt
    FROM videos
    WHERE created_at BETWEEN now() - (days * 2 || ' days')::interval 
      AND now() - (days || ' days')::interval
      AND status = 'published'
    GROUP BY tag
  )
  SELECT 
    c.tag,
    c.cnt as count,
    CASE WHEN COALESCE(p.cnt, 0) = 0 THEN 999
         ELSE round((c.cnt::numeric - p.cnt) / p.cnt * 100, 1)
    END as growth
  FROM current_period c
  LEFT JOIN prev_period p ON c.tag = p.tag
  ORDER BY c.cnt DESC
  LIMIT 20;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ========== 上升话题函数 ==========
CREATE OR REPLACE FUNCTION get_rising_topics(days INT DEFAULT 7)
RETURNS TABLE(topic TEXT, first_seen TIMESTAMPTZ, video_count BIGINT, trend TEXT) AS $$
  SELECT 
    unnest(tags) as topic,
    MIN(created_at) as first_seen,
    count(*) as video_count,
    CASE 
      WHEN count(*) > 10 THEN 'hot'
      WHEN count(*) > 5 THEN 'rising'
      ELSE 'emerging'
    END as trend
  FROM videos
  WHERE created_at > now() - (days || ' days')::interval
    AND status = 'published'
  GROUP BY topic
  HAVING count(*) >= 3
  ORDER BY video_count DESC
  LIMIT 15;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ========== 内容类型统计函数 ==========
CREATE OR REPLACE FUNCTION get_content_type_stats(days INT DEFAULT 7)
RETURNS TABLE(content_type TEXT, avg_views NUMERIC, avg_engagement NUMERIC, video_count BIGINT) AS $$
  SELECT 
    niche as content_type,
    COALESCE(avg(v.view_count), 0) as avg_views,
    COALESCE(avg(
      CASE WHEN v.view_count > 0 
        THEN (v.like_count + v.comment_count)::numeric / v.view_count 
        ELSE 0 
      END
    ), 0) as avg_engagement,
    count(DISTINCT v.id) as video_count
  FROM creators c
  JOIN videos v ON v.creator_id = c.id
  WHERE v.created_at > now() - (days || ' days')::interval
    AND v.status = 'published'
  GROUP BY niche
  ORDER BY avg_views DESC
  LIMIT 10;
$$ LANGUAGE SQL SECURITY DEFINER;
