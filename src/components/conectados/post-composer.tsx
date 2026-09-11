"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Calendar, ImagePlus, ListChecks, X } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { createPost, uploadPostAttachment } from "@/lib/conectados/actions";
import { useConectados } from "./conectados-feed";
import { useMentionState } from "./mention-overlay";
import type { FeedPost } from "@/lib/conectados/queries";

const MAX_POLL_OPTIONS = 6;

export function PostComposer({ onCreated }: { onCreated: (post: FeedPost) => void }) {
  const { viewer, departments, mentionable } = useConectados();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const listaId = useId();
  const scheduleId = useId();
  const mention = useMentionState(mentionable);
  const [isPending, startTransition] = useTransition();

  const [departmentId, setDepartmentId] = useState<string>("");
  // Tope inferior del input de fecha. Se calcula al ABRIR el panel (evento),
  // nunca en el cuerpo del render: `Date.now()` en render es impuro y acá es
  // error de build. En hora LOCAL y con el formato que espera
  // `datetime-local` (sin zona, sin segundos) — `toISOString()` a secas daría
  // UTC y correría el tope varias horas.
  const [minPublishAt, setMinPublishAt] = useState("");
  const [roles, setRoles] = useState<Array<"gestor" | "admin" | "super_admin">>([]);
  const [publishAt, setPublishAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [files, setFiles] = useState<File[]>([]);

  function toggleRole(role: "gestor" | "admin" | "super_admin") {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function toggleSchedule() {
    // Al cerrarlo se limpia la fecha: si quedara puesta, el post saldría
    // programado sin que se vea ningún control de fecha en pantalla. El
    // `setPublishAt` va acá y NO dentro del actualizador de `setShowSchedule`
    // — un actualizador de estado tiene que ser puro (React lo re-ejecuta en
    // StrictMode y en cada pasada de una actualización concurrente).
    if (showSchedule) {
      setPublishAt("");
    } else {
      // +60s antes de recortar a minutos: `slice(0,16)` trunca los segundos,
      // así que el minuto en curso quedaría "permitido" por el input pero el
      // servidor lo rechaza por pasado (compara contra el instante exacto).
      const ahora = new Date(Date.now() + 60_000);
      setMinPublishAt(new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
    }
    setShowSchedule((prev) => !prev);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = mention.serialized();
    const trimmedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    const poll = showPoll && trimmedOptions.length >= 2 ? { options: trimmedOptions.map((label) => ({ label })) } : null;

    // El servidor no puede exigir esto: en el momento de `createPost` todavía
    // no sabe si vienen adjuntos (se suben después, referenciando el post ya
    // creado). Solo el compositor conoce las 3 fuentes de contenido a la vez.
    if (!content.trim() && !poll && files.length === 0) {
      notifyError("Escribe algo, agrega una encuesta, o adjunta un archivo antes de publicar.");
      return;
    }

    // "Programar" activado pero sin fecha: el botón queda encendido y el
    // envío diría "Publicar" — se lee como programado y sale de inmediato
    // para toda la organización. Se corta acá con un mensaje concreto.
    if (showSchedule && !publishAt) {
      notifyError("Elige la fecha y hora, o desactiva Programar para publicar de una vez.");
      return;
    }

    // Un navegador sin soporte de `datetime-local` degrada el control a texto
    // libre: `new Date("mañana").toISOString()` lanza RangeError dentro del
    // transition y el envío moriría en silencio, sin aviso ninguno.
    const scheduledFor = publishAt ? new Date(publishAt) : null;
    if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
      notifyError("La fecha para programar no es válida.");
      return;
    }

    startTransition(async () => {
      const result = await createPost({
        content,
        departmentId: departmentId || null,
        roles: roles.length > 0 ? roles : null,
        publishAt: scheduledFor ? scheduledFor.toISOString() : null,
        poll,
      });
      if (result.error) {
        notifyError(result.error);
        return;
      }
      if (result.post) {
        // Captura en un `const` propio: el spread de abajo ocurre después de
        // un `await`, y TypeScript no conserva el angostamiento de
        // `if (result.post)` a través de una llamada async.
        const createdPost = result.post;
        // Secuencial, no `Promise.all`: `uploadPostAttachment` hace un
        // lectura-modificación-escritura de `posts.attachments` (lee la lista
        // actual, agrega una entrada, escribe) — en paralelo, cada subida lee
        // la lista ANTES de que la anterior termine de escribir, y todas
        // menos la última en confirmar pisan a las demás (se pierden
        // adjuntos, hallado en /code-review). Uno a la vez, cada lectura ya
        // ve lo que la subida anterior escribió.
        const attachments: (typeof createdPost.attachments)[number][] = [];
        const failedNames: string[] = [];
        for (const file of files) {
          const formData = new FormData();
          formData.set("file", file);
          const r = await uploadPostAttachment(createdPost.id, formData);
          if (r.attachment) attachments.push(r.attachment);
          else failedNames.push(file.name);
        }
        if (failedNames.length > 0) {
          notifyError(
            failedNames.length === 1 ? `No se pudo subir "${failedNames[0]}".` : `No se pudieron subir ${failedNames.length} archivos.`,
            "La publicación sí se creó — puedes intentar adjuntarlos de nuevo.",
          );
        }
        onCreated({ ...createdPost, attachments });
        notifySuccess(result.success ?? "Publicación creada");
        mention.reset();
        setDepartmentId("");
        setRoles([]);
        setPublishAt("");
        setShowSchedule(false);
        setShowPoll(false);
        setPollOptions(["", ""]);
        setFiles([]);
      }
    });
  }

  return (
    // `overflow-visible` pisa el `overflow-hidden` que `Card` trae de fábrica
    // (tailwind-merge deja ganar la clase del llamador): la lista de
    // sugerencias de @menciones se posiciona `absolute` dentro de esta Card y,
    // con el recorte puesto, quedaba cortada al borde — en un teléfono se veía
    // apenas la primera fila. Nada acá adentro necesita el recorte: el padding
    // de la Card evita que cualquier hijo toque la esquina redondeada.
    <Card className="overflow-visible p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <div
            ref={highlightRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-border bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words"
          >
            {mention.segments.map((s, i) =>
              s.esMencion ? (
                <span key={i} className="text-accent">
                  {s.texto}
                </span>
              ) : (
                <span key={i}>{s.texto}</span>
              ),
            )}
            {mention.body.endsWith("\n") && "​"}
          </div>
          <textarea
            ref={areaRef}
            rows={3}
            value={mention.body}
            onChange={(e) => {
              mention.handleChange(e.target.value);
              mention.setCursor(e.target.selectionStart);
              mention.setElegido(0);
              mention.setCerrada(false);
            }}
            onKeyUp={(e) => mention.setCursor(e.currentTarget.selectionStart)}
            onClick={(e) => mention.setCursor(e.currentTarget.selectionStart)}
            onScroll={(e) => {
              // El overlay es un <div>, no scrollea solo con el textarea:
              // pasadas las filas visibles, el texto pintado se queda quieto
              // mientras el cursor real baja. Mismo gotcha ya documentado
              // para NoteForm en .claude/napkin.md.
              if (highlightRef.current) highlightRef.current.scrollTop = e.currentTarget.scrollTop;
            }}
            onKeyDown={(e) => {
              if (mention.sugerencias.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                mention.setElegido((i) => (i + 1) % mention.sugerencias.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                mention.setElegido((i) => (i - 1 + mention.sugerencias.length) % mention.sugerencias.length);
              } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                mention.insertMention(mention.sugerencias[mention.elegido] ?? mention.sugerencias[0], areaRef);
              } else if (e.key === "Escape") {
                e.preventDefault();
                mention.setCerrada(true);
              }
            }}
            placeholder="¿Qué quieres compartir con el equipo? (@ para mencionar)"
            role="combobox"
            aria-expanded={mention.sugerencias.length > 0}
            aria-controls={listaId}
            className="relative w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-sm text-transparent caret-foreground placeholder:text-muted-foreground"
          />
          {mention.sugerencias.length > 0 && (
            <Card
              as="ul"
              id={listaId}
              role="listbox"
              aria-label="Personas que puedes mencionar"
              className="absolute z-10 mt-1 w-full max-w-xs rounded-md"
            >
              {mention.sugerencias.map((m, i) => (
                <li
                  key={m.id}
                  role="option"
                  aria-selected={i === mention.elegido}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    mention.insertMention(m, areaRef);
                  }}
                  className={`cursor-pointer px-3 py-2 text-[13px] ${i === mention.elegido ? "bg-muted" : ""}`}
                >
                  {m.display_name}
                </li>
              ))}
            </Card>
          )}
        </div>

        {showPoll && (
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => setPollOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                  placeholder={`Opción ${i + 1}`}
                  maxLength={120}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    aria-label="Quitar opción"
                    onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                    className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < MAX_POLL_OPTIONS && (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ""])}
                className="self-start text-xs font-medium text-accent underline"
              >
                Agregar opción
              </button>
            )}
          </div>
        )}

        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li key={i} className="flex max-w-[12rem] items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs">
                <span className="min-w-0 truncate">{f.name}</span>
                <button
                  type="button"
                  aria-label={`Quitar ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* El contenedor se renderiza siempre (vacío al estar cerrado) para
            que el `aria-controls` del botón "Programar" nunca apunte a un id
            inexistente. El input de fecha vive acá, con etiqueta visible, y
            no suelto en la barra de abajo: un `datetime-local` vacío se pinta
            en Android como una caja con una flecha y nada más — nadie adivina
            para qué sirve. */}
        <div id={scheduleId}>
          {showSchedule && (
            <div className="flex flex-col gap-1.5 rounded-md border border-border p-3 text-xs text-muted-foreground">
              {/* El texto de ayuda va FUERA del <label>: dentro, se pegaría
                  al nombre accesible del input ("Publicar a partir de Se
                  libera en la siguiente revisión..."). */}
              <label className="flex flex-col gap-1.5">
                <span>Publicar a partir de</span>
                <input
                  type="datetime-local"
                  value={publishAt}
                  min={minPublishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  className="w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              {/* "A partir de" y no "el": el cron que libera los programados
                  corre una vez al día (límite del plan Hobby de Vercel, ver
                  .claude/napkin.md), así que prometer la hora exacta sería
                  mentir hasta por ~24h. */}
              <span className="text-[11px]">Se libera en la siguiente revisión diaria del sistema.</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <label
            className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Agregar adjunto"
          >
            <ImagePlus className="size-[18px]" aria-hidden />
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
              className="hidden"
              onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
            />
          </label>
          <button
            type="button"
            onClick={() => setShowPoll((v) => !v)}
            aria-pressed={showPoll}
            className={`flex size-9 items-center justify-center rounded-full ${showPoll ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
            aria-label="Agregar encuesta"
          >
            {/* strokeWidth 2.5 cuando está activo: AGENTS.md exige mínimo 2.5
                para cualquier ícono sobre fondo de color sólido — con el
                verde AJE detrás, el grosor 2 por defecto se lee borroso. */}
            <ListChecks className="size-[18px]" strokeWidth={showPoll ? 2.5 : 2} aria-hidden />
          </button>

          {viewer.isAdminOrAbove && (
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="max-w-[10rem] rounded-full border border-border bg-background px-3 py-1.5 text-xs"
            >
              <option value="">Toda la organización</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {!viewer.isAdminOrAbove && viewer.departmentId && (
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="max-w-[10rem] rounded-full border border-border bg-background px-3 py-1.5 text-xs"
            >
              <option value="">Toda la organización</option>
              <option value={viewer.departmentId}>Solo mi departamento</option>
            </select>
          )}

          {viewer.isAdminOrAbove && (
            // Roles destinatarios DENTRO del departamento ya elegido — mismo
            // significado que `posts.roles`: vacío = todos, nunca amplía,
            // solo restringe. Reservado a admin+, calca `posts_insert`.
            // Con la etiqueta "Solo para" al frente: tres píldoras sueltas no
            // dicen por sí solas que restringen la audiencia.
            // `w-full` + `flex-wrap`: con la etiqueta al frente el grupo mide
            // ~270px, más de lo que queda en un teléfono angosto (320px menos
            // los gutters y el padding de la Card) — y la Card recorta, no
            // scrollea. En su propia fila y con wrap nunca se corta.
            <div
              role="group"
              aria-label="Restringir a roles"
              className="flex w-full flex-wrap items-center gap-1 rounded-lg border border-border px-3 py-1.5"
            >
              <span className="text-[11px] text-muted-foreground">Solo para</span>
              {(["gestor", "admin", "super_admin"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  aria-pressed={roles.includes(role)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${roles.includes(role) ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
                >
                  {role === "gestor" ? "Gestores" : role === "admin" ? "Admins" : "Super admins"}
                </button>
              ))}
            </div>
          )}

          {viewer.isAdminOrAbove && (
            <button
              type="button"
              onClick={toggleSchedule}
              aria-expanded={showSchedule}
              aria-controls={scheduleId}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${showSchedule ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Calendar className="size-3.5" strokeWidth={showSchedule ? 2.5 : 2} aria-hidden />
              Programar
            </button>
          )}

          <ActionButton type="submit" pending={isPending} className="ml-auto h-9 px-5 text-xs">
            {publishAt ? "Programar" : "Publicar"}
          </ActionButton>
        </div>
      </form>
    </Card>
  );
}
