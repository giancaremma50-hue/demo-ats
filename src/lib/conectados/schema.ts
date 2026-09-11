import { z } from "zod";

export const REACTION_TYPES = ["like", "corazon", "aplauso", "fuego"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

/**
 * "Todavía no lo ve nadie más que su autor".
 *
 * Vive acá y no en `queries.ts` porque lo usan los dos lados: el servidor al
 * armar el feed y el manejador de Realtime en el cliente. `queries.ts` es
 * `server-only`, e importar un VALOR suyo desde un componente cliente rompe
 * el build (importar solo el TIPO sí se permite — los tipos se borran).
 *
 * Ojo con la condición: `publish_at != null` NO alcanza. `posts_select` ya
 * deja pasar el post en cuanto `publish_at <= now()`, mientras que el cron
 * que limpia la marca corre una vez al día — entre esos dos momentos el post
 * ya es visible para todos y marcarlo "Programada" sería mentir por ~24h.
 */
export function isScheduled(publishAt: string | null): boolean {
  return publishAt !== null && new Date(publishAt).getTime() > Date.now();
}

export const PollSchema = z.object({
  options: z
    .array(z.object({ label: z.string().trim().min(1, "Una opción no puede estar vacía.").max(120) }))
    .min(2, "Una encuesta necesita al menos 2 opciones.")
    .max(6, "Máximo 6 opciones por encuesta."),
});
export type PollInput = z.infer<typeof PollSchema>;

// Sin campo `mentions`: las menciones se extraen del CUERPO (los tokens
// `@[Nombre](uuid)` que serializa el compositor) y se validan contra perfiles
// reales en `resolveMentions`. Un array aparte era la misma información dos
// veces — y la copia del cliente era la que abría el hueco de notificar a un
// uuid de otra organización.
export const CreatePostSchema = z.object({
  content: z.string().trim().max(4000, "El contenido es demasiado largo."),
  departmentId: z.string().uuid().nullable(),
  roles: z.array(z.enum(["gestor", "admin", "super_admin"])).nullable(),
  publishAt: z.string().datetime().nullable(),
  poll: PollSchema.nullable(),
});
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const CreateCommentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1, "Escribe algo antes de comentar.").max(2000, "El comentario es demasiado largo."),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
