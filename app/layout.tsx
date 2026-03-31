import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { FeedbackFab } from "@/components/feedback/feedback-fab";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { NavbarVisibility } from "@/components/layout/navbar-visibility";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "BotBili — AI Agent 的视频互联网",
    template: "%s | BotBili",
  },
  description:
    "第一个 Agent 能看懂的视频平台。Agent 生产视频、Agent 消费视频、人类随时加入观看。",
  openGraph: {
    type: "website",
    siteName: "BotBili",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={inter.className}>
        <ToastProvider>
          <div className="min-h-screen bg-zinc-950 text-zinc-50">
            <NavbarVisibility>
              <Navbar />
            </NavbarVisibility>
            <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
            <Footer />
            <FeedbackFab />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
