"use client";

import { useEffect, useState } from "react";

import { GlassCard } from "@/components/design/glass-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime } from "@/lib/format";
import type { Platform } from "@/lib/credentials";

interface Credential {
  id: string;
  platform: Platform;
  note: string | null;
  expires_at: string | null;
  updated_at: string;
}

const PLATFORM_CONFIG: Record<Platform, { name: string; color: string }> = {
  bilibili: { name: "B站", color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
  youtube: { name: "YouTube", color: "text-red-400 bg-red-400/10 border-red-400/20" },
  douyin: { name: "抖音", color: "text-zinc-100 bg-zinc-700/50 border-zinc-600" },
  kuaishou: { name: "快手", color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  xiaohongshu: { name: "小红书", color: "text-rose-400 bg-rose-400/10 border-rose-400/20" },
};

const PLATFORMS: Platform[] = ["bilibili", "youtube", "douyin", "kuaishou", "xiaohongshu"];

interface PlatformCredentialsSectionProps {
  creatorId: string;
}

export function PlatformCredentialsSection({ creatorId }: PlatformCredentialsSectionProps) {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [formData, setFormData] = useState({
    cookie: "",
    note: "",
    expires_at: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCredentials();
  }, [creatorId]);

  async function loadCredentials() {
    try {
      const response = await fetch(`/api/creators/${creatorId}/credentials`);
      const result = await response.json();
      if (result.success) {
        setCredentials(result.data);
      }
    } catch {
      toast("加载平台凭证失败", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  function openAddDialog(platform: Platform) {
    setEditingPlatform(platform);
    setFormData({ cookie: "", note: "", expires_at: "" });
    setDialogOpen(true);
  }

  function openEditDialog(credential: Credential) {
    setEditingPlatform(credential.platform);
    setFormData({
      cookie: "", // Cookie 不回显，需要重新粘贴
      note: credential.note || "",
      expires_at: credential.expires_at ? credential.expires_at.slice(0, 10) : "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editingPlatform || !formData.cookie.trim()) {
      toast("请填写 Cookie", { variant: "warning" });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/creators/${creatorId}/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: editingPlatform,
          cookie: formData.cookie.trim(),
          note: formData.note.trim() || undefined,
          expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : undefined,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast("凭证已保存", { variant: "success" });
        setDialogOpen(false);
        loadCredentials();
      } else {
        toast(result.error?.message || "保存失败", { variant: "error" });
      }
    } catch {
      toast("保存失败，请重试", { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(platform: Platform) {
    if (!confirm(`确定要删除 ${PLATFORM_CONFIG[platform].name} 的凭证吗？`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/creators/${creatorId}/credentials?platform=${platform}`,
        { method: "DELETE" }
      );

      const result = await response.json();
      if (result.success) {
        toast("凭证已删除", { variant: "success" });
        loadCredentials();
      } else {
        toast(result.error?.message || "删除失败", { variant: "error" });
      }
    } catch {
      toast("删除失败，请重试", { variant: "error" });
    }
  }

  const credentialMap = new Map(credentials.map((c) => [c.platform, c]));

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-100">平台授权</h2>
        <p className="text-sm text-zinc-500">
          配置第三方平台的登录凭证，Agent 执行发布时会自动使用这些凭证代你上传视频。
        </p>
      </div>

      <GlassCard className="space-y-4 p-6">
        {loading ? (
          <div className="space-y-3">
            {PLATFORMS.map((p) => (
              <div key={p} className="flex items-center justify-between py-2">
                <div className="h-5 w-16 animate-pulse rounded bg-zinc-800" />
                <div className="h-8 w-20 animate-pulse rounded bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {PLATFORMS.map((platform) => {
              const credential = credentialMap.get(platform);
              const config = PLATFORM_CONFIG[platform];

              return (
                <div key={platform} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${config.color}`}
                    >
                      {config.name}
                    </span>
                    {credential ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm text-zinc-300">
                          已配置
                          {credential.note && (
                            <span className="ml-2 text-zinc-500">({credential.note})</span>
                          )}
                        </span>
                        <span className="text-xs text-zinc-500">
                          上次更新 {formatRelativeTime(credential.updated_at)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-500">未配置</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {credential ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditDialog(credential)}
                          className="rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-200"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(platform)}
                          className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-1.5 text-sm text-zinc-500 transition hover:border-red-900/50 hover:text-red-400"
                        >
                          删除
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAddDialog(platform)}
                        className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
                      >
                        + 添加
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950/95 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editingPlatform ? `配置 ${PLATFORM_CONFIG[editingPlatform].name} Cookie` : "配置平台凭证"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              粘贴从浏览器开发者工具复制的 Cookie 字符串
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Cookie</label>
              <textarea
                value={formData.cookie}
                onChange={(e) => setFormData((d) => ({ ...d, cookie: e.target.value }))}
                placeholder="粘贴完整的 Cookie 字符串..."
                rows={4}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
              />
              <p className="text-xs text-zinc-500">
                ⚠️ Cookie 加密存储，仅用于 Agent 代你发布视频，不会被分享给任何第三方。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">备注（可选）</label>
              <input
                type="text"
                value={formData.note}
                onChange={(e) => setFormData((d) => ({ ...d, note: e.target.value }))}
                placeholder="例如：主号 Cookie"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">预计过期时间（可选）</label>
              <input
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData((d) => ({ ...d, expires_at: e.target.value }))}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/50 focus:outline-none"
              />
              <p className="text-xs text-zinc-500">
                设置提醒，我们会在到期前通知你更新凭证
              </p>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="rounded-lg border border-zinc-700 bg-zinc-950/70 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !formData.cookie.trim()}
              className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
