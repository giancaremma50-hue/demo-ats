"use client";

import { useState } from "react";
import { NoteForm } from "./note-form";
import { NoteBody } from "./note-body";
import { TaskRow } from "./task-list";
import { Card } from "@/components/ui/card";
import type { ApplicationNote, ApplicationTask, MentionableProfile } from "@/lib/applications/get-applications";

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
    <Card as="li" className="rounded-md p-3.5 text-sm">
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
    </Card>
  );
}

type FeedItem =
  | { kind: "nota"; sortDate: string; raiz: ApplicationNote; respuestas: ApplicationNote[] }
  | { kind: "tarea"; sortDate: string; task: ApplicationTask };

export function NoteList({
  notes,
  tasks,
  applicationId,
  mentionable,
  canWrite,
  canMarkPrivate,
  onSaved,
}: {
  notes: ApplicationNote[];
  tasks: ApplicationTask[];
  applicationId: string;
  mentionable: MentionableProfile[];
  canWrite: boolean;
  canMarkPrivate: boolean;
  onSaved: () => void;
}) {
  if (notes.length === 0 && tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin seguimientos todavía.</p>;
  }

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

  // Un feed único, notas y tareas mezcladas por fecha — más reciente arriba
  // (decisión del usuario, 2026-09-09): antes vivían en dos pestañas
  // separadas, pero una tarea y una nota sobre lo mismo suelen pasar casi al
  // mismo tiempo, y partirlas en dos listas rompía la secuencia real de qué
  // se dijo o se hizo primero. Una respuesta no "sube" a su hilo raíz — el
  // hilo se ordena por la fecha de la nota RAÍZ, no por su última respuesta,
  // para que sea un histórico estable y no una bandeja que salta de lugar.
  const items: FeedItem[] = [
    ...[...raices, ...huerfanas].map((raiz) => ({
      kind: "nota" as const,
      sortDate: raiz.createdAt,
      raiz,
      respuestas: porPadre.get(raiz.id) ?? [],
    })),
    ...tasks.map((task) => ({ kind: "tarea" as const, sortDate: task.createdAt, task })),
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) =>
        item.kind === "nota" ? (
          <Hilo
            key={item.raiz.id}
            raiz={item.raiz}
            canReply={!item.raiz.parentId}
            respuestas={item.respuestas}
            applicationId={applicationId}
            mentionable={mentionable}
            canWrite={canWrite}
            canMarkPrivate={canMarkPrivate}
            onSaved={onSaved}
          />
        ) : (
          <TaskRow key={item.task.id} task={item.task} applicationId={applicationId} onChanged={onSaved} />
        ),
      )}
    </ul>
  );
}
