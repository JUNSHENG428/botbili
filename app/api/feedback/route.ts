import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

const VALID_TYPES = ["bug", "feature", "partnership", "general"] as const;
type FeedbackType = (typeof VALID_TYPES)[number];

interface FeedbackBody {
  type?: string;
  name?: string;
  email?: string;
  agent_id?: string;
  subject?: string;
  body?: string;
  page_url?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw = (await req.json()) as FeedbackBody;

    if (!raw.type || !VALID_TYPES.includes(raw.type as FeedbackType)) {
      return NextResponse.json(
        { error: "type 必须是 bug | feature | partnership | general", code: "VALIDATION_TYPE" },
        { status: 400 },
      );
    }

    const subject = raw.subject?.trim();
    const body = raw.body?.trim();

    if (!subject || !body) {
      return NextResponse.json(
        { error: "subject 和 body 为必填", code: "VALIDATION_REQUIRED" },
        { status: 400 },
      );
    }

    const isAgent = req.headers.get("authorization")?.startsWith("Bearer ");
    const source = isAgent ? "agent" : "human";

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("feedback")
      .insert({
        type: raw.type,
        source,
        name: raw.name || null,
        email: raw.email || null,
        agent_id: raw.agent_id || null,
        subject: subject.slice(0, 200),
        body: body.slice(0, 5000),
        page_url: raw.page_url || req.headers.get("referer") || null,
        user_agent: req.headers.get("user-agent") || null,
      })
      .select("id, created_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      { message: "反馈已收到，感谢！", id: data.id, created_at: data.created_at },
      { status: 201 },
    );
  } catch (err) {
    console.error("Feedback submission error:", err);
    return NextResponse.json(
      { error: "提交失败，请稍后再试", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
