"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { createSegment } from "@/lib/candidates/segments-actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DialogShell, type DialogShellHandle } from "@/components/ui/dialog-shell";
import { Field } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";
import type { CandidateFilters } from "@/lib/candidates/get-candidates";

export function SaveSegmentButton({ filters }: { filters: CandidateFilters }) {
  const dialogRef = useRef<DialogShellHandle>(null);
  // Prefijo propio por instancia: un id fijo choca si el diálogo se monta más
  // de una vez en la misma pantalla, y `htmlFor`/`aria-describedby` resuelven
  // por la primera coincidencia del documento.
  const uid = useId();
  const [state, formAction] = useActionState(createSegment, undefined);

  // El formulario vive en un `<dialog>`: si el usuario lo cierra mientras la
  // acción corre, el mensaje se pinta pero no se ve, y el hook lo manda al toast.
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);
  const errorDe = selectorDeError(state);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      dialogRef.current?.close();
    }
  }, [state]);

  const activeFilters = Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (activeFilters.length === 0) return null;

  return (
    <>
      <ActionButton type="button" variant="secondary" onClick={() => dialogRef.current?.open()} className="h-9 px-3 text-xs">
        Guardar como segmento
      </ActionButton>
      <DialogShell ref={dialogRef} title="Guardar segmento" maxWidthClassName="max-w-[380px]">
        <form action={formAction}>
          {activeFilters.map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}

          <Field id={`${uid}-name`} label="Nombre" error={errorDe("name")}>
            <input
              name="name"
              required
              autoFocus
              maxLength={80}
              placeholder="Candidatos en entrevista — Ventas"
              className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
            />
          </Field>

          <div className="mt-6 flex justify-end gap-2.5">
            <ActionButton type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>
              Cancelar
            </ActionButton>
            <ActionButton type="submit" pendingLabel="Guardando…">
              Guardar
            </ActionButton>
          </div>
        </form>
      </DialogShell>
    </>
  );
}
