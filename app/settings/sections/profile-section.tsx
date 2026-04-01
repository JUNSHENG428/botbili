"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";

import { GlassCard } from "@/components/design/glass-card";
import { createClient } from "@/lib/supabase/client";

interface ProfileSectionProps {
  user: User;
}

function getProvider(user: User): string {
  const provider = user.app_metadata?.provider as string | undefined;
  if (provider === "google") return "google";
  if (provider === "github") return "github";
  return "email";
}

function getProviderLabel(provider: string): string {
  if (provider === "google") return "Google 账号登录";
  if (provider === "github") return "GitHub 账号登录";
  return "邮箱密码登录";
}

function getAvatarSource(provider: string): string {
  if (provider === "google") return "Google";
  if (provider === "github") return "GitHub";
  return "默认";
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const provider = getProvider(user);
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : null;
  const email = user.email ?? "";

  const [displayName, setDisplayName] = useState<string>(
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleSave(): Promise<void> {
    setSaving(true);
    setSaveError("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim() },
    });
    setSaving(false);
    if (error) {
      setSaveError(error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <GlassCard className="space-y-5">
      <h2 className="text-lg font-semibold text-zinc-100">个人信息</h2>

      {/* 头像行 */}
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <span
            className="h-16 w-16 shrink-0 rounded-full border border-zinc-700 bg-cover bg-center"
            style={{ backgroundImage: `url(${avatarUrl})` }}
            aria-label="用户头像"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-2xl font-medium text-zinc-400">
            {email[0]?.toUpperCase() ?? "U"}
          </span>
        )}
        <div>
          <p className="text-sm text-zinc-400">
            头像来自 <span className="text-zinc-300">{getAvatarSource(provider)}</span>
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">修改头像请到对应平台更新</p>
        </div>
      </div>

      {/* 表单字段 */}
      <div className="space-y-4">
        {/* 昵称 */}
        <div>
          <label className="mb-1.5 block text-sm text-zinc-400">昵称</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="给自己起个名字"
            maxLength={50}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-cyan-500/60"
          />
        </div>

        {/* 邮箱（只读） */}
        <div>
          <label className="mb-1.5 block text-sm text-zinc-400">邮箱</label>
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-500">
            {email}
          </div>
        </div>

        {/* 登录方式（只读） */}
        <div>
          <label className="mb-1.5 block text-sm text-zinc-400">登录方式</label>
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-500">
            {getProviderLabel(provider)}
          </div>
        </div>

        {/* 保存按钮 + 反馈 */}
        {saveError ? (
          <p className="text-sm text-red-400">{saveError}</p>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "保存中..." : saved ? "已保存 ✓" : "保存修改"}
        </button>
      </div>
    </GlassCard>
  );
}
