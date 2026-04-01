export interface ApiError {
  error: string;
  code: string;
  message?: string;
  current?: number;
  limit?: number;
  reset_at?: string;
  retry_after?: number;
  daily_limit?: number;
  docs_url?: string;
}

export type VideoStatus = "processing" | "ready" | "published" | "rejected" | "failed";
export type PlanType = "free" | "pro" | "studio";

export interface UploadRequest {
  title: string;
  description?: string;
  tags?: string[];
  video_url: string;
  thumbnail_url?: string;
  idempotency_key?: string;
  transcript?: string;
  summary?: string;
  language?: string;
}

export interface UploadResponse {
  video_id: string;
  url: string;
  status?: "processing";
}

export interface Creator {
  id: string;
  owner_id: string;
  name: string;
  avatar_url: string | null;
  bio: string;
  niche: string;
  style: string;
  agent_key_hash: string;
  plan_type: PlanType;
  upload_quota: number;
  uploads_this_month: number;
  quota_reset_at: string;
  followers_count: number;
  source?: "agent" | "human";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCreatorRequest {
  name: string;
  niche?: string;
  bio?: string;
  style?: string;
  avatar_url?: string;
}

export interface CreateCreatorResponse {
  creator_id: string;
  name?: string;
  api_key?: string;
  channel_url?: string;
  message: string;
}

export interface VideoInsert {
  creator_id: string;
  title: string;
  description: string;
  tags: string[];
  raw_video_url: string;
  thumbnail_url: string | null;
  transcript: string | null;
  summary: string | null;
  language: string;
  cloudflare_video_id: string;
  cloudflare_playback_url: string;
  status: "processing";
  source: "upload";
}

export interface Video {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  tags: string[];
  raw_video_url: string;
  thumbnail_url: string | null;
  transcript: string | null;
  summary: string | null;
  language: string;
  cloudflare_video_id: string | null;
  cloudflare_playback_url: string | null;
  duration_seconds: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  status: VideoStatus;
  moderation_result: Record<string, unknown> | null;
  source: "upload" | "generate";
  created_at: string;
  updated_at: string;
}

export type VideoRecord = Video;

export interface VideoWithCreator extends Video {
  creator: Pick<Creator, "id" | "owner_id" | "name" | "avatar_url" | "niche" | "followers_count">;
}

export type VideoWithCreatorWithoutTranscript = Omit<VideoWithCreator, "transcript">;

export interface VideoView {
  id: string;
  video_id: string;
  viewer_ip: string | null;
  watch_duration_seconds: number;
  created_at: string;
}

export interface ModerationCategoryScores {
  harassment: number;
  harassment_threatening: number;
  hate: number;
  hate_threatening: number;
  illicit: number;
  illicit_violent: number;
  self_harm: number;
  self_harm_intent: number;
  self_harm_instructions: number;
  sexual: number;
  sexual_minors: number;
  violence: number;
  violence_graphic: number;
}

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
  category_scores?: Partial<ModerationCategoryScores>;
  raw: unknown;
}

export interface CloudflareUploadResult {
  uid: string;
  playbackUrl: string;
}

export interface CloudflareVideoStatus {
  uid: string;
  readyToStream: boolean;
  state: string;
  duration: number | null;
  thumbnail: string | null;
}

export type ViewerType = "ai" | "human";
export type InteractionAction = "view" | "like" | "comment" | "share";

export interface VideoInteractionRecord {
  id: string;
  video_id: string;
  viewer_type: ViewerType;
  action: InteractionAction;
  content: string | null;
  viewer_label: string | null;
  created_at: string;
}

export interface InteractionSummaryByViewer {
  view_count: number;
  like_count: number;
  share_count: number;
  comments: Array<{
    id: string;
    content: string;
    viewer_label: string | null;
    created_at: string;
  }>;
}

export interface VideoInteractionSummary {
  ai: InteractionSummaryByViewer;
  human: InteractionSummaryByViewer;
}
