import type { Database } from "@/lib/supabase/database.types";

type NotificationType = Database["public"]["Enums"]["notification_type"];

// `mencion_nota` estuvo fuera de esta lista hasta 2026-09-09 porque el
// selector de mención no existía y el tipo nunca se disparaba — no tiene
// sentido ofrecer una preferencia para un evento que no ocurre. Ya existe
// (NoteForm), y `addNote` manda campana Y correo, así que los dos
// interruptores de esa fila hacen algo real.
export const PREFERENCE_TYPES: NotificationType[] = [
  "nueva_postulacion",
  "cambio_etapa",
  "mencion_nota",
  "vacante_pendiente_aprobacion",
  "vacante_cambio_estado",
  "movimiento_referido",
  "respuesta_reporte_error",
];

// respuesta_reporte_error se reutiliza en las dos direcciones (Fase 7): al
// reportante cuando soporte responde, y a los super admin cuando entra un
// reporte nuevo o el reportante escribe de vuelta — no existe un segundo
// valor de enum para "reporte nuevo" y no vale la pena una migración solo
// por el nombre. La etiqueta queda neutral a propósito.
//
// post_nuevo/post_mencion/post_reaccion/post_comentario (AJE Conectados)
// tienen etiqueta acá porque el tipo exige el mapeo completo. Desde
// 2026-09-11 el módulo SÍ tiene UI real que los dispara (feed, comentarios,
// reacciones) — pero siguen sin entrar a PREFERENCE_TYPES a propósito:
// notify() nunca les pasa un `email` (deliberado, no se construyeron
// plantillas de correo en esta fase), y ofrecer acá el interruptor de
// "correo" sin que ningún correo salga sería el mismo error que ya se
// documentó una vez con mencion_nota. Agregarlos cuando exista la plantilla.
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  nueva_postulacion: "Nueva postulación en tus vacantes",
  cambio_etapa: "Cambios de etapa en tus vacantes",
  mencion_nota: "Menciones en notas",
  vacante_pendiente_aprobacion: "Vacantes pendientes de aprobación",
  vacante_cambio_estado: "Cambios de estado en tus vacantes",
  movimiento_referido: "Movimientos de tus referidos",
  respuesta_reporte_error: "Actividad en reportes de soporte",
  post_nuevo: "Nuevas publicaciones en AJE Conectados",
  post_mencion: "Menciones en AJE Conectados",
  post_reaccion: "Reacciones a tus publicaciones y comentarios",
  post_comentario: "Comentarios en AJE Conectados",
};
