"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Search, Check } from "lucide-react";

import { GlassCard } from "@/components/design/glass-card";
import { formatViewCount } from "@/lib/format";

interface SearchResult {
  video_id: string;
  title: string;
  creator_name: string;
  creator_id: string;
  match_type: string;
  snippet: string;
  relevance_score: number;
  created_at: string;
  view_count: number;
}

interface SearchResponse {
  query: string;
  count: number;
  results: SearchResult[];
}

const MATCH_TYPE_LABEL: Record<string, string> = {
  semantic: "语义匹配",
  title: "标题匹配",
  transcript: "字幕匹配",
  summary: "摘要匹配",
  tags: "标签匹配",
};

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q.trim())}&limit=30`,
      );
      if (res.ok) {
        const data: SearchResponse = await res.json();
        setResults(data.results);
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
          placeholder="搜索视频、频道、标签…"
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
            <p className="mt-1 text-sm text-zinc-600">试试其他关键词？</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">
              找到 {results.length} 个结果
            </p>
            {results.map((r) => (
              <Link key={r.video_id} href={`/v/${r.video_id}`}>
                <GlassCard className="block transition hover:border-zinc-600">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-zinc-100">
                        {r.title}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        <Link
                          href={`/c/${r.creator_id}`}
                          className="text-cyan-400/80 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.creator_name}
                        </Link>
                        <span className="mx-2 text-zinc-600">·</span>
                        {formatViewCount(r.view_count)} 次观看
                      </p>
                      {r.snippet && (
                        <p className="mt-1.5 line-clamp-2 text-sm text-zinc-500">
                          {r.snippet}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                      {MATCH_TYPE_LABEL[r.match_type] ?? r.match_type}
                    </span>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        ) : !searched ? (
          <div className="py-16 text-center text-zinc-500">
            <Search className="mx-auto mb-3 h-10 w-10 text-zinc-700" />
            <p>输入关键词搜索视频内容</p>
            <p className="mt-1 text-sm text-zinc-600">
              支持标题、字幕、标签、语义搜索
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
