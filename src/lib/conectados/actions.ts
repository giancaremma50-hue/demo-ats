"use server";

import { randomUUID } from "node:crypto";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyBestEffort } from "@/lib/notifications/notify";
import { CreatePostSchema, CreateCommentSchema, REACTION_TYPES, type ReactionType } from "./schema";
import type { FeedPost, FeedComment, Attachment, Poll, Reactions } from "./queries";

export type ConectadosActionResult<T = undefined> = { error?: string; success?: string } & (T extends undefined
  ? object
  : Partial<T>);

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

function previewContent(content: string): string {
  const text = content.trim();
  if (!text) return "Nueva publicación con contenido adjunto";
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function toFeedPost(row: Record<string, unknown>): FeedPost {
  return {
    ...(row as Omit<FeedPost, "attachments" | "poll" | "reactions">),
    attachments: [], // recién creado: nunca trae adjuntos todavía (se suben después y se agregan al estado local).
    poll: (row.poll as Poll | null) ?? null,
    reactions: (row.reactions as Reactions) ?? {},
  };
}

function toFeedComment(row: Record<string, unknown>): FeedComment {
  return { ...(row as Omit<FeedComment, "reactions">), reactions: (row.reactions as Reactions) ?? {} };
}

/**
 * El cliente manda `mentions` como una lista de UUIDs ya resueltos (el diseño
 * del muro usa autocompletado, no texto a re-parsear) — pero esa lista NUNCA
 * se usa tal cual. Se filtra contra perfiles reales, activos, de la MISMA
 * organización del autor: sin esto, cualquiera puede mandar el UUID de un
 * perfil de OTRA organización y `notify()` (que busca el email solo por id,
 * sin filtrar por `organization_id`) le manda un aviso y un correo a un
 * desconocido. Encontrado en `/code-review` de la fase de backend.
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
 * quién se entera, no solo quién existe en la organización.
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
      const isAdminOrAbove = p.role === "admin" || p.role === "super_admin";
      const departmentOk = departmentId === null || isAdminOrAbove || p.department_id === departmentId;
      const rolesOk = roles === null || isAdminOrAbove || (roles as string[]).includes(p.role);
      return departmentOk && rolesOk;
    })
    .map((p) => p.id);
}

export async function createPost(input: unknown): Promise<ConectadosActionResult<{ post: FeedPost }>> {
  const profile = await requireProfile();
  const parsed = CreatePostSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { content, departmentId, roles, publishAt, mentions: rawMentions, poll } = parsed.data;

  if (!content.trim() && !poll) {
    return { error: "Escribe algo, o agrega una encuesta, antes de publicar." };
  }

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
      poll: poll ? ({ options: poll.options.map((o) => ({ label: o.label, votes: [] })) } satisfies Poll) : null,
    })
    .select("*")
    .single();

  if (error || !post) return { error: "No se pudo publicar." };

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

  return { success: "Publicación creada", post: toFeedPost(post) };
}

export async function addComment(input: unknown): Promise<ConectadosActionResult<{ comment: FeedComment }>> {
  const profile = await requireProfile();
  const parsed = CreateCommentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { postId, body, mentions: rawMentions } = parsed.data;
  const mentions = await filterMentionsInOrg(rawMentions, profile.organization_id);

  const supabase = await createClient();
  const { data: comment, error } = await supabase
    .from("post_comments")
    .insert({
      organization_id: profile.organization_id,
      post_id: postId,
      author_id: profile.id,
      author_name: profile.display_name,
      author_avatar_url: profile.avatar_url,
      body,
      mentions,
    })
    .select("*")
    .single();
  if (error || !comment) return { error: "No se pudo comentar." };

  notifyBestEffort(async () => {
    // El autor del post se entera de un comentario nuevo (post_comentario,
    // reservado desde el backend para esto) — salvo que sea él mismo quien
    // comenta. `select` propio, no admin: si el post ya no existe (borrado
    // entre que se abrió el form y se envió), simplemente no hay a quién
    // avisar.
    const { data: post } = await supabase.from("posts").select("author_id").eq("id", postId).maybeSingle();
    if (post?.author_id && post.author_id !== profile.id) {
      await notify({
        organizationId: profile.organization_id,
        recipientId: post.author_id,
        type: "post_comentario",
        title: `${profile.display_name} comentó tu publicación`,
        body: previewContent(body),
        url: "/conectados",
        entityType: "post",
        entityId: postId,
      });
    }

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

  return { success: "Comentario publicado", comment: toFeedComment(comment) };
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

  return {};
}

export async function toggleCommentReaction(commentId: string, type: ReactionType): Promise<ConectadosActionResult> {
  await requireProfile();
  if (!REACTION_TYPES.includes(type)) return { error: "Tipo de reacción inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_post_comment_reaction", {
    p_comment_id: commentId,
    p_type: type,
  });
  if (error) return { error: "No se pudo reaccionar." };

  const aviso = data as { organization_id: string; recipient_id: string } | null;
  if (aviso) {
    notifyBestEffort(() =>
      notify({
        organizationId: aviso.organization_id,
        recipientId: aviso.recipient_id,
        type: "post_reaccion",
        title: "Reaccionaron a tu comentario",
        body: "Alguien reaccionó a tu comentario.",
        url: "/conectados",
        entityType: "post_comment",
        entityId: commentId,
      }),
    );
  }

  return {};
}

export async function votePoll(postId: string, optionIndex: number): Promise<ConectadosActionResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("vote_post_poll", { p_post_id: postId, p_option_index: optionIndex });
  if (error) return { error: "No se pudo votar." };
  return {};
}

export async function deletePost(postId: string): Promise<ConectadosActionResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return { error: "No se pudo eliminar la publicación." };
  return {};
}

export async function deleteComment(commentId: string): Promise<ConectadosActionResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
  if (error) return { error: "No se pudo eliminar el comentario." };
  return {};
}

export async function uploadPostAttachment(
  postId: string,
  formData: FormData,
): Promise<ConectadosActionResult<{ attachment: Attachment & { url: string } }>> {
  const profile = await requireProfile();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo primero." };
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: "El archivo pesa más de 10 MB." };
  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension) return { error: "Formato no admitido. Usa imagen (JPG/PNG/WebP), video MP4 o PDF." };

  const supabase = await createClient();
  // Confirma que el post es del autor actual ANTES de escribir en Storage —
  // `posts_update_own` ya lo exigiría al final (el `update` de abajo), pero
  // fallar acá da un mensaje claro en vez de subir el archivo y recién ahí
  // descubrir que el `update` fue rechazado por RLS.
  const { data: post } = await supabase
    .from("posts")
    .select("id, author_id, attachments")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.author_id !== profile.id) return { error: "No puedes agregar adjuntos a esta publicación." };

  const path = `${profile.organization_id}/${postId}/${randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("conectados-adjuntos")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: "No se pudo subir el archivo. Inténtalo de nuevo." };

  const attachment: Attachment = { path, mimeType: file.type, name: file.name, size: file.size };
  const current = Array.isArray(post.attachments) ? (post.attachments as Attachment[]) : [];
  const { error: updateError } = await supabase
    .from("posts")
    .update({ attachments: [...current, attachment] })
    .eq("id", postId);
  if (updateError) return { error: "El archivo se subió pero no se pudo guardar en la publicación." };

  const { data: signed } = await supabase.storage.from("conectados-adjuntos").createSignedUrl(path, 60 * 60);
  return { success: "Adjunto agregado", attachment: { ...attachment, url: signed?.signedUrl ?? "" } };
}
