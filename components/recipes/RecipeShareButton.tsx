"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface RecipeShareButtonProps {
  recipeId: string;
  recipeTitle: string;
  recipeSlug: string;
}

export function RecipeShareButton({ recipeSlug, recipeTitle }: RecipeShareButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/recipes/${recipeSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("链接已复制", { variant: "success" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("复制失败，请手动复制", { variant: "error" });
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="border-zinc-700 bg-zinc-950/70"
      onClick={handleCopy}
      title={`分享：${recipeTitle}`}
    >
      {copied ? "✓ 已复制" : "分享"}
    </Button>
  );
}
