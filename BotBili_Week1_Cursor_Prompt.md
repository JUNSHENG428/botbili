# BotBili MVP Week 1 — Cursor 开发指令

> 把这个文件放在项目根目录，让 Cursor 在每次对话开始时读取它作为上下文。

---

## 项目概述

BotBili 是一个 **AI 视频发布+展示平台**。  
用户的 AI agent 通过 Upload API 把视频发布上来，观众在 Feed 浏览、播放、查看 UP 主主页。  
**平台不做视频生成，只做接收→审核→存储→展示→分发。**

---

## 技术栈（锁死，不要换）

| 层 | 技术 | 版本 |
|---|---|---|
| 框架 | Next.js (App Router) | 15.x |
| 样式 | Tailwind CSS + shadcn/ui | 最新 |
| 数据库 | Supabase (PostgreSQL) | - |
| 认证 | Supabase Auth | - |
| 视频存储 | Cloudflare Stream | - |
| 内容审核 | OpenAI Moderation API | - |
| 部署 | Vercel | - |
| 包管理器 | pnpm | 最新 |
| 语言 | TypeScript（严格模式） | 5.x |

---

## 项目目录结构

```
botbili/
├── app/
│   ├── layout.tsx                  # 根 layout，包含 <Navbar>
│   ├── page.tsx                    # Feed 首页 "/"
│   ├── v/
│   │   └── [id]/
│   │       └── page.tsx            # 播放页 "/v/[id]"
│   ├── c/
│   │   └── [id]/
│   │       └── page.tsx            # UP主主页 "/c/[id]"
│   ├── create/
│   │   └── page.tsx                # 创建向导 "/create"
│   └── api/
│       ├── upload/
│       │   └── route.ts            # POST /api/upload
│       ├── videos/
│       │   ├── route.ts            # GET /api/videos
│       │   └── [id]/
│       │       └── route.ts        # GET /api/videos/[id]
│       ├── creators/
│       │   ├── route.ts            # POST /api/creators
│       │   └── [id]/
│       │       └── route.ts        # GET /api/creators/[id]
│       ├── webhooks/
│       │   └── cloudflare/
│       │       └── route.ts        # POST /api/webhooks/cloudflare
│       └── health/
│           └── route.ts            # GET /api/health
├── components/
│   ├── layout/
│   │   ├── navbar.tsx
│   │   └── footer.tsx
│   ├── video/
│   │   ├── video-card.tsx
│   │   ├── video-grid.tsx
│   │   └── video-player.tsx
│   └── creator/
│       ├── creator-info.tsx
│       ├── creator-header.tsx
│       └── api-key-display.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # 浏览器端 Supabase 客户端
│   │   └── server.ts               # 服务端 Supabase 客户端
│   ├── cloudflare.ts               # Cloudflare Stream API 封装
│   ├── moderation.ts               # OpenAI Moderation API 封装
│   ├── auth.ts                     # API Key 验证逻辑
│   ├── quota.ts                    # 配额检查
│   └── utils.ts                    # 工具函数
├── types/
│   └── index.ts                    # 全局类型定义
├── .env.local                      # 环境变量（不入库）
├── .env.example                    # 环境变量示例
└── package.json
```

---

## 环境变量 (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Cloudflare Stream
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_WEBHOOK_SECRET=xxx

# OpenAI
OPENAI_API_KEY=sk-xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 数据库 Schema（Supabase SQL）

在 Supabase SQL Editor 执行以下语句建表：

```sql
-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== users 表 ==========
-- 由 Supabase Auth 自动管理 auth.users
-- 这里创建 public.profiles 作为用户公开信息
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== creators 表（AI UP主）==========
CREATE TABLE public.creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  niche TEXT DEFAULT '',
  style TEXT DEFAULT '',
  agent_key_hash TEXT UNIQUE NOT NULL,   -- SHA-256 哈希，不存明文
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'studio')),
  upload_quota INT DEFAULT 30,           -- 每月上传配额
  uploads_this_month INT DEFAULT 0,      -- 本月已上传数
  quota_reset_at TIMESTAMPTZ DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month'),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_creators_owner ON public.creators(owner_id);
CREATE INDEX idx_creators_key_hash ON public.creators(agent_key_hash);

-- ========== videos 表 ==========
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  cloudflare_video_id TEXT,              -- Cloudflare Stream 返回的 UID
  cloudflare_playback_url TEXT,          -- 嵌入播放 URL
  raw_video_url TEXT NOT NULL,           -- 原始视频 URL
  thumbnail_url TEXT,
  duration_seconds INT,
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'published', 'rejected', 'failed')),
  moderation_result JSONB,               -- 审核结果记录
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'generate')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_videos_creator ON public.videos(creator_id);
CREATE INDEX idx_videos_status ON public.videos(status);
CREATE INDEX idx_videos_created ON public.videos(created_at DESC);

-- ========== video_views 表（播放记录，用于统计）==========
CREATE TABLE public.video_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  viewer_ip TEXT,                         -- MVP 阶段用 IP 去重
  watch_duration_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_views_video ON public.video_views(video_id);

-- ========== RLS 策略 ==========
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

-- profiles: 所有人可读，本人可写
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- creators: 所有人可读，owner 可写
CREATE POLICY "creators_select" ON public.creators FOR SELECT USING (true);
CREATE POLICY "creators_insert" ON public.creators FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "creators_update" ON public.creators FOR UPDATE USING (auth.uid() = owner_id);

-- videos: published 的所有人可读；creator 的 owner 可写
CREATE POLICY "videos_select_published" ON public.videos FOR SELECT USING (status = 'published');
CREATE POLICY "videos_select_own" ON public.videos FOR SELECT USING (
  creator_id IN (SELECT id FROM public.creators WHERE owner_id = auth.uid())
);
CREATE POLICY "videos_insert" ON public.videos FOR INSERT WITH CHECK (
  creator_id IN (SELECT id FROM public.creators WHERE owner_id = auth.uid())
);

-- video_views: 所有人可插入，仅 service_role 可读
CREATE POLICY "views_insert" ON public.video_views FOR INSERT WITH CHECK (true);

-- 注意：API Routes 使用 service_role_key 绕过 RLS，所以 Upload API 不受 RLS 影响
```

---

## 全局类型定义 (types/index.ts)

```typescript
export interface Creator {
  id: string;
  owner_id: string;
  name: string;
  avatar_url: string | null;
  bio: string;
  niche: string;
  style: string;
  plan_type: 'free' | 'pro' | 'studio';
  upload_quota: number;
  uploads_this_month: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  tags: string[];
  cloudflare_video_id: string | null;
  cloudflare_playback_url: string | null;
  raw_video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number;
  like_count: number;
  status: 'processing' | 'ready' | 'published' | 'rejected' | 'failed';
  source: 'upload' | 'generate';
  created_at: string;
  updated_at: string;
  // joined
  creator?: Creator;
}

export interface VideoView {
  id: string;
  video_id: string;
  viewer_ip: string | null;
  watch_duration_seconds: number;
  created_at: string;
}

export interface UploadRequest {
  title: string;
  description?: string;
  tags?: string[];
  video_url: string;
  thumbnail_url?: string;
}

export interface UploadResponse {
  video_id: string;
  url: string;
}

export interface CreateCreatorRequest {
  name: string;
  bio?: string;
  niche?: string;
  avatar_url?: string;
}

export interface CreateCreatorResponse {
  creator_id: string;
  api_key: string;        // 仅在创建时返回一次明文
  message: string;
}

export interface ApiError {
  error: string;
  code: string;
  status: number;
}
```

---

## Day 1 任务：项目初始化

### 指令

```
请帮我初始化 BotBili 项目：

1. 用 pnpm 创建 Next.js 15 项目，使用 App Router，TypeScript 严格模式，Tailwind CSS
2. 安装依赖：
   - @supabase/supabase-js @supabase/ssr
   - shadcn/ui（按 shadcn 官方 CLI 初始化，使用 "zinc" 主题，dark mode 支持）
   - crypto-js（用于 SHA-256）
3. 创建 .env.local 和 .env.example 文件（内容见上方环境变量）
4. 创建 lib/supabase/client.ts 和 lib/supabase/server.ts
   - client.ts: 使用 createBrowserClient
   - server.ts: 使用 createServerClient（从 cookies 读取），以及一个 createAdminClient 使用 service_role_key
5. 创建 types/index.ts（内容见上方类型定义）
6. 创建基础 layout.tsx：
   - 使用 Inter 字体
   - 深色主题为主（bg-zinc-950 text-zinc-50）
   - 包含 <Navbar> 组件（logo "BotBili" + 导航链接：首页、创建）
7. 创建 app/page.tsx 占位页面，显示 "BotBili — AI视频的家"
8. 确保 pnpm dev 能正常跑起来，pnpm build 无报错

不要安装多余的依赖。不要使用 pages router。所有组件使用函数组件。
```

---

## Day 2 任务：数据库建表 + Cloudflare Stream 对接

### 指令

```
Day 2 任务，分两部分：

### Part A：Cloudflare Stream 封装

创建 lib/cloudflare.ts，封装以下函数：

1. uploadVideoByUrl(videoUrl: string): Promise<{ uid: string; playbackUrl: string }>
   - 调用 Cloudflare Stream "Upload via URL" API
   - 端点：POST https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/copy
   - 请求体：{ "url": videoUrl, "meta": { "name": "botbili-upload" } }
   - 认证：Bearer token (CLOUDFLARE_API_TOKEN)
   - 返回 Cloudflare 的 uid 和 playback URL（格式：https://customer-{subdomain}.cloudflarestream.com/{uid}/iframe）
   - 注意：视频上传后状态是 "downloading"，需要等 webhook 回调才知道是否 ready

2. getVideoStatus(uid: string): Promise<{ status: string; duration: number; thumbnail: string }>
   - 调用 GET https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/{uid}
   - 返回视频的 readyToStream 状态、duration、thumbnail

3. getEmbedUrl(uid: string): string
   - 返回 Cloudflare Stream 嵌入播放器 URL
   - 格式：https://customer-{subdomain}.cloudflarestream.com/{uid}/iframe

所有函数内部做错误处理，失败时 throw Error 并带上 Cloudflare 返回的错误信息。
使用 fetch，不要用 axios。

### Part B：Supabase 数据库

SQL 已经在上方 Schema 部分提供，我会手动在 Supabase SQL Editor 执行。
请创建 lib/db-helpers.ts，封装以下常用数据库操作函数（全部使用 service_role admin client）：

1. getPublishedVideos(sort: 'hot' | 'latest', page: number, pageSize: number)
   - sort=hot: 按 (view_count * 1 + like_count * 3) DESC 排序
   - sort=latest: 按 created_at DESC 排序
   - 返回 videos 列表，每条 join creator 信息（name, avatar_url, niche）
   - 分页，page 从 1 开始

2. getVideoById(id: string)
   - 返回单条 video + join creator
   - 同时 view_count += 1（原子更新）

3. getCreatorById(id: string)
   - 返回 creator 信息 + 该 creator 的所有 published videos（按 created_at DESC）

4. createCreator(ownerId: string, data: CreateCreatorRequest, keyHash: string)
   - 插入 creators 表
   - 返回新创建的 creator

5. createVideo(creatorId: string, data: UploadRequest, cloudflareUid: string, playbackUrl: string)
   - 插入 videos 表，status = 'processing'
   - 返回新创建的 video

6. updateVideoStatus(cloudflareUid: string, status: string, duration?: number, thumbnail?: string)
   - 根据 cloudflare_video_id 查找视频并更新状态
   - 用于 webhook 回调

7. verifyApiKey(keyHash: string): Promise<Creator | null>
   - 根据 key hash 查找 creator
   - 返回 creator 或 null

8. checkAndIncrementQuota(creatorId: string): Promise<boolean>
   - 检查 uploads_this_month < upload_quota
   - 如果未超限，uploads_this_month += 1 并返回 true
   - 超限返回 false
   - 如果当前时间 > quota_reset_at，先重置 uploads_this_month=0 并更新 quota_reset_at
```

---

## Day 3 任务：Upload API（最核心接口）

### 指令

```
Day 3 任务：实现 Upload API。这是整个产品最核心的接口。

### 文件：app/api/upload/route.ts

实现 POST /api/upload，完整流程如下：

1. 从 Authorization header 提取 Bearer token（格式：Bearer bb_xxxxxxxx）
2. 对 token 做 SHA-256 哈希
3. 调用 verifyApiKey(hash) 验证身份，失败返回 401
4. 检查 creator.is_active，非活跃返回 403
5. 调用 checkAndIncrementQuota(creator.id)，超限返回 429 + 错误消息 "Monthly upload quota exceeded"
6. 解析请求体 (UploadRequest)，验证必填字段：
   - title: 非空字符串，最长 200 字符
   - video_url: 合法 URL（http/https 开头）
   - description: 可选，最长 2000 字符
   - tags: 可选，数组最多 10 个，每个最长 30 字符
   - thumbnail_url: 可选，合法 URL
7. 调用 OpenAI Moderation API 审核 title + description 文本
   - 如果被标记为违规，返回 422 + 原因
8. 调用 cloudflare.uploadVideoByUrl(video_url) 推送到 Cloudflare Stream
9. 调用 createVideo() 写入数据库，status = 'processing'
10. 返回 201：{ video_id, url: "${APP_URL}/v/${video_id}" }

### 文件：lib/auth.ts

实现 API Key 认证逻辑：
- hashApiKey(plainKey: string): string — 用 crypto 模块的 SHA-256
- generateApiKey(): { plain: string; hash: string } — 生成格式为 "bb_" + 32位随机十六进制字符串

### 文件：lib/moderation.ts

实现内容审核：
- moderateText(text: string): Promise<{ flagged: boolean; categories: string[]; raw: any }>
- 调用 OpenAI Moderation API (POST https://api.openai.com/v1/moderations)
- 使用 omni-moderation-latest 模型
- 返回是否违规 + 违规类别

### 错误处理规则：
- 所有错误返回统一的 JSON 格式：{ error: string, code: string }
- 使用正确的 HTTP 状态码：400/401/403/422/429/500
- 服务端错误记录到 console.error，不暴露内部细节给客户端
- Cloudflare API 调用失败时做 1 次重试（间隔 2 秒），仍失败返回 502

### Rate Limiting：
- 在 API 入口处检查：每个 API Key 每小时最多 10 次上传
- 用简单的内存 Map 实现（MVP 阶段够用）：Map<keyHash, { count: number, resetAt: number }>

### 测试命令（写在注释里）：
// curl 测试：
// curl -X POST http://localhost:3000/api/upload \
//   -H "Authorization: Bearer bb_xxxxxxxx" \
//   -H "Content-Type: application/json" \
//   -d '{"title":"测试视频","video_url":"https://example.com/video.mp4"}'
```

---

## Day 4 任务：Cloudflare Webhook + 审核状态流转

### 指令

```
Day 4 任务：实现 Cloudflare Stream webhook 回调和视频状态管理。

### 文件：app/api/webhooks/cloudflare/route.ts

实现 POST /api/webhooks/cloudflare：

1. Cloudflare Stream 会在视频处理完成后发送 webhook 到这个端点
2. Webhook 签名验证：
   - Cloudflare 在 header "Webhook-Signature" 中发送签名
   - 用 CLOUDFLARE_WEBHOOK_SECRET 和请求 body 计算 HMAC-SHA256
   - 签名格式为 "time=xxx,sig1=xxx"，需要解析
   - 验证失败返回 403
3. 解析 webhook body，Cloudflare 发送的格式大致为：
   {
     "uid": "xxx",
     "readyToStream": true,
     "status": { "state": "ready" },
     "duration": 60.5,
     "thumbnail": "https://..."
   }
4. 状态流转逻辑：
   - readyToStream === true && state === "ready"
     → 更新 video status 为 'published'（MVP 阶段自动发布，跳过人工审核）
     → 更新 duration_seconds 和 thumbnail_url（如果用户没提供 thumbnail）
   - state === "error"
     → 更新 video status 为 'failed'
   - 其他状态忽略（返回 200）
5. 返回 200 OK

### 文件：app/api/health/route.ts

实现 GET /api/health：
- 返回 { status: "ok", timestamp: new Date().toISOString() }

### 额外：给 Upload API 补充状态说明

视频生命周期：
processing → (Cloudflare webhook) → published  （正常流程）
processing → (Cloudflare webhook) → failed     （转码失败）
processing → (Moderation API)     → rejected   （内容违规——这个在上传时已处理）

确保 getPublishedVideos 只返回 status='published' 的视频。
```

---

## Day 5 任务：前端 Feed 首页

### 指令

```
Day 5 任务：实现 Feed 首页，这是观众进入 BotBili 看到的第一个页面。

### 设计要求
- 深色背景（zinc-950），视频卡片有微妙的 border 和 hover 效果
- 类似 YouTube/B站 的视频网格布局
- 响应式：手机 1 列，平板 2 列，桌面 3-4 列
- 视觉风格：简洁科技感，不要花哨

### 文件：app/page.tsx（Feed 首页）

1. 顶部 Tab 切换：「热门」/「最新」（默认热门）
2. 视频网格（VideoGrid + VideoCard）
3. 底部加载更多按钮（MVP 不做无限滚动，用 "加载更多" 按钮分页）
4. 空状态：如果没有视频，显示友好提示 "还没有视频，成为第一个 AI UP 主？" + 跳转创建链接
5. 数据获取：使用 Server Component + fetch 调用内部 API，ISR revalidate = 60 秒
6. 页面 metadata：title = "BotBili — AI 视频的家"，description 适当写

### 文件：components/video/video-card.tsx

VideoCard 组件：
- 封面图（thumbnail_url），如果没有就显示一个渐变占位符
- 视频时长标签（右下角，格式 "1:30"）
- 标题（最多 2 行，溢出省略）
- UP 主名称 + 头像（小圆头像）
- 播放量（格式化：1.2K / 3.5W）
- 整个卡片是 Link 组件，点击跳转到 /v/[id]
- hover 时封面图微微放大 (scale-105 transition)

### 文件：components/video/video-grid.tsx

VideoGrid 组件：
- 接收 videos: Video[] 属性
- 响应式网格：grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4

### 文件：components/layout/navbar.tsx（更新）

Navbar：
- 左侧：BotBili logo（文字，加一个小的播放图标 ▶）
- 右侧：「创建 AI UP主」按钮（Link 到 /create）
- 固定顶部，模糊背景 (backdrop-blur)

### 工具函数：lib/utils.ts（补充）

- formatViewCount(count: number): string — 格式化播放量（<1000 原样，≥1000 用 K，≥10000 用 W）
- formatDuration(seconds: number): string — 格式化时长（秒→ "1:30" 格式）
- formatRelativeTime(dateString: string): string — 相对时间（"3 小时前"/"2 天前"）
```

---

## Day 6 任务：播放页 + UP 主主页

### 指令

```
Day 6 任务：实现视频播放页和 UP 主主页。

### 文件：app/v/[id]/page.tsx（播放页）

1. 视频播放器（Cloudflare Stream iframe 嵌入）
   - 使用 iframe src = cloudflare_playback_url
   - 16:9 比例，响应式宽度
   - 允许 allowfullscreen
2. 视频信息区：
   - 标题（大字）
   - 播放量 + 发布时间（相对时间）
   - 标签列表（小 badge）
   - 描述文本（折叠/展开，默认折叠 3 行）
3. UP 主信息卡片：
   - 头像 + 名称 + 简介
   - 点击名称跳转到 /c/[id]
4. 数据获取：Server Component，调用 getVideoById
5. 404 处理：视频不存在时 notFound()
6. metadata：动态生成 title 和 description，支持 Open Graph（og:title, og:image = thumbnail）

### 文件：app/c/[id]/page.tsx（UP 主主页）

1. 顶部 Header 区：
   - 大头像（96x96 圆形）
   - UP 主名称（大字）
   - 简介
   - 领域标签 (niche)
   - 视频总数统计
2. 视频列表区：
   - 使用 VideoGrid 组件
   - 按创建时间倒序
   - 空状态："这位 UP 主还没有发布视频"
3. 数据获取：Server Component，调用 getCreatorById
4. 404 处理：UP 主不存在时 notFound()

### 文件：components/video/video-player.tsx

CloudflareVideoPlayer 组件：
- props: { videoId: string; playbackUrl: string }
- 渲染 iframe，src = playbackUrl
- 外层容器 aspect-video（16:9）
- loading="lazy"
- allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
```

---

## Day 7 任务：创建向导 + 种子数据 + 上线

### 指令

```
Day 7 任务，三件事：创建向导页、API Key 生成完整流程、种子数据脚本。

### Part A：创建向导页

文件：app/create/page.tsx

这是一个客户端交互页面（"use client"），完整流程：

1. 表单字段：
   - UP 主名称（必填，2-30 字符，唯一性前端不做校验，后端报错时提示）
   - 领域 (niche)：下拉选择 ["科技", "教育", "娱乐", "游戏", "生活", "音乐", "其他"]
   - 简介 (bio)：textarea，可选，最长 300 字符
   - 头像 URL (avatar_url)：可选，输入 URL
2. 提交后：
   - 调用 POST /api/creators
   - 成功后显示 API Key（只展示这一次！）
   - 使用 api-key-display 组件：一个有边框的区域，显示 API Key，旁边有复制按钮
   - 红色警告文字："请立即保存此 API Key，关闭后无法再次查看！"
3. 提交后还显示 Quick Start Guide：
   - 用代码块展示 curl 命令示例
   - 示例内容预填用户刚创建的 UP 主信息

### Part B：完善 POST /api/creators

文件：app/api/creators/route.ts

1. MVP 阶段：暂不要求登录，使用一个临时方案
   - 请求体增加一个 email 字段（必填）
   - 后端用 email 作为 owner 标识
   - 在 profiles 表中查找或创建该 email 对应的记录
   - 注意：这是临时方案，Week 2 会换成 OAuth
2. 验证 name 唯一性（数据库层面已有 UNIQUE 约束，catch 错误即可）
3. 调用 generateApiKey() 生成 key pair
4. 创建 creator 记录（存 hash）
5. 返回 { creator_id, api_key（明文）, message: "API Key 仅展示一次，请妥善保存" }

临时方案备注：因为 MVP 阶段 profiles 表依赖 auth.users，而我们暂不做 OAuth，
所以改为：创建一个独立的 creator_owners 表或者直接在 creators 表中存 email。
请选择最简单的方案：在 creators 表加一个 owner_email TEXT 字段代替 owner_id，
同时把 profiles 表相关的 FK 和 trigger 先注释掉，Week 2 再迁移。

### Part C：种子数据脚本

创建 scripts/seed.ts（用 tsx 执行）：

1. 创建 3 个 AI UP 主：
   - "AI科技日报" (niche: 科技, bio: "每日AI领域最新资讯速递")
   - "AI故事工坊" (niche: 娱乐, bio: "用AI讲述奇妙故事")
   - "AI知识课堂" (niche: 教育, bio: "AI帮你理解复杂概念")
2. 为每个 UP 主创建 5 条种子视频（共 15 条）
   - 使用假数据：标题、描述、tags 随机生成
   - video_url 用公开的 MP4 测试链接（如 sample-videos.com 的测试视频）
   - status 直接设为 'published'（跳过审核流程）
   - 用 Cloudflare 的 placeholder 或直接赋值 playback URL
3. 在 package.json 添加 script: "seed": "tsx scripts/seed.ts"

### Part D：部署上线检查清单

确保以下所有项都 OK：
- [ ] Vercel 环境变量已配置（所有 .env.local 中的变量）
- [ ] Supabase 数据库表已创建
- [ ] Cloudflare Stream 已开通
- [ ] Cloudflare Webhook URL 已配置为 https://botbili.com/api/webhooks/cloudflare
- [ ] pnpm build 无报错
- [ ] git push 到 main 分支触发 Vercel 自动部署
```

---

## 全局编码规范（Cursor 必须遵守）

```
1. 语言：TypeScript 严格模式，不使用 any（除非真的必要，加注释说明）
2. 组件：全部函数组件，不用 class component
3. 数据获取：Server Component 优先，只有需要交互的组件才用 "use client"
4. 样式：只用 Tailwind CSS + shadcn/ui，不写自定义 CSS 文件
5. 命名：
   - 文件名：kebab-case（video-card.tsx）
   - 组件名：PascalCase（VideoCard）
   - 函数名：camelCase（getVideoById）
   - 类型名：PascalCase（UploadRequest）
6. 错误处理：所有 API route 都用 try-catch 包裹，统一错误格式
7. 环境变量：服务端用 process.env.XXX，客户端用 NEXT_PUBLIC_ 前缀
8. import 顺序：React/Next → 第三方库 → 本地 lib → 本地 components → 类型
9. 不要安装没在技术栈中列出的依赖，除非我明确要求
10. 注释：关键逻辑写中文注释，简短即可
```

---

## 每天结束时的自检项

每完成一天的任务后，确认：
- [ ] pnpm build 无报错
- [ ] pnpm dev 能正常运行
- [ ] 新增的 API 用 curl 测试通过
- [ ] 新增的页面在浏览器中正常显示
- [ ] 没有引入不必要的依赖
- [ ] TypeScript 无 type error
