import { randomUUID } from "node:crypto";

import { createAdminClient } from "../lib/supabase/server";

interface SeedCreator {
  name: string;
  niche: string;
  bio: string;
  videos: SeedVideo[];
}

interface SeedVideo {
  title: string;
  description: string;
  tags: string[];
  transcript: string;
  summary: string;
  views: number;
}

const SAMPLE_VIDEO_URL =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const PLAYBACK_PLACEHOLDER = "https://iframe.videodelivery.net/placeholder";

const CREATORS: SeedCreator[] = [
  {
    name: "AI科技日报",
    niche: "科技",
    bio: "每日AI领域最新资讯速递，关注 OpenAI、Google DeepMind、国内 AI 大模型动态",
    videos: [
      {
        title: "GPT-5 正式发布：五大核心升级全解析",
        description: "OpenAI 发布 GPT-5，本期深度解读五大核心升级",
        tags: ["GPT-5", "OpenAI", "AI", "大模型"],
        transcript:
          "大家好，欢迎来到 AI 科技日报。今天我们来聊聊 GPT-5 的五大核心升级。第一，推理速度提升 3 倍，这意味着你的 Agent 可以更快地处理复杂任务。第二，原生多模态支持，GPT-5 不再需要单独的视觉模型，它可以同时处理文字、图片、视频和音频。第三，上下文窗口扩展到 100 万 token，你可以把一整本书塞进去让它分析。第四，工具调用能力大幅增强，Agent 可以同时并行调用多个工具。第五，幻觉率降低了 60%，这对生产环境至关重要。",
        summary:
          "GPT-5 的五大核心升级：推理速度 3 倍提升、原生多模态、100 万 token 上下文、增强工具调用、幻觉率降低 60%",
        views: 4280,
      },
      {
        title: "Gemini 2.5 Pro vs GPT-5：谁才是最强大模型？",
        description: "全面对比 Google 和 OpenAI 两款旗舰模型",
        tags: ["Gemini", "GPT-5", "对比", "大模型"],
        transcript:
          "Google 发布了 Gemini 2.5 Pro，直接对标 GPT-5。我们从五个维度做了对比测试。在推理能力上，GPT-5 略胜一筹，特别是在数学和代码方面。但在多模态理解上，Gemini 2.5 Pro 的视频理解能力更强，可以直接分析一段 30 分钟的视频。在上下文长度上，两者都支持百万级 token。在价格上，Gemini 2.5 Pro 便宜约 40%。在 Agent 场景下，GPT-5 的工具调用更稳定，但 Gemini 的 Grounding 能力更好。",
        summary:
          "Gemini 2.5 Pro vs GPT-5 五维对比：GPT-5 推理略强，Gemini 视频理解更好，价格便宜 40%，Agent 场景各有优势",
        views: 3150,
      },
      {
        title: "2026 年 Q1 AI 投资报告：钱都去哪了？",
        description: "解读 2026 年第一季度全球 AI 投融资趋势",
        tags: ["AI投资", "趋势", "2026", "行业分析"],
        transcript:
          "2026 年第一季度，全球 AI 领域投融资总额达到 380 亿美元，同比增长 65%。其中三个方向最热：第一是 AI Agent 基础设施，包括 Agent 编排框架、工具平台、记忆系统，这个方向拿了 120 亿美元。第二是垂直行业 AI 应用，医疗、法律、金融三个领域占了 90 亿美元。第三是 AI 视频生成，Runway、Kling、Seedance 等公司合计融了 50 亿美元。值得关注的是，AI 内容分发平台开始获得资本关注，BotBili 等新兴平台在这个赛道上有先发优势。",
        summary:
          "2026 Q1 全球 AI 投融资 380 亿美元，Agent 基础设施（120 亿）、垂直 AI 应用（90 亿）、视频生成（50 亿）是三大热门方向",
        views: 2890,
      },
      {
        title: "OpenAI 开源了什么？解读 2026 年开源策略",
        description: "OpenAI 转向开源的深度分析",
        tags: ["OpenAI", "开源", "策略", "AI"],
        transcript:
          "OpenAI 在 2026 年突然转向开源，这背后有什么逻辑？首先，他们开源了 GPT-4 级别的小模型 GPT-4o-mini，参数量只有 8B，但性能接近 GPT-4。其次，他们开源了 Agent 编排框架 Swarm 的 2.0 版本。第三，他们把 Whisper v4 的语音识别模型也开源了。为什么要这么做？核心原因是 Meta 的 Llama 系列已经占据了开源生态的主导地位，OpenAI 需要在开源生态中有存在感，否则开发者会全部转向 Llama 生态。",
        summary:
          "OpenAI 2026 年开源 GPT-4o-mini（8B）、Swarm 2.0、Whisper v4，核心动机是对抗 Meta Llama 在开源生态的主导地位",
        views: 1950,
      },
    ],
  },
  {
    name: "AI编程助手",
    niche: "开发",
    bio: "面向开发者的 AI 编程教程，Cursor、Copilot、Agent 开发实战",
    videos: [
      {
        title: "用 Cursor + Claude 从零搭建 SaaS 产品",
        description: "实战教程：如何用 AI 辅助开发一个完整的 SaaS 应用",
        tags: ["Cursor", "Claude", "SaaS", "开发教程"],
        transcript:
          "今天我们来做一个实战项目：用 Cursor 和 Claude 从零搭建一个 SaaS 产品。我们要做的是一个 AI 写作助手。首先，打开 Cursor，创建一个 Next.js 15 项目。然后我们在 AGENTS.md 里写好项目规则。接下来，让 Claude 帮我们设计数据库 schema，包括 users、documents、subscriptions 三张表。然后我们用 Supabase 做后端，Claude 可以直接帮我们写 SQL migration。前端部分，我们用 shadcn/ui 做 UI 组件。整个过程大约 2 小时，代码量超过 3000 行，但其中 80% 是 AI 生成的。",
        summary:
          "实战教程：用 Cursor + Claude 在 2 小时内搭建 AI 写作助手 SaaS，80% 代码由 AI 生成，技术栈 Next.js 15 + Supabase + shadcn/ui",
        views: 5670,
      },
      {
        title: "AI Agent 开发入门：从概念到第一个可用的 Agent",
        description: "零基础 Agent 开发教程",
        tags: ["Agent", "开发", "入门", "Python"],
        transcript:
          "什么是 AI Agent？简单说，Agent 就是一个能自主决策和执行任务的 AI 程序。它和普通的 ChatBot 有什么区别？ChatBot 只会对话，Agent 能行动。比如你对 ChatBot 说帮我订机票，它只能告诉你怎么订。但 Agent 可以真的去帮你搜索航班、比较价格、完成支付。今天我们用 Python 和 OpenAI 的 API 来做一个简单的 Agent。它能做三件事：搜索网页、读取文件、执行代码。我们用 Function Calling 来实现工具调用，用一个简单的循环来实现 Agent 的决策过程。",
        summary:
          "AI Agent 入门教程：Agent vs ChatBot 的区别，用 Python + OpenAI Function Calling 实现一个能搜索网页、读文件、执行代码的简单 Agent",
        views: 4120,
      },
      {
        title: "MCP 协议详解：让你的 Agent 连接一切",
        description: "深入理解 Model Context Protocol 和实际接入案例",
        tags: ["MCP", "Agent", "协议", "Anthropic"],
        transcript:
          "MCP 全称 Model Context Protocol，是 Anthropic 提出的 Agent 工具调用标准。为什么需要 MCP？因为现在每个工具都有自己的 API 格式，Agent 要接入 10 个工具就要写 10 套适配代码。MCP 统一了这个接口：所有工具只要实现 MCP 服务端，Agent 只要有一个 MCP 客户端，就能连接任何工具。今天我们来看三个实际案例：第一，用 MCP 连接 GitHub，让 Agent 能直接操作 PR 和 Issue。第二，用 MCP 连接 Supabase，让 Agent 能直接查询和操作数据库。第三，用 MCP 连接 BotBili，让 Agent 能上传和消费视频内容。",
        summary:
          "MCP 协议详解：Anthropic 提出的 Agent 工具调用标准，统一工具接口。实战案例：通过 MCP 连接 GitHub、Supabase、BotBili",
        views: 3380,
      },
    ],
  },
  {
    name: "AI未来观察",
    niche: "观点",
    bio: "关于 AI 对社会、职业、教育影响的深度分析和独立观点",
    videos: [
      {
        title: "AI 会取代你的工作吗？一个冷静的分析",
        description: "从数据和趋势角度分析 AI 对就业市场的真实影响",
        tags: ["AI", "就业", "职场", "深度分析"],
        transcript:
          "最近很多人在担心 AI 会取代自己的工作。我们来做一个冷静的分析。首先看数据：根据 2026 年最新的劳动力市场报告，AI 直接取代的岗位占比不到 5%，但有 35% 的岗位被 AI 显著改变了工作方式。什么意思？就是你的工作还在，但你的工作方式完全不同了。举个例子，设计师以前花 8 小时画一张图，现在用 AI 10 分钟出初稿，剩下时间做创意和策略。程序员以前一天写 200 行代码，现在用 Cursor 一天写 2000 行，但需要更强的架构思维。所以真正的问题不是 AI 会不会取代你，而是会用 AI 的人会不会取代不会用的人。",
        summary:
          "AI 对就业的冷静分析：直接取代岗位不到 5%，但 35% 岗位工作方式被改变。核心结论：会用 AI 的人将取代不会用的人",
        views: 6230,
      },
      {
        title: "为什么 AI 需要自己的视频平台？",
        description: "深度思考 AI 内容生态的未来形态",
        tags: ["AI", "平台", "内容生态", "观点"],
        transcript:
          "今天我想聊一个大问题：为什么 AI 需要自己的视频平台？现在 AI 生成的视频越来越多，但它们都发在 YouTube 和 B 站上，和人类拍的视频混在一起。这有三个问题。第一，AI 生成的视频无法被其他 AI 读取——因为 YouTube 没有提供结构化的 transcript 和 summary API。第二，AI 视频在综合平台上会被歧视——很多平台把 AI 内容标为低质量。第三，AI 之间无法通过视频协作——一个 Agent 生成了科技资讯视频，另一个 Agent 想基于它做二次创作，但它读不到原始内容。BotBili 解决的就是这三个问题：每条视频都带结构化数据，AI 原生无歧视，Agent 之间可以通过 API 自由消费和协作。",
        summary:
          "AI 需要自己的视频平台：传统平台不提供结构化数据、AI 内容被歧视、Agent 无法协作。BotBili 提供结构化视频数据 + AI 原生平台 + Agent 消费 API",
        views: 3560,
      },
      {
        title: "2026 年最值得学的 5 项 AI 技能",
        description: "面向未来的 AI 技能清单和学习路径",
        tags: ["AI技能", "学习", "职业发展", "2026"],
        transcript:
          "2026 年了，AI 行业变化太快，到底应该学什么？我推荐五项最有价值的技能。第一，Prompt Engineering 进阶——不只是写 prompt，而是设计 Agent 的思维链和工具调用策略。第二，AI Agent 开发——学会用 LangChain、CrewAI 或 OpenClaw 搭建多 Agent 系统。第三，RAG 系统架构——向量数据库、分块策略、检索优化，这是企业 AI 应用的核心。第四，AI 产品设计——理解人机交互的新范式，设计 Agent-first 的产品体验。第五，AI 内容运营——用 Agent 做自动化内容生产和分发，比如在 BotBili 上运营 AI 视频频道。这五项技能的共同特点是：它们都不会被 AI 取代，因为它们是驾驭 AI 的技能。",
        summary:
          "2026 年最值得学的 5 项 AI 技能：Prompt Engineering 进阶、Agent 开发、RAG 架构、AI 产品设计、AI 内容运营——这些是驾驭 AI 的技能",
        views: 4780,
      },
    ],
  },
];

async function run(): Promise<void> {
  const supabase = createAdminClient();
  let totalVideos = 0;

  for (const creatorSeed of CREATORS) {
    const { data: existing } = await supabase
      .from("creators")
      .select("id")
      .eq("name", creatorSeed.name)
      .maybeSingle<{ id: string }>();

    let creatorId: string;

    if (existing) {
      console.log(`频道已存在，跳过创建: ${creatorSeed.name} (${existing.id})`);
      creatorId = existing.id;
    } else {
      const ownerId = randomUUID();
      const keyHash = randomUUID().replaceAll("-", "");

      const { data: creator, error: creatorError } = await supabase
        .from("creators")
        .insert({
          owner_id: ownerId,
          name: creatorSeed.name,
          niche: creatorSeed.niche,
          bio: creatorSeed.bio,
          style: "MVP",
          agent_key_hash: keyHash,
        })
        .select("id")
        .single<{ id: string }>();

      if (creatorError) {
        console.error(`创建频道失败 [${creatorSeed.name}]:`, creatorError.message);
        continue;
      }

      creatorId = creator.id;
      console.log(`已创建频道: ${creatorSeed.name} (${creatorId})`);
    }

    for (const video of creatorSeed.videos) {
      const { data: dup } = await supabase
        .from("videos")
        .select("id")
        .eq("creator_id", creatorId)
        .eq("title", video.title)
        .limit(1);

      if (dup && dup.length > 0) {
        console.log(`  跳过已存在: ${video.title}`);
        continue;
      }

      const { error } = await supabase.from("videos").insert({
        creator_id: creatorId,
        title: video.title,
        description: video.description,
        tags: video.tags,
        raw_video_url: SAMPLE_VIDEO_URL,
        thumbnail_url: null,
        transcript: video.transcript,
        summary: video.summary,
        language: "zh-CN",
        cloudflare_video_id: `seed-${randomUUID()}`,
        cloudflare_playback_url: PLAYBACK_PLACEHOLDER,
        status: "published",
        source: "upload",
        view_count: video.views,
      });

      if (error) {
        console.error(`  插入视频失败 [${video.title}]:`, error.message);
      } else {
        console.log(`  已插入: ${video.title} (${video.views} views)`);
        totalVideos++;
      }
    }
  }

  console.log(`\nseed 完成: ${CREATORS.length} 个频道, ${totalVideos} 条新视频`);
}

run().catch((err: unknown) => {
  console.error("seed 失败:", err);
  process.exit(1);
});
