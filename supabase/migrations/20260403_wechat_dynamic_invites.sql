-- 微信公众号邀请码改为按用户动态生成，停用历史公开码。
UPDATE public.invite_codes
SET is_active = false
WHERE code = 'LAORUI2026';
