import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";
import { buildInterviewCalendarUrl, formatInterviewWhenUTC } from "@/lib/interviews/calendar-link";

/**
 * Va a un colaborador agregado como destinatario de la entrevista — interno,
 * sin pie de privacidad (esa regla es para correos que recibe un candidato,
 * ver AGENTS.md). Mismo cálculo de fecha/enlace que entrevista-programada.tsx
 * (la del candidato), para que las dos muestren exactamente la misma hora.
 */
export function EntrevistaAgendadaInternoEmail({
  platformName,
  organizerName,
  candidateName,
  jobTitle,
  scheduledAtIso,
  durationMinutes,
  location,
  applicationUrl,
}: {
  platformName: string;
  organizerName: string;
  candidateName: string;
  jobTitle: string;
  scheduledAtIso: string;
  durationMinutes: number;
  location: string | null;
  applicationUrl: string;
}) {
  const when = formatInterviewWhenUTC(scheduledAtIso);
  const calendarUrl = buildInterviewCalendarUrl(jobTitle, { scheduledAt: scheduledAtIso, durationMinutes, location });

  return (
    <EmailLayout platformName={platformName}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Te agregaron a una entrevista</Text>
      <Text>
        {organizerName} te agregó a la entrevista de <strong>{candidateName}</strong> ({jobTitle}) el {when} (hora UTC)
        {location ? <> en {location}</> : null}.
      </Text>
      <Link href={calendarUrl} style={{ color: "#1f4d3d" }}>
        Agregar a Google Calendar
      </Link>
      <Text style={{ fontSize: 12, color: "#6b6862" }}>
        El enlace de arriba la muestra automáticamente en tu propia zona horaria.
      </Text>
      <Text>
        <Link href={applicationUrl} style={{ color: "#1f4d3d" }}>
          Ver la postulación
        </Link>
      </Text>
    </EmailLayout>
  );
}
