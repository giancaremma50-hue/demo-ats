"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { scheduleInterview } from "@/lib/interviews/actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { ERROR_CONTROL_CLASS, FieldError } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";
import { campoSuelto } from "@/lib/forms/field-signals";
import { cn } from "@/lib/utils";
import type { AssignableProfile } from "@/lib/applications/get-applications";

const STEP_LABELS = ["Fecha", "Hora", "Destinatarios"];

/**
 * Sub-drawer de 3 pasos sobre el drawer de candidato — mismo
 * scheduleInterview() que ya usa InterviewForm (la versión plana en
 * /postulaciones/[id]), solo con la interacción partida en pasos en vez de
 * un formulario largo de una vez.
 */
export function MeetingScheduler({
  applicationId,
  candidateName,
  candidateEmail,
  assignable,
  onClose,
  onScheduled,
}: {
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
  assignable: AssignableProfile[];
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");

  const boundAction = scheduleInterview.bind(null, applicationId);
  async function action(prevState: Awaited<ReturnType<typeof boundAction>> | undefined, formData: FormData) {
    formData.set("scheduled_at", new Date(`${date}T${time}`).toISOString());
    formData.set("attendee_ids", JSON.stringify(attendeeIds));
    formData.set("duration_minutes", String(duration));
    formData.set("location", location);
    return boundAction(prevState, formData);
  }
  const [state, formAction, pending] = useActionState(action, undefined);

  const uid = useId();
  // Los campos del asistente viven en pasos distintos, así que el mensaje de
  // uno que quedó atrás NO se ve — y el hook lo manda al toast justamente por
  // eso: comprueba si está pintado en vez de suponerlo. El único que puede
  // fallar con el paso a la vista es `attendee_ids`, y ese sí se muestra abajo.
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);
  const destinatarios = campoSuelto(selectorDeError(state)("attendee_ids"), `${uid}-attendee_ids-error`);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      onScheduled();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function addAttendee(id: string) {
    setAttendeeIds((prev) => [...prev, id]);
    setSearch("");
  }
  function removeAttendee(id: string) {
    setAttendeeIds((prev) => prev.filter((a) => a !== id));
  }

  const selectedAttendees = assignable.filter((p) => attendeeIds.includes(p.id));
  const searchResults = assignable.filter(
    (p) => !attendeeIds.includes(p.id) && p.display_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-[420px] flex-col bg-card p-5 shadow-[-8px_0_24px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-extrabold tracking-heading text-xl">Agendar reunión</h3>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="flex size-[30px] flex-none items-center justify-center rounded-full bg-muted"
        >
          <X className="size-3.5 text-muted-foreground" aria-hidden />
        </button>
      </div>

      <div className="mt-3.5 flex gap-1.5">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className={`h-[3px] flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`} />
        ))}
      </div>

      <form action={formAction} className="mt-6 flex flex-1 flex-col">
        {step === 0 && (
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor={`${uid}-fecha`} className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
              Paso 1 de 3 — Fecha
            </label>
            <input
              id={`${uid}-fecha`}
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-md border border-border bg-background px-3 text-sm"
            />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor={`${uid}-hora`} className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                Paso 2 de 3 — Hora
              </label>
              <input
                id={`${uid}-hora`}
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              />
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Duración (min)</span>
              <input
                type="number"
                min={15}
                max={480}
                step={15}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-9 w-24 rounded-md border border-border bg-background px-2.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Lugar o enlace (opcional)</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                placeholder="Google Meet, oficina, etc."
                className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col gap-3">
            {/* El nombre del grupo sale de ESTE texto, que es el que se ve: un
                nombre accesible distinto del visible rompe el control por voz
                (WCAG 2.5.3), que es lo que ya costó un arreglo en la barra. */}
            <span
              id={`${uid}-destinatarios-label`}
              className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase"
            >
              Paso 3 de 3 — Destinatarios
            </span>
            <p className="text-xs text-muted-foreground">Cada uno recibe su propio enlace para agregarlo a su calendario.</p>

            <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <strong>{candidateName}</strong> <span className="text-xs text-muted-foreground">{candidateEmail}</span>
              </span>
              <span className="flex-none text-[10px] tracking-[0.06em] text-muted-foreground uppercase">Candidato · automático</span>
            </div>

            {/* El error habla de la LISTA de destinatarios, no del buscador: el
                servidor rechaza a alguien YA elegido, y el texto que haya en el
                buscador da igual — marcarlo a él lo anunciaba inválido por algo
                que no es suyo. `role="group"` con etiqueta y descripción, y
                `tabIndex={-1}` con error para que el salto al campo llegue. */}
            {/* Solo cuando tiene algo que agrupar: vacío y sin error era un
                grupo con nombre y sin contenido, que un lector anuncia como tal
                justo después de un encabezado que dice casi lo mismo. */}
            {selectedAttendees.length > 0 && (
            <div
              role="group"
              aria-labelledby={`${uid}-destinatarios-label`}
              aria-describedby={destinatarios.props["aria-describedby"]}
              tabIndex={destinatarios.enError ? -1 : undefined}
              // Borde de 2px transparente y `p-2` SIEMPRE: si solo aparecieran
              // con el error, las fichas ya elegidas darían un salto de 10px
              // justo cuando el usuario está leyendo el mensaje nuevo.
              // `focus:` y no `focus-visible:` por lo mismo que en
              // `CollaboratorsPicker`: a este grupo lo enfoca el hook.
              className={cn(
                "flex flex-col gap-1.5 rounded-md border-2 border-transparent p-2 focus:outline-2 focus:outline-offset-2 focus:outline-ring",
                destinatarios.enError && ERROR_CONTROL_CLASS,
              )}
            >
              {selectedAttendees.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedAttendees.map((p) => (
                    <span key={p.id} className="flex items-center gap-1.5 rounded-full border border-border py-1 pl-2.5 pr-1.5 text-xs">
                      {p.display_name}
                      <button
                        type="button"
                        aria-label={`Quitar a ${p.display_name}`}
                        onClick={() => removeAttendee(p.id)}
                        className="flex size-4 items-center justify-center rounded-full hover:bg-muted"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            )}
            {/* FUERA del grupo que lo describe: adentro se lee tres veces —
                como alerta, como descripción al enfocar, y otra vez al recorrer
                el contenido del grupo. */}
            {/* Solo mientras siga habiendo destinatarios: el mensaje habla de
                los elegidos, y si el usuario los quitó a todos —la reacción
                natural al leerlo— dejó de ser cierto. Un cuadro rojo vacío con
                un texto viejo es peor que nada. */}
            {destinatarios.idMensaje && selectedAttendees.length > 0 && (
              <FieldError id={destinatarios.idMensaje}>{destinatarios.mensaje}</FieldError>
            )}

            {/* Etiqueta visible: el placeholder se va con la primera letra. */}
            <label htmlFor={`${uid}-buscar`} className="text-xs text-muted-foreground">
              Agregar a alguien del equipo
            </label>
            <input
              id={`${uid}-buscar`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // Enter en este campo no debe enviar el formulario — el botón
              // "Confirmar" queda habilitado en cuanto hay 1 destinatario, y
              // sin esto, Enter mientras se busca a un segundo colega agenda
              // la reunión de una vez (con menos destinatarios de los que el
              // usuario todavía quería agregar), sin pasar por "Confirmar".
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="Buscar colega por nombre…"
              className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
            />
            {assignable.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nadie más tiene acceso a esta vacante todavía.</p>
            ) : (
              <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: 160 }}>
                {searchResults.length === 0 && <p className="px-1 text-xs text-muted-foreground">Sin resultados.</p>}
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addAttendee(p.id)}
                    className="rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted/60"
                  >
                    {p.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex justify-between pt-5">
          {step > 0 ? (
            <ActionButton type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Atrás
            </ActionButton>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <ActionButton type="button" disabled={step === 0 && !date} onClick={() => setStep((s) => s + 1)}>
              Siguiente
            </ActionButton>
          ) : (
            <ActionButton type="submit" pending={pending} pendingLabel="Agendando…" disabled={attendeeIds.length === 0}>
              Confirmar
            </ActionButton>
          )}
        </div>
      </form>
    </div>
  );
}
