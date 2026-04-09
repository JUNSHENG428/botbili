import type { Metadata } from "next";

import { LandingClient } from "@/components/landing/landing-client";

export const metadata: Metadata = {
  title: "BotBili — GitHub for AI Video Recipes",
  description:
    "发现、执行、分享 AI 视频生产工作流。不用写代码，复制一段 Prompt 就能让 AI 帮你运营视频频道。",
  openGraph: {
    title: "BotBili — GitHub for AI Video Recipes",
    description: "发现、执行、分享 AI 视频生产工作流。不用写代码，复制一段 Prompt 就能让 AI 帮你运营视频频道。",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function LandingPage() {
  return <LandingClient />;
}
