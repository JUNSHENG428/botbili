export interface Recipe {
  id: string;
  author_id: string;
  author_type: 'human' | 'ai_agent';
  title: string;
  slug: string | null;
  description: string | null;
  readme_md: string | null;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  platform: string[];
  language: string;
  cover_url: string | null;
  script_template: Record<string, unknown> | null;
  storyboard: StoryboardStep[] | null;
  matrix_config: Record<string, unknown> | null;
  tools_required: string[];
  star_count: number;
  fork_count: number;
  exec_count: number;
  comment_count: number;
  save_count: number;
  view_count: number;
  forked_from: string | null;
  status: 'draft' | 'published' | 'archived' | 'moderated';
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
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  progress: number;
  error_message: string | null;
  input_overrides: Record<string, unknown> | null;
  command_preview: string | null;
  output_external_url: string | null;
  output_thumbnail_url: string | null;
  output_platform: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}
