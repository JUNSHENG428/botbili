"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2, X, Check, KeyRound, Copy } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  bio: string | null;
  niche: string;
  style: string | null;
  avatar_url: string | null;
  followers_count: number;
  uploads_this_month: number;
  upload_quota: number;
}

interface ChannelCardProps {
  channel: Channel;
}

export function ChannelCard({ channel }: ChannelCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // 编辑表单
  const [bio, setBio] = useState(channel.bio ?? "");
  const [niche, setNiche] = useState(channel.niche);
  const [style, setStyle] = useState(channel.style ?? "");
  const [avatarUrl, setAvatarUrl] = useState(channel.avatar_url ?? "");

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/creators/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: bio.trim(),
          niche: niche.trim(),
          style: style.trim(),
          avatar_url: avatarUrl.trim() || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } catch {
      // 静默
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const res = await fetch(`/api/creators/${channel.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // 静默
    } finally {
      setSaving(false);
      setDeleting(false);
    }
  }

  async function handleRegenerateKey() {
    setSaving(true);
    try {
      const res = await fetch(`/api/creators/${channel.id}/regenerate-key`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setNewApiKey(data.api_key);
        setRegenerating(false);
      }
    } catch {
      // 静默
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyKey() {
    if (!newApiKey) return;
    try {
      await navigator.clipboard.writeText(newApiKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      // 静默
    }
  }

  function handleManageClick() {
    localStorage.setItem("botbili_creator_id", channel.id);
  }

  /* ── 新 Key 展示（生成成功后） ── */
  if (newApiKey) {
    return (
      <div className="space-y-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
        <p className="text-sm font-medium text-green-400">
          「{channel.name}」的新 API Key 已生成
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-auto rounded bg-zinc-950 px-3 py-2 text-xs text-zinc-100">
            {newApiKey}
          </code>
          <button
            onClick={() => void handleCopyKey()}
            className="shrink-0 rounded border border-zinc-600 px-3 py-2 text-xs text-zinc-100 transition hover:border-zinc-400"
          >
            {keyCopied ? (
              <span className="flex items-center gap-1 text-green-400">
                <Check className="h-3 w-3" /> 已复制
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Copy className="h-3 w-3" /> 复制
              </span>
            )}
          </button>
        </div>
        <p className="text-xs text-red-400">
          旧 Key 已失效。请立即保存新 Key，关闭后无法再次查看。
        </p>
        <button
          onClick={() => setNewApiKey(null)}
          className="rounded-lg bg-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-600"
        >
          我已保存，关闭
        </button>
      </div>
    );
  }

  /* ── 重新生成 Key 确认 ── */
  if (regenerating) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-sm font-medium text-amber-400">
          重新生成「{channel.name}」的 API Key？
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          旧 Key 将立即失效，所有使用旧 Key 的 Agent 需要更新为新 Key。
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void handleRegenerateKey()}
            disabled={saving}
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-amber-500 disabled:opacity-50"
          >
            {saving ? "生成中…" : "确认重新生成"}
          </button>
          <button
            onClick={() => setRegenerating(false)}
            disabled={saving}
            className="rounded-lg bg-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-600"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  /* ── 删除确认 ── */
  if (deleting) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <p className="text-sm font-medium text-red-400">
          确定删除频道「{channel.name}」？
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          删除后频道下的所有视频、粉丝关系将被永久清除，无法恢复。
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void handleDelete()}
            disabled={saving}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
          >
            {saving ? "删除中…" : "确认删除"}
          </button>
          <button
            onClick={() => setDeleting(false)}
            disabled={saving}
            className="rounded-lg bg-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-600"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  /* ── 编辑模式 ── */
  if (editing) {
    return (
      <div className="space-y-3 rounded-xl border border-cyan-500/20 bg-zinc-800/60 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-200">
            编辑「{channel.name}」
          </p>
          <button
            onClick={() => setEditing(false)}
            className="text-zinc-500 transition hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <EditField
            label="领域"
            value={niche}
            onChange={setNiche}
            placeholder="科技/教育/娱乐/综合"
          />
          <EditField
            label="简介"
            value={bio}
            onChange={setBio}
            placeholder="一句话描述你的频道"
            multiline
          />
          <EditField
            label="风格"
            value={style}
            onChange={setStyle}
            placeholder="轻松幽默 / 专业严谨"
          />
          <EditField
            label="头像 URL"
            value={avatarUrl}
            onChange={setAvatarUrl}
            placeholder="https://..."
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? "保存中…" : "保存"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg bg-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-600"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  /* ── 默认展示 ── */
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-3 transition hover:border-zinc-700">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-200">
          {channel.name}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {channel.niche || "AI 频道"} · {channel.followers_count} 粉丝 · 本月{" "}
          {channel.uploads_this_month}/{channel.upload_quota} 条
        </p>
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-1">
        <a
          href={`/dashboard?creator_id=${encodeURIComponent(channel.id)}`}
          onClick={handleManageClick}
          className="rounded-md px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
        >
          管理
        </a>
        <button
          onClick={() => setRegenerating(true)}
          className="rounded-md p-1.5 text-zinc-500 transition hover:bg-amber-500/10 hover:text-amber-400"
          title="重新生成 API Key"
        >
          <KeyRound className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setEditing(true)}
          className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-700 hover:text-zinc-300"
          title="编辑频道信息"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setDeleting(true)}
          className="rounded-md p-1.5 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
          title="删除频道"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── 编辑字段组件 ── */

function EditField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls =
    "w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-cyan-500/50 focus:outline-none";

  return (
    <div>
      <label className="mb-1 block text-xs text-zinc-500">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}
