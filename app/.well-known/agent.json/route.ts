import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { discoverAgents, generateAgentCard } from "@/lib/agent-card";
import { getBaseUrl } from "@/lib/utils";
import type { ApiError } from "@/types";

/**
 * GET /.well-known/agent.json
 * 
 * A2A 协议标准端点，返回 Agent Card
 * 
 * Query params:
 * - creator: 创作者 slug 或 ID（可选，不提供则返回 Agent 发现列表）
 * - niche: 领域筛选（可选）
 * 
 * A2A 协议参考：https://github.com/google/A2A
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const creatorIdentifier = searchParams.get("creator");
    const niche = searchParams.get("niche") ?? undefined;
    const baseUrl = getBaseUrl();

    // 如果提供了 creator 标识，返回该 Agent 的 Card
    if (creatorIdentifier) {
      const agentCard = await generateAgentCard(creatorIdentifier, baseUrl);

      if (!agentCard) {
        return apiErrorResponse({
          message: "Agent not found or inactive",
          code: "AGENT_NOT_FOUND",
          status: 404,
        });
      }

      return NextResponse.json(agentCard, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600", // 缓存 1 小时
        },
      });
    }

    // 否则返回 Agent 发现列表
    const agents = await discoverAgents(baseUrl, 50, niche);

    return NextResponse.json({
      agents: agents.map((a) => ({
        ...a,
        agent_card_url: `${baseUrl}/.well-known/agent.json?creator=${a.slug}`,
      })),
      total: agents.length,
      niche: niche ?? "all",
      discovery_url: `${baseUrl}/.well-known/agent.json`,
    });
  } catch (error: unknown) {
    console.error("GET /.well-known/agent.json failed:", error);
    return apiErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }
}
