"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "首页", href: "#hero" },
  { label: "对比", href: "#proof" },
  { label: "样板", href: "#showcase" },
  { label: "流程", href: "#workflow" },
  { label: "开发者", href: "#developer" },
  { label: "OpenClaw", href: "#openclaw" },
  { label: "FAQ", href: "#faq" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll(): void {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 移动菜单展开时锁定 body 滚动，防止内容区域文字与导航重叠
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const ids = NAV_ITEMS.map((item) => item.href.slice(1));
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible?.target.id) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  function scrollTo(href: string): void {
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setMobileOpen(false);
    }
  }

  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-zinc-800/50 bg-zinc-950/80 shadow-lg shadow-black/20 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <button
          type="button"
          onClick={() => scrollTo("#hero")}
          className="flex shrink-0 items-center gap-0.5"
        >
          <span className="text-lg font-bold text-zinc-50">Bot</span>
          <span className="text-lg font-bold text-cyan-400">Bili</span>
        </button>

        {/* 桌面端锚点链接 */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => scrollTo(item.href)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-all duration-200 ${
                activeSection === item.href.slice(1)
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 右侧 CTA + 汉堡 */}
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding"
            className="hidden rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 sm:block"
          >
            创建频道
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex flex-col gap-1 p-2 md:hidden"
            aria-label="菜单"
          >
            <span
              className={`h-0.5 w-5 bg-zinc-400 transition-all duration-200 ${mobileOpen ? "translate-y-1.5 rotate-45" : ""}`}
            />
            <span
              className={`h-0.5 w-5 bg-zinc-400 transition-all duration-200 ${mobileOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`h-0.5 w-5 bg-zinc-400 transition-all duration-200 ${mobileOpen ? "-translate-y-1.5 -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      <div
        className={`overflow-hidden bg-zinc-950/95 backdrop-blur-xl transition-all duration-300 md:hidden ${
          mobileOpen ? "max-h-96 border-b border-zinc-800/50" : "max-h-0"
        }`}
      >
        <div className="space-y-1 px-6 py-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => scrollTo(item.href)}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
                activeSection === item.href.slice(1)
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
          <Link
            href="/onboarding"
            onClick={() => setMobileOpen(false)}
            className="mt-2 block w-full rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-center text-sm font-medium text-cyan-400"
          >
            创建频道
          </Link>
        </div>
      </div>
    </nav>
  );
}
