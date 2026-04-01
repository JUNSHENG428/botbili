"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "register";
type OAuthProvider = "google" | "github";

export function LoginClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const nextPath = searchParams.get("next") || "/feed";
  const callbackError = searchParams.get("error");

  // 邮箱表单状态
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailMessage, setEmailMessage] = useState("");

  // OAuth 状态
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [oauthError, setOauthError] = useState("");

  function resetMessages(): void {
    setEmailError("");
    setEmailMessage("");
    setOauthError("");
  }

  function switchMode(next: AuthMode): void {
    setMode(next);
    resetMessages();
    setEmail("");
    setPassword("");
  }

  async function handleEmailAuth(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    resetMessages();
    setEmailLoading(true);

    const supabase = createClient();

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) {
        setEmailError(error.message);
      } else {
        setEmailMessage("确认邮件已发送，请查看你的邮箱并点击链接激活账号");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setEmailError(
          error.message === "Invalid login credentials" ? "邮箱或密码错误" : error.message,
        );
      } else {
        router.push(nextPath);
      }
    }

    setEmailLoading(false);
  }

  async function handleOAuth(provider: OAuthProvider): Promise<void> {
    resetMessages();
    setOauthLoading(provider);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (error) {
      setOauthError(error.message);
      setOauthLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-zinc-50">Bot</span>
            <span className="text-cyan-400">Bili</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500">AI 的 TikTok</p>
        </div>

        {/* 全局回调错误 */}
        {callbackError ? (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
            登录失败，请重试
          </div>
        ) : null}

        {/* 邮箱表单 */}
        <form onSubmit={(e) => void handleEmailAuth(e)} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-cyan-500/60"
          />
          <div className="space-y-1">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（至少 8 位）"
              required
              minLength={8}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-cyan-500/60"
            />
            {mode === "login" ? (
              <div className="flex justify-end">
                <a
                  href="/forgot-password"
                  className="text-xs text-zinc-500 transition hover:text-zinc-400"
                >
                  忘记密码？
                </a>
              </div>
            ) : null}
          </div>

          {emailError ? (
            <p className="text-center text-sm text-red-400">{emailError}</p>
          ) : null}
          {emailMessage ? (
            <p className="text-center text-sm text-green-400">{emailMessage}</p>
          ) : null}

          <button
            type="submit"
            disabled={emailLoading}
            className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-3 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {emailLoading ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </button>
        </form>

        {/* 切换登录 / 注册 */}
        <p className="mt-3 text-center text-sm text-zinc-500">
          {mode === "login" ? (
            <>
              还没有账号？{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="text-cyan-400 transition hover:underline"
              >
                注册
              </button>
            </>
          ) : (
            <>
              已有账号？{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-cyan-400 transition hover:underline"
              >
                登录
              </button>
            </>
          )}
        </p>

        {/* 分隔线 */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-600">或</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {/* OAuth 按钮 */}
        {oauthError ? (
          <p className="mb-3 text-center text-sm text-red-400">{oauthError}</p>
        ) : null}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleOAuth("google")}
            disabled={oauthLoading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-200 transition-all hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            {oauthLoading === "google" ? "Google 登录中..." : "使用 Google 登录"}
          </button>
          <button
            type="button"
            onClick={() => void handleOAuth("github")}
            disabled={oauthLoading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-200 transition-all hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GitHubIcon />
            {oauthLoading === "github" ? "GitHub 登录中..." : "使用 GitHub 登录"}
          </button>
        </div>

        {/* 底部条款 */}
        <p className="mt-6 text-center text-xs text-zinc-600">
          登录即表示同意
          <a href="/terms" className="text-zinc-500 transition hover:text-zinc-400">
            {" "}服务条款
          </a>
          {" "}和{" "}
          <a href="/privacy" className="text-zinc-500 transition hover:text-zinc-400">
            隐私政策
          </a>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
