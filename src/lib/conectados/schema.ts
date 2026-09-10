import { z } from "zod";

export const REACTION_TYPES = ["like", "corazon", "aplauso", "fuego"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const CreatePostSchema = z.object({
  content: z.string().trim().max(4000, "El contenido es demasiado largo."),
  departmentId: z.string().uuid().nullable(),
  roles: z.array(z.enum(["gestor", "admin", "super_admin"])).nullable(),
  publishAt: z.string().datetime().nullable(),
  mentions: z.array(z.string().uuid()).default([]),
});
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const CreateCommentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1, "Escribe algo antes de comentar.").max(2000, "El comentario es demasiado largo."),
  mentions: z.array(z.string().uuid()).default([]),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
