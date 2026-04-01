import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { createClientForServer } from "@/lib/supabase/server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "majunsheng0428@gmail.com";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClientForServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    return apiErrorResponse({
      message: "Forbidden",
      code: "AUTH_FORBIDDEN",
      status: 403,
    });
  }

  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return apiErrorResponse({
      message: error.message,
      code: "INTERNAL_ERROR",
      status: 500,
    });
  }

  return NextResponse.json({ items: data });
}
