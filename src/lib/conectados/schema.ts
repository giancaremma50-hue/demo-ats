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
