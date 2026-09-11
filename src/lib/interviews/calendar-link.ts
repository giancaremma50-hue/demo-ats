/** Enlace "TEMPLATE" de Google Calendar — sin OAuth ni API, cada quien lo agrega a su propio calendario con un clic. */
function toGoogleDateUtc(date: Date): string {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

export function buildGoogleCalendarUrl(input: {
  title: string;
  details?: string;
  location?: string | null;
  scheduledAt: string;
  durationMinutes: number;
}): string {
  const start = new Date(input.scheduledAt);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${toGoogleDateUtc(start)}/${toGoogleDateUtc(end)}`,
  });
  if (input.details) params.set("details", input.details);
  if (input.location) params.set("location", input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Título/detalle consistentes entre el correo al candidato y el enlace que ve quien entrevista — un solo lugar que los arma. */
export function buildInterviewCalendarUrl(
  jobTitle: string,
  interview: { scheduledAt: string; durationMinutes: number; location?: string | null },
): string {
  return buildGoogleCalendarUrl({
    title: `Entrevista — ${jobTitle}`,
    details: `Entrevista para el puesto de ${jobTitle}.`,
    location: interview.location,
    scheduledAt: interview.scheduledAt,
    durationMinutes: interview.durationMinutes,
  });
}

// El correo se renderiza en el servidor (después de responder, vía after())
// — toLocaleString ahí usa la zona horaria del servidor, no la del
// destinatario, y no hay una zona horaria de organización guardada en el
// esquema. Se muestra en UTC de forma explícita en vez de fingir una hora
// local que podría estar mal por varias horas; el enlace de calendario sí la
// ajusta correctamente a la zona de quien lo abre — de ahí la aclaración.
// Compartido entre el correo al candidato y el correo interno a los
// destinatarios: duplicarlo ya causó drift una vez (ver napkin 2026-09-11).
export function formatInterviewWhenUTC(scheduledAtIso: string): string {
  return new Date(scheduledAtIso).toLocaleString("es", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" });
}
