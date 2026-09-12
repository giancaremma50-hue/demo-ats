import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";
import { buildInterviewCalendarUrl, formatInterviewWhenUTC } from "@/lib/interviews/calendar-link";

export function EntrevistaProgramadaEmail({
  platformName,
  privacyUrl,
  candidateName,
  jobTitle,
  scheduledAtIso,
  durationMinutes,
  location,
}: {
  platformName: string;
  privacyUrl: string;
  candidateName: string;
  jobTitle: string;
  scheduledAtIso: string;
  durationMinutes: number;
  location: string | null;
}) {
  const when = formatInterviewWhenUTC(scheduledAtIso);
  const calendarUrl = buildInterviewCalendarUrl(jobTitle, { scheduledAt: scheduledAtIso, durationMinutes, location });

  return (
    <EmailLayout platformName={platformName} privacyUrl={privacyUrl}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Tienes una entrevista agendada</Text>
      <Text>
        Hola {candidateName}, se agendó tu entrevista para <strong>{jobTitle}</strong> el {when} (hora UTC)
        {location ? <> en {location}</> : null}.
      </Text>
      <Link href={calendarUrl} style={{ color: "#008134" }}>
        Agregar a Google Calendar
      </Link>
      <Text style={{ fontSize: 12, color: "#6b6862" }}>
        El enlace de arriba la muestra automáticamente en tu propia zona horaria.
      </Text>
    </EmailLayout>
  );
}
