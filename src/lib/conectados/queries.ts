import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isScheduled } from "./schema";
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
  /** Todavía NO lo ve nadie más que su autor. Se calcula acá y no en el
   * componente por dos razones: `Date.now()` en el cuerpo de un render es
   * error de build en este proyecto (regla de pureza), y `publish_at != null`
   * a secas no alcanza — `posts_select` ya deja pasar el post en cuanto
   * `publish_at <= now()`, mientras que el cron que limpia la marca corre una
   * vez al día. Entre esos dos momentos el post ES visible para todos, así
   * que marcarlo "Programada" sería mentir por hasta ~24h. */
  scheduled: boolean;
};
export type FeedComment = Omit<PostComment, "reactions"> & { reactions: Reactions };

const FEED_LIMIT = 50;
const ATTACHMENT_URL_TTL_SECONDS = 60 * 60;

/**
 * Firma TODAS las URLs de adjuntos de la página del feed en una sola llamada
 * a Storage, con el cliente de SESIÓN (no admin) a propósito:
 * `createSignedUrls` sobre un bucket privado respeta la misma política de
 * `storage.objects` que una descarga real — que quien pide la URL siga
 * estando en la organización dueña del post se verifica dos veces (acá y en
 * Storage), nunca una sola. Una llamada por post (en vez de una para toda la
 * página) sería 50 round-trips a Storage en el peor caso — se firma todo
 * junto y se reparte por `path` después.
 */
async function hydrateAllAttachments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: { attachments: unknown }[],
): Promise<Map<string, string>> {
  const paths = rows.flatMap((row) => (Array.isArray(row.attachments) ? (row.attachments as Attachment[]) : []).map((a) => a.path));
  if (paths.length === 0) return new Map();

  const { data, error } = await supabase.storage.from("conectados-adjuntos").createSignedUrls(paths, ATTACHMENT_URL_TTL_SECONDS);
  if (error || !data) return new Map();
  // Un `path` individual puede fallar a firmar (borrado del bucket entre que
  // se guardó en `posts.attachments` y esta lectura) sin que la llamada
  // entera falle — esos vienen con `path`/`signedUrl` en `null` y se saltan.
  const map = new Map<string, string>();
  for (const d of data) {
    if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  }
  return map;
}

function resolveAttachments(attachments: unknown, urlByPath: Map<string, string>): (Attachment & { url: string })[] {
  const list = Array.isArray(attachments) ? (attachments as Attachment[]) : [];
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

  const rows = data ?? [];
  const urlByPath = await hydrateAllAttachments(supabase, rows);

  return rows.map((row) => ({
    ...row,
    attachments: resolveAttachments(row.attachments, urlByPath),
    poll: (row.poll as Poll | null) ?? null,
    reactions: (row.reactions as Reactions) ?? {},
    scheduled: isScheduled(row.publish_at),
  }));
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
