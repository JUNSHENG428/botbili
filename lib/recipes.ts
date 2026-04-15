import { getSupabaseAdminClient } from '@/lib/supabase/server';
import type {
  Recipe,
  RecipeWithAuthor,
  RecipeDetail,
  RecipeComment,
  RecipeExecution,
} from '@/types/recipe';

export function calculateRecipeTrendingScore(
  recipe: Pick<
    Recipe,
    | 'star_count'
    | 'fork_count'
    | 'exec_count'
    | 'execution_count'
    | 'effect_score'
    | 'last_executed_at'
    | 'created_at'
  >,
): number {
  const executionCount = recipe.execution_count ?? recipe.exec_count ?? 0;
  const effectScore = recipe.effect_score ?? 0;
  const baseScore =
    effectScore > 0
      ? effectScore + recipe.star_count * 0.2 + recipe.fork_count * 0.3
      : recipe.star_count * 0.45 + recipe.fork_count * 0.3 + executionCount * 0.25;

  if (baseScore <= 0) {
    return 0;
  }

  const freshnessSource = recipe.last_executed_at ?? recipe.created_at;
  const createdAtMs = new Date(freshnessSource).getTime();
  const ageInDays = Number.isFinite(createdAtMs)
    ? Math.max(0, (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24))
    : 30;

  // 让近期高质量 Recipe 更容易进入前排，避免榜单永远被旧内容占住。
  const decayMultiplier = Math.pow(0.5, ageInDays / 7);
  const freshnessBonus = Math.max(0, 1 - ageInDays / 14) * 0.15;

  return baseScore * decayMultiplier + freshnessBonus;
}

// 获取所有公开 Recipe 的标签及出现次数
export async function getPopularTags(limit = 30): Promise<{ tag: string; count: number }[]> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase.rpc('get_popular_recipe_tags', { p_limit: limit });
  return (data ?? []) as { tag: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

async function fetchProfiles(ids: string[]): Promise<Map<string, ProfileRow>> {
  if (ids.length === 0) return new Map();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', ids);
  if (error) throw new Error(`fetchProfiles failed: ${error.message}`);
  const map = new Map<string, ProfileRow>();
  for (const row of data ?? []) {
    map.set(row.id, row as ProfileRow);
  }
  return map;
}

// ---------------------------------------------------------------------------
// listRecipes
// ---------------------------------------------------------------------------

type ListRecipesOptions = {
  sort: string;
  page: number;
  pageSize: number;
  tag?: string;
  difficulty?: string;
  platform?: string;
};

/**
 * @deprecated 直接使用 app/api/recipes/route.ts 里的 GET handler 逻辑。
 * 此函数保留仅供 server-side 内部调用（如 sitemap.ts），
 * 勿在新代码中引用。
 */
export async function listRecipes(
  options: ListRecipesOptions,
): Promise<{ recipes: RecipeWithAuthor[]; total: number }> {
  const { sort, page, pageSize, tag, difficulty, platform } = options;
  const admin = getSupabaseAdminClient();

  // Build sort column
  type SortSpec = { column: string; ascending: boolean };
  const sortMap: Record<string, SortSpec> = {
    trending: { column: 'star_count', ascending: false },
    newest: { column: 'created_at', ascending: false },
    most_starred: { column: 'star_count', ascending: false },
    most_forked: { column: 'fork_count', ascending: false },
    most_executed: { column: 'execution_count', ascending: false },
  };
  const { column: orderCol, ascending: orderAsc } =
    sortMap[sort] ?? sortMap['newest'];

  let query = admin
    .from('recipes')
    .select('*', { count: 'exact' })
    .eq('status', 'published');

  if (tag) query = query.contains('tags', [tag]);
  if (difficulty) query = query.eq('difficulty', difficulty);
  if (platform) query = query.contains('platform', [platform]);

  if (sort === 'trending') {
    let trendingQuery = admin.from('recipes').select('*').eq('status', 'published');
    if (tag) trendingQuery = trendingQuery.contains('tags', [tag]);
    if (difficulty) trendingQuery = trendingQuery.eq('difficulty', difficulty);
    if (platform) trendingQuery = trendingQuery.contains('platform', [platform]);
    const { data: allData, error: allError } = await trendingQuery;
    if (allError) throw new Error(`listRecipes trending failed: ${allError.message}`);
    const sorted = ((allData ?? []) as Recipe[])
      .sort((a, b) => calculateRecipeTrendingScore(b) - calculateRecipeTrendingScore(a));
    const total = sorted.length;
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
    const authorIds = [...new Set(paged.map(r => r.author_id))];
    const profileMap = await fetchProfiles(authorIds);
    return {
      recipes: paged.map((r) => ({
        ...r,
        author: {
          id: r.author_id,
          display_name: profileMap.get(r.author_id)?.display_name ?? null,
          avatar_url: profileMap.get(r.author_id)?.avatar_url ?? null,
        },
      })),
      total,
    };
  }

  query = query
    .order(orderCol, { ascending: orderAsc })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`listRecipes failed: ${error.message}`);

  const recipes = (data ?? []) as Recipe[];

  const authorIds = [...new Set(recipes.map((r) => r.author_id))];
  const profileMap = await fetchProfiles(authorIds);

  const recipesWithAuthor: RecipeWithAuthor[] = recipes.map((r) => {
    const profile = profileMap.get(r.author_id);
    return {
      ...r,
      author: {
        id: r.author_id,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
    };
  });

  return { recipes: recipesWithAuthor, total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// getRecipeById
// ---------------------------------------------------------------------------

export async function getRecipeById(
  id: string,
  viewerUserId?: string,
): Promise<RecipeDetail | null> {
  const admin = getSupabaseAdminClient();

  const { data: recipeData, error: recipeError } = await admin
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single();

  if (recipeError) {
    if (recipeError.code === 'PGRST116') return null; // not found
    throw new Error(`getRecipeById failed: ${recipeError.message}`);
  }

  const recipe = recipeData as Recipe;

  // Fetch author profile
  const profileMap = await fetchProfiles([recipe.author_id]);
  const profile = profileMap.get(recipe.author_id);

  // Viewer star/save state
  let viewer_starred = false;
  let viewer_saved = false;

  if (viewerUserId) {
    const [starResult, saveResult] = await Promise.all([
      admin
        .from('recipe_stars')
        .select('id', { count: 'exact', head: true })
        .eq('recipe_id', id)
        .eq('user_id', viewerUserId),
      admin
        .from('recipe_saves')
        .select('id', { count: 'exact', head: true })
        .eq('recipe_id', id)
        .eq('user_id', viewerUserId),
    ]);
    viewer_starred = (starResult.count ?? 0) > 0;
    viewer_saved = (saveResult.count ?? 0) > 0;
  }

  // Increment view_count (fire-and-forget)
  void admin
    .from('recipes')
    .update({ view_count: recipe.view_count + 1 })
    .eq('id', id);

  return {
    ...recipe,
    author: {
      id: recipe.author_id,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    },
    viewer_starred,
    viewer_saved,
  };
}

// ---------------------------------------------------------------------------
// createRecipe
// ---------------------------------------------------------------------------

type CreateRecipeData = {
  author_id: string;
  author_type?: 'human' | 'ai_agent';
  title: string;
  description?: string;
  readme_md?: string;
  tags?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  platform?: string[];
  cover_url?: string;
  script_template?: Record<string, unknown>;
  storyboard?: Recipe['storyboard'];
  matrix_config?: Record<string, unknown>;
  tools_required?: string[];
  status?: Recipe['status'];
};

export async function createRecipe(data: CreateRecipeData): Promise<Recipe> {
  const admin = getSupabaseAdminClient();

  const slug = generateSlug(data.title);

  const insert = {
    author_id: data.author_id,
    author_type: data.author_type ?? 'human',
    title: data.title,
    slug,
    description: data.description ?? null,
    readme_md: data.readme_md ?? null,
    tags: data.tags ?? [],
    difficulty: data.difficulty ?? 'beginner',
    platform: data.platform ?? [],
    cover_url: data.cover_url ?? null,
    script_template: data.script_template ?? null,
    storyboard: data.storyboard ?? null,
    matrix_config: data.matrix_config ?? null,
    tools_required: data.tools_required ?? [],
    status: data.status ?? 'draft',
  };

  const { data: created, error } = await admin
    .from('recipes')
    .insert(insert)
    .select('*')
    .single();

  if (error) throw new Error(`createRecipe failed: ${error.message}`);
  return created as Recipe;
}

// ---------------------------------------------------------------------------
// updateRecipe
// ---------------------------------------------------------------------------

const UPDATABLE_FIELDS: (keyof Recipe)[] = [
  'title',
  'description',
  'readme_md',
  'readme_json',
  'tags',
  'difficulty',
  'platform',
  'platforms',
  'cover_url',
  'script_template',
  'storyboard',
  'matrix_config',
  'tools_required',
  'status',
  'visibility',
  'slug',
];

export async function updateRecipe(
  id: string,
  authorId: string,
  data: Partial<Recipe>,
): Promise<Recipe | null> {
  const admin = getSupabaseAdminClient();

  // Verify ownership
  const { data: existing, error: fetchError } = await admin
    .from('recipes')
    .select('id, author_id')
    .eq('id', id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') return null;
    throw new Error(`updateRecipe fetch failed: ${fetchError.message}`);
  }
  if (existing.author_id !== authorId) {
    throw new Error('updateRecipe: author_id mismatch');
  }

  // Filter to allowed fields only
  const patch: Partial<Record<string, unknown>> = {};
  for (const field of UPDATABLE_FIELDS) {
    if (field in data) {
      patch[field] = data[field];
    }
  }

  if (Object.keys(patch).length === 0) return existing as unknown as Recipe;

  const { data: updated, error } = await admin
    .from('recipes')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`updateRecipe failed: ${error.message}`);
  return updated as Recipe;
}

// ---------------------------------------------------------------------------
// toggleStar
// ---------------------------------------------------------------------------

export async function toggleStar(
  recipeId: string,
  userId: string,
): Promise<{ starred: boolean; star_count: number }> {
  const admin = getSupabaseAdminClient();

  const { data: existing, error: checkError } = await admin
    .from('recipe_stars')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (checkError) throw new Error(`toggleStar check failed: ${checkError.message}`);

  let delta: number;
  if (existing) {
    const { error: delError } = await admin
      .from('recipe_stars')
      .delete()
      .eq('id', existing.id);
    if (delError) throw new Error(`toggleStar delete failed: ${delError.message}`);
    delta = -1;
  } else {
    const { error: insError } = await admin
      .from('recipe_stars')
      .insert({ recipe_id: recipeId, user_id: userId });
    if (insError) throw new Error(`toggleStar insert failed: ${insError.message}`);
    delta = 1;
  }

  // Fetch current count and update
  const { data: recipeRow, error: recipeError } = await admin
    .from('recipes')
    .select('star_count')
    .eq('id', recipeId)
    .single();
  if (recipeError) throw new Error(`toggleStar fetch recipe failed: ${recipeError.message}`);

  const newCount = Math.max(0, (recipeRow.star_count ?? 0) + delta);
  const { error: updateError } = await admin
    .from('recipes')
    .update({ star_count: newCount })
    .eq('id', recipeId);
  if (updateError) throw new Error(`toggleStar update count failed: ${updateError.message}`);

  return { starred: delta > 0, star_count: newCount };
}

// ---------------------------------------------------------------------------
// toggleSave
// ---------------------------------------------------------------------------

export async function toggleSave(
  recipeId: string,
  userId: string,
): Promise<{ saved: boolean; save_count: number }> {
  const admin = getSupabaseAdminClient();

  const { data: existing, error: checkError } = await admin
    .from('recipe_saves')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (checkError) throw new Error(`toggleSave check failed: ${checkError.message}`);

  let delta: number;
  if (existing) {
    const { error: delError } = await admin
      .from('recipe_saves')
      .delete()
      .eq('id', existing.id);
    if (delError) throw new Error(`toggleSave delete failed: ${delError.message}`);
    delta = -1;
  } else {
    const { error: insError } = await admin
      .from('recipe_saves')
      .insert({ recipe_id: recipeId, user_id: userId });
    if (insError) throw new Error(`toggleSave insert failed: ${insError.message}`);
    delta = 1;
  }

  const { data: recipeRow, error: recipeError } = await admin
    .from('recipes')
    .select('save_count')
    .eq('id', recipeId)
    .single();
  if (recipeError) throw new Error(`toggleSave fetch recipe failed: ${recipeError.message}`);

  const newCount = Math.max(0, (recipeRow.save_count ?? 0) + delta);
  const { error: updateError } = await admin
    .from('recipes')
    .update({ save_count: newCount })
    .eq('id', recipeId);
  if (updateError) throw new Error(`toggleSave update count failed: ${updateError.message}`);

  return { saved: delta > 0, save_count: newCount };
}

// ---------------------------------------------------------------------------
// forkRecipe
// ---------------------------------------------------------------------------

export async function forkRecipe(
  recipeId: string,
  userId: string,
): Promise<Recipe> {
  const admin = getSupabaseAdminClient();

  // Fetch source recipe
  const { data: source, error: sourceError } = await admin
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .single();

  if (sourceError) {
    if (sourceError.code === 'PGRST116') throw new Error('forkRecipe: source recipe not found');
    throw new Error(`forkRecipe fetch failed: ${sourceError.message}`);
  }

  const src = source as Recipe;

  // Create forked recipe
  const forkedSlug = generateSlug(`Fork of ${src.title}`);
  const insert = {
    author_id: userId,
    author_type: 'human' as const,
    title: `Fork of ${src.title}`,
    slug: forkedSlug,
    description: src.description,
    readme_md: src.readme_md,
    tags: src.tags,
    difficulty: src.difficulty,
    platform: src.platform,
    cover_url: src.cover_url,
    script_template: src.script_template,
    storyboard: src.storyboard,
    matrix_config: src.matrix_config,
    tools_required: src.tools_required,
    forked_from: recipeId,
    status: 'draft' as const,
  };

  const { data: forked, error: insertError } = await admin
    .from('recipes')
    .insert(insert)
    .select('*')
    .single();

  if (insertError) throw new Error(`forkRecipe insert failed: ${insertError.message}`);

  const forkedRecipe = forked as Recipe;

  // Insert recipe_forks record
  const { error: forkRecordError } = await admin
    .from('recipe_forks')
    .insert({ recipe_id: recipeId, forked_recipe_id: forkedRecipe.id, user_id: userId });
  if (forkRecordError) {
    // Non-fatal: log but don't throw
    console.error('forkRecipe: failed to insert recipe_forks record', forkRecordError.message);
  }

  // Increment source fork_count
  const { error: updateError } = await admin
    .from('recipes')
    .update({ fork_count: src.fork_count + 1 })
    .eq('id', recipeId);
  if (updateError) throw new Error(`forkRecipe update fork_count failed: ${updateError.message}`);

  return forkedRecipe;
}

// ---------------------------------------------------------------------------
// listComments
// ---------------------------------------------------------------------------

export async function listComments(
  recipeId: string,
  page: number,
  pageSize: number = 20,
): Promise<{ comments: RecipeComment[]; total: number }> {
  const admin = getSupabaseAdminClient();

  const { data, error, count } = await admin
    .from('recipe_comments')
    .select('*', { count: 'exact' })
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) throw new Error(`listComments failed: ${error.message}`);

  const rows = (data ?? []) as Array<{
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
  }>;

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profileMap = await fetchProfiles(userIds);

  const comments: RecipeComment[] = rows.map((r) => {
    const profile = profileMap.get(r.user_id);
    return {
      ...r,
      author: {
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
    };
  });

  return { comments, total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// createComment
// ---------------------------------------------------------------------------

type CreateCommentData = {
  recipe_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  comment_type?: string;
};

export async function createComment(data: CreateCommentData): Promise<RecipeComment> {
  const admin = getSupabaseAdminClient();

  const insert = {
    recipe_id: data.recipe_id,
    user_id: data.user_id,
    parent_id: data.parent_id ?? null,
    content: data.content,
    comment_type: data.comment_type ?? 'text',
  };

  const { data: created, error } = await admin
    .from('recipe_comments')
    .insert(insert)
    .select('*')
    .single();

  if (error) throw new Error(`createComment insert failed: ${error.message}`);

  const row = created as {
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
  };

  // Increment recipe comment_count
  const { data: recipeRow, error: recipeError } = await admin
    .from('recipes')
    .select('comment_count')
    .eq('id', data.recipe_id)
    .single();
  if (recipeError) throw new Error(`createComment fetch recipe failed: ${recipeError.message}`);

  const { error: updateError } = await admin
    .from('recipes')
    .update({ comment_count: (recipeRow.comment_count ?? 0) + 1 })
    .eq('id', data.recipe_id);
  if (updateError) throw new Error(`createComment update count failed: ${updateError.message}`);

  // Fetch author profile
  const profileMap = await fetchProfiles([data.user_id]);
  const profile = profileMap.get(data.user_id);

  return {
    ...row,
    author: {
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// createExecution
// ---------------------------------------------------------------------------

export async function createExecution(
  recipeId: string,
  userId: string,
  overrides?: Record<string, unknown>,
): Promise<RecipeExecution> {
  const admin = getSupabaseAdminClient();

  // Fetch recipe to build command_preview
  const { data: recipeData, error: recipeError } = await admin
    .from('recipes')
    .select('slug, exec_count')
    .eq('id', recipeId)
    .single();

  if (recipeError) {
    if (recipeError.code === 'PGRST116') throw new Error('createExecution: recipe not found');
    throw new Error(`createExecution fetch recipe failed: ${recipeError.message}`);
  }

  const slug = recipeData.slug ?? recipeId;
  const overrideStr = overrides
    ? ' ' +
      Object.entries(overrides)
        .map(([k, v]) => `--${k}=${String(v)}`)
        .join(' ')
    : '';
  const command_preview = `openclaw run botbili --recipe=${slug}${overrideStr}`;

  const insert = {
    recipe_id: recipeId,
    user_id: userId,
    status: 'pending' as const,
    progress_pct: 0,
    input_overrides: overrides ?? null,
    command_preview,
  };

  const { data: created, error } = await admin
    .from('recipe_executions')
    .insert(insert)
    .select('*')
    .single();

  if (error) throw new Error(`createExecution insert failed: ${error.message}`);

  // Increment exec_count
  const { error: updateError } = await admin
    .from('recipes')
    .update({ exec_count: (recipeData.exec_count ?? 0) + 1 })
    .eq('id', recipeId);
  if (updateError) throw new Error(`createExecution update exec_count failed: ${updateError.message}`);

  return created as RecipeExecution;
}

// ---------------------------------------------------------------------------
// getExecution
// ---------------------------------------------------------------------------

export async function getExecution(id: string): Promise<RecipeExecution | null> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('recipe_executions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`getExecution failed: ${error.message}`);
  }

  return data as RecipeExecution;
}
