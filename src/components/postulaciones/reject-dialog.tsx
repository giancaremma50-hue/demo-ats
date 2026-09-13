"use client";

import { forwardRef, useActionState, useEffect, useImperativeHandle, useRef } from "react";
import { rejectApplication } from "@/lib/applications/actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DialogShell, type DialogShellHandle } from "@/components/ui/dialog-shell";
import { Field } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";

type RejectionReason = { id: string; label: string };
export type RejectDialogHandle = { open: () => void };

export const RejectDialog = forwardRef<
  RejectDialogHandle,
  {
    applicationId: string;
    reasons: RejectionReason[];
    /** Por defecto un <ActionButton> propio — un caller que ya tiene su
     * propia botonera (ej. la barra flotante del drawer de candidato) puede
     * pasar `trigger={null}` y abrir el diálogo con el ref en su lugar. */
    trigger?: React.ReactNode | null;
    onSuccess?: () => void;
  }
>(function RejectDialog({ applicationId, reasons, trigger, onSuccess }, ref) {
  const dialogRef = useRef<DialogShellHandle>(null);
  const action = rejectApplication.bind(null, applicationId);
  const [state, formAction] = useActionState(action, undefined);

  useImperativeHandle(ref, () => ({ open: () => dialogRef.current?.open() }));

  // El formulario vive dentro de un `<dialog>`: si el usuario lo cierra
  // mientras la acción corre, el mensaje se pinta pero NO se ve. El hook mira
  // el layout, así que en ese caso el toast sí habla y el error no queda mudo.
  useErrorToast(state, (campo) => `rechazo-${campo}-error`);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      dialogRef.current?.close();
      onSuccess?.();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {trigger !== null && (
        <span onClick={() => dialogRef.current?.open()}>
          {trigger ?? (
            <ActionButton type="button" variant="ghost" className="text-destructive">
              Rechazar
            </ActionButton>
          )}
        </span>
      )}
      <DialogShell ref={dialogRef} title="¿Rechazar esta postulación?">
        <form action={formAction} className="flex flex-col gap-4">
          {/* Etiqueta visible: la primera opción deshabilitada ("Elige un
              motivo") desaparece en cuanto se elige algo, así que no puede ser
              lo único que nombra al campo (AGENTS.md, regla 12). */}
          <Field
            id="rechazo-rejection_reason_id"
            label="Motivo del rechazo"
            error={selectorDeError(state)("rejection_reason_id")}
          >
            <select
              name="rejection_reason_id"
              required
              defaultValue=""
              className="h-11 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="" disabled>
                Elige un motivo
              </option>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <ActionButton variant="destructive">Sí, rechazar</ActionButton>
        </form>
      </DialogShell>
    </>
  );
});
