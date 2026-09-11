"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyBestEffort } from "@/lib/notifications/notify";
import { CreatePostSchema, CreateCommentSchema, REACTION_TYPES, type ReactionType } from "./schema";

export type ConectadosActionResult = { error?: string; success?: string };

function previewContent(content: string): string {
  const text = content.trim();
  if (!text) return "Nueva publicación con contenido adjunto";
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

/**
 * El cliente manda `mentions` como una lista de UUIDs ya resueltos (el diseño
 * del muro usa autocompletado, no texto a re-parsear) — pero esa lista NUNCA
 * se usa tal cual. Se filtra contra perfiles reales, activos, de la MISMA
 * organización del autor: sin esto, cualquiera puede mandar el UUID de un
 * perfil de OTRA organización y `notify()` (que busca el email solo por id,
 * sin filtrar por `organization_id`) le manda un aviso y un correo a un
 * desconocido. Encontrado en `/code-review` de esta misma fase.
 */
async function filterMentionsInOrg(mentions: string[], organizationId: string): Promise<string[]> {
  if (mentions.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .in("id", mentions)
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  return (data ?? []).map((p) => p.id);
}

/**
 * Misma audiencia que la RLS de lectura del post (`posts_select`) y que la
 * liberación de posts programados: `department_id`/`roles` del post filtran
 * quién se entera, no solo quién existe en la organización. Sin este filtro,
 * un post restringido avisa —con preview del contenido— a gente que ni
 * siquiera puede abrirlo. Usa el cliente admin a propósito, igual que
 * `notifyPendingApproval`/`notifySuperAdmins` en otros módulos: hace falta
 * ver a TODA la organización, no solo lo que el autor (a menudo no-admin) ve
 * por su propia RLS.
 */
async function getPostAudience(
  organizationId: string,
  authorId: string,
  departmentId: string | null,
  roles: Array<"gestor" | "admin" | "super_admin"> | null,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data: candidates } = await admin
    .from("profiles")
    .select("id, role, department_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .neq("id", authorId);

  return (candidates ?? [])
    .filter((p) => {
      // admin/super_admin pasa las dos condiciones sin importar el filtro:
      // misma regla de bypass total que usa posts_select (RLS) para que
      // avisar coincida exacto con quién puede de verdad abrir el post.
      const isAdminOrAbove = p.role === "admin" || p.role === "super_admin";
      const departmentOk = departmentId === null || isAdminOrAbove || p.department_id === departmentId;
      const rolesOk = roles === null || isAdminOrAbove || (roles as string[]).includes(p.role);
      return departmentOk && rolesOk;
    })
    .map((p) => p.id);
}

export async function createPost(input: unknown): Promise<ConectadosActionResult> {
  const profile = await requireProfile();
  const parsed = CreatePostSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { content, departmentId, roles, publishAt, mentions: rawMentions } = parsed.data;
  const mentions = await filterMentionsInOrg(rawMentions, profile.organization_id);

  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      organization_id: profile.organization_id,
      author_id: profile.id,
      author_name: profile.display_name,
      author_avatar_url: profile.avatar_url,
      department_id: departmentId,
      roles,
      publish_at: publishAt,
      content,
      mentions,
    })
    .select("id")
    .single();

  if (error) return { error: "No se pudo publicar." };

  // Programado: los avisos salen cuando el cron lo libera (Task 9), no ahora.
  if (!publishAt) {
    notifyBestEffort(async () => {
      const recipients = await getPostAudience(profile.organization_id, profile.id, departmentId, roles);

      await Promise.all(
        recipients.map((recipientId) =>
          notify({
            organizationId: profile.organization_id,
            recipientId,
            type: "post_nuevo",
            title: "Nueva publicación",
            body: `${profile.display_name} publicó: "${previewContent(content)}"`,
            url: "/conectados",
            entityType: "post",
            entityId: post.id,
          }),
        ),
      );

      await Promise.all(
        mentions
          .filter((id) => id !== profile.id)
          .map((recipientId) =>
            notify({
              organizationId: profile.organization_id,
              recipientId,
              type: "post_mencion",
              title: `${profile.display_name} te mencionó`,
              body: previewContent(content),
              url: "/conectados",
              entityType: "post",
              entityId: post.id,
            }),
          ),
      );
    });
  }

  revalidatePath("/conectados");
  return { success: "Publicación creada" };
}

export async function addComment(input: unknown): Promise<ConectadosActionResult> {
  const profile = await requireProfile();
  const parsed = CreateCommentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { postId, body, mentions: rawMentions } = parsed.data;
  const mentions = await filterMentionsInOrg(rawMentions, profile.organization_id);

  const supabase = await createClient();
  const { error } = await supabase.from("post_comments").insert({
    organization_id: profile.organization_id,
    post_id: postId,
    author_id: profile.id,
    author_name: profile.display_name,
    author_avatar_url: profile.avatar_url,
    body,
    mentions,
  });
  if (error) return { error: "No se pudo comentar." };

  notifyBestEffort(async () => {
    await Promise.all(
      mentions
        .filter((id) => id !== profile.id)
        .map((recipientId) =>
          notify({
            organizationId: profile.organization_id,
            recipientId,
            type: "post_mencion",
            title: `${profile.display_name} te mencionó`,
            body: previewContent(body),
            url: "/conectados",
            entityType: "post",
            entityId: postId,
          }),
        ),
    );
  });

  revalidatePath("/conectados");
  return { success: "Comentario publicado" };
}

export async function toggleReaction(postId: string, type: ReactionType): Promise<ConectadosActionResult> {
  await requireProfile();
  if (!REACTION_TYPES.includes(type)) return { error: "Tipo de reacción inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_post_reaction", { p_post_id: postId, p_type: type });
  if (error) return { error: "No se pudo reaccionar." };

  const aviso = data as { organization_id: string; recipient_id: string } | null;
  if (aviso) {
    notifyBestEffort(() =>
      notify({
        organizationId: aviso.organization_id,
        recipientId: aviso.recipient_id,
        type: "post_reaccion",
        title: "Reaccionaron a tu publicación",
        body: "Alguien reaccionó a tu publicación.",
        url: "/conectados",
        entityType: "post",
        entityId: postId,
      }),
    );
  }

  revalidatePath("/conectados");
  return {};
}

export async function votePoll(postId: string, optionIndex: number): Promise<ConectadosActionResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("vote_post_poll", { p_post_id: postId, p_option_index: optionIndex });
  if (error) return { error: "No se pudo votar." };
  revalidatePath("/conectados");
  return {};
}
