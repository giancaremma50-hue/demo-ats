import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Post = Tables<"posts">;
export type PostComment = Tables<"post_comments">;
export type PostPermission = Tables<"post_permissions">;

/** Forma fija de `posts.attachments`/`posts.poll` — la columna es `jsonb`
 * sin esquema propio, y el backend (Task 13-14) la dejó sin usar. Ver spec
 * 2026-09-11 para la razón de fijarla acá y no en una migración. */
export type Attachment = { path: string; mimeType: string; name: string; size: number };
export type Poll = { options: { label: string; votes: string[] }[] };

/** Reacciones: mapa de `profile_id` -> tipo de reacción. Mismo shape que la
 * RPC `toggle_post_reaction` ya arma (`reactions -> uid_txt`). */
export type Reactions = Record<string, string>;

/** `Post`/`PostComment` con los campos `jsonb` tipados y, en el caso de
 * `attachments`, con una URL firmada ya resuelta — el componente de UI
 * nunca ve un `path` de Storage crudo. */
export type FeedPost = Omit<Post, "attachments" | "poll" | "reactions"> & {
  attachments: (Attachment & { url: string })[];
  poll: Poll | null;
  reactions: Reactions;
};
export type FeedComment = Omit<PostComment, "reactions"> & { reactions: Reactions };

const FEED_LIMIT = 50;
const ATTACHMENT_URL_TTL_SECONDS = 60 * 60;

/**
 * Firma las URLs de los adjuntos de un post con el cliente de SESIÓN (no
 * admin) a propósito: `createSignedUrl` sobre un bucket privado respeta la
 * misma política de `storage.objects` que una descarga real — que quien
 * pide la URL siga estando en la organización dueña del post se verifica
 * dos veces (acá y en Storage), nunca una sola.
 */
async function hydrateAttachments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  attachments: unknown,
): Promise<(Attachment & { url: string })[]> {
  const list = Array.isArray(attachments) ? (attachments as Attachment[]) : [];
  if (list.length === 0) return [];

  const paths = list.map((a) => a.path);
  const { data, error } = await supabase.storage
    .from("conectados-adjuntos")
    .createSignedUrls(paths, ATTACHMENT_URL_TTL_SECONDS);
  if (error || !data) return [];

  const urlByPath = new Map(data.map((d) => [d.path, d.signedUrl]));
  return list.map((a) => ({ ...a, url: urlByPath.get(a.path) ?? "" })).filter((a) => a.url !== "");
}

export async function getPosts(): Promise<FeedPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => ({
      ...row,
      attachments: await hydrateAttachments(supabase, row.attachments),
      poll: (row.poll as Poll | null) ?? null,
      reactions: (row.reactions as Reactions) ?? {},
    })),
  );
}

export async function getPostComments(postId: string): Promise<FeedComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, reactions: (row.reactions as Reactions) ?? {} }));
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

export type AudienceDepartment = { id: string; name: string };

/** Lista liviana para el selector de audiencia del compositor — a propósito
 * más chica que `getDepartmentsAdmin` (que además trae el `head`, algo que
 * el compositor no necesita). */
export async function getDepartmentsForAudience(organizationId: string): Promise<AudienceDepartment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}
