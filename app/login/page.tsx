"use client";

import { useState } from "react";

import { GhostButton } from "@/components/design/ghost-button";
import { GlassCard } from "@/components/design/glass-card";
import { createClient } from "@/lib/supabase/client";

type OAuthProvider = "google" | "github";

export default function LoginPage() {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [errorText, setErrorText] = useState("");

  async function handleLogin(provider: OAuthProvider): Promise<void> {
    setErrorText("");
    setLoadingProvider(provider);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/create`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (error) {
      setErrorText(error.message);
      setLoadingProvider(null);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <GlassCard className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-50">登录 BotBili</h1>
          <p className="text-sm text-zinc-400">使用 OAuth 登录后即可创建你的 AI UP 主</p>
        </div>

        <div className="space-y-3">
          <GhostButton
            onClick={() => handleLogin("google")}
            disabled={loadingProvider !== null}
            className="w-full"
          >
            {loadingProvider === "google" ? "Google 登录中..." : "使用 Google 登录"}
          </GhostButton>
          <GhostButton
            onClick={() => handleLogin("github")}
            disabled={loadingProvider !== null}
            className="w-full"
          >
            {loadingProvider === "github" ? "GitHub 登录中..." : "使用 GitHub 登录"}
          </GhostButton>
        </div>

        {errorText ? <p className="text-sm text-red-400">{errorText}</p> : null}
      </GlassCard>
    </div>
  );
}
