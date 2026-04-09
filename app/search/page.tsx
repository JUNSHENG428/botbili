"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { RecipeCard } from "@/components/recipes";
import type { Recipe } from "@/types/recipe";

interface RecipeAuthor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  author_type: "human" | "ai_agent";
}

interface SearchResponse {
  success: boolean;
  data?: {
    recipes: Array<Recipe & { author: RecipeAuthor }>;
    total: number;
    hasMore: boolean;
  };
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Array<Recipe & { author: RecipeAuthor }>>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/recipes?q=${encodeURIComponent(q.trim())}&limit=30&sort=trending`);
      if (res.ok) {
        const data = (await res.json()) as SearchResponse;
        setResults(data.success && data.data ? data.data.recipes : []);
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery.trim().length >= 2) {
      setQuery(initialQuery);
      void doSearch(initialQuery);
    }
  }, [initialQuery, doSearch]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    void doSearch(query);
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      {/* 搜索框 */}
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索 Recipe、作者、工作流…"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 py-3.5 pl-12 pr-4 text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-cyan-500/50"
        />
      </form>

      {/* 结果区 */}
      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-cyan-400" />
          </div>
        ) : searched && results.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg text-zinc-400">未找到相关结果</p>
            <p className="mt-1 text-sm text-zinc-600">试试搜索一个主题、作者或工作流？</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">
              找到 {results.length} 个结果
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {results.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          </div>
        ) : !searched ? (
          <div className="py-16 text-center text-zinc-500">
            <Search className="mx-auto mb-3 h-10 w-10 text-zinc-700" />
            <p>输入关键词搜索 Recipe</p>
            <p className="mt-1 text-sm text-zinc-600">
              支持按标题、说明和 README 关键词搜索
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <SearchContent />
    </Suspense>
  );
}
