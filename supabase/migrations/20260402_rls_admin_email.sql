-- 20260402: 更新 RLS 策略使用环境变量替代硬编码邮箱
-- 在 Supabase Dashboard → Settings → Database → Custom GUC 中设置:
-- ALTER DATABASE postgres SET app.admin_email = 'majunsheng0428@gmail.com';

DROP POLICY IF EXISTS "Only admin can read feedback" ON public.feedback;
CREATE POLICY "Only admin can read feedback" ON public.feedback FOR SELECT
  USING (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
