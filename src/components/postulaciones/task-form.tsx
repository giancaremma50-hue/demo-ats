"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { addTask } from "@/lib/applications/actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { ERROR_CONTROL_CLASS, FieldError } from "@/components/ui/field";
import { useErrorToast } from "@/lib/forms/use-error-toast";
import { camposDeFila } from "@/lib/forms/field-signals";
import { cn } from "@/lib/utils";
import type { AssignableProfile } from "@/lib/applications/get-applications";

/** Los campos que este formulario pinta, y la única fuente de cuál está en
 *  error: de acá salen el borde, `aria-invalid`, `aria-describedby` y el
 *  mensaje. Son los mismos que puede señalar `TaskSchema`. */
const CAMPOS = ["description", "due_date", "assigned_to"] as const;

export function TaskForm({
  applicationId,
  assignable,
  onSaved,
}: {
  applicationId: string;
  assignable: AssignableProfile[];
  /** Ver el comentario en NoteForm: el drawer no se refresca solo. */
  onSaved?: () => void;
}) {
  const action = addTask.bind(null, applicationId);
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Un prefijo propio: el cajón del candidato monta este formulario junto al
  // de seguimientos y al de mensaje, todos en la misma pantalla.
  const uid = useId();
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);
  const fila = camposDeFila(state, uid, CAMPOS);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
      onSaved?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    /* El mensaje va debajo de la FILA, no dentro de la columna de un campo:
       con `items-end`, adentro empujaría el botón "Agregar" hacia abajo y
       desalinearía la fila entera justo al fallar (AGENTS.md, regla 12). */
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        {/* Etiquetas visibles: el placeholder se va con la primera letra y deja
            los tres controles sin nombre — y la fecha solo tenía `aria-label`,
            invisible para quien ve. */}
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <label htmlFor={`${uid}-description`} className="text-[11px] text-muted-foreground">
            Tarea
          </label>
          <input
            id={`${uid}-description`}
            name="description"
            required
            minLength={3}
            maxLength={300}
            placeholder="Agendar segunda entrevista…"
            {...fila.props("description")}
            className={cn(
              "h-9 w-full rounded-md border border-border bg-background px-3 text-sm",
              fila.es("description") && ERROR_CONTROL_CLASS,
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-due_date`} className="text-[11px] text-muted-foreground">
            Fecha límite (opcional)
          </label>
          <input
            id={`${uid}-due_date`}
            name="due_date"
            type="date"
            {...fila.props("due_date")}
            className={cn(
              "h-9 rounded-md border border-border bg-background px-2 text-xs",
              fila.es("due_date") && ERROR_CONTROL_CLASS,
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-assigned_to`} className="text-[11px] text-muted-foreground">
            Responsable
          </label>
          <select
            id={`${uid}-assigned_to`}
            name="assigned_to"
            defaultValue=""
            {...fila.props("assigned_to")}
            className={cn(
              "h-9 w-40 rounded-md border border-border bg-background px-2 text-xs",
              fila.es("assigned_to") && ERROR_CONTROL_CLASS,
            )}
          >
            <option value="">Sin asignar</option>
            {assignable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </div>
        <ActionButton className="h-9 shrink-0 px-4 text-xs" pendingLabel="Agregando…">
          Agregar
        </ActionButton>
      </div>
      {fila.idMensaje && <FieldError id={fila.idMensaje}>{fila.mensaje}</FieldError>}
    </form>
  );
}
