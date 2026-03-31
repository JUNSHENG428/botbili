"use client";

import { usePathname } from "next/navigation";

export function NavbarOpenClawLink() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  function handleClick(): void {
    document.getElementById("lobster-uploader")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="hidden text-xs text-zinc-500 transition hover:text-cyan-400 lg:inline"
    >
      🦞 OpenClaw 用户？
    </button>
  );
}
