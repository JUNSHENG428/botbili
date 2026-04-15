# BotBili Recipe 护城河升级 — Cursor 开发指令

> **战略背景**：字节（剪映/CapCut）的带货脚本数据分散在不同产品线，无法形成统一的带货效果数据资产；且字节没有动力为中小商家建立开放的 Recipe 共享社区，因为这与其内容平台的封闭生态逻辑相悖。BotBili 的护城河必须建立在「用户越贡献越离不开」的飞轮上，而不是「用户走不了」的锁定逻辑。
>
> 本 Prompt 专注于将现有 Recipe 功能升级为**不可复制的数据资产飞轮**。
>
> **当前项目状态**：已有 `/recipes`（列表页）、`/recipes/[id]`（详情页）、`/recipes/new`（创建页）、`/api/recipes`、`/api/executions`、`/api/leaderboard`。不要重复建已有的基础结构，直接在其上叠加护城河功能。

---

## 核心战略：三层数据飞轮

```
第一层：执行数据沉淀
  用户执行 Recipe → 记录执行结果（成功率/耗时/输出视频）→ 形成带货效果数据库

第二层：社区信号放大
  执行数据 → 计算 Recipe 真实效果分 → 驱动 Trending 排序 → 吸引更多执行

第三层：贡献者身份资产
  高质量 Recipe 作者 → 获得声誉积分 → 形成不可迁移的平台身份 → 无法带走去字节
```

**这三层字节都建不了**：第一层需要开放社区；第二层需要跨作者数据汇聚；第三层需要公开的贡献者声誉系统。

---

## Sprint 1：执行数据闭环（最高优先级）

### 目标
把「执行」从简单的点击行为升级为**结构化数据事件**，每次执行都沉淀可分析的带货效果信号。

### 任务 1-A：升级 executions 表 Schema

在 Supabase SQL Editor 执行以下迁移：

```sql
-- 如果 executions 表已存在，执行 ALTER；如果不存在，执行 CREATE
-- 先检查：SELECT column_name FROM information_schema.columns WHERE table_name = 'executions';

ALTER TABLE public.executions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS duration_seconds INT,           -- 执行耗时
  ADD COLUMN IF NOT EXISTS output_video_id UUID REFERENCES public.videos(id),  -- 执行产出的视频
  ADD COLUMN IF NOT EXISTS output_metrics JSONB DEFAULT '{}',  -- 带货效果数据: views/likes/revenue
  ADD COLUMN IF NOT EXISTS notes TEXT,                     -- 用户执行备注（改了哪些参数）
  ADD COLUMN IF NOT EXISTS fork_depth INT DEFAULT 0,       -- 第几层 Fork（原版=0, Fork一次=1）
  ADD COLUMN IF NOT EXISTS parent_execution_id UUID REFERENCES public.executions(id);  -- 从哪次执行 Fork 来的

-- 给 recipes 表加效果汇总字段（冗余存储，避免每次聚合查询）
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS execution_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_rate NUMERIC(4,3) DEFAULT 0,   -- 0.000 ~ 1.000
  ADD COLUMN IF NOT EXISTS avg_duration_seconds INT,
  ADD COLUMN IF NOT EXISTS effect_score NUMERIC(6,2) DEFAULT 0,   -- 综合效果分（见计算逻辑）
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ;

-- 索引
CREATE INDEX IF NOT EXISTS idx_executions_recipe ON public.executions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_executions_user ON public.executions(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON public.executions(status);
CREATE INDEX IF NOT EXISTS idx_recipes_effect_score ON public.recipes(effect_score DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_execution_count ON public.recipes(execution_count DESC);
```

### 任务 1-B：执行结果回写 API

**文件：`app/api/executions/[id]/complete/route.ts`**

实现 `PATCH /api/executions/[id]/complete`，用于 Agent 执行完毕后回写结果：

```typescript
// 请求体
interface CompleteExecutionRequest {
  status: 'completed' | 'failed' | 'cancelled';
  duration_seconds?: number;
  output_video_id?: string;          // 如果产出了视频
  output_metrics?: {
    views_24h?: number;              // 视频发布24小时播放量
    likes_count?: number;
    revenue_cny?: number;            // 带货收益（可选填）
    ctr_percent?: number;            // 点击率
  };
  notes?: string;
}
```

完整逻辑：
1. 验证 Bearer token（同现有 auth.ts）
2. 确认该 execution 属于当前 creator
3. 更新 executions 表（status, duration, output_video_id, output_metrics, notes）
4. 触发 Recipe 效果分重新计算（调用下面的 `recalculateRecipeStats` 函数）
5. 返回 200

**文件：`lib/recipe-stats.ts`**

```typescript
// 核心函数：重新计算并更新 recipe 的统计数据
export async function recalculateRecipeStats(recipeId: string): Promise<void>

// 计算逻辑：
// execution_count = COUNT(executions WHERE recipe_id = ? AND status != 'cancelled')
// success_rate = COUNT(status='completed') / execution_count
// avg_duration_seconds = AVG(duration_seconds WHERE status='completed')
// last_executed_at = MAX(created_at)

// effect_score 计算公式（综合效果分，越高排名越靠前）：
// base_score = execution_count * 1.0 + star_count * 3.0 + fork_count * 5.0
// recency_boost = 最近7天执行次数 * 2.0
// success_bonus = success_rate * 10.0
// quality_penalty = (1 - success_rate) * 5.0  // 成功率低的惩罚
// effect_score = base_score + recency_boost + success_bonus - quality_penalty
//
// 注意：output_metrics 里的数据是可选的，不要强依赖；没有带货数据时照常计算
```

---

## Sprint 2：Recipe 效果排行榜强化

### 目标
把 Leaderboard 从「谁最火」升级为「哪个 Recipe 真的有效」，这是字节永远给不了中小商家的数据。

### 任务 2-A：升级 `/api/leaderboard` 接口

**文件：`app/api/leaderboard/route.ts`**（在现有基础上扩展，不要删现有逻辑）

新增 `type` 查询参数，支持多种排行榜维度：

```
GET /api/leaderboard?type=effect_score    # 综合效果分（默认）
GET /api/leaderboard?type=execution_count # 执行次数排行
GET /api/leaderboard?type=success_rate    # 成功率排行（至少10次执行才上榜）
GET /api/leaderboard?type=trending        # 7日内热度（现有逻辑）
GET /api/leaderboard?type=contributor     # 贡献者声誉排行
```

每种排行榜返回：
- recipe/contributor 基本信息
- 该维度的核心数字（大字显示）
- 辅助指标（小字显示）
- 排名变化（本周 vs 上周，+2/-1/new）

**文件：`app/leaderboard/page.tsx`**（更新前端）

在现有排行榜页面顶部加 Tab 切换，默认显示「效果分」排行。

Tab 设计：
```
[综合效果] [执行次数] [成功率] [贡献者]
```

每行显示：排名 | Recipe名 | 作者 | 核心指标大数字 | 执行次数 | 成功率 | 本周变化

### 任务 2-B：Recipe 卡片升级

**文件：`components/recipes/RecipeCard.tsx`**（在现有 RecipeCard 基础上添加）

在现有卡片底部加一行「效果数据行」：

```tsx
// 效果数据行（只在 execution_count > 0 时显示）
<div className="flex items-center gap-3 text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-800">
  {execution_count > 0 && (
    <>
      <span>▶ {execution_count} 次执行</span>
      {success_rate > 0 && (
        <span className={success_rate >= 0.8 ? "text-green-500" : success_rate >= 0.5 ? "text-yellow-500" : "text-red-500"}>
          ✓ {Math.round(success_rate * 100)}% 成功率
        </span>
      )}
      {last_executed_at && (
        <span>最近 {formatRelativeTime(last_executed_at)}</span>
      )}
    </>
  )}
  {execution_count === 0 && (
    <span className="text-zinc-600">尚无执行记录</span>
  )}
</div>
```

**规则**：
- 不要改动现有卡片的任何其他样式
- 这一行是加法，不是替换
- Recipe type 定义里加 `execution_count`, `success_rate`, `last_executed_at` 字段

---

## Sprint 3：贡献者声誉系统

### 目标
让高质量 Recipe 作者在平台上积累**不可迁移的身份资产**。这是护城河最深的那一层。

### 任务 3-A：声誉积分 Schema

```sql
-- 用户声誉积分表
CREATE TABLE IF NOT EXISTS public.user_reputation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INT DEFAULT 0,
  recipe_points INT DEFAULT 0,        -- Recipe 贡献积分
  execution_points INT DEFAULT 0,     -- 执行贡献积分
  review_points INT DEFAULT 0,        -- 评审/评论积分
  level TEXT DEFAULT 'newcomer'
    CHECK (level IN ('newcomer', 'contributor', 'expert', 'master', 'legend')),
  level_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 积分流水表（用于展示「为什么得了这些分」）
CREATE TABLE IF NOT EXISTS public.reputation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INT NOT NULL,                -- 正数=加分，负数=扣分
  reason TEXT NOT NULL,               -- 'recipe_created', 'recipe_starred', 'recipe_forked', 'execution_completed', 'recipe_got_star'
  ref_id UUID,                        -- 关联的 recipe_id 或 execution_id
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_user ON public.user_reputation(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_log_user ON public.reputation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_total ON public.user_reputation(total_points DESC);
```

### 积分规则（写在 `lib/reputation.ts`）

```
创建 Recipe（被发布）：+10 分
Recipe 每获得 1 个 Star：+3 分
Recipe 每被 Fork 1 次：+5 分
Recipe 每被执行 1 次（成功）：+2 分
执行别人的 Recipe 并回写结果：+1 分
连续7天活跃（创建或执行）：+15 分 bonus

等级门槛：
newcomer    0 ~ 99 分
contributor 100 ~ 499 分
expert      500 ~ 1999 分
master      2000 ~ 9999 分
legend      10000+ 分
```

**文件：`lib/reputation.ts`**

```typescript
// 发放积分并更新等级
export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  refId?: string
): Promise<void>

// 计算并更新用户等级
function calculateLevel(totalPoints: number): string

// 批量检查连续活跃奖励（每天跑一次，用 Vercel Cron 或手动触发）
export async function checkStreakBonuses(): Promise<void>
```

**触发时机**（在现有相关 API 里添加调用，不要改动主逻辑）：
- `POST /api/recipes`（创建成功后）→ `awardPoints(userId, 10, 'recipe_created', recipeId)`
- `POST /api/recipes/[id]/star`（star 成功后）→ 给 recipe 作者 `awardPoints(authorId, 3, 'recipe_got_star', recipeId)`
- `POST /api/recipes/[id]/fork` → 给 recipe 作者 `awardPoints(authorId, 5, 'recipe_got_fork', recipeId)`
- `PATCH /api/executions/[id]/complete`（completed）→ `awardPoints(userId, 1, 'execution_completed', executionId)`

### 任务 3-B：用户主页显示声誉

**文件：`app/u/[username]/page.tsx`**（在现有用户页上添加，不要重写）

在用户头像旁边加：
```tsx
// 等级徽章
<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColors[user.level]}`}>
  {levelEmoji[user.level]} {levelLabel[user.level]}
</span>
// 总积分
<span className="text-sm text-zinc-400">{user.total_points} pts</span>
```

等级颜色方案：
```
newcomer    → zinc-600 背景，zinc-400 文字
contributor → blue-900 背景，blue-300 文字
expert      → purple-900 背景，purple-300 文字
master      → amber-900 背景，amber-300 文字
legend      → gradient from cyan-500 to purple-500（彩色渐变边框）
```

---

## Sprint 4：Fork 数据链路（差异化核心）

### 目标
让每次 Fork 都携带「从哪里来」的数据，形成 Recipe 演化图谱。这是字节的封闭生态根本无法复制的开放数据资产。

### 任务 4-A：Fork 链路追踪 Schema

```sql
-- 已有 fork 功能的话，确认 recipes 表里有这些字段；没有则添加
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS forked_from_id UUID REFERENCES public.recipes(id),
  ADD COLUMN IF NOT EXISTS fork_depth INT DEFAULT 0,   -- 0=原创, 1=Fork自原创, 2=Fork自Fork
  ADD COLUMN IF NOT EXISTS fork_count INT DEFAULT 0;   -- 被 Fork 次数

-- Fork 关系表（记录完整的 Fork 树）
CREATE TABLE IF NOT EXISTS public.recipe_forks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  forked_recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  forked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(original_recipe_id, forked_recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_forks_original ON public.recipe_forks(original_recipe_id);
CREATE INDEX IF NOT EXISTS idx_forks_forked ON public.recipe_forks(forked_recipe_id);
```

### 任务 4-B：Recipe 详情页加「Fork 家族」展示

**文件：`app/recipes/[id]/page.tsx`**（在现有详情页底部添加一个新 Section）

在页面底部加「Fork 家族」卡片：

```tsx
// 只在 fork_count > 0 时显示
<section className="mt-8 space-y-3">
  <h3 className="text-sm font-medium text-zinc-400">
    {fork_count} 个基于此 Recipe 的衍生版本
  </h3>
  <ForkFamilyList recipeId={recipe.id} />
</section>
```

**文件：`components/recipes/ForkFamilyList.tsx`**

展示该 Recipe 的直接 Fork 列表（最多显示6个）：
- 子 Recipe 标题 + 作者 + 执行次数 + 成功率
- 点击直接跳转到子 Recipe 详情
- 如果有更多，显示「查看全部 X 个衍生」→ 跳转到筛选了 `forked_from=id` 的列表页

**API：`GET /api/recipes/[id]/forks`**

返回该 Recipe 的直接 Fork 列表（只返回 published 状态的），join 作者信息和 execution_count。

---

## Sprint 5：智能推荐（防御字节的算法优势）

### 目标
用社区产生的结构化数据训练平台自己的推荐逻辑，而不是依赖视频消费数据（那是字节的主场）。

### 任务 5-A：基于执行历史的个性化推荐 API

**文件：`app/api/recipes/recommended/route.ts`**

```
GET /api/recipes/recommended?limit=6
```

推荐逻辑（按优先级顺序，找到足够数量就停止）：
1. 用户执行过的 Recipe 的同类目 Recipe（同 category），按 effect_score 排
2. 用户 Star 过的 Recipe 的作者的其他 Recipe
3. 用户所在 Fork 链路上游 Recipe 的相关推荐
4. 兜底：全局 trending（effect_score 最高的）

如果用户未登录，直接返回全局 trending。

**文件：`app/recipes/page.tsx`**（在现有页面顶部，搜索框上方添加「为你推荐」区域）

只对已登录用户显示，最多3个卡片，横向滚动，卡片样式用现有 RecipeCard。

---

## 全局注意事项

### 不要改动的部分
- 现有 `/recipes/page.tsx` 的筛选逻辑（RecipeFilters, URL params）
- 现有 RecipeCard 的主体样式（只加数据行，不改布局）
- 现有 auth 和 API Key 验证逻辑
- 技术栈（Next.js 15, Supabase, Cloudflare Stream, Tailwind + shadcn/ui）

### 数据安全规则
- `output_metrics` 里的 `revenue_cny` 字段：在 API 响应里**默认不返回**，只在用户查看自己的执行记录时才返回。避免商业敏感数据泄露。
- 声誉积分只能通过 `service_role` 写入，客户端 API 不能直接操作 reputation 表。
- Fork 深度上限：`fork_depth` 最大值 10，超过不允许继续 Fork（防止无限套娃）。

### 性能规则
- `recalculateRecipeStats` 不要在每次 API 请求里同步调用，用 `waitUntil` 或异步执行
- Leaderboard 数据缓存 5 分钟（用 Next.js `revalidate` 或 Redis，MVP 用 Next.js ISR 就够）
- 推荐 API 每次最多查3张表，不要做复杂 JOIN

### 数据库迁移顺序
必须按以下顺序执行 SQL（有外键依赖）：
1. 先 ALTER `executions` 表
2. 再 ALTER `recipes` 表加统计字段
3. 再创建 `user_reputation` 和 `reputation_log` 表
4. 最后创建 `recipe_forks` 表

---

## 每个 Sprint 完成标准

**Sprint 1 完成**：
- [ ] 执行完成后可以通过 API 回写 status 和 output_metrics
- [ ] `recipes` 表里的 `execution_count` 和 `success_rate` 在执行完成后自动更新
- [ ] curl 测试 `PATCH /api/executions/[id]/complete` 通过

**Sprint 2 完成**：
- [ ] Leaderboard 页面有 Tab 切换
- [ ] Recipe 卡片显示执行次数和成功率
- [ ] Effect score 排序生效

**Sprint 3 完成**：
- [ ] 创建 Recipe 后用户积分+10（在 user_reputation 表验证）
- [ ] 用户主页显示等级徽章
- [ ] Leaderboard 的「贡献者」Tab 可用

**Sprint 4 完成**：
- [ ] Fork 一个 Recipe 后，原 Recipe 的 fork_count+1
- [ ] Recipe 详情页底部显示 Fork 家族列表
- [ ] Fork 链路数据在 recipe_forks 表里有记录

**Sprint 5 完成**：
- [ ] 已登录用户在 /recipes 页面顶部看到「为你推荐」
- [ ] 推荐 API 返回结果与用户历史执行记录相关（手动验证）
