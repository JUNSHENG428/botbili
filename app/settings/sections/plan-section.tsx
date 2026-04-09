"use client";

import { useState } from "react";

import { AuroraButton } from "@/components/design/aurora-button";
import { GlassCard } from "@/components/design/glass-card";
import { useToast } from "@/components/ui/toast";

interface PlanSectionProps {
  userId: string;
}

interface PlanFeature {
  label: string;
  value: string;
}

const FREE_PLAN: PlanFeature[] = [
  { label: "创建 Recipe", value: "最多 5 个" },
  { label: "执行 Recipe", value: "10 次/小时" },
  { label: "社区发现", value: "✓" },
  { label: "Agent API", value: "✓（基础）" },
];

const PRO_PLAN: PlanFeature[] = [
  { label: "创建 Recipe", value: "无限" },
  { label: "执行 Recipe", value: "100 次/小时" },
  { label: "优先执行队列", value: "✓" },
  { label: "执行历史", value: "90 天" },
  { label: "矩阵批量执行", value: "✓" },
  { label: "私有 Recipe 团队分享", value: "✓" },
];

function PlanFeatureList({ items }: { items: PlanFeature[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between gap-4 border-b border-zinc-800/80 pb-3 text-sm last:border-b-0 last:pb-0"
        >
          <span className="text-zinc-400">{item.label}</span>
          <span className="text-right font-medium text-zinc-100">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function PlanSection({ userId }: PlanSectionProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleUpgradeWaitlist() {
    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "feature",
          subject: "Pro 计划候补名单",
          body: `用户 ${userId} 点击了 Pro 计划候补按钮，期望升级到 Recipe Pro。`,
          page_url: "/settings",
        }),
      });

      toast("Pro 计划即将上线，你已加入候补名单", { variant: "success" });
    } catch {
      toast("已记录你的升级意向，稍后我们会开放 Pro 计划", { variant: "info" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-zinc-100">订阅计划</h2>
        <p className="text-sm text-zinc-500">
          先用 Free 跑通你的第一个 Recipe，再决定是否升级到更高的执行额度和团队协作能力。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-5">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300">
              Free 计划
            </div>
            <div>
              <p className="text-2xl font-semibold text-zinc-100">当前方案</p>
              <p className="mt-1 text-sm text-zinc-500">适合刚开始构建 Recipe、验证执行闭环的个人创作者。</p>
            </div>
          </div>

          <PlanFeatureList items={FREE_PLAN} />
        </GlassCard>

        <GlassCard className="space-y-5 border-cyan-500/20 bg-cyan-500/[0.03]">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              Pro 计划
            </div>
            <div>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-semibold text-zinc-100">¥29/月</p>
                <span className="pb-1 text-xs text-zinc-500">占位价</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                面向稳定更新频道、需要更高执行吞吐和矩阵能力的创作者团队。
              </p>
            </div>
          </div>

          <PlanFeatureList items={PRO_PLAN} />

          <AuroraButton disabled={submitting} onClick={() => void handleUpgradeWaitlist()}>
            {submitting ? "加入中…" : "立即升级"}
          </AuroraButton>
        </GlassCard>
      </div>
    </div>
  );
}
