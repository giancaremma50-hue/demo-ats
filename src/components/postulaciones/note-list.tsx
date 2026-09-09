"use client";

import { useState } from "react";
import { NoteForm } from "./note-form";
import { NoteBody } from "./note-body";
import type { ApplicationNote, MentionableProfile } from "@/lib/applications/get-applications";

/** Cuántas respuestas se ven sin expandir. Decisión del usuario: solo las últimas 2. */
const RESPUESTAS_VISIBLES = 2;

function Meta({ note }: { note: ApplicationNote }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {note.authorName} · {new Date(note.createdAt).toLocaleString("es")}
      {note.isPrivate && (
        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
          Privada
        </span>
      )}
      {/* Quién recibió aviso, resuelto por el SERVIDOR desde `notes.mentions`.
          Se había quitado al pasar las menciones al cuerpo, y eso dejaba el
          nombre escrito por el autor como única fuente en pantalla. Con esto,
          un token que no notificó a nadie (ej. el uuid del propio autor) se
          nota: sale en negrita arriba y no sale en esta línea. */}
      {note.mentionNames.length > 0 && <span>· avisó a {note.mentionNames.join(", ")}</span>}
    </p>
  );
}

function Hilo({
  raiz,
  respuestas,
  applicationId,
  mentionable,
  canWrite,
  canReply,
  canMarkPrivate,
  onSaved,
}: {
  raiz: ApplicationNote;
  respuestas: ApplicationNote[];
  applicationId: string;
  mentionable: MentionableProfile[];
  canWrite: boolean;
  canReply: boolean;
  canMarkPrivate: boolean;
  onSaved: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [respondiendo, setRespondiendo] = useState(false);

  // Colapsado por defecto, y el estado es por usuario y por sesión (nada se
  // guarda): un hilo largo no debe empujar el resto del seguimiento fuera de
  // vista en un drawer angosto.
  const ocultas = Math.max(0, respuestas.length - RESPUESTAS_VISIBLES);
  const visibles = expandido ? respuestas : respuestas.slice(-RESPUESTAS_VISIBLES);

  return (
    <li className="rounded-md border border-border bg-card p-3.5 text-sm">
      <NoteBody body={raiz.body} />
      <Meta note={raiz} />

      {respuestas.length > 0 && (
        <div className="mt-3 border-l-2 border-border pl-3">
          {!expandido && ocultas > 0 && (
            <button
              type="button"
              onClick={() => setExpandido(true)}
              className="mb-2 text-xs font-medium text-accent underline"
            >
              Ver {ocultas} {ocultas === 1 ? "respuesta anterior" : "respuestas anteriores"}
            </button>
          )}
          <ul className="flex flex-col gap-2.5">
            {visibles.map((r) => (
              <li key={r.id}>
                <NoteBody body={r.body} />
                <Meta note={r} />
              </li>
            ))}
          </ul>
          {expandido && ocultas > 0 && (
            <button
              type="button"
              onClick={() => setExpandido(false)}
              className="mt-2 text-xs text-muted-foreground underline"
            >
              Contraer el hilo
            </button>
          )}
        </div>
      )}

      {/* `canReply` y no solo `canWrite`: a una respuesta huérfana (su raíz la
          filtró RLS) no se le ofrece responder, porque `addNote` rechazaría
          responder-a-una-respuesta. Es defensivo — hoy no debería ocurrir. */}
      {canWrite && canReply && (
        <div className="mt-3">
          {/* NoteForm va sin `key`: al guardar, `onSaved` hace
              setRespondiendo(false) y el formulario se desmonta solo, lo que
              limpia su estado (cuerpo, menciones) sin tocar setState dentro de
              un efecto. Una key basada en el número de respuestas solo servía
              para borrar un borrador a medio escribir cuando OTRA persona
              respondía en el mismo hilo. */}
          {respondiendo ? (
            <NoteForm
              applicationId={applicationId}
              mentionable={mentionable}
              canMarkPrivate={canMarkPrivate}
              parentId={raiz.id}
              inheritedPrivate={raiz.isPrivate}
              onSaved={() => {
                setRespondiendo(false);
                setExpandido(true);
                onSaved();
              }}
              onCancel={() => setRespondiendo(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setRespondiendo(true)}
              className="text-xs font-medium text-accent underline"
            >
              Responder
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function NoteList({
  notes,
  applicationId,
  mentionable,
  canWrite,
  canMarkPrivate,
  onSaved,
}: {
  notes: ApplicationNote[];
  applicationId: string;
  mentionable: MentionableProfile[];
  canWrite: boolean;
  canMarkPrivate: boolean;
  onSaved: () => void;
}) {
  if (notes.length === 0) return <p className="text-sm text-muted-foreground">Sin notas todavía.</p>;

  // Un solo nivel, así que agrupar es directo: raíces en orden, y cada
  // respuesta cuelga de la suya. Las respuestas cuyo padre no está visible
  // (RLS pudo filtrar la raíz) se muestran como raíces para no perderlas.
  const raices = notes.filter((n) => !n.parentId);
  const idsRaiz = new Set(raices.map((n) => n.id));
  const porPadre = new Map<string, ApplicationNote[]>();
  const huerfanas: ApplicationNote[] = [];
  for (const n of notes) {
    if (!n.parentId) continue;
    if (!idsRaiz.has(n.parentId)) {
      huerfanas.push(n);
      continue;
    }
    porPadre.set(n.parentId, [...(porPadre.get(n.parentId) ?? []), n]);
  }

  return (
    <ul className="flex flex-col gap-3">
      {[...raices, ...huerfanas].map((raiz) => (
        <Hilo
          key={raiz.id}
          raiz={raiz}
          canReply={!raiz.parentId}
          respuestas={porPadre.get(raiz.id) ?? []}
          applicationId={applicationId}
          mentionable={mentionable}
          canWrite={canWrite}
          canMarkPrivate={canMarkPrivate}
          onSaved={onSaved}
        />
      ))}
    </ul>
  );
}
