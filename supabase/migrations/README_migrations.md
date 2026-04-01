# 迁移文件说明

## 执行顺序

### 新项目（首次初始化）
1. `000_full_init.sql`
2. `20260331_add_video_agent_fields.sql`
3. `20260401_owner_id_oauth.sql`
4. `20260402_creators_source.sql`
5. `20260402_add_rls_policies.sql`
6. `20260402_hourly_rate_limit.sql`
7. `20260402_rls_admin_email.sql`（可选，需配置 GUC）
8. `20260402_invite_applications.sql`

### 已有项目（增量更新）
1. `20260402_add_rls_policies.sql`
2. `20260402_hourly_rate_limit.sql`
3. 在 Supabase Dashboard 设置 `app.admin_email` GUC
4. `20260402_rls_admin_email.sql`

## 重复迁移文件说明

以下增量迁移文件与 `000_full_init.sql` 重复定义表结构：
- `20260401_comments_likes.sql`
- `20260401_follows.sql`
- `20260401_invite_codes.sql`
- `20260401_feedback.sql`

**建议**：
- 新项目只执行 `000_full_init.sql`
- 已有项目的增量迁移已执行过，无需回滚
- 将来增量迁移只包含 `ALTER TABLE` / `ADD COLUMN` 等变更
