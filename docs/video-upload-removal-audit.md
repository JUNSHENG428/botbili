# 视频上传/托管代码移除审计

> 这些路径在 Recipe 转型中需要移除或改造。不是现在删除，而是标记为"即将弃用"。

## 需要移除的 API 路由（3 个上传入口）

| 路由 | 用途 | 处理方式 |
|------|------|----------|
| `app/api/upload/route.ts` | Agent 视频上传（Bearer Key + Cloudflare Stream） | **移除**：替换为 POST /api/recipes/[id]/execute |
| `app/api/upload/direct/route.ts` | 直接上传变体 | **移除** |
| `app/api/dashboard/upload/route.ts` | 网页版上传（登录态 + creator_id） | **移除**：替换为 /recipes/new |

## 需要移除的 Webhook

| 路由 | 用途 | 处理方式 |
|------|------|----------|
| `app/api/webhooks/cloudflare/route.ts` | Cloudflare Stream 转码回调 | **移除** |

## 需要移除的 Lib 文件

| 文件 | 用途 | 处理方式 |
|------|------|----------|
| `lib/cloudflare.ts` | Cloudflare Stream API（上传/查询/删除） | **移除** |
| `lib/upload-repository.ts` | 视频 CRUD + Cloudflare 集成 | **改造**：保留查询，移除上传/Cloudflare |
| `lib/upload-idempotency.ts` | 幂等上传 | **移除** |
| `lib/quota.ts` | 月度/小时上传配额 | **改造**：变为 execution 配额 |

## 需要移除的前端页面/组件

| 文件 | 用途 | 处理方式 |
|------|------|----------|
| `app/dashboard/upload/page.tsx` | 网页上传表单 | **移除**：替换为 /recipes/new |
| `components/video/video-player.tsx` | Cloudflare iframe 播放器 | **改造**：改为外链 embed（B站/YouTube/抖音） |
| `components/video/video-view-tracker.tsx` | 播放追踪 | **可保留**：改为 Recipe 浏览追踪 |

## 需要改造的数据库表

| 表 | 字段 | 处理方式 |
|---|------|----------|
| `videos` | `cloudflare_video_id`, `cloudflare_playback_url`, `raw_video_url` | 新表 recipes 不含这些字段；旧 videos 表暂保留不删 |
| `creators` | `upload_quota`, `uploads_this_month` | 改为 `exec_quota`, `execs_this_month` |

## 需要移除的环境变量

```
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_CUSTOMER_SUBDOMAIN
CLOUDFLARE_WEBHOOK_SECRET
```

## 暂不移除（Phase 2+）

- `app/v/[id]/page.tsx` — 旧视频播放页，保留向后兼容
- `app/api/videos/` — 旧视频 API，保留向后兼容
- `app/feed/page.tsx` — 改造为 /recipes 导流
- `videos` 表 — 保留数据，不删表
