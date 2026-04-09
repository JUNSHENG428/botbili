export async function GET(request: Request): Promise<Response> {
  const { origin } = new URL(request.url);

  return Response.json(
    {
      success: false,
      error: {
        code: "RESOURCE_GONE",
        message: "视频 Feed 已下线，请改用 /api/recipes 发现和执行 Recipe。",
        docs_url: `${origin}/recipes`,
      },
    },
    { status: 410 },
  );
}
