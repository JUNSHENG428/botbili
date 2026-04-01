import { GlassCard } from "@/components/design/glass-card";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

interface PlanSectionProps {
  userId: string;
}

interface CreatorPlanRow {
  id: string;
  name: string;
  plan_type: string;
  uploads_this_month: number;
  upload_quota: number;
  quota_reset_at: string;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  studio: "Studio",
};

const PLAN_STYLES: Record<string, string> = {
  free: "bg-zinc-800 text-zinc-400",
  pro: "bg-cyan-500/10 text-cyan-300",
  studio: "bg-purple-500/10 text-purple-400",
};

export async function PlanSection({ userId }: PlanSectionProps) {
  const supabase = getSupabaseAdminClient();

  const { data: creators } = await supabase
    .from("creators")
    .select("id, name, plan_type, uploads_this_month, upload_quota, quota_reset_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .returns<CreatorPlanRow[]>();

  const list = creators ?? [];

  // 汇总：显示用量最高的频道（MVP 阶段多频道共用套餐展示最高值）
  const primary = list[0];

  const plan = primary?.plan_type ?? "free";
  const used = primary?.uploads_this_month ?? 0;
  const quota = primary?.upload_quota ?? 30;
  const resetAt = primary?.quota_reset_at;
  const usePct = Math.min((used / Math.max(quota, 1)) * 100, 100);

  const resetLabel = resetAt
    ? new Date(resetAt).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
    : null;

  return (
    <GlassCard className="space-y-5">
      <h2 className="text-lg font-semibold text-zinc-100">订阅套餐</h2>

      {/* 套餐标签 */}
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${PLAN_STYLES[plan] ?? PLAN_STYLES.free}`}
        >
          {PLAN_LABELS[plan] ?? "Free"}
        </span>
        {primary ? (
          <span className="text-xs text-zinc-500">{primary.name}</span>
        ) : null}
      </div>

      {/* 用量进度条 */}
      {primary ? (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>本月上传</span>
            <span>
              {used} / {quota} 条
              {resetLabel ? <span className="ml-1 text-zinc-600">· {resetLabel} 重置</span> : null}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${usePct >= 90 ? "bg-red-400" : "bg-cyan-400"}`}
              style={{ width: `${usePct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">暂无频道，创建后可查看用量</p>
      )}

      {/* CTA */}
      {plan === "free" && primary ? (
        <a
          href="/pricing"
          className="block rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-center text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
        >
          升级到 Pro — 解锁 1,000 条/月
        </a>
      ) : plan !== "free" ? (
        <p className="text-xs text-zinc-500">
          如需管理订阅，请联系{" "}
          <a href="mailto:botbili2026@outlook.com" className="text-cyan-400 hover:underline">
            botbili2026@outlook.com
          </a>
        </p>
      ) : null}
    </GlassCard>
  );
}
