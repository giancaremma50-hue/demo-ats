"use server";

import { randomUUID } from "node:crypto";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyBestEffort } from "@/lib/notifications/notify";
import { extractMentionIds, resolveMentionTokens } from "@/lib/mentions";
import type { Database } from "@/lib/supabase/database.types";
import { CreatePostSchema, CreateCommentSchema, REACTION_TYPES, isScheduled, type ReactionType } from "./schema";
import { getPostComments, type FeedPost, type FeedComment, type Attachment, type Poll, type Reactions } from "./queries";

export type ConectadosActionResult<T = undefined> = { error?: string; success?: string } & (T extends undefined
  ? object
  : Partial<T>);

/** Mismo tope que `addNote` en Postulaciones: un cuerpo de 4000 caracteres
 * entra ~66 tokens, y cada mención dispara aviso in-app y correo. */
const MAX_MENCIONES = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    ...(row as Omit<FeedPost, "attachments" | "poll" | "reactions" | "scheduled">),
    attachments: [], // recién creado: nunca trae adjuntos todavía (se suben después y se agregan al estado local).
    poll: (row.poll as Poll | null) ?? null,
    reactions: (row.reactions as Reactions) ?? {},
    scheduled: isScheduled((row.publish_at as string | null) ?? null),
  };
}

function toFeedComment(row: Record<string, unknown>): FeedComment {
  return { ...(row as Omit<FeedComment, "reactions">), reactions: (row.reactions as Reactions) ?? {} };
}

/**
 * Resuelve las menciones de un cuerpo contra perfiles reales y devuelve el
 * cuerpo ya saneado.
 *
 * **Manda el CUERPO, no el array que manda el cliente** — misma regla que
 * `addNote` en Postulaciones (ver `.claude/napkin.md`, 2026-09-09: "cuando un
 * dato queda duplicado en dos lugares, escribir cuál manda"). El compositor
 * serializa cada mención como token `@[Nombre](uuid)` dentro del texto, así
 * que el cuerpo ya es la fuente completa; el array separado solo repetía lo
 * mismo y abría dos huecos:
 *
 * 1. **Notificar/emailear a cualquiera**: un uuid de OTRA organización pasaba
 *    `z.string().uuid()` y `notify()` busca el correo solo por id, sin filtrar
 *    organización (hallado en el code-review de la fase de backend).
 * 2. **Suplantar**: el texto del token nunca se validaba, así que escribir a
 *    mano `@[Directora de RH](uuid-de-otro)` se pintaba en negrita con el
 *    color de acento, idéntico a una mención resuelta por el sistema.
 *
 * Acá se cierran los dos: los ids salen del cuerpo, se validan contra perfiles
 * activos de la MISMA organización, y `resolveMentionTokens` reescribe cada
 * token con el nombre autoritativo y degrada a texto plano los que no resolvió.
 */
async function resolveMentions(
  body: string,
  organizationId: string,
): Promise<{ body: string; mentionIds: string[]; error?: string }> {
  // El grupo de id del token es `[0-9a-fA-F-]{36}`: casa 36 guiones y otras
  // formas que NO son un uuid. Un solo id así en el `in (...)` hace que
  // Postgres rechace la consulta entera (22P02) y, sin este filtro, TODAS las
  // menciones legítimas del mismo post se degradarían a texto plano en
  // silencio. Antes no pasaba porque los ids venían de `z.string().uuid()`.
  const ids = extractMentionIds(body).filter((id) => UUID_RE.test(id));
  if (ids.length === 0) return { body: resolveMentionTokens(body, new Map()), mentionIds: [] };
  if (ids.length > MAX_MENCIONES) {
    return { body, mentionIds: [], error: `Máximo ${MAX_MENCIONES} menciones por publicación.` };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", ids)
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  // Un fallo de la consulta NO puede tratarse como "ninguna mención resolvió":
  // eso degradaría menciones válidas a texto plano y guardaría el post así,
  // sin forma de recuperarlo.
  if (error) return { body, mentionIds: [], error: "No se pudieron verificar las menciones. Inténtalo de nuevo." };

  // Se descarta el perfil con nombre vacío: `resolveMentionTokens` lo trataría
  // como "no resolvió" (cadena falsy) y degradaría el token, pero su id
  // seguiría en la lista a notificar — aviso de una mención que no se ve.
  const nombrePorId = new Map(
    (data ?? []).filter((p) => p.display_name.trim() !== "").map((p) => [p.id, p.display_name]),
  );
  return { body: resolveMentionTokens(body, nombrePorId), mentionIds: [...nombrePorId.keys()] };
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
  // Tipo del enum de la base, no la unión de 3 que acepta el compositor: la
  // columna `posts.roles` todavía puede traer `colaborador` (el valor sigue
  // en el enum de Postgres aunque el rol ya no se asigne, ver AGENTS.md), y
  // acá solo se compara contra el rol de cada perfil.
  roles: Database["public"]["Enums"]["app_role"][] | null,
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
  // No se exige contenido/encuesta acá: los adjuntos se suben en un segundo
  // paso, después de que este insert devuelva el `id` del post (convención de
  // carpeta `{organization_id}/{post_id}/{...}`) — un post "solo fotos" es
  // válido y, en este punto, el servidor todavía no sabe si vienen adjuntos.
  // El compositor (única parte que conoce content + poll + archivos a la vez)
  // es quien bloquea un post genuinamente vacío antes de llamar acá.
  const { content: rawContent, departmentId, roles, publishAt, poll } = parsed.data;

  // Una fecha ya pasada dejaría el post invisible para todos menos su autor
  // hasta la próxima corrida del cron (diaria, ver .claude/napkin.md) — se ve
  // igual que "se perdió". Mejor decirlo de frente antes de guardarlo.
  if (publishAt && new Date(publishAt).getTime() <= Date.now()) {
    return { error: "La fecha para programar ya pasó. Elige una fecha futura." };
  }

  const resolved = await resolveMentions(rawContent, profile.organization_id);
  if (resolved.error) return { error: resolved.error };
  const { body: content, mentionIds: mentions } = resolved;

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
      // Las menciones se cruzan con la MISMA audiencia del post: mencionar a
      // alguien no puede saltarse la restricción de departamento/rol. Sin
      // esto, un post "solo Finanzas / solo admins" le manda a un gestor de
      // otra área un aviso —y un correo— con los primeros 120 caracteres de
      // algo que `posts_select` no le deja abrir. Mismo criterio que ya
      // aplica `addNote` con las notas privadas.
      const audiencia = new Set(recipients);
      await Promise.all(
        mentions
          .filter((id) => id !== profile.id && audiencia.has(id))
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

  // Un post programado NO está publicado: solo su autor lo ve hasta que el
  // cron lo libera. Decir "Publicación creada" ahí sería el "Éxito"/"Listo"
  // genérico que AGENTS.md prohíbe — el mensaje tiene que decir qué pasó.
  return {
    success: publishAt ? "Publicación programada" : "Publicación creada",
    post: toFeedPost(post),
  };
}

export async function addComment(input: unknown): Promise<ConectadosActionResult<{ comment: FeedComment }>> {
  const profile = await requireProfile();
  const parsed = CreateCommentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { postId, body: rawBody } = parsed.data;
  const resolved = await resolveMentions(rawBody, profile.organization_id);
  if (resolved.error) return { error: resolved.error };
  const { body, mentionIds: mentions } = resolved;

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
    const { data: post } = await supabase
      .from("posts")
      .select("author_id, department_id, roles")
      .eq("id", postId)
      .maybeSingle();
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

    // Igual que en `createPost`: mencionar a alguien en un comentario no
    // puede saltarse la restricción de audiencia del POST padre — el
    // comentario hereda su visibilidad (`post_comments_select` delega en
    // `can_view_post`), así que avisar fuera de esa audiencia filtraría el
    // contenido a quien no puede abrirlo.
    const audiencia = new Set(
      post ? await getPostAudience(profile.organization_id, profile.id, post.department_id, post.roles) : [],
    );
    await Promise.all(
      mentions
        .filter((id) => id !== profile.id && audiencia.has(id))
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

  // El nombre de archivo del cliente NUNCA entra a la key de Storage —
  // mismo patrón que `uploadAvatar` (`avatar.${extension}`): la key la arma
  // el servidor entero a partir de datos que ya validó (extensión derivada
  // del MIME, un uuid propio). El nombre original se guarda aparte, en
  // `Attachment.name`, solo para mostrarlo — nunca para direccionar Storage.
  const path = `${profile.organization_id}/${postId}/${randomUUID()}.${extension}`;
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

export async function listComments(postId: string) {
  await requireProfile();
  return getPostComments(postId);
}
