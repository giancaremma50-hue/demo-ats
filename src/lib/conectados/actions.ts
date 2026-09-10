"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { notify, notifyBestEffort } from "@/lib/notifications/notify";
import { CreatePostSchema, CreateCommentSchema, REACTION_TYPES, type ReactionType } from "./schema";

export type ConectadosActionResult = { error?: string; success?: string };

function previewContent(content: string): string {
  const text = content.trim();
  if (!text) return "Nueva publicación con contenido adjunto";
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export async function createPost(input: unknown): Promise<ConectadosActionResult> {
  const profile = await requireProfile();
  const parsed = CreatePostSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { content, departmentId, roles, publishAt, mentions } = parsed.data;

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
      const { data: recipients } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .neq("id", profile.id);
      for (const recipient of recipients ?? []) {
        await notify({
          organizationId: profile.organization_id,
          recipientId: recipient.id,
          type: "post_nuevo",
          title: "Nueva publicación",
          body: `${profile.display_name} publicó: "${previewContent(content)}"`,
          url: "/conectados",
          entityType: "post",
          entityId: post.id,
        });
      }
      for (const recipientId of mentions.filter((id) => id !== profile.id)) {
        await notify({
          organizationId: profile.organization_id,
          recipientId,
          type: "post_mencion",
          title: `${profile.display_name} te mencionó`,
          body: previewContent(content),
          url: "/conectados",
          entityType: "post",
          entityId: post.id,
        });
      }
    });
  }

  revalidatePath("/conectados");
  return { success: "Publicación creada" };
}

export async function addComment(input: unknown): Promise<ConectadosActionResult> {
  const profile = await requireProfile();
  const parsed = CreateCommentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { postId, body, mentions } = parsed.data;

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
    for (const recipientId of mentions.filter((id) => id !== profile.id)) {
      await notify({
        organizationId: profile.organization_id,
        recipientId,
        type: "post_mencion",
        title: `${profile.display_name} te mencionó`,
        body: previewContent(body),
        url: "/conectados",
        entityType: "post",
        entityId: postId,
      });
    }
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
