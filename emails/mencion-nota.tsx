import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

/**
 * "Te mencionaron en un seguimiento". Va a una persona INTERNA, así que no
 * lleva el pie de privacidad (esa regla es para los correos que recibe un
 * candidato — ver AGENTS.md).
 *
 * No incluye el texto de la nota a propósito: una mención puede estar en una
 * nota privada, y el correo sale del servidor de correo sin los controles de
 * `notes_select`. El aviso dice QUÉ pasó y DÓNDE verlo; el contenido se lee
 * dentro de la plataforma, donde RLS decide si esa persona puede.
 */
export function MencionNotaEmail({
  platformName,
  authorName,
  candidateName,
  applicationUrl,
}: {
  platformName: string;
  authorName: string;
  candidateName: string;
  applicationUrl: string;
}) {
  return (
    <EmailLayout platformName={platformName}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Te mencionaron en un seguimiento</Text>
      <Text>
        {authorName} te mencionó en el seguimiento de <strong>{candidateName}</strong>.
      </Text>
      <Link href={applicationUrl} style={{ color: "#008134" }}>
        Ver el seguimiento
      </Link>
    </EmailLayout>
  );
}
