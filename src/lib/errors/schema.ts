import { z } from "zod";

/** La única pregunta del diálogo "Contarle al soporte". */
export const ReportErrorSchema = z.object({
  user_message: z
    .string()
    .trim()
    .min(5, { error: "Cuéntanos un poco más — al menos 5 caracteres." })
    .max(2000, { error: "Máximo 2000 caracteres." }),
  // Los cinco los llena el cliente con el contexto de la pantalla, no el
  // usuario, y `createErrorReport` los normaliza o los trunca a estos mismos
  // topes ANTES de validar — así que hoy ninguno de estos mensajes se alcanza.
  // Están en español igual, y a propósito: son la red por si algún día alguien
  // manda uno de estos campos sin pasar por ese truncado. Lo que mantiene el
  // reporte a salvo es el truncado, no el mensaje: un `titulo` sin truncar
  // rechazaba el reporte ENTERO —y con él lo que el usuario había escrito— por
  // un campo que nunca vio.
  motivo: z.string().trim().max(60, { error: "Máximo 60 caracteres." }).optional(),
  titulo: z.string().trim().max(200, { error: "Máximo 200 caracteres." }).optional(),
  url: z.string().trim().max(500, { error: "Máximo 500 caracteres." }).optional(),
  user_agent: z.string().trim().max(300, { error: "Máximo 300 caracteres." }).optional(),
  technical_detail: z.string().trim().max(2000, { error: "Máximo 2000 caracteres." }).optional(),
});
export type ReportErrorValues = z.infer<typeof ReportErrorSchema>;

export const ReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, { error: "Escribe algo antes de responder." })
    .max(4000, { error: "Máximo 4000 caracteres." }),
});

export const ERROR_STATUS_LABEL = {
  nuevo: "Sin abrir",
  en_revision: "En revisión",
  esperando_usuario: "Esperando al usuario",
  resuelto: "Resuelto",
  descartado: "Descartado",
} as const;

export const ERROR_SEVERITY_LABEL = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
} as const;
