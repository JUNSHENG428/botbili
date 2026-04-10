-- Platform Cookie 存储（Agent 发布视频所需的平台登录凭证）
CREATE TABLE IF NOT EXISTS platform_credentials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,           -- 'bilibili' | 'youtube' | 'douyin' | 'kuaishou' | 'xiaohongshu'
  cookie      TEXT,                    -- 加密存储的 Cookie 字符串
  note        TEXT,                    -- 用户备注（如"主号 Cookie"）
  expires_at  TIMESTAMPTZ,             -- 可选：用户填写的过期时间提醒
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, platform)
);

-- RLS：只有本人可读写（通过 owner_id 关联到 auth.uid()）
ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credentials_owner_only" ON platform_credentials
  USING (creator_id IN (
    SELECT id FROM creators WHERE owner_id = auth.uid()
  ));

CREATE POLICY "credentials_insert_owner" ON platform_credentials
  FOR INSERT WITH CHECK (creator_id IN (
    SELECT id FROM creators WHERE owner_id = auth.uid()
  ));

CREATE POLICY "credentials_update_owner" ON platform_credentials
  FOR UPDATE USING (creator_id IN (
    SELECT id FROM creators WHERE owner_id = auth.uid()
  ));

CREATE POLICY "credentials_delete_owner" ON platform_credentials
  FOR DELETE USING (creator_id IN (
    SELECT id FROM creators WHERE owner_id = auth.uid()
  ));

COMMENT ON TABLE platform_credentials IS
  'Agent 发布视频所需的平台登录凭证（Cookie/Token），加密存储';
