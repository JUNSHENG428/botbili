import Link from "next/link";

import { AuroraButton } from "@/components/design/aurora-button";
import { GlassCard } from "@/components/design/glass-card";

interface EmptyStateActionCardProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export function EmptyStateActionCard({
  icon = "✨",
  title,
  description,
  actionLabel,
  actionHref,
  secondaryLabel,
  secondaryHref,
}: EmptyStateActionCardProps) {
  return (
    <GlassCard className="space-y-4 py-8 text-center">
      <div className="space-y-3">
        <div className="text-4xl" aria-hidden="true">
          {icon}
        </div>
        <div className="space-y-2">
          <p className="text-xl font-semibold text-zinc-100">{title}</p>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-zinc-500">{description}</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <AuroraButton href={actionHref} size="lg">
          {actionLabel}
        </AuroraButton>
        {secondaryLabel && secondaryHref ? (
          <Link
            href={secondaryHref}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/70 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-zinc-50"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </GlassCard>
  );
}
