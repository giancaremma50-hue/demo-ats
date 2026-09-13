"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { referCandidate } from "@/lib/jobs/actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { Field, FieldError } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";

export function ReferCandidateDialog({ jobId }: { jobId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const action = referCandidate.bind(null, jobId);
  const [state, formAction] = useActionState(action, undefined);

  // El formulario entero está detrás de `{open && …}` y dentro de un
  // `<dialog>`: cerrarlo mientras la acción corre desmonta el mensaje. El hook
  // mira si el mensaje se pinta de verdad, así que ahí el toast sí habla —
  // antes esto era una lista de booleanos que decía "se ve" y no se veía.
  useErrorToast(state, (campo) => `referir-${campo}-error`);

  const errorDe = selectorDeError(state);
  /** La casilla se cablea a mano (su texto ES la etiqueta), así que su error se
   *  busca una vez y se reusa: repetir la consulta en cada señal es como se
   *  desincronizan. */
  const errorAutorizacion = errorDe("referral_authorized");
  const ID_ERROR_AUTORIZACION = "referir-referral_authorized-error";

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      dialogRef.current?.close();
    }
  }, [state]);

  return (
    <>
      <ActionButton
        type="button"
        variant="secondary"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
      >
        Referir candidato
      </ActionButton>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        // w-[calc(100%-2rem)], no w-full: ver el comentario en DialogShell —
        // sin esto el diálogo toca los bordes de la pantalla en un celular.
        className="w-[calc(100%-2rem)] max-w-[440px] rounded-lg bg-card p-0 text-foreground shadow-elevated backdrop:bg-foreground/25"
      >
        <div className="p-7">
          <div className="flex items-start justify-between gap-5">
            <h2 className="font-extrabold tracking-heading text-[23px] leading-tight">Referir candidato</h2>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => dialogRef.current?.close()}
              className="flex size-[30px] flex-none items-center justify-center rounded-full bg-muted"
            >
              <X className="size-3.5 text-muted-foreground" aria-hidden />
            </button>
          </div>

          {open && (
            <form action={formAction} className="mt-5 flex flex-col gap-4">
              {/* Etiqueta visible en los tres, no placeholder: quien refiere
                  carga datos de OTRA persona y al volver con un error tiene que
                  poder ubicar cuál de los tres campos corregir (AGENTS.md,
                  regla 12). */}
              <Field id="referir-full_name" label="Nombre completo" error={errorDe("full_name")}>
                <input
                  name="full_name"
                  required
                  className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field id="referir-email" label="Correo" error={errorDe("email")}>
                <input
                  name="email"
                  type="email"
                  required
                  className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field id="referir-phone" label="Teléfono" error={errorDe("phone")}>
                <input
                  name="phone"
                  required
                  className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                />
              </Field>
              {/* Quien refiere carga datos de OTRA persona. No es el
                  consentimiento del titular (ese no existe en este camino):
                  es la declaración de quien los sube. */}
              {/* No pasa por `<Field>`: acá el texto ES la etiqueta del control
                  (va dentro del `<label>`), no un rótulo aparte. El mensaje va
                  FUERA del `<label>` — adentro pasaría a formar parte del nombre
                  accesible de la casilla en vez de ser su descripción. */}
              <div className="flex flex-col gap-1.5">
                <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    name="referral_authorized"
                    required
                    aria-invalid={errorAutorizacion !== undefined}
                    aria-describedby={
                      errorAutorizacion !== undefined ? ID_ERROR_AUTORIZACION : undefined
                    }
                    className="mt-0.5 size-4 flex-none"
                  />
                  <span>
                    Esta persona me autorizó a compartir sus datos para postularla a esta vacante, y le informé que
                    quedarán registrados en la plataforma.
                  </span>
                </label>
                {errorAutorizacion && <FieldError id={ID_ERROR_AUTORIZACION}>{errorAutorizacion}</FieldError>}
              </div>
              <ActionButton>Referir</ActionButton>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
