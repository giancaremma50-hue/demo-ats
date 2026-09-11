# AJE Conectados — Feed real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la UI real del muro social AJE Conectados sobre el backend ya cerrado (Task 20): compositor completo (texto + adjuntos + encuesta + programar + audiencia), tarjetas de post, reacciones, comentarios con reacciones, y @menciones con autocompletado — reemplazando el placeholder de `/conectados`.

**Architecture:** Server Component (`page.tsx`) carga los datos iniciales (posts, departamentos, perfiles mencionables, permisos propios) y los pasa a un client component `ConectadosFeed`, dueño del estado del feed. `ConectadosFeed` se suscribe a Realtime (mismo patrón ya usado en `notification-bell.tsx`: canal por Supabase JS, `postgres_changes` filtrado, cleanup en el `useEffect`) sobre `posts`/`post_comments` filtrado por `organization_id`, y mezcla los cambios en su estado local por `id`. Las Server Actions existentes (`src/lib/conectados/actions.ts`) pierden su `revalidatePath("/conectados")` — la ruta tiene `loading.tsx`, y revalidar la ruta que se está viendo puede remontar el árbol de cliente (napkin, "MÁXIMA PRIORIDAD", ya documentado con otro módulo) — y en su lugar devuelven la fila creada para que el propio autor actualice su estado de inmediato, sin esperar el eco de Realtime.

**Tech Stack:** Next.js 16 (App Router) + TypeScript + Supabase (`@supabase/ssr`, Realtime JS) + Zod + `date-fns` (locale `es`) + `lucide-react` + `sonner` (toasts vía `notifySuccess`/`notifyError`).

**Spec:** `docs/superpowers/specs/2026-09-11-aje-conectados-feed-design.md`

## Global Constraints

- Interfaz 100% en español. Cero texto en inglés.
- Look "AJE" (`AGENTS.md`): elevación con sombra (`shadow-elevated`, nunca borde de 1px salvo la excepción de densidad de listas repetidas — no aplica acá, el feed no es una tabla densa); radio de la escala del proyecto (`rounded-md`/`rounded-lg`, nunca un valor de Tailwind sin relación); botones tipo píldora (`rounded-full`) en todo lo que pase por `<ActionButton>`; círculo (`rounded-full`) en todo ícono suelto de un solo símbolo (reacciones, cerrar, quitar adjunto); `strokeWidth={2.5}` en cualquier ícono sobre fondo de color sólido.
- Todo botón que muta datos usa `<ActionButton>`; nunca un `<button type="submit">` crudo para una mutación.
- Toda mutación exitosa que el usuario inicia explícitamente (publicar, comentar, eliminar) confirma con `notifySuccess("mensaje concreto")`. Los toggles de baja fricción (reacción, voto de encuesta) no llevan toast — la propia UI (ícono resaltado) ya es la confirmación (ver spec).
- Todo borrado usa `<DeleteButton>` (confirma con `<ConfirmDialog>`), nunca un solo clic.
- RLS decide visibilidad y permisos reales; la UI solo oculta lo que el usuario no puede hacer, nunca es la única barrera.
- `posts.attachments: Attachment[]`, `posts.poll: Poll | null` — formas fijadas en la spec, ver Task 2.
- Signed URLs de adjuntos: TTL 1 hora (no 60 s — esa regla es para CVs, ver spec).
- Ningún commit se hace sin pasar por `/code-review` (regla del proyecto).

---

### Task 1: Mover `mentions.ts` a una ubicación compartida

**Por qué:** El algoritmo de menciones (`parseMentions`, `buildMentionToken`, `activeMentionQuery`, `extractMentionIds`, `canonicalizeMentions`) es genérico — no tiene nada específico de postulaciones — y Conectados lo necesita también. El napkin del proyecto ya registra que el mismo hueco de seguridad de menciones se reintrodujo en Conectados por no mirar este precedente; moverlo a un solo lugar es la forma de que no vuelva a pasar.

**Files:**
- Create: `src/lib/mentions.ts` (contenido íntegro del actual `src/lib/applications/mentions.ts`)
- Modify: `src/lib/applications/mentions.ts` (queda como re-export)

**Interfaces:**
- Produces: `parseMentions(body: string): MentionPart[]`, `extractMentionIds(body: string): string[]`, `canonicalizeMentions(body: string, nombrePorId: ReadonlyMap<string, string>): string`, `buildMentionToken(nombre: string, profileId: string): string`, `activeMentionQuery(texto: string, cursor: number): { query: string; desde: number } | null`, tipo `MentionPart`.

- [x] **Paso 1: Crear `src/lib/mentions.ts` con el contenido actual de `src/lib/applications/mentions.ts`**

Copia el archivo tal cual (comentarios incluidos — documentan decisiones de seguridad reales, no se resumen). Ruta nueva, mismo contenido byte a byte.

- [x] **Paso 2: Reemplazar `src/lib/applications/mentions.ts` por un re-export**

```typescript
/**
 * Movido a `src/lib/mentions.ts` (2026-09-11): el algoritmo no tiene nada
 * específico de postulaciones y AJE Conectados lo necesita también. Este
 * archivo queda como re-export para no romper los imports existentes de
 * este módulo.
 */
export * from "@/lib/mentions";
```

- [x] **Paso 3: Verificar que nada más quedó roto**

Run: `grep -rn "from \"@/lib/applications/mentions\"" src/`
Expected: solo los imports que ya existían antes de este cambio (siguen funcionando via el re-export, no hace falta tocarlos).

Run: `npm run typecheck`
Expected: sin errores nuevos.

- [x] **Paso 4: Commit**

```bash
git add src/lib/mentions.ts src/lib/applications/mentions.ts
git commit -m "refactor(mentions): mueve el algoritmo de menciones a src/lib/mentions.ts, reusable por Conectados"
```

---

### Task 2: Esquema de encuesta + tipos de adjunto/encuesta en la capa de datos

**Files:**
- Modify: `src/lib/conectados/schema.ts`
- Modify: `src/lib/conectados/queries.ts`

**Interfaces:**
- Consumes: nada nuevo de otras tareas.
- Produces: `PollSchema` (Zod), `CreatePostInput.poll: Poll | null`, tipos `Attachment` y `Poll` exportados desde `queries.ts`, `Post["attachments"]`/`Post["poll"]` tipados (no `Json` crudo) via el tipo `FeedPost` que las tareas 3-9 consumen.

- [x] **Paso 1: Agregar `PollSchema` a `src/lib/conectados/schema.ts`**

```typescript
import { z } from "zod";

export const REACTION_TYPES = ["like", "corazon", "aplauso", "fuego"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const PollSchema = z.object({
  options: z
    .array(z.object({ label: z.string().trim().min(1, "Una opción no puede estar vacía.").max(120) }))
    .min(2, "Una encuesta necesita al menos 2 opciones.")
    .max(6, "Máximo 6 opciones por encuesta."),
});
export type PollInput = z.infer<typeof PollSchema>;

export const CreatePostSchema = z.object({
  content: z.string().trim().max(4000, "El contenido es demasiado largo."),
  departmentId: z.string().uuid().nullable(),
  roles: z.array(z.enum(["gestor", "admin", "super_admin"])).nullable(),
  publishAt: z.string().datetime().nullable(),
  mentions: z.array(z.string().uuid()).default([]),
  poll: PollSchema.nullable(),
});
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const CreateCommentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1, "Escribe algo antes de comentar.").max(2000, "El comentario es demasiado largo."),
  mentions: z.array(z.string().uuid()).default([]),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
```

Nota: `content` puede quedar vacío (`""`) si el post es solo una encuesta o solo adjuntos — por eso no lleva `.min(1)`. `createPost` (Task 4) exige que al menos uno de contenido/encuesta/adjuntos exista, ahí sí con un mensaje de error real.

- [x] **Paso 2: Definir los tipos `Attachment`/`Poll` y el `FeedPost` en `src/lib/conectados/queries.ts`**

Reemplaza el contenido completo del archivo:

```typescript
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Post = Tables<"posts">;
export type PostComment = Tables<"post_comments">;
export type PostPermission = Tables<"post_permissions">;

/** Forma fija de `posts.attachments`/`post_comments.reactions` no aplica —
 * solo posts llevan adjuntos y encuesta. Ver spec 2026-09-11 para la razón
 * de por qué se fija acá y no en una migración: la columna es `jsonb` sin
 * esquema, y Task 13-14 (backend) la dejó sin usar. */
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
  return list
    .map((a) => ({ ...a, url: urlByPath.get(a.path) ?? "" }))
    .filter((a) => a.url !== "");
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
```

- [x] **Paso 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores. (`createSignedUrls` es un método real de `supabase-js` storage — si el tipo no resuelve, confirmar la versión del paquete con `npm ls @supabase/supabase-js` antes de asumir un typo.)

- [x] **Paso 4: Commit**

```bash
git add src/lib/conectados/schema.ts src/lib/conectados/queries.ts
git commit -m "feat(conectados): fija la forma de attachments/poll, agrega signed URLs y getDepartmentsForAudience"
```

---

### Task 3: Server Actions — devolver la fila creada, quitar `revalidatePath`, notificar comentarios, borrar, subir adjuntos

**Files:**
- Modify: `src/lib/conectados/actions.ts`
- Modify: `src/lib/notifications/preferences-schema.ts` (un comentario, no agrega los 4 tipos a `PREFERENCE_TYPES` todavía — ver spec, "Fuera de alcance")

**Interfaces:**
- Consumes: `FeedPost`/`FeedComment`/`Attachment`/`Poll` de Task 2; `parseMentions`/etc. no se usan acá (eso es del lado del cliente).
- Produces: `createPost(input): Promise<{ error?: string; success?: string; post?: FeedPost }>`, `addComment(input): Promise<{ error?: string; success?: string; comment?: FeedComment }>`, `toggleReaction(postId, type)`, `votePoll(postId, optionIndex)` (mismas firmas, ya no llaman `revalidatePath`), `deletePost(postId: string): Promise<{ error?: string }>`, `deleteComment(commentId: string): Promise<{ error?: string }>`, `uploadPostAttachment(postId: string, formData: FormData): Promise<{ error?: string; attachment?: Attachment & { url: string } }>`.

- [x] **Paso 1: Reemplazar el contenido completo de `src/lib/conectados/actions.ts`**

```typescript
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
    attachments: [], // recién creado: nunca trae adjuntos todavía (Task 6 los sube después y los agrega al estado local).
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
    // avisar, y no vale la pena un cliente admin para ese caso raro.
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
  // Confirma que el post es del autor actual y de su organización ANTES de
  // escribir en Storage — `posts_update_own` ya lo exigiría al final (el
  // `update` de abajo), pero fallar acá da un mensaje claro en vez de subir
  // el archivo y recién ahí descubrir que el `update` fue rechazado por RLS.
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
```

- [x] **Paso 2: Agregar un comentario en `preferences-schema.ts`** (sin agregar los 4 tipos a `PREFERENCE_TYPES` — decisión de alcance, ver spec)

Editar el comentario existente sobre `post_nuevo`/etc. para que quede correcto ahora que SÍ hay UI real:

```typescript
// post_nuevo/post_mencion/post_reaccion/post_comentario (AJE Conectados)
// tienen etiqueta acá porque el tipo exige el mapeo completo. Desde
// 2026-09-11 el módulo SÍ tiene UI real que los dispara (feed, comentarios,
// reacciones) — pero siguen sin entrar a PREFERENCE_TYPES a propósito:
// notify() nunca les pasa un `email` (deliberado, no se construyeron
// plantillas de correo en esta fase), y ofrecer acá el interruptor de
// "correo" sin que ningún correo salga sería el mismo error que ya se
// documentó una vez con mencion_nota. Agregarlos cuando exista la plantilla.
```

- [x] **Paso 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores. (`ConectadosActionResult<T>` con `Partial<T>` es un tipo utilitario nuevo — si el intersection da un error de tipo raro en algún callsite, simplificar a un tipo de retorno explícito por función en vez de forzar la genérica; no vale la pena pelear con una abstracción que no rinde.)

- [x] **Paso 4: Commit**

```bash
git add src/lib/conectados/actions.ts src/lib/notifications/preferences-schema.ts
git commit -m "feat(conectados): actions devuelven la fila creada, notifican comentarios, agregan borrar/subir adjuntos"
```

---

### Task 4: `ConectadosFeed` — estado del feed + Realtime

**Files:**
- Create: `src/components/conectados/conectados-feed.tsx`
- Create: `src/components/conectados/types.ts`

**Interfaces:**
- Consumes: `FeedPost`, `FeedComment` (Task 2); `createPost`, `toggleReaction`, `votePoll`, `deletePost` (Task 3, importados dentro de los componentes hijos de las Tasks 5-8, no acá).
- Produces: `<ConectadosFeed initialPosts organizationId profile canPost departments mentionable />`, tipo `ConectadosContext` (permisos + datos compartidos) vía React Context para que `PostComposer`/`PostCard`/`CommentThread` no reciban todo por props en cascada.

- [x] **Paso 1: Crear `src/components/conectados/types.ts`**

```typescript
export type MentionableProfile = { id: string; display_name: string };

export type ConectadosViewer = {
  id: string;
  organizationId: string;
  departmentId: string | null;
  isAdminOrAbove: boolean;
  canPost: boolean;
};
```

- [x] **Paso 2: Crear `src/components/conectados/conectados-feed.tsx`**

```typescript
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PostComposer } from "./post-composer";
import { PostCard } from "./post-card";
import type { FeedPost, Poll, Reactions } from "@/lib/conectados/queries";
import type { AudienceDepartment } from "@/lib/conectados/queries";
import type { ConectadosViewer, MentionableProfile } from "./types";

type ConectadosContextValue = {
  viewer: ConectadosViewer;
  departments: AudienceDepartment[];
  mentionable: MentionableProfile[];
};

const ConectadosContext = createContext<ConectadosContextValue | null>(null);

/** Cualquier componente bajo `<ConectadosFeed>` (compositor, tarjeta,
 * comentarios) llama esto en vez de recibir los mismos 3 datos por props en
 * cada nivel — son de solo lectura para toda la sesión del feed. */
export function useConectados(): ConectadosContextValue {
  const ctx = useContext(ConectadosContext);
  if (!ctx) throw new Error("useConectados debe usarse dentro de <ConectadosFeed>");
  return ctx;
}

type PostRow = {
  id: string;
  organization_id: string;
  author_id: string | null;
  author_name: string;
  author_title: string;
  author_avatar_url: string | null;
  department_id: string | null;
  roles: string[] | null;
  publish_at: string | null;
  content: string;
  attachments: unknown;
  poll: Poll | null;
  reactions: Reactions;
  mentions: string[];
  edited: boolean;
  created_at: string;
};

function mergePost(current: FeedPost[], incoming: PostRow): FeedPost[] {
  const existing = current.find((p) => p.id === incoming.id);
  // Un post que llega por Realtime nunca trae `attachments` con URL firmada
  // (esa hidratación es server-side, ver Task 2) — se conserva la lista de
  // adjuntos que el cliente ya tenía y solo se actualizan los campos que
  // Realtime sí trae completos y al día (reacciones, poll, contenido).
  const attachments = existing?.attachments ?? [];
  const merged: FeedPost = { ...incoming, attachments, poll: incoming.poll ?? null, reactions: incoming.reactions ?? {} };
  if (!existing) return [merged, ...current].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return current.map((p) => (p.id === incoming.id ? merged : p));
}

export function ConectadosFeed({
  initialPosts,
  viewer,
  departments,
  mentionable,
}: {
  initialPosts: FeedPost[];
  viewer: ConectadosViewer;
  departments: AudienceDepartment[];
  mentionable: MentionableProfile[];
}) {
  const [posts, setPosts] = useState(initialPosts);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conectados:${viewer.organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts", filter: `organization_id=eq.${viewer.organizationId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setPosts((current) => current.filter((p) => p.id !== (payload.old as { id: string }).id));
            return;
          }
          setPosts((current) => mergePost(current, payload.new as PostRow));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.organizationId]);

  function handleCreated(post: FeedPost) {
    setPosts((current) => (current.some((p) => p.id === post.id) ? current : [post, ...current]));
  }

  function handleDeleted(postId: string) {
    setPosts((current) => current.filter((p) => p.id !== postId));
  }

  return (
    <ConectadosContext.Provider value={{ viewer, departments, mentionable }}>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-28 pt-6">
        {viewer.canPost && <PostComposer onCreated={handleCreated} />}
        {posts.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Todavía no hay publicaciones. {viewer.canPost ? "Sé la primera persona en publicar algo." : ""}
          </p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} onDeleted={handleDeleted} />)
        )}
      </div>
    </ConectadosContext.Provider>
  );
}
```

Nota sobre `postId`/comentarios: este componente NO se suscribe a `post_comments` directamente — `CommentThread` (Task 8) abre su propio canal, scopeado a `post_id`, solo cuando el usuario expande los comentarios de un post puntual (evita 50 suscripciones activas por cada post del feed cuando nadie miró sus comentarios).

- [x] **Paso 3: Verificar tipos**

Run: `npm run typecheck`
Expected: errores esperados de imports que todavía no existen (`./post-composer`, `./post-card`) — se resuelven en las Tasks 5 y 7. Confirmar que el ÚNICO error reportado es "Cannot find module" para esos dos, nada más.

- [x] **Paso 4: Commit** (junto con Tasks 5-8, ver Task 8 — este archivo no compila solo hasta que existan sus dos imports).

---

### Task 5: `PostComposer` — texto con menciones, audiencia, encuesta, programar, adjuntos

**Files:**
- Create: `src/components/conectados/post-composer.tsx`
- Create: `src/components/conectados/mention-overlay.ts` (helpers de estado compartidos entre compositor y comentario — ver Task 8)

**Interfaces:**
- Consumes: `useConectados()` (Task 4), `createPost`/`uploadPostAttachment` (Task 3), `parseMentions`/`activeMentionQuery`/`buildMentionToken` (Task 1, desde `@/lib/mentions`), `ActionButton`, `Card`, `notifySuccess`/`notifyError`.
- Produces: `<PostComposer onCreated={(post: FeedPost) => void} />`; exporta `useMentionState(candidates: MentionableProfile[])` desde `mention-overlay.ts` para que `CommentThread` (Task 8) no reimplemente el mismo manejo de `body`/`mentions`/`cursor`/`elegido`/`cerrada`.

- [x] **Paso 1: Crear `src/components/conectados/mention-overlay.ts`**

Extrae la parte de `NoteForm` que es pura lógica de estado (no JSX) para que el compositor y el formulario de comentario la compartan — el JSX del overlay (que sí depende del layout de cada formulario: alto de textarea, si hay lista de sugerencias arriba o abajo) se queda en cada componente.

```typescript
import { useState } from "react";
import { activeMentionQuery, buildMentionToken } from "@/lib/mentions";
import { normalizarTexto } from "@/lib/utils";
import type { MentionableProfile } from "./types";

export type MentionRange = { start: number; end: number; nombre: string; profileId: string };

/** Mismo algoritmo que `NoteForm` (ver `.claude/napkin.md`, entradas de
 * 2026-09-09 sobre el overlay de menciones): una mención que se solapa con
 * un tramo editado se descarta, nunca queda apuntando a texto que ya no
 * dice ese nombre. */
export function adjustMentions(mentions: MentionRange[], oldStart: number, oldEnd: number, newLength: number): MentionRange[] {
  const delta = newLength - (oldEnd - oldStart);
  const result: MentionRange[] = [];
  for (const m of mentions) {
    if (m.end <= oldStart) result.push(m);
    else if (m.start >= oldEnd) result.push({ ...m, start: m.start + delta, end: m.end + delta });
  }
  return result;
}

export function changedRange(before: string, after: string): { oldStart: number; oldEnd: number; newLength: number } {
  const maxCommon = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < maxCommon && before[prefix] === after[prefix]) prefix++;
  const maxSuffix = Math.min(before.length - prefix, after.length - prefix);
  let suffix = 0;
  while (suffix < maxSuffix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  return { oldStart: prefix, oldEnd: before.length - suffix, newLength: after.length - suffix - prefix };
}

export function serializeMentions(body: string, mentions: MentionRange[]): string {
  const sorted = [...mentions].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const m of sorted) {
    out += body.slice(cursor, m.start);
    out += buildMentionToken(m.nombre, m.profileId);
    cursor = m.end;
  }
  out += body.slice(cursor);
  return out;
}

const MAX_SUGGESTIONS = 6;

/**
 * Todo el estado del textarea-con-overlay (Task de referencia: `NoteForm`,
 * `src/components/postulaciones/note-form.tsx`) en un hook para no
 * reescribirlo en cada formulario nuevo que necesite @menciones.
 */
export function useMentionState(candidates: MentionableProfile[]) {
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<MentionRange[]>([]);
  const [cursor, setCursor] = useState(0);
  const [elegido, setElegido] = useState(0);
  const [cerrada, setCerrada] = useState(false);

  const activa = cerrada ? null : activeMentionQuery(body, cursor);
  const q = activa ? normalizarTexto(activa.query) : "";
  const sugerencias = activa === null ? [] : candidates.filter((c) => normalizarTexto(c.display_name).includes(q)).slice(0, MAX_SUGGESTIONS);

  function handleChange(nuevoBody: string) {
    const { oldStart, oldEnd, newLength } = changedRange(body, nuevoBody);
    setMentions((prev) => adjustMentions(prev, oldStart, oldEnd, newLength));
    setBody(nuevoBody);
  }

  function insertMention(m: MentionableProfile | undefined, areaRef: React.RefObject<HTMLTextAreaElement | null>) {
    if (!m || !activa) return;
    const nombreLimpio = m.display_name.replace(/[[\]()]/g, "").trim();
    const oldStart = activa.desde;
    const oldEnd = cursor;
    const nuevoBody = `${body.slice(0, oldStart)}${nombreLimpio} ${body.slice(oldEnd)}`;
    const fin = oldStart + nombreLimpio.length;
    setMentions((prev) => [...adjustMentions(prev, oldStart, oldEnd, nombreLimpio.length + 1), { start: oldStart, end: fin, nombre: nombreLimpio, profileId: m.id }]);
    setBody(nuevoBody);
    setElegido(0);
    const posicion = fin + 1;
    requestAnimationFrame(() => {
      areaRef.current?.setSelectionRange(posicion, posicion);
      areaRef.current?.focus();
      setCursor(posicion);
    });
  }

  function reset() {
    setBody("");
    setMentions([]);
    setCursor(0);
    setElegido(0);
    setCerrada(false);
  }

  const segments: { texto: string; esMencion: boolean }[] = [];
  {
    const ordered = [...mentions].sort((a, b) => a.start - b.start);
    let cur = 0;
    for (const m of ordered) {
      if (m.start > cur) segments.push({ texto: body.slice(cur, m.start), esMencion: false });
      segments.push({ texto: body.slice(m.start, m.end), esMencion: true });
      cur = m.end;
    }
    if (cur < body.length) segments.push({ texto: body.slice(cur), esMencion: false });
  }

  return {
    body,
    mentions,
    sugerencias,
    elegido,
    segments,
    setCursor,
    setElegido,
    setCerrada,
    handleChange,
    insertMention,
    reset,
    serialized: () => serializeMentions(body, mentions),
    mentionIds: () => mentions.map((m) => m.profileId),
  };
}
```

- [x] **Paso 2: Crear `src/components/conectados/post-composer.tsx`**

```typescript
"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Calendar, ImagePlus, ListChecks, X } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { createPost, uploadPostAttachment } from "@/lib/conectados/actions";
import { useConectados } from "./conectados-feed";
import { useMentionState } from "./mention-overlay";
import type { FeedPost } from "@/lib/conectados/queries";

const MAX_POLL_OPTIONS = 6;

export function PostComposer({ onCreated }: { onCreated: (post: FeedPost) => void }) {
  const { viewer, departments, mentionable } = useConectados();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const listaId = useId();
  const mention = useMentionState(mentionable);
  const [isPending, startTransition] = useTransition();

  const [departmentId, setDepartmentId] = useState<string>("");
  const [roles, setRoles] = useState<Array<"gestor" | "admin" | "super_admin">>([]);
  const [publishAt, setPublishAt] = useState("");
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [files, setFiles] = useState<File[]>([]);

  function toggleRole(role: "gestor" | "admin" | "super_admin") {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = mention.serialized();
    const trimmedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    const poll = showPoll && trimmedOptions.length >= 2 ? { options: trimmedOptions.map((label) => ({ label })) } : null;

    startTransition(async () => {
      const result = await createPost({
        content,
        departmentId: departmentId || null,
        roles: roles.length > 0 ? roles : null,
        publishAt: publishAt ? new Date(publishAt).toISOString() : null,
        mentions: mention.mentionIds(),
        poll,
      });
      if (result.error) {
        notifyError(result.error);
        return;
      }
      if (result.post) {
        // Captura en un `const` propio: el spread de `result.post` más abajo
        // ocurre después de un `await Promise.all(...)`, y TypeScript no
        // conserva el angostamiento de `if (result.post)` a través de una
        // llamada async — sin este `const`, `result.post` volvería a verse
        // como `FeedPost | undefined` en el spread y el objeto armado no
        // calzaría con lo que `onCreated` espera.
        const createdPost = result.post;
        // Adjuntos: recién ahora existe `post.id` (convención de carpeta
        // `{organization_id}/{post_id}/{...}` — ver spec). Se suben en
        // paralelo y se agregan al post ya devuelto antes de avisar al feed.
        const uploaded = await Promise.all(
          files.map(async (file) => {
            const formData = new FormData();
            formData.set("file", file);
            const r = await uploadPostAttachment(createdPost.id, formData);
            return r.attachment ?? null;
          }),
        );
        onCreated({ ...createdPost, attachments: uploaded.filter((a) => a !== null) });
        notifySuccess(result.success ?? "Publicación creada");
        mention.reset();
        setDepartmentId("");
        setRoles([]);
        setPublishAt("");
        setShowPoll(false);
        setPollOptions(["", ""]);
        setFiles([]);
      }
    });
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-border bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words"
          >
            {mention.segments.map((s, i) =>
              s.esMencion ? (
                <span key={i} className="text-accent">
                  {s.texto}
                </span>
              ) : (
                <span key={i}>{s.texto}</span>
              ),
            )}
            {mention.body.endsWith("\n") && "​"}
          </div>
          <textarea
            ref={areaRef}
            rows={3}
            value={mention.body}
            onChange={(e) => {
              mention.handleChange(e.target.value);
              mention.setCursor(e.target.selectionStart);
              mention.setElegido(0);
              mention.setCerrada(false);
            }}
            onKeyUp={(e) => mention.setCursor(e.currentTarget.selectionStart)}
            onClick={(e) => mention.setCursor(e.currentTarget.selectionStart)}
            onKeyDown={(e) => {
              if (mention.sugerencias.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                mention.setElegido((i) => (i + 1) % mention.sugerencias.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                mention.setElegido((i) => (i - 1 + mention.sugerencias.length) % mention.sugerencias.length);
              } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                mention.insertMention(mention.sugerencias[mention.elegido] ?? mention.sugerencias[0], areaRef);
              } else if (e.key === "Escape") {
                e.preventDefault();
                mention.setCerrada(true);
              }
            }}
            placeholder="¿Qué quieres compartir con el equipo? (@ para mencionar)"
            role="combobox"
            aria-expanded={mention.sugerencias.length > 0}
            aria-controls={listaId}
            className="relative w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-sm text-transparent caret-foreground placeholder:text-muted-foreground"
          />
          {mention.sugerencias.length > 0 && (
            <Card as="ul" id={listaId} role="listbox" aria-label="Personas que puedes mencionar" className="absolute z-10 mt-1 w-full max-w-xs rounded-md">
              {mention.sugerencias.map((m, i) => (
                <li
                  key={m.id}
                  role="option"
                  aria-selected={i === mention.elegido}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    mention.insertMention(m, areaRef);
                  }}
                  className={`cursor-pointer px-3 py-2 text-[13px] ${i === mention.elegido ? "bg-muted" : ""}`}
                >
                  {m.display_name}
                </li>
              ))}
            </Card>
          )}
        </div>

        {showPoll && (
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => setPollOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                  placeholder={`Opción ${i + 1}`}
                  maxLength={120}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    aria-label="Quitar opción"
                    onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                    className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < MAX_POLL_OPTIONS && (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ""])}
                className="self-start text-xs font-medium text-accent underline"
              >
                Agregar opción
              </button>
            )}
          </div>
        )}

        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs">
                {f.name}
                <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <label className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Agregar adjunto">
            <ImagePlus className="size-[18px]" aria-hidden />
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
              className="hidden"
              onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
            />
          </label>
          <button
            type="button"
            onClick={() => setShowPoll((v) => !v)}
            aria-pressed={showPoll}
            className={`flex size-9 items-center justify-center rounded-full ${showPoll ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
            aria-label="Agregar encuesta"
          >
            <ListChecks className="size-[18px]" aria-hidden />
          </button>

          {viewer.isAdminOrAbove && (
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs"
            >
              <option value="">Toda la organización</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {!viewer.isAdminOrAbove && viewer.departmentId && (
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs"
            >
              <option value="">Toda la organización</option>
              <option value={viewer.departmentId}>Solo mi departamento</option>
            </select>
          )}

          {viewer.isAdminOrAbove && (
            // Roles destinatarios DENTRO del departamento ya elegido — mismo
            // significado que `posts.roles` (comentario de columna, Task 3
            // del backend): NULL/vacío = todos, nunca amplía, solo restringe.
            // Reservado a admin+, calca `posts_insert`.
            <div className="flex items-center gap-1 rounded-full border border-border px-2 py-1">
              {(["gestor", "admin", "super_admin"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  aria-pressed={roles.includes(role)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${roles.includes(role) ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
                >
                  {role === "gestor" ? "Gestores" : role === "admin" ? "Admins" : "Super admins"}
                </button>
              ))}
            </div>
          )}

          {viewer.isAdminOrAbove && (
            <label className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" aria-hidden />
              <input
                type="datetime-local"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                className="bg-transparent outline-none"
              />
            </label>
          )}

          <ActionButton type="submit" pending={isPending} className="ml-auto h-9 px-5 text-xs">
            {publishAt ? "Programar" : "Publicar"}
          </ActionButton>
        </div>
      </form>
    </Card>
  );
}
```

- [x] **Paso 3: Verificar tipos**

Run: `npm run typecheck`
Expected: error esperado en `conectados-feed.tsx` por el import de `./post-card` (Task 7 todavía no existe) — nada más nuevo.

- [x] **Paso 4: No commitear todavía** (este archivo depende de `useConectados`, que ya existe desde Task 4 — sí puede commitearse solo si typecheck no arrastra el error de post-card. Si el error es únicamente por `post-card`, hacer commit ahora es seguro igual: TypeScript reporta por archivo, no bloquea un commit de git.)

```bash
git add src/components/conectados/mention-overlay.ts src/components/conectados/post-composer.tsx
git commit -m "feat(conectados): compositor con menciones, audiencia, encuesta, programar y adjuntos"
```

---

### Task 6: `ReactionBar` y `PollWidget`

**Files:**
- Create: `src/components/conectados/reaction-bar.tsx`
- Create: `src/components/conectados/poll-widget.tsx`

**Interfaces:**
- Consumes: `toggleReaction`/`toggleCommentReaction`/`votePoll` (Task 3), `useConectados()` (Task 4).
- Produces: `<ReactionBar targetId reactions onOptimisticToggle scope="post"|"comment" />`, `<PollWidget postId poll viewerId onOptimisticVote />`.

- [x] **Paso 1: Crear `src/components/conectados/reaction-bar.tsx`**

```typescript
"use client";

import { useTransition } from "react";
import { Flame, Heart, PartyPopper, ThumbsUp } from "lucide-react";
import { toggleReaction, toggleCommentReaction } from "@/lib/conectados/actions";
import { notifyError } from "@/lib/notifications/toast";
import { useConectados } from "./conectados-feed";
import type { ReactionType } from "@/lib/conectados/schema";
import type { Reactions } from "@/lib/conectados/queries";

const REACTION_ICON: Record<ReactionType, typeof ThumbsUp> = {
  like: ThumbsUp,
  corazon: Heart,
  aplauso: PartyPopper,
  fuego: Flame,
};

/**
 * Reacción: toggle de baja fricción, sin `notifySuccess` (el propio ícono
 * resaltado ya confirma — un toast por cada "me gusta" sería ruido, no
 * información, ver spec). El cambio se aplica en el ESTADO DEL PADRE
 * (`onOptimisticToggle`) antes de esperar la respuesta del servidor: la
 * actualización autoritativa llega después por Realtime (`posts`/
 * `post_comments` UPDATE) y siempre pisa este valor optimista.
 */
export function ReactionBar({
  targetId,
  reactions,
  scope,
  onOptimisticToggle,
}: {
  targetId: string;
  reactions: Reactions;
  scope: "post" | "comment";
  onOptimisticToggle: (type: ReactionType) => void;
}) {
  const { viewer } = useConectados();
  const [, startTransition] = useTransition();
  const mine = reactions[viewer.id] as ReactionType | undefined;

  const counts = Object.values(reactions).reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  function handleClick(type: ReactionType) {
    onOptimisticToggle(type);
    startTransition(async () => {
      const action = scope === "post" ? toggleReaction : toggleCommentReaction;
      const result = await action(targetId, type);
      if (result.error) {
        notifyError(result.error);
        onOptimisticToggle(type); // revertir el toggle optimista
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      {(Object.keys(REACTION_ICON) as ReactionType[]).map((type) => {
        const Icon = REACTION_ICON[type];
        const active = mine === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => handleClick(type)}
            aria-pressed={active}
            className={`flex size-7 items-center justify-center rounded-full ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Icon className="size-3.5" strokeWidth={active ? 2.5 : 2} aria-hidden />
          </button>
        );
      })}
      {Object.keys(counts).length > 0 && (
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
          {Object.values(counts).reduce((a, b) => a + b, 0)}
        </span>
      )}
    </div>
  );
}
```

- [x] **Paso 2: Crear `src/components/conectados/poll-widget.tsx`**

```typescript
"use client";

import { useTransition } from "react";
import { votePoll } from "@/lib/conectados/actions";
import { notifyError } from "@/lib/notifications/toast";
import { useConectados } from "./conectados-feed";
import type { Poll } from "@/lib/conectados/queries";

export function PollWidget({
  postId,
  poll,
  onOptimisticVote,
}: {
  postId: string;
  poll: Poll;
  onOptimisticVote: (optionIndex: number) => void;
}) {
  const { viewer } = useConectados();
  const [, startTransition] = useTransition();
  const total = poll.options.reduce((acc, o) => acc + o.votes.length, 0);
  const myVoteIndex = poll.options.findIndex((o) => o.votes.includes(viewer.id));

  function handleVote(index: number) {
    if (index === myVoteIndex) return;
    onOptimisticVote(index);
    startTransition(async () => {
      const result = await votePoll(postId, index);
      if (result.error) notifyError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {poll.options.map((option, i) => {
        const pct = total === 0 ? 0 : Math.round((option.votes.length / total) * 100);
        const mine = i === myVoteIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => handleVote(i)}
            className="relative w-full overflow-hidden rounded-md border border-border px-3 py-2 text-left text-sm"
          >
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 ${mine ? "bg-accent/25" : "bg-muted"}`}
              style={{ width: `${pct}%` }}
            />
            <span className="relative flex items-center justify-between gap-2">
              <span className={mine ? "font-semibold" : ""}>{option.label}</span>
              <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>
            </span>
          </button>
        );
      })}
      <p className="text-xs tabular-nums text-muted-foreground">{total} {total === 1 ? "voto" : "votos"}</p>
    </div>
  );
}
```

- [x] **Paso 3: Verificar que los íconos elegidos existen en `lucide-react`**

Run: `grep -rn "PartyPopper\|ThumbsUp\|Flame\b" node_modules/lucide-react/dist/lucide-react.d.ts | head -5`
Expected: los 3 nombres aparecen. Si `PartyPopper` no existe en la versión instalada, sustituir por `Sparkles` (también razonable para "aplauso") y ajustar el único import.

- [x] **Paso 4: Commit**

```bash
git add src/components/conectados/reaction-bar.tsx src/components/conectados/poll-widget.tsx
git commit -m "feat(conectados): barra de reacciones (post y comentario) y widget de encuesta"
```

---

### Task 7: `PostCard` + `AttachmentGallery`

**Files:**
- Create: `src/components/conectados/post-card.tsx`
- Create: `src/components/conectados/attachment-gallery.tsx`
- Create: `src/components/conectados/mention-text.tsx`

**Interfaces:**
- Consumes: `parseMentions` (Task 1), `ReactionBar`/`PollWidget` (Task 6), `deletePost` (Task 3), `useConectados()` (Task 4), `CommentThread` (Task 8 — import queda declarado acá, la Task 8 lo crea).
- Produces: `<PostCard post={FeedPost} onDeleted={(id: string) => void} />`.

- [x] **Paso 1: Crear `src/components/conectados/mention-text.tsx`**

```typescript
import { parseMentions } from "@/lib/mentions";

/** Mismo principio que `NoteBody` (postulaciones): partes de texto de
 * React, nunca `dangerouslySetInnerHTML` — un cuerpo con `<script>` se
 * pinta como texto literal, no se ejecuta. */
export function MentionText({ body }: { body: string }) {
  return (
    <>
      {parseMentions(body).map((part, i) =>
        part.tipo === "mencion" ? (
          <span key={i} className="font-semibold text-accent">
            @{part.nombre}
          </span>
        ) : (
          <span key={i}>{part.valor}</span>
        ),
      )}
    </>
  );
}
```

- [x] **Paso 2: Crear `src/components/conectados/attachment-gallery.tsx`**

```typescript
import { FileText } from "lucide-react";
import type { Attachment } from "@/lib/conectados/queries";

export function AttachmentGallery({ attachments }: { attachments: (Attachment & { url: string })[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className={`grid gap-1.5 overflow-hidden rounded-md ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {attachments.map((a, i) => {
        if (a.mimeType.startsWith("image/")) {
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage, con TTL de 1h: <Image> de Next la cachearía más allá de su vencimiento.
          return <img key={i} src={a.url} alt={a.name} className="aspect-video w-full object-cover" />;
        }
        if (a.mimeType.startsWith("video/")) {
          return <video key={i} src={a.url} controls className="aspect-video w-full" />;
        }
        return (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm"
          >
            <FileText className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{a.name}</span>
          </a>
        );
      })}
    </div>
  );
}
```

- [x] **Paso 3: Crear `src/components/conectados/post-card.tsx`**

```typescript
"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError } from "@/lib/notifications/toast";
import { deletePost } from "@/lib/conectados/actions";
import { useConectados } from "./conectados-feed";
import { MentionText } from "./mention-text";
import { AttachmentGallery } from "./attachment-gallery";
import { ReactionBar } from "./reaction-bar";
import { PollWidget } from "./poll-widget";
import { CommentThread } from "./comment-thread";
import type { FeedPost, Poll } from "@/lib/conectados/queries";
import type { ReactionType } from "@/lib/conectados/schema";

export function PostCard({ post: initialPost, onDeleted }: { post: FeedPost; onDeleted: (id: string) => void }) {
  const { viewer, departments } = useConectados();
  const [post, setPost] = useState(initialPost);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const canDelete = post.author_id === viewer.id || viewer.isAdminOrAbove;
  const audienceLabel = post.department_id
    ? (departments.find((d) => d.id === post.department_id)?.name ?? "un departamento")
    : null;

  function toggleOwnReaction(type: ReactionType) {
    setPost((p) => {
      const mine = p.reactions[viewer.id];
      const reactions = { ...p.reactions };
      if (mine === type) delete reactions[viewer.id];
      else reactions[viewer.id] = type;
      return { ...p, reactions };
    });
  }

  function applyPollVote(optionIndex: number) {
    setPost((p) => {
      if (!p.poll) return p;
      const options = p.poll.options.map((o, i) => {
        const votes = o.votes.filter((v) => v !== viewer.id);
        if (i === optionIndex) votes.push(viewer.id);
        return { ...o, votes };
      });
      return { ...p, poll: { options } as Poll };
    });
  }

  async function handleDelete() {
    const result = await deletePost(post.id);
    if (result.error) {
      notifyError(result.error);
      throw new Error(result.error);
    }
    onDeleted(post.id);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
          {post.author_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo, mismo patrón que el resto de la app
            <img src={post.author_avatar_url} alt="" className="size-full object-cover" />
          ) : (
            post.author_name.slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <p className="text-sm font-semibold">{post.author_name}</p>
            {audienceLabel && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Solo {audienceLabel}
              </span>
            )}
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: es })}
          </p>
        </div>
        {canDelete && (
          <DeleteButton
            itemLabel="esta publicación"
            iconOnly
            onDelete={handleDelete}
            successMessage="Publicación eliminada"
          />
        )}
      </div>

      {post.content && (
        <p className="whitespace-pre-wrap text-sm">
          <MentionText body={post.content} />
        </p>
      )}

      <AttachmentGallery attachments={post.attachments} />
      {post.poll && <PollWidget postId={post.id} poll={post.poll} onOptimisticVote={applyPollVote} />}

      <div className="flex items-center justify-between border-t border-border pt-2">
        <ReactionBar targetId={post.id} reactions={post.reactions} scope="post" onOptimisticToggle={toggleOwnReaction} />
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="size-3.5" aria-hidden />
          Comentarios
        </button>
      </div>

      {commentsOpen && <CommentThread postId={post.id} />}
    </Card>
  );
}
```

- [x] **Paso 4: Verificar tipos**

Run: `npm run typecheck`
Expected: error esperado en `post-card.tsx` por `./comment-thread` (Task 8) y en `conectados-feed.tsx` ya resuelto (post-card ya existe). Ningún otro error nuevo.

- [x] **Paso 5: Commit**

```bash
git add src/components/conectados/post-card.tsx src/components/conectados/attachment-gallery.tsx src/components/conectados/mention-text.tsx
git commit -m "feat(conectados): tarjeta de post con adjuntos, encuesta, reacciones e insignia de audiencia"
```

---

### Task 8: `CommentThread`

**Files:**
- Create: `src/components/conectados/comment-thread.tsx`

**Interfaces:**
- Consumes: `getPostComments` NO se usa acá — los comentarios se cargan client-side al expandir (ver Paso 1) via una nueva Route-less fetch: en realidad, para no crear un Route Handler solo para esto, `CommentThread` llama una Server Action de lectura. Se agrega `listComments` a `actions.ts` en el Paso 1 de esta tarea (server actions también sirven para leer, no solo mutar — mismo patrón que ya usa el resto del repo para datos que se cargan después del render inicial).
- Produces: `<CommentThread postId={string} />`.

- [x] **Paso 1: Agregar `listComments` a `src/lib/conectados/actions.ts`**

Server Actions normalmente mutan, pero acá no hay Route Handler ni querystring razonable para "comentarios de este post, cargados al expandir" — una Server Action que solo lee es el patrón más simple, y ya lo valida `requireProfile()` + RLS igual que cualquier lectura.

Reemplazar la línea de import existente (Task 3 la dejó como `import type { FeedPost, FeedComment, Attachment, Poll, Reactions } from "./queries";`) por una sola línea que combine el import de valor con los de tipo — dos `import` separados del mismo módulo dispararía `import/no-duplicates`:

```typescript
import { getPostComments, type FeedPost, type FeedComment, type Attachment, type Poll, type Reactions } from "./queries";
```

Y agregar al final del archivo, junto a las demás funciones exportadas:

```typescript
export async function listComments(postId: string) {
  await requireProfile();
  return getPostComments(postId);
}
```

- [x] **Paso 2: Crear `src/components/conectados/comment-thread.tsx`**

```typescript
"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError } from "@/lib/notifications/toast";
import { addComment, deleteComment, listComments } from "@/lib/conectados/actions";
import { useConectados } from "./conectados-feed";
import { useMentionState } from "./mention-overlay";
import { MentionText } from "./mention-text";
import { ReactionBar } from "./reaction-bar";
import type { FeedComment, Reactions } from "@/lib/conectados/queries";
import type { ReactionType } from "@/lib/conectados/schema";

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string | null;
  author_name: string;
  author_avatar_url: string | null;
  body: string;
  mentions: string[];
  reactions: Reactions;
  created_at: string;
  updated_at: string | null;
};

export function CommentThread({ postId }: { postId: string }) {
  const { viewer, mentionable } = useConectados();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const listaId = useId();
  const mention = useMentionState(mentionable);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    listComments(postId).then((data) => {
      if (active) {
        setComments(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [postId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conectados-comments:${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setComments((current) => current.filter((c) => c.id !== (payload.old as { id: string }).id));
            return;
          }
          const row = payload.new as CommentRow;
          setComments((current) => {
            const merged: FeedComment = { ...row, reactions: row.reactions ?? {} };
            if (current.some((c) => c.id === row.id)) return current.map((c) => (c.id === row.id ? merged : c));
            return [...current, merged];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = mention.serialized();
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await addComment({ postId, body, mentions: mention.mentionIds() });
      if (result.error) {
        notifyError(result.error);
        return;
      }
      if (result.comment && !comments.some((c) => c.id === result.comment!.id)) {
        setComments((current) => [...current, result.comment!]);
      }
      mention.reset();
    });
  }

  function toggleOwnReaction(commentId: string, type: ReactionType) {
    setComments((current) =>
      current.map((c) => {
        if (c.id !== commentId) return c;
        const mine = c.reactions[viewer.id];
        const reactions = { ...c.reactions };
        if (mine === type) delete reactions[viewer.id];
        else reactions[viewer.id] = type;
        return { ...c, reactions };
      }),
    );
  }

  async function handleDeleteComment(commentId: string) {
    const result = await deleteComment(commentId);
    if (result.error) {
      notifyError(result.error);
      throw new Error(result.error);
    }
    setComments((current) => current.filter((c) => c.id !== commentId));
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando comentarios…</p>
      ) : (
        comments.map((comment) => (
          <div key={comment.id} className="flex items-start gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
              {comment.author_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar externo
                <img src={comment.author_avatar_url} alt="" className="size-full object-cover" />
              ) : (
                comment.author_name.slice(0, 1).toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="text-xs font-semibold">{comment.author_name}</p>
                <p className="text-sm">
                  <MentionText body={comment.body} />
                </p>
              </div>
              <div className="mt-1 flex items-center gap-3 pl-3">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es })}
                </span>
                <ReactionBar
                  targetId={comment.id}
                  reactions={comment.reactions}
                  scope="comment"
                  onOptimisticToggle={(type) => toggleOwnReaction(comment.id, type)}
                />
                {(comment.author_id === viewer.id || viewer.isAdminOrAbove) && (
                  <DeleteButton
                    itemLabel="este comentario"
                    iconOnly
                    onDelete={() => handleDeleteComment(comment.id)}
                    successMessage="Comentario eliminado"
                    className="size-6"
                  />
                )}
              </div>
            </div>
          </div>
        ))
      )}

      <form onSubmit={handleSubmit} className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-border bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words"
        >
          {mention.segments.map((s, i) =>
            s.esMencion ? (
              <span key={i} className="text-accent">
                {s.texto}
              </span>
            ) : (
              <span key={i}>{s.texto}</span>
            ),
          )}
        </div>
        <textarea
          ref={areaRef}
          rows={1}
          value={mention.body}
          onChange={(e) => {
            mention.handleChange(e.target.value);
            mention.setCursor(e.target.selectionStart);
            mention.setElegido(0);
            mention.setCerrada(false);
          }}
          onKeyUp={(e) => mention.setCursor(e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (mention.sugerencias.length > 0) {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                mention.insertMention(mention.sugerencias[mention.elegido] ?? mention.sugerencias[0], areaRef);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                mention.setCerrada(true);
                return;
              }
            }
          }}
          placeholder="Escribe un comentario… (@ para mencionar)"
          role="combobox"
          aria-expanded={mention.sugerencias.length > 0}
          aria-controls={listaId}
          className="relative w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-sm text-transparent caret-foreground placeholder:text-muted-foreground"
        />
        {mention.sugerencias.length > 0 && (
          <Card as="ul" id={listaId} role="listbox" aria-label="Personas que puedes mencionar" className="absolute z-10 mt-1 w-full max-w-xs rounded-md">
            {mention.sugerencias.map((m, i) => (
              <li
                key={m.id}
                role="option"
                aria-selected={i === mention.elegido}
                onMouseDown={(e) => {
                  e.preventDefault();
                  mention.insertMention(m, areaRef);
                }}
                className={`cursor-pointer px-3 py-2 text-[13px] ${i === mention.elegido ? "bg-muted" : ""}`}
              >
                {m.display_name}
              </li>
            ))}
          </Card>
        )}
        <ActionButton type="submit" pending={isPending} className="mt-2 h-8 px-4 text-xs">
          Comentar
        </ActionButton>
      </form>
    </div>
  );
}
```

- [x] **Paso 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores en ningún archivo de `src/components/conectados/` (Tasks 4, 5, 6, 7 y 8 ya se resuelven entre sí).

- [x] **Paso 4: Commit**

```bash
git add src/lib/conectados/actions.ts src/components/conectados/comment-thread.tsx src/components/conectados/conectados-feed.tsx
git commit -m "feat(conectados): hilo de comentarios con menciones, reacciones y borrado; cierra el feed completo"
```

---

### Task 9: Reemplazar el placeholder de `/conectados`

**Files:**
- Modify: `src/app/(app)/conectados/page.tsx`
- Delete: `src/app/(app)/conectados/loading.tsx` (ver nota abajo)

**Interfaces:**
- Consumes: `getPosts`, `getDepartmentsForAudience` (Task 2), `getOwnPostPermissions` (ya existía), `getProfilesForSelect` (`src/lib/departments/get-departments-admin.ts`, sin cambios), `requireProfile` (`src/lib/auth/dal.ts`), `ConectadosFeed` (Task 4).

**Nota sobre `loading.tsx`:** el diseño evita depender de `revalidatePath` precisamente porque esta ruta tenía un Suspense boundary. Con `page.tsx` haciendo varias consultas en paralelo (nunca secuenciales, todas rápidas — ninguna espera de red larga tipo generación de IA), un `loading.tsx` no aporta nada real y sigue siendo la causa potencial de un remontaje si algo lo dispara más adelante (otra revalidación, un `router.refresh()` futuro). Se elimina; si la carga inicial demostrara ser lenta en producción, se puede reintroducir con un skeleton real en vez del genérico actual — pero medir antes de reintroducir, no reintroducir "por si acaso".

- [x] **Paso 1: Confirmar el contenido actual de `loading.tsx` antes de borrarlo**

Run: `cat "src/app/(app)/conectados/loading.tsx"`
Expected: un skeleton genérico sin lógica propia (si tuviera algo más específico, conservar esa idea como comentario en el nuevo `page.tsx` en vez de perderla).

- [x] **Paso 2: Borrar `src/app/(app)/conectados/loading.tsx`**

```bash
git rm "src/app/(app)/conectados/loading.tsx"
```

- [x] **Paso 3: Reemplazar `src/app/(app)/conectados/page.tsx`**

```typescript
import { requireProfile } from "@/lib/auth/dal";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import { getProfilesForSelect } from "@/lib/departments/get-departments-admin";
import { getPosts, getDepartmentsForAudience, getOwnPostPermissions } from "@/lib/conectados/queries";
import { ConectadosFeed } from "@/components/conectados/conectados-feed";

export default async function ConectadosPage() {
  const profile = await requireProfile();
  const isAdminOrAbove = ADMIN_ROLES.has(profile.role);

  const [posts, departments, mentionable, ownPermissions] = await Promise.all([
    getPosts(),
    getDepartmentsForAudience(profile.organization_id),
    getProfilesForSelect(profile.organization_id),
    getOwnPostPermissions(profile.id),
  ]);

  const canPost = isAdminOrAbove || (ownPermissions?.can_post ?? false);

  return (
    <ConectadosFeed
      initialPosts={posts}
      viewer={{
        id: profile.id,
        organizationId: profile.organization_id,
        departmentId: profile.department_id,
        isAdminOrAbove,
        canPost,
      }}
      departments={departments}
      mentionable={mentionable.filter((m) => m.id !== profile.id)}
    />
  );
}
```

- [x] **Paso 4: Verificar tipos y build**

Run: `npm run typecheck`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores nuevos (warnings preexistentes ajenos a esta rama, como ya se documentó en Task 20 del plan de backend, quedan igual).

Run: `npm run dev` (dejar corriendo en background el tiempo suficiente para confirmar que arranca)
Expected: arranca sin error de compilación. Sin sesión no se puede ver el feed renderizado (mismo límite que Task 20 — login solo Google OAuth), pero sí confirma que la ruta compila y no hay un error de import/tipo que solo aparece en runtime de servidor.

- [x] **Paso 5: Commit**

```bash
git add "src/app/(app)/conectados/page.tsx"
git commit -m "feat(conectados): reemplaza el placeholder por el feed real"
```

---

### Task 10: Verificación final, `/code-review`, napkin, push

**Files:** ninguno nuevo — solo verificación y documentación.

- [x] **Paso 1: `npm run typecheck` y `npm run lint` sobre todo el diff de la fase**

Expected: 0 errores. Cualquier warning debe ser preexistente y ajeno a esta rama (confirmar con `git stash` + correr lint en `main` si hay duda de si un warning ya estaba).

- [x] **Paso 2: Auditoría manual de la regla no negociable de interacción**

Run: `grep -rn "type=\"submit\"" src/components/conectados/`
Expected: cada `type="submit"` encontrado está dentro de un `<ActionButton>` (el compositor y el form de comentario), nunca un `<button type="submit">` crudo para una mutación.

Run: `grep -rn "DeleteButton" src/components/conectados/`
Expected: aparece en `post-card.tsx` y `comment-thread.tsx` — ningún borrado en un solo clic.

- [x] **Paso 3: `/code-review` sobre el diff completo de la fase (desde el commit de Task 1 hasta el de Task 9)**

Correr con el alcance más amplio disponible (line-by-line, reuse, simplificación, eficiencia, convenciones de `AGENTS.md`). Prestar atención particular a:
- Que `filterMentionsInOrg` siga aplicándose a TODA mención nueva (compositor y comentario) — es el hueco de seguridad que ya se reintrodujo una vez en este mismo módulo.
- Que ningún `<img>`/URL de adjunto use algo distinto de la URL firmada devuelta por `getPosts`/`uploadPostAttachment` (nunca un `path` crudo de Storage).
- Que el merge de Realtime en `conectados-feed.tsx`/`comment-thread.tsx` no duplique filas cuando el propio autor ya insertó su post/comentario de forma optimista.
- Corregir cualquier hallazgo real en el mismo commit de cierre (mismo patrón que Task 20 del backend: 6 hallazgos, todos corregidos antes de cerrar la fase).

- [x] **Paso 4: Actualizar `.claude/napkin.md`**

Agregar (al principio, respetando el máximo de 10 ítems por categoría — recortar el más viejo/menos relevante si hace falta) cualquier gotcha real encontrado durante la implementación (no hipotético): por ejemplo, si `createSignedUrls` tuvo algún comportamiento inesperado con paths que no existen, si el merge de Realtime tuvo una condición de carrera real al probarlo, o si el hook `useMentionState` reveló algo que `NoteForm` no había mostrado al tener un textarea de una sola fila (el formulario de comentario) en vez de varias.

- [x] **Paso 5: Commit de cierre (fixes de code-review + napkin) y push final**

```bash
git add -A
git commit -m "docs(conectados): code-review final del feed + napkin actualizado"
git push -u origin claude/aje-conectados-feed-ch7xhv
```

---

## Cierre de la fase (auto-revisión)

Ejecutado de punta a punta en modo automático (usuario en reunión), sin checkpoints intermedios, commit por tarea:

- Task 1 (mover menciones): `a6ee3ee`
- Task 2 (schema/queries): `51ef9ba`
- Task 3 (actions): `124532a`
- Task 4 (ConectadosFeed): `878811a`
- Task 5 (compositor): `b2060aa`
- Task 6 (reacciones + encuesta): `a6051d4`
- Task 7 (tarjeta de post): `b93c01e`
- Task 8 (comentarios): `f57f576`
- Task 9 (page.tsx real): `5618d32`
- Task 10 (`/code-review` + napkin): `cbdb463`

`/code-review` (nivel high) sobre el diff completo encontró **12 hallazgos reales, los 12 corregidos** en el commit de cierre — más que la fase de backend (6), esperable dado que esta fase es toda UI de cliente nueva (estado optimista, Realtime, formularios) en vez de SQL. El más serio: `PostCard` nunca releía su prop tras el primer render, así que Realtime en los hechos solo servía para el propio autor de una acción, nunca para el resto de quienes miran el feed — ver `.claude/napkin.md` para el detalle y la lección general (estado derivado de un prop necesita sincronizarse explícitamente, no solo `useState(prop)`).

**Desviaciones reales del plan escrito, con motivo:**
- El guard de "contenido o encuesta obligatorios" se movió de `createPost` (servidor) al compositor (cliente): el servidor no puede saber en el momento de crear el post si vienen adjuntos (se suben después, en un segundo paso, referenciando el `id` ya creado) — exigirlo ahí bloqueaba un post válido de "solo fotos". Documentado en el propio código y en el commit de cierre.
- Los adjuntos se suben secuencialmente, no en paralelo (`Promise.all` original) — un `read-modify-write` sobre `posts.attachments` en paralelo pierde escrituras (hallado en `/code-review`, ver napkin).
- La key de Storage del adjunto ya no usa `file.name` del cliente — solo un uuid propio + extensión derivada del MIME ya validado, igual que `uploadAvatar`.

**Sin migraciones nuevas** — se confirma lo previsto en el diseño: toda la RLS/RPCs del backend (fase anterior) ya cubrían lo que esta UI necesitaba.

**Pendiente para el usuario, no para un agente:** click-through real en el navegador (login Google OAuth, publicar, comentar, reaccionar, votar una encuesta, ver un adjunto). Mismo límite que Task 20 de la fase de backend — sin credenciales de prueba no hay forma de autenticarse en este entorno, y esta sesión además no tenía `node_modules` ni variables de entorno de Supabase configuradas (se instalaron las dependencias; las credenciales de Supabase siguen sin estar disponibles acá). Se compensó con `typecheck`/`lint` limpios en cada tarea y `/code-review` de cierre — no reemplaza probarlo con una cuenta real.
