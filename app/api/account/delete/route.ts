import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteUserAccount } from "@/lib/account";
import { verifyCsrfOrigin } from "@/lib/csrf";

export async function POST(request: Request): Promise<NextResponse> {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "未登录", code: "unauthorized" },
        { status: 401 }
      );
    }

    const result = await deleteUserAccount(user.id);

    if (!result.success) {
      console.error("Account deletion failed:", result.error);
      return NextResponse.json(
        { error: "账号删除失败", code: "delete_failed", detail: result.error },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "账号已删除",
    });

    response.cookies.set("sb-access-token", "", { maxAge: 0 });
    response.cookies.set("sb-refresh-token", "", { maxAge: 0 });

    return response;
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "服务器错误", code: "internal_error" },
      { status: 500 }
    );
  }
}
