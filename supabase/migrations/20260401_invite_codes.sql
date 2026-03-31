-- 邀请码表
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'manual',
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  created_by TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 邀请码使用记录
CREATE TABLE IF NOT EXISTS public.invite_code_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES public.invite_codes(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  used_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_code ON public.invite_codes (code);
CREATE INDEX IF NOT EXISTS idx_invite_usage_user ON public.invite_code_usage (user_id);

-- RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_code_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can verify invite codes"
  ON public.invite_codes FOR SELECT USING (true);

CREATE POLICY "Service role can update invite codes"
  ON public.invite_codes FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert usage"
  ON public.invite_code_usage FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can read usage"
  ON public.invite_code_usage FOR SELECT
  USING (true);

-- 原子核销 RPC
CREATE OR REPLACE FUNCTION redeem_invite_code(p_code_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.invite_codes
  SET used_count = used_count + 1
  WHERE id = p_code_id
    AND is_active = true
    AND used_count < max_uses
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_code_invalid';
  END IF;

  INSERT INTO public.invite_code_usage (code_id, user_id)
  VALUES (p_code_id, p_user_id);
END;
$$;

-- 预置种子邀请码
INSERT INTO public.invite_codes (code, source, max_uses, created_by)
VALUES ('OPENCLAW2026', 'openclaw', 50, 'system')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.invite_codes (code, source, max_uses, created_by)
VALUES ('LAORUI2026', 'wechat', 50, 'system')
ON CONFLICT (code) DO NOTHING;
