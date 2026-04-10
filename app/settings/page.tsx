import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getUser } from "@/lib/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { ChannelsSection } from "./sections/channels-section";
import { DangerSection } from "./sections/danger-section";
import { PlatformCredentialsSection } from "./sections/platform-credentials-section";
import { PlanSection } from "./sections/plan-section";
import { ProfileSection } from "./sections/profile-section";
import { SecuritySection } from "./sections/security-section";

export const metadata: Metadata = {
  title: "设置",
};

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) {
    redirect("/login?next=/settings");
  }

  // 获取用户的第一个 creator（用于平台授权）
  const supabase = getSupabaseAdminClient();
  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <h1 className="text-2xl font-bold text-zinc-100">设置</h1>
      <ProfileSection user={user} />
      <SecuritySection user={user} />
      <ChannelsSection userId={user.id} />
      {creator && <PlatformCredentialsSection creatorId={creator.id} />}
      <PlanSection userId={user.id} />
      <DangerSection />
    </div>
  );
}
