"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { createRejectionReason } from "@/lib/rejection-reasons/actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { ERROR_CONTROL_CLASS, FieldError } from "@/components/ui/field";
import { useErrorToast } from "@/lib/forms/use-error-toast";
import { camposDeFila } from "@/lib/forms/field-signals";
import { cn } from "@/lib/utils";

/**
 * **No pasa por `<Field>`**, por lo mismo que `InviteForm`: el campo y el botón
 * comparten una fila, y `<Field>` apila etiqueta, control y mensaje en columna.
 * Con el mensaje adentro de la columna y la fila en `items-end`, fallar empuja
 * "Agregar" hacia abajo y desalinea la fila entera justo en el momento en que
 * el usuario está mirando. El mensaje va debajo de la FILA; las tres piezas
 * (`aria-invalid`, `aria-describedby`, `role="alert"` vía `<FieldError>`) van
 * cableadas a mano, que es lo que la regla 12 pide en este caso.
 */
export function AddRejectionReasonForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createRejectionReason, undefined);

  const uid = useId();
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);
  const fila = camposDeFila(state, uid, ["label"] as const);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      {/* `flex-wrap` + mínimo real en el campo: a 320px el campo y "Agregar" en
          una línea no entran en el ancho útil de la tarjeta, y `html` recorta
          el eje X sin barra — el botón quedaría fuera de la pantalla. */}
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <label htmlFor={`${uid}-label`} className="text-xs text-muted-foreground">
            Nuevo motivo
          </label>
          <input
            id={`${uid}-label`}
            name="label"
            required
            minLength={2}
            maxLength={160}
            placeholder="No cumple con la experiencia requerida"
            {...fila.props("label")}
            className={cn(
              "h-[38px] rounded-md border border-border bg-background px-2.5 text-sm",
              fila.es("label") && ERROR_CONTROL_CLASS,
            )}
          />
        </div>
        <ActionButton type="submit" variant="secondary" className="h-[38px] shrink-0" pendingLabel="Agregando…">
          Agregar
        </ActionButton>
      </div>
      {fila.idMensaje && <FieldError id={fila.idMensaje}>{fila.mensaje}</FieldError>}
    </form>
  );
}
