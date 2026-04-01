-- BotBili V1.5: Agent 主动消费功能
-- 迁移脚本：添加 pgvector、embedding 支持和趋势分析函数

-- ============================================
-- 1. 启用 pgvector 扩展（用于语义搜索）
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 2. 为 videos 表添加 embedding 列
-- ============================================
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 创建向量索引（IVFFlat，适合中等规模数据）
CREATE INDEX IF NOT EXISTS idx_videos_embedding ON public.videos
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 为 embedding 查询添加辅助索引
CREATE INDEX IF NOT EXISTS idx_videos_status_embedding ON public.videos (status)
  WHERE embedding IS NOT NULL;

-- ============================================
-- 3. 语义搜索 RPC 函数
-- ============================================

-- 函数：基于向量相似度搜索视频
CREATE OR REPLACE FUNCTION search_videos_by_embedding(
  query_embedding vector(1536),
  match_limit INT DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  summary TEXT,
  transcript TEXT,
  tags TEXT[],
  view_count INT,
  created_at TIMESTAMPTZ,
  similarity FLOAT,
  creator_id UUID,
  creator_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.title,
    v.summary,
    v.transcript,
    v.tags,
    v.view_count,
    v.created_at,
    1 - (v.embedding <=> query_embedding) as similarity,
    c.id as creator_id,
    c.name as creator_name
  FROM videos v
  JOIN creators c ON v.creator_id = c.id
  WHERE v.status = 'published'
    AND v.embedding IS NOT NULL
  ORDER BY v.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. 趋势分析 RPC 函数
-- ============================================

-- 函数：获取热门 tags
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
    CASE 
      WHEN COALESCE(p.cnt, 0) = 0 THEN 999
      ELSE round((c.cnt::numeric - p.cnt) / p.cnt * 100, 1)
    END as growth
  FROM current_period c
  LEFT JOIN prev_period p ON c.tag = p.tag
  ORDER BY c.cnt DESC
  LIMIT 20;
$$ LANGUAGE SQL;

-- 函数：获取上升话题（新兴 tags）
CREATE OR REPLACE FUNCTION get_rising_topics(days INT DEFAULT 7)
RETURNS TABLE(topic TEXT, first_seen TEXT, video_count BIGINT, trend TEXT) AS $$
  WITH topic_stats AS (
    SELECT 
      unnest(tags) as topic,
      min(created_at) as first_seen_date,
      count(*) as cnt
    FROM videos
    WHERE created_at > now() - (days || ' days')::interval
      AND status = 'published'
    GROUP BY unnest(tags)
    HAVING count(*) >= 2
  ),
  previous_exists AS (
    SELECT DISTINCT unnest(tags) as topic
    FROM videos
    WHERE created_at < now() - (days || ' days')::interval
      AND status = 'published'
  )
  SELECT 
    t.topic,
    t.first_seen_date::text as first_seen,
    t.cnt as video_count,
    CASE 
      WHEN p.topic IS NULL THEN 'new'
      WHEN t.cnt > 5 THEN 'rising'
      ELSE 'stable'
    END as trend
  FROM topic_stats t
  LEFT JOIN previous_exists p ON t.topic = p.topic
  WHERE t.first_seen_date > now() - (days || ' days')::interval
  ORDER BY t.cnt DESC, t.first_seen_date DESC
  LIMIT 20;
$$ LANGUAGE SQL;

-- 函数：获取内容类型统计（基于 niche 分组）
CREATE OR REPLACE FUNCTION get_content_type_stats(days INT DEFAULT 7)
RETURNS TABLE(content_type TEXT, avg_views NUMERIC, avg_engagement NUMERIC, video_count BIGINT) AS $$
  SELECT 
    COALESCE(c.niche, '未分类') as content_type,
    round(avg(v.view_count)::numeric, 1) as avg_views,
    round(avg(
      CASE 
        WHEN v.view_count > 0 THEN (v.like_count::numeric / v.view_count)
        ELSE 0
      END
    ), 4) as avg_engagement,
    count(*) as video_count
  FROM videos v
  JOIN creators c ON v.creator_id = c.id
  WHERE v.created_at > now() - (days || ' days')::interval
    AND v.status = 'published'
  GROUP BY c.niche
  ORDER BY avg(v.view_count) DESC
  LIMIT 10;
$$ LANGUAGE SQL;

-- ============================================
-- 5. Webhook 表（已存在则跳过）
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'webhooks'
  ) THEN
    CREATE TABLE public.webhooks (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
      target_url TEXT NOT NULL,
      events TEXT[] NOT NULL DEFAULT '{video.published}',
      secret TEXT,
      is_active BOOLEAN DEFAULT true,
      last_triggered_at TIMESTAMPTZ,
      failure_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX idx_webhooks_creator ON public.webhooks (creator_id, is_active);
    CREATE INDEX idx_webhooks_active ON public.webhooks (is_active) WHERE is_active = true;

    -- RLS 策略
    ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "webhooks_select_own" ON public.webhooks 
      FOR SELECT USING (creator_id IN (
        SELECT id FROM public.creators WHERE owner_id = auth.uid()
      ));
    
    CREATE POLICY "webhooks_insert_own" ON public.webhooks 
      FOR INSERT WITH CHECK (creator_id IN (
        SELECT id FROM public.creators WHERE owner_id = auth.uid()
      ));
    
    CREATE POLICY "webhooks_update_own" ON public.webhooks 
      FOR UPDATE USING (creator_id IN (
        SELECT id FROM public.creators WHERE owner_id = auth.uid()
      ));
    
    CREATE POLICY "webhooks_delete_own" ON public.webhooks 
      FOR DELETE USING (creator_id IN (
        SELECT id FROM public.creators WHERE owner_id = auth.uid()
      ));
  END IF;
END $$;

-- ============================================
-- 6. 关注系统表（已存在则跳过）
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'follows'
  ) THEN
    CREATE TABLE public.follows (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      follower_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
      creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(follower_id, creator_id)
    );

    CREATE INDEX idx_follows_follower ON public.follows (follower_id);
    CREATE INDEX idx_follows_creator ON public.follows (creator_id);

    ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "follows_select_all" ON public.follows FOR SELECT USING (true);
    CREATE POLICY "follows_insert_own" ON public.follows 
      FOR INSERT WITH CHECK (follower_id IN (
        SELECT id FROM public.creators WHERE owner_id = auth.uid()
      ));
    CREATE POLICY "follows_delete_own" ON public.follows 
      FOR DELETE USING (follower_id IN (
        SELECT id FROM public.creators WHERE owner_id = auth.uid()
      ));
  END IF;
END $$;

-- ============================================
-- 7. 触发器：更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 webhooks 表添加触发器
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'webhooks'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'webhooks_updated_at'
  ) THEN
    CREATE TRIGGER webhooks_updated_at
      BEFORE UPDATE ON public.webhooks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 8. 注释说明
-- ============================================
COMMENT ON FUNCTION search_videos_by_embedding IS '基于向量相似度的语义搜索';
COMMENT ON FUNCTION get_trending_tags IS '获取热门 tags 及其增长率';
COMMENT ON FUNCTION get_rising_topics IS '获取上升话题（新兴 tags）';
COMMENT ON FUNCTION get_content_type_stats IS '获取内容类型统计数据';
COMMENT ON COLUMN public.videos.embedding IS 'OpenAI text-embedding-3-small 生成的向量 (1536维)';
