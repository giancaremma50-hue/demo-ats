import { parseMentions } from "@/lib/mentions";

/** Mismo principio que la representación de notas de postulaciones: partes
 * de texto de React, nunca `dangerouslySetInnerHTML` — un cuerpo con
 * `<script>` se pinta como texto literal, no se ejecuta. */
export function MentionText({ body }: { body: string }) {
  return (
    <>
      {parseMentions(body).map((part, i) =>
        part.tipo === "mencion" ? (
          <span key={i} className="font-semibold text-accent">
            @{part.nombre}
          </span>
        ) : (
          <span key={i}>{part.valor}</span>
        ),
      )}
    </>
  );
}
