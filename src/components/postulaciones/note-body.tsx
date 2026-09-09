import { parseMentions } from "@/lib/applications/mentions";

/**
 * El cuerpo de una nota, con las menciones en negrita.
 *
 * Cada trozo se pinta como texto de React (`{parte.valor}`), nunca con
 * `dangerouslySetInnerHTML`: el cuerpo lo escribe cualquiera con permiso de
 * escritura en la vacante, así que inyectar HTML ahí sería un XSS almacenado.
 * Así, una nota que diga `<script>` se lee como `<script>`.
 */
export function NoteBody({ body }: { body: string }) {
  return (
    <p className="whitespace-pre-wrap">
      {parseMentions(body).map((parte, i) =>
        parte.tipo === "mencion" ? (
          <strong key={i} className="font-semibold text-accent">
            {parte.nombre}
          </strong>
        ) : (
          <span key={i}>{parte.valor}</span>
        ),
      )}
    </p>
  );
}
