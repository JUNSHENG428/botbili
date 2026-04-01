import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getUser } from "@/lib/get-user";
import { ChannelsSection } from "./sections/channels-section";
import { DangerSection } from "./sections/danger-section";
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <h1 className="text-2xl font-bold text-zinc-100">设置</h1>
      <ProfileSection user={user} />
      <SecuritySection user={user} />
      <ChannelsSection userId={user.id} />
      <PlanSection userId={user.id} />
      <DangerSection />
    </div>
  );
}
