import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RecipeCommentType = "question" | "feedback" | "optimization" | "matrix" | "bug";

const COMMENT_TYPE_META: Record<
  RecipeCommentType,
  {
    emoji: string;
    label: string;
    className: string;
  }
> = {
  question: {
    emoji: "❓",
    label: "提问",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  },
  feedback: {
    emoji: "💡",
    label: "反馈",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  optimization: {
    emoji: "⚡",
    label: "优化",
    className: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  },
  matrix: {
    emoji: "📊",
    label: "矩阵",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  bug: {
    emoji: "🐛",
    label: "问题",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  },
};

interface CommentTypeBadgeProps {
  type: RecipeCommentType;
  className?: string;
}

export function CommentTypeBadge({ type, className }: CommentTypeBadgeProps) {
  const meta = COMMENT_TYPE_META[type];

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border px-2 py-0.5 text-[11px] font-medium", meta.className, className)}
      title={meta.label}
    >
      <span aria-hidden="true">{meta.emoji}</span>
      <span>{meta.label}</span>
    </Badge>
  );
}
