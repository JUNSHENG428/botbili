import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { ModerationActions } from "./moderation-actions";

interface ReportWithVideo {
  id: string;
  video_id: string;
  reporter_id: string;
  reporter_type: string;
  reason: string;
  detail: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  video: {
    id: string;
    title: string;
  } | null;
}

interface ModerationLog {
  id: string;
  video_id: string;
  check_type: string;
  flagged: boolean;
  categories: string[];
  created_at: string;
}

const REASON_LABELS: Record<string, string> = {
  inappropriate: "不适当内容",
  spam: "垃圾广告",
  copyright: "版权侵权",
  misinformation: "虚假信息",
  other: "其他",
};

export default async function AdminModerationPage() {
  const supabase = getSupabaseAdminClient();

  // 获取待处理举报（关联视频标题）
  const { data: reports } = await supabase
    .from("reports")
    .select("id, video_id, reporter_id, reporter_type, reason, detail, status, admin_note, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  // 获取被拦截视频的标题
  const reportList = (reports ?? []) as Omit<ReportWithVideo, "video">[];
  const videoIds = [...new Set(reportList.map((r) => r.video_id))];
  const videoTitles: Record<string, string> = {};

  if (videoIds.length > 0) {
    const { data: videos } = await supabase
      .from("videos")
      .select("id, title")
      .in("id", videoIds);
    for (const v of videos ?? []) {
      videoTitles[v.id] = v.title;
    }
  }

  const reportsWithVideos: ReportWithVideo[] = reportList.map((r) => ({
    ...r,
    video: videoTitles[r.video_id]
      ? { id: r.video_id, title: videoTitles[r.video_id] }
      : null,
  }));

  // 获取最近自动审核拦截日志（flagged = true）
  const { data: flaggedLogs } = await supabase
    .from("moderation_logs")
    .select("id, video_id, check_type, flagged, categories, created_at")
    .eq("flagged", true)
    .order("created_at", { ascending: false })
    .limit(30);

  const logs = (flaggedLogs ?? []) as ModerationLog[];

  // 获取拦截日志中的视频标题
  const logVideoIds = [...new Set(logs.map((l) => l.video_id))].filter(
    (id) => !videoTitles[id],
  );
  const logVideoTitles: Record<string, string> = { ...videoTitles };

  if (logVideoIds.length > 0) {
    const { data: logVideos } = await supabase
      .from("videos")
      .select("id, title")
      .in("id", logVideoIds);
    for (const v of logVideos ?? []) {
      logVideoTitles[v.id] = v.title;
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">内容审核</h1>
        <p className="mt-1 text-sm text-zinc-500">
          待处理举报 {reportsWithVideos.length} 条 · 自动拦截 {logs.length} 条
        </p>
      </div>

      {/* 待处理举报 */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-zinc-200">待处理举报</h2>
        {reportsWithVideos.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 py-10 text-center text-sm text-zinc-500">
            暂无待处理举报
          </p>
        ) : (
          <div className="space-y-3">
            {reportsWithVideos.map((report) => (
              <div
                key={report.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-400">
                        {REASON_LABELS[report.reason] ?? report.reason}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {report.reporter_type === "human" ? "用户举报" : "AI 举报"}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {new Date(report.created_at).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <p className="truncate text-sm font-medium text-zinc-200">
                      视频：{report.video?.title ?? report.video_id}
                    </p>
                    {report.detail && (
                      <p className="text-sm text-zinc-400">{report.detail}</p>
                    )}
                    <p className="text-xs text-zinc-600">
                      举报人 ID：{report.reporter_id}
                    </p>
                  </div>
                  <ModerationActions reportId={report.id} videoId={report.video_id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 自动审核拦截 */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-zinc-200">自动审核拦截</h2>
        {logs.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 py-10 text-center text-sm text-zinc-500">
            暂无自动拦截记录
          </p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-orange-900/40 px-2 py-0.5 text-xs font-medium text-orange-400">
                    {log.check_type}
                  </span>
                  {log.categories.map((cat) => (
                    <span
                      key={cat}
                      className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                    >
                      {cat}
                    </span>
                  ))}
                  <span className="text-xs text-zinc-600">
                    {new Date(log.created_at).toLocaleString("zh-CN")}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-zinc-300">
                  视频：{logVideoTitles[log.video_id] ?? log.video_id}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
