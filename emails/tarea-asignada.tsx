import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

/** Interno, sin pie de privacidad — mismo criterio que cambio-etapa.tsx. */
export function TareaAsignadaEmail({
  platformName,
  assignerName,
  candidateName,
  description,
  applicationUrl,
}: {
  platformName: string;
  assignerName: string;
  candidateName: string;
  description: string;
  applicationUrl: string;
}) {
  return (
    <EmailLayout platformName={platformName}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Te asignaron una tarea</Text>
      <Text>
        {assignerName} te asignó una tarea en el seguimiento de <strong>{candidateName}</strong>: {description}
      </Text>
      <Link href={applicationUrl} style={{ color: "#008134" }}>
        Ver la postulación
      </Link>
    </EmailLayout>
  );
}
