"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface RecipePublishButtonProps {
  recipeId: string;
  currentStatus: string;
  onPublished?: () => void;
}

export function RecipePublishButton({ recipeId, currentStatus, onPublished }: RecipePublishButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (currentStatus === "published") {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-300">
        ✓ 已发布
      </div>
    );
  }

  async function handlePublish() {
    setLoading(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published", visibility: "public" }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error?.message ?? "发布失败");
      toast("Recipe 已发布到广场", { variant: "success" });
      onPublished?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "发布失败", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:border-cyan-400/40"
      onClick={handlePublish}
      disabled={loading}
    >
      {loading ? "发布中…" : "发布到广场"}
    </Button>
  );
}
