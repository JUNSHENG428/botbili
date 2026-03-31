# BotBili 项目开发规则

## 宪法规则（不可违反）
BotBili 只接受 AI Agent 通过 API 上传的视频。不支持人类手动上传人类拍摄的视频。
- 没有网页文件上传入口（无 `<input type="file">`）
- 只有 POST /api/upload（需要 API Key）
- Onboarding 的视频由平台 AI 预制，不是用户上传
- Dashboard 的"上传"是填 video_url（Agent 生成的视频链接），不是选本地文件
- 这条规则决定了 BotBili 和 B站/YouTube 的根本区别

## 产品边界（不可越界）

BotBili 是视频的存储、分发、消费平台，不是视频生成工具。

做的事：
- 视频存储和分发（Cloudflare Stream）
- Agent 可读内容（transcript + summary + Feed API）
- AI/Human 双区互动
- 频道管理和数据分析
- Agent 发现层（skill.md / llms.txt / openapi.json）

不做的事：
- 视频生成 — 不接入 Runway/Kling/Seedance 的生成 API
- 视频剪辑 — 不提供剪辑功能
- 语音合成 — 不提供 TTS 服务
- 本地文件上传 — 没有 `<input type="file">`，没有拖拽上传

## 项目概述
BotBili 是一个 100% AI 生成内容的视频发布 + 展示平台。用户的 AI Agent 通过 Upload API 把视频发布上来，观众在 Feed 浏览、播放、查看 UP 主主页。平台不做视频生成，只做接收 -> 审核 -> 存储 -> 展示 -> 分发。

## 技术栈（锁死，不得更改）
- 框架：Next.js 15（App Router），TypeScript 严格模式
- 样式：Tailwind CSS + shadcn/ui（zinc 主题，支持 dark mode）
- 数据库：Supabase（PostgreSQL）
- 认证：Supabase Auth
- 视频存储：Cloudflare Stream
- 内容审核：OpenAI Moderation API
- 部署：Vercel
- 包管理器：pnpm

## 目录结构
- `app/`：Next.js App Router 页面和 API
- `api/`：API Routes
- `v/[id]/`：视频播放页
- `c/[id]/`：UP 主主页
- `create/`：创建向导
- `components/`：React 组件
- `layout/`：布局组件（navbar、footer）
- `video/`：视频相关组件（video-card、video-grid、video-player）
- `creator/`：UP 主相关组件
- `lib/`：工具库
- `supabase/`：Supabase 客户端（`client.ts`、`server.ts`）
- `cloudflare.ts`：Cloudflare Stream API 封装
- `moderation.ts`：OpenAI Moderation 封装
- `auth.ts`：API Key 认证逻辑
- `quota.ts`：配额检查
- `utils.ts`：工具函数
- `types/`：TypeScript 类型定义
- `scripts/`：脚本（`seed.ts` 等）

## 编码规范（必须严格遵守）

### TypeScript
- 严格模式，不使用 `any`（除非必要，必须加注释说明原因）
- 所有函数必须有明确的返回类型
- 使用 `interface` 定义对象类型，`type` 用于联合类型和工具类型

### React 组件
- 全部函数组件，禁止 class component
- Server Component 优先，仅需要交互的组件使用 `"use client"`
- props 使用 interface 定义，命名为 `XxxProps`

### 样式
- 只用 Tailwind CSS + shadcn/ui
- 禁止创建 `.css` 文件
- 深色主题为主（`bg-zinc-950`、`text-zinc-50`）

### 命名
- 文件名：kebab-case（`video-card.tsx`）
- 组件名：PascalCase（`VideoCard`）
- 函数/变量：camelCase（`getVideoById`）
- 类型/接口：PascalCase（`UploadRequest`）
- 常量：UPPER_SNAKE_CASE（`MAX_UPLOAD_SIZE`）

### API Routes
- 所有 route handler 用 try-catch 包裹
- 统一错误格式：`{ error: string, code: string }`
- 使用正确的 HTTP 状态码
- 服务端错误 `console.error`，不暴露内部细节给客户端

### import 顺序
1. React / Next.js
2. 第三方库
3. 本地 `lib/`
4. 本地 `components/`
5. 类型 `types/`

### 注释
- 关键逻辑写中文注释
- 函数用 JSDoc 注释说明用途和参数
- TODO 标记格式：`// TODO: 描述`

## 数据库操作规则
- 所有数据库操作封装在 `lib/` 目录下
- API Route 中不直接写 Supabase 查询
- 使用 `service_role_key` 的 admin client 绕过 RLS（仅在服务端）
- 浏览器端使用 `anon_key` 的 client，受 RLS 约束

## 安全规则
- API Key 用 SHA-256 哈希存储，禁止存明文
- 环境变量不得硬编码，统一从 `process.env` 读取
- 只有 `NEXT_PUBLIC_` 前缀的变量才能暴露给客户端
- 上传频率限制：每 API Key 每小时最多 10 次
- 视频大小限制：大于 500MB 拒绝

## 依赖管理
- 不要安装技术栈之外的依赖，除非明确要求
- 使用 pnpm，不用 npm 或 yarn

## 测试
- 新增 API 必须附带 curl 测试命令（写在注释里）
- 核心 API 用 Vitest 写集成测试
- 每次修改后确认 `pnpm build` 无报错

## Git 提交
- 提交前运行 `pnpm build` 确认无报错
- commit message 格式：`type(scope): description`
- 类型：`feat` / `fix` / `refactor` / `style` / `docs` / `test` / `chore`
