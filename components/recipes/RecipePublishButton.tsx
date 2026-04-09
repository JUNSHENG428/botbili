"use client";

import { useState } from "react";

import { AuroraButton } from "@/components/design/aurora-button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface RecipePublishButtonProps {
  recipeId: string;
  currentStatus: string;
  onPublished: () => void;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export function RecipePublishButton({
  recipeId,
  currentStatus,
  onPublished,
}: RecipePublishButtonProps) {
  const { toast } = useToast();
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    setPublishing(true);

    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "published",
          visibility: "public",
        }),
      });

      const payload = (await response.json()) as ApiResponse<{ recipe: { id: string } }>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "发布 Recipe 失败");
      }

      toast("Recipe 已发布，现在社区可以发现它了 🎉", { variant: "success" });
      onPublished();
    } catch (error) {
      toast(error instanceof Error ? error.message : "发布 Recipe 失败", { variant: "error" });
    } finally {
      setPublishing(false);
    }
  }

  if (currentStatus === "published") {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
        已发布
      </Badge>
    );
  }

  if (currentStatus !== "draft") {
    return null;
  }

  return (
    <AuroraButton className="w-full justify-center" disabled={publishing} onClick={() => void handlePublish()}>
      {publishing ? "发布中…" : "发布 Recipe"}
    </AuroraButton>
  );
}
