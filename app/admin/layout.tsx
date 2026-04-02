import Link from "next/link";
import type { ReactNode } from "react";

const ADMIN_LINKS = [
  { href: "/admin/invite", label: "邀请码" },
  { href: "/admin/feedback", label: "用户反馈" },
  { href: "/admin/moderation", label: "内容审核" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl py-6">
      <div className="mb-6 flex items-center gap-1 border-b border-zinc-800 pb-3">
        <span className="mr-3 text-sm font-medium text-zinc-400">
          管理后台
        </span>
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            {link.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
