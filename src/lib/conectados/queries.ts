import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Post = Tables<"posts">;
export type PostComment = Tables<"post_comments">;
export type PostPermission = Tables<"post_permissions">;

const FEED_LIMIT = 50;

export async function getPosts(): Promise<Post[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (error) throw error;
  return data ?? [];
}

export async function getPostComments(postId: string): Promise<PostComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getOwnPostPermissions(profileId: string): Promise<PostPermission | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_permissions")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
