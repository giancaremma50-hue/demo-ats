import { parseMentions } from "@/lib/mentions";

/** Mismo principio que `NoteBody` (postulaciones): partes de texto de
 * React, nunca `dangerouslySetInnerHTML` — un cuerpo con `<script>` se
 * pinta como texto literal, no se ejecuta.
 *
 * Y la mención se pinta SIN la arroba, igual que `NoteBody` — el nombre en
 * negrita con el color de acento ya es el sello de "esto lo resolvió el
 * sistema". Escribir `@` acá además mentía sobre el dato guardado: el token
 * es `@[Nombre](uuid)`, el `@` es sintaxis del token, no parte del nombre. */
export function MentionText({ body }: { body: string }) {
  return (
    <>
      {parseMentions(body).map((part, i) =>
        part.tipo === "mencion" ? (
          <strong key={i} className="font-semibold text-accent">
            {part.nombre}
          </strong>
        ) : (
          <span key={i}>{part.valor}</span>
        ),
      )}
    </>
  );
}
