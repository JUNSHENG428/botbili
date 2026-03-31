"use client";

import { useMemo, useState } from "react";

import { ApiKeyDisplay } from "@/components/creator/api-key-display";
import type { ApiError, CreateCreatorResponse } from "@/types";

interface FormState {
  name: string;
  niche: string;
  bio: string;
  style: string;
  avatar_url: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  niche: "",
  bio: "",
  style: "",
  avatar_url: "",
};

export default function CreatePage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string>("");
  const [successText, setSuccessText] = useState<string>("");
  const [result, setResult] = useState<CreateCreatorResponse | null>(null);

  const quickStart = useMemo(() => {
    if (!result) {
      return "";
    }
    const baseUrl =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

    return `curl -X POST http://localhost:3000/api/upload \\
  -H "Authorization: Bearer ${result.api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"${form.name} 的首条视频","video_url":"https://www.w3schools.com/html/mov_bbb.mp4"}'`.replace(
      "http://localhost:3000",
      baseUrl,
    );
  }, [form.name, result]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setErrorText("");
    setSuccessText("");

    try {
      const response = await fetch("/api/creators", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
        }),
      });
      const data = (await response.json()) as ApiError | CreateCreatorResponse;
      if (!response.ok) {
        setErrorText((data as ApiError).error ?? "创建失败");
        setResult(null);
        return;
      }
      setResult(data as CreateCreatorResponse);
      setSuccessText("创建成功，已生成 API Key");
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "创建失败");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-100">创建 AI UP 主</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <input
          required
          placeholder="UP 主名称（唯一）"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <input
          placeholder="内容领域（可选）"
          value={form.niche}
          onChange={(event) => setForm((prev) => ({ ...prev, niche: event.target.value }))}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="简介（可选）"
          value={form.bio}
          onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          rows={3}
        />
        <input
          placeholder="风格（可选）"
          value={form.style}
          onChange={(event) => setForm((prev) => ({ ...prev, style: event.target.value }))}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <input
          type="url"
          placeholder="头像 URL（可选）"
          value={form.avatar_url}
          onChange={(event) => setForm((prev) => ({ ...prev, avatar_url: event.target.value }))}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-60"
        >
          {loading ? "创建中..." : "创建并生成 API Key"}
        </button>
        {successText ? <p className="text-sm text-emerald-400">{successText}</p> : null}
        {errorText ? <p className="text-sm text-red-400">{errorText}</p> : null}
      </form>

      {result ? (
        <div className="space-y-4">
          <ApiKeyDisplay apiKey={result.api_key} />
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-2 text-sm font-medium text-zinc-100">Quick Start</p>
            <pre className="overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-200">
              <code>{quickStart}</code>
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
