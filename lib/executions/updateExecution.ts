import { getSupabaseAdminClient } from '@/lib/supabase/server';
import type { RecipeExecutionOutput, RecipeExecutionStatus } from '@/types/recipe';

interface ExecutionPatch {
  status?: RecipeExecutionStatus;
  progress_pct?: number;
  output_external_url?: string | null;
  output_thumbnail_url?: string | null;
  output_platform?: string | null;
  output?: RecipeExecutionOutput | null;
  error_message?: string | null;
  command_text?: string | null;
  completed_at?: string | null;
}

export async function updateExecutionById(id: string, patch: ExecutionPatch): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('recipe_executions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`updateExecutionById failed: ${error.message}`);
}
