-- upload_idempotency: 限制为 service_role 访问
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'upload_idempotency' AND policyname = 'upload_idempotency_service_role_all') THEN
    CREATE POLICY "upload_idempotency_service_role_all"
      ON public.upload_idempotency
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- video_interactions: 公开读，service_role 写
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'video_interactions' AND policyname = 'video_interactions_select') THEN
    CREATE POLICY "video_interactions_select"
      ON public.video_interactions
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'video_interactions' AND policyname = 'video_interactions_insert_service') THEN
    CREATE POLICY "video_interactions_insert_service"
      ON public.video_interactions
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
