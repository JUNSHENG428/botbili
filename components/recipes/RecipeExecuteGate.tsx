import type { ReactNode } from "react";

interface RecipeExecuteGateProps {
  children: ReactNode;
  recipeId: string;
}

export function RecipeExecuteGate({ children, recipeId }: RecipeExecuteGateProps) {
  // TODO: 等 Pro 真正接入后，在这里根据 recipeId / 用户套餐做执行额度门控。
  // if (execCount >= FREE_LIMIT && !isPro) { show upgrade prompt }
  void recipeId;

  return (
    <div className="space-y-2">
      {children}
      <p className="text-center text-xs text-zinc-500">免费计划：每小时可执行 10 次</p>
    </div>
  );
}
