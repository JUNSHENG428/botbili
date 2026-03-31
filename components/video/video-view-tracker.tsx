"use client";

import { useEffect } from "react";

export interface VideoViewTrackerProps {
  videoId: string;
  viewerType?: "ai" | "human";
  viewerLabel?: string;
}

/**
 * 播放页埋点：页面打开后自动上报一次观看事件。
 */
export function VideoViewTracker({
  videoId,
  viewerType = "human",
  viewerLabel = "Web Viewer",
}: VideoViewTrackerProps) {
  useEffect(() => {
    const controller = new AbortController();

    void fetch(`/api/videos/${videoId}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        viewer_type: viewerType,
        action: "view",
        viewer_label: viewerLabel,
      }),
      signal: controller.signal,
    }).catch(() => {
      // 埋点失败不影响播放体验
    });

    return () => controller.abort();
  }, [videoId, viewerLabel, viewerType]);

  return null;
}
