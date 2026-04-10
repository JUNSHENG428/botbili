# 视频上传/托管代码移除审计

> 这些路径在 Recipe 转型中已下线或改造。BotBili 不再托管视频，只存储 Agent 执行结果元数据。

## 需要移除的 API 路由（3 个上传入口）

| 路由 | 用途 | 处理方式 |
|------|------|----------|
| `app/api/upload/route.ts` | Agent 视频上传（Bearer Key + Stream 托管） | **已移除**：替换为 POST /api/recipes/[id]/execute |
| `app/api/upload/direct/route.ts` | 直接上传变体 | **移除** |
| `app/api/dashboard/upload/route.ts` | 网页版上传（登录态 + creator_id） | **移除**：替换为 /recipes/new |

## 需要移除的 Webhook

| 路由 | 用途 | 处理方式 |
|------|------|----------|
| `app/api/webhooks/cloudflare/route.ts` | 旧视频转码回调 | **已移除** |

## 需要移除的 Lib 文件

| 文件 | 用途 | 处理方式 |
|------|------|----------|
| `lib/cloudflare.ts` | 旧视频托管 API（上传/查询/删除） | **已移除** |
| `lib/upload-repository.ts` | 旧视频 CRUD | **改造**：保留 API Key 校验和 legacy 查询，移除托管调用 |
| `lib/upload-idempotency.ts` | 幂等上传 | **移除** |
| `lib/quota.ts` | 月度/小时上传配额 | **改造**：变为 execution 配额 |

## 需要移除的前端页面/组件

| 文件 | 用途 | 处理方式 |
|------|------|----------|
| `app/dashboard/upload/page.tsx` | 网页上传表单 | **移除**：替换为 /recipes/new |
| `components/video/video-player.tsx` | 旧播放器 | **改造**：改为外链 embed（B站/YouTube/抖音） |
| `components/video/video-view-tracker.tsx` | 播放追踪 | **已移除** |

## 需要改造的数据库表

| 表 | 字段 | 处理方式 |
|---|------|----------|
| `videos` | 旧托管字段、`raw_video_url` | 新表 recipes 不含这些字段；旧 videos 表暂保留不删 |
| `creators` | `upload_quota`, `uploads_this_month` | 改为 `exec_quota`, `execs_this_month` |

## 环境变量

旧视频托管环境变量已移除；Recipe 执行结果回填改走 execution metadata。

## 暂不移除（Phase 2+）

- `app/v/[id]/page.tsx` — 旧视频播放页，已移除
- `app/api/videos/` — 旧视频 API，保留向后兼容
- `app/feed/page.tsx` — 已移除；保留 `/feed/[slug].json` 作为 Recipe JSON Feed
- `videos` 表 — 保留数据，不删表
