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
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  nueva_postulacion: "Nueva postulación en tus vacantes",
  cambio_etapa: "Cambios de etapa en tus vacantes",
  mencion_nota: "Menciones en notas",
  vacante_pendiente_aprobacion: "Vacantes pendientes de aprobación",
  vacante_cambio_estado: "Cambios de estado en tus vacantes",
  movimiento_referido: "Movimientos de tus referidos",
  respuesta_reporte_error: "Actividad en reportes de soporte",
};
