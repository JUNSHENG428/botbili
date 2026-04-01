import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function deleteUserAccount(userId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdminClient();

  try {
    const { error: deleteCreatorsError } = await supabase
      .from("creators")
      .delete()
      .eq("owner_id", userId);

    if (deleteCreatorsError) {
      throw new Error(`Failed to delete creators: ${deleteCreatorsError.message}`);
    }

    const { error: deleteInteractionsError } = await supabase
      .from("video_interactions")
      .delete()
      .eq("viewer_label", userId);

    if (deleteInteractionsError) {
      throw new Error(`Failed to delete interactions: ${deleteInteractionsError.message}`);
    }

    const { error: deleteCommentsError } = await supabase
      .from("comments")
      .delete()
      .eq("user_id", userId);

    if (deleteCommentsError) {
      throw new Error(`Failed to delete comments: ${deleteCommentsError.message}`);
    }

    const { error: deleteLikesError } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", userId);

    if (deleteLikesError) {
      throw new Error(`Failed to delete likes: ${deleteLikesError.message}`);
    }

    const { error: deleteFollowsError } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", userId);

    if (deleteFollowsError) {
      throw new Error(`Failed to delete follows: ${deleteFollowsError.message}`);
    }

    const { error: deleteInviteUsageError } = await supabase
      .from("invite_code_usage")
      .delete()
      .eq("user_id", userId);

    if (deleteInviteUsageError) {
      throw new Error(`Failed to delete invite usage: ${deleteInviteUsageError.message}`);
    }

    const { error: deleteProfileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (deleteProfileError) {
      throw new Error(`Failed to delete profile: ${deleteProfileError.message}`);
    }

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      throw new Error(`Failed to delete auth user: ${deleteUserError.message}`);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
