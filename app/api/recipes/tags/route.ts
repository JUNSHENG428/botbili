import { getPopularTags } from "@/lib/recipes";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  try {
    const tags = await getPopularTags(limit);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Failed to fetch popular tags:", error);
    return NextResponse.json(
      { error: "获取热门标签失败" },
      { status: 500 }
    );
  }
}