/**
 * Límites y textos de la foto de perfil, compartidos entre la Server Action
 * que los aplica y el campo que los valida antes de enviar.
 *
 * En un módulo aparte y no dentro de `actions.ts` por dos razones: un módulo
 * "use server" solo puede exportar funciones async, y porque tenerlos escritos
 * dos veces era exactamente el desfase que ya se arregló del lado de marca —
 * subir el tope en el servidor dejaba al cliente rechazando con el número
 * viejo, sin que nada avisara.
 */
export const AVATAR_MAX_BYTES = 3 * 1024 * 1024;

export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

export const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function avatarRejectionMessage(motivo: "formato" | "tamano" | "vacio"): string {
  if (motivo === "formato") return "Formato no admitido. Usa PNG, JPG o WebP.";
  if (motivo === "vacio") return "Esa foto está vacía. Elige otra.";
  const mb = Math.round(AVATAR_MAX_BYTES / (1024 * 1024));
  return `La foto pesa más de ${mb} MB. Prueba con una más liviana.`;
}

export function avatarHint(): string {
  const mb = Math.round(AVATAR_MAX_BYTES / (1024 * 1024));
  return `PNG, JPG o WebP, máx. ${mb} MB. Se ve en tus publicaciones, seguimientos y en el encabezado.`;
}
