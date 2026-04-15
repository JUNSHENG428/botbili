export type RecipeExecutionStatus =
  | 'pending'
  | 'running'
  | 'script_done'
  | 'edit_done'
  | 'publishing'
  | 'success'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type VideoPlatform =
  | 'bilibili'
  | 'youtube'
  | 'douyin'
  | 'kuaishou'
  | 'xiaohongshu'
  | 'other';

export interface RecipeExecutionOutput {
  platform: VideoPlatform;
  video_url: string;
  title: string;
  thumbnail_url?: string;
  gif_url?: string;
  published_at?: string;
  view_count?: number;
  platform_video_id?: string;
}

export interface RecipeExecutionMetrics {
  views_24h?: number;
  likes_count?: number;
  revenue_cny?: number;
  ctr_percent?: number;
}

export interface RecipeExecutionOutputSource {
  output?: RecipeExecutionOutput | null;
  output_external_url?: string | null;
  output_thumbnail_url?: string | null;
  output_platform?: string | null;
  title?: string | null;
  gif_url?: string | null;
  published_at?: string | null;
  view_count?: number | null;
  platform_video_id?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
}

export interface RecipeExecutionStatusSnapshot extends RecipeExecutionOutputSource {
  status: RecipeExecutionStatus;
  progress_pct: number;
  error_message: string | null;
  command_text?: string | null;
  command_preview?: string | null;
  duration_seconds?: number | null;
  output_video_id?: string | null;
  output_metrics?: Record<string, unknown> | null;
  notes?: string | null;
  created_at?: string;
}

export interface RecipeExecutionHistoryItem extends RecipeExecutionOutputSource {
  id: string;
  status: RecipeExecutionStatus;
  command_text: string | null;
  command_preview: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeExecutionCompleteRequest extends RecipeExecutionOutputSource {
  status: "completed" | "failed" | "cancelled";
  duration_seconds?: number;
  output_video_id?: string;
  output_metrics?: RecipeExecutionMetrics;
  notes?: string;
  error_message?: string | null;
}

export interface Recipe {
  id: string;
  author_id: string;
  author_type: 'human' | 'ai_agent';
  title: string;
  slug: string;
  description: string | null;
  readme_md: string | null;
  readme_json: Record<string, unknown> | string | null;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  platform: string[];
  platforms: string[];
  language: string;
  cover_url: string | null;
  script_template: Record<string, unknown> | null;
  storyboard: StoryboardStep[] | null;
  matrix_config: Record<string, unknown> | null;
  tools_required: string[];
  star_count: number;
  fork_count: number;
  exec_count: number;
  execution_count: number;
  completed_execution_count?: number;
  success_rate: number;
  avg_duration_seconds: number | null;
  effect_score: number;
  last_executed_at: string | null;
  output_count?: number;
  recent_execution_count?: number;
  comment_count: number;
  save_count: number;
  view_count: number;
  forked_from: string | null;
  forked_from_id: string | null;
  fork_depth: number;
  status: 'draft' | 'published' | 'archived' | 'moderated';
  visibility: 'public' | 'unlisted' | 'private';
  category: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoryboardStep {
  type: string; // 'narration' | 'visual' | 'transition' | 'music'
  prompt: string;
  duration?: number;
  notes?: string;
}

export interface RecipeWithAuthor extends Recipe {
  author: { id: string; display_name: string | null; avatar_url: string | null };
}

export interface RecipeDetail extends RecipeWithAuthor {
  viewer_starred: boolean;
  viewer_saved: boolean;
}

export interface RecipeComment {
  id: string;
  recipe_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  comment_type: string;
  like_count: number;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author: { display_name: string | null; avatar_url: string | null };
}

export interface RecipeExecution {
  id: string;
  recipe_id: string;
  user_id: string;
  status: RecipeExecutionStatus;
  progress_pct: number;
  error_message: string | null;
  input_overrides: Record<string, unknown> | null;
  command_preview: string | null;
  command_text: string | null;
  output_external_url: string | null;
  output_thumbnail_url: string | null;
  output_platform: string | null;
  output?: RecipeExecutionOutput | null;
  duration_seconds: number | null;
  output_video_id: string | null;
  output_metrics: Record<string, unknown> | null;
  notes: string | null;
  fork_depth: number;
  parent_execution_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeExecutionCallbackPayload extends RecipeExecutionOutputSource {
  status: RecipeExecutionStatus;
  progress_pct?: number;
  error_message?: string | null;
  command_text?: string | null;
}

export interface RecipeOutputExample {
  id: string;
  recipe_id: string;
  execution_id: string;
  title: string;
  platform: VideoPlatform;
  video_url: string;
  thumbnail_url?: string;
  gif_url?: string;
  published_at?: string;
  completed_at?: string | null;
  created_at: string;
}

export interface RecipeStar {
  id: string;
  recipe_id: string;
  user_id: string;
  created_at: string;
}

export interface RecipeSave {
  id: string;
  recipe_id: string;
  user_id: string;
  created_at: string;
}

export interface RecipeFork {
  id: string;
  original_recipe_id: string;
  forked_recipe_id: string;
  user_id: string;
  forked_by?: string | null;
  created_at: string;
}

export interface RecipeCommentLike {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
}
