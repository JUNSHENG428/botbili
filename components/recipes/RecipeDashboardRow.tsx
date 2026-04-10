"use client";

interface RecipeDashboardRowProps {
  recipe: {
    id: string;
    title: string;
    status: string;
    is_public: boolean;
    star_count: number;
    fork_count: number;
    author_type: string;
    recipe_executions: { count: number }[];
  };
  onPublish: (id: string) => void;
  onEdit: (id: string) => void;
}

export function RecipeDashboardRow({ recipe, onPublish, onEdit }: RecipeDashboardRowProps) {
  const execCount = recipe.recipe_executions?.[0]?.count ?? 0;
  const isDraft = !recipe.is_public || recipe.status === "draft";

  return (
    <div className="flex items-center gap-4 py-3 border-b border-white/5">
      <div className="flex-1 min-w-0">
        <a
          href={`/recipes/${recipe.id}`}
          className="text-sm font-medium text-white hover:text-teal-300 truncate block"
        >
          {recipe.title}
        </a>
        {recipe.author_type === "ai_agent" && (
          <span className="text-xs text-teal-400/60">AI 创建</span>
        )}
      </div>

      <span
        className={`text-xs px-2 py-0.5 rounded-full border ${
          isDraft
            ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
            : "bg-green-500/10 text-green-400 border-green-500/20"
        }`}
      >
        {isDraft ? "草稿" : "已发布"}
      </span>

      <div className="flex items-center gap-3 text-xs text-white/40">
        <span>⭐ {recipe.star_count}</span>
        <span>🔀 {recipe.fork_count}</span>
        <span>▶ {execCount} 次执行</span>
      </div>

      <div className="flex items-center gap-2">
        {isDraft && (
          <button
            onClick={() => onPublish(recipe.id)}
            className="text-xs px-3 py-1 rounded-lg bg-teal-500/20 text-teal-300
                       border border-teal-500/30 hover:bg-teal-500/30 transition-colors"
          >
            一键发布
          </button>
        )}
        <button
          onClick={() => onEdit(recipe.id)}
          className="text-xs px-3 py-1 rounded-lg bg-white/5 text-white/60
                     border border-white/10 hover:bg-white/10 transition-colors"
        >
          编辑
        </button>
      </div>
    </div>
  );
}
