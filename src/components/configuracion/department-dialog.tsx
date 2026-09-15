"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { createDepartment, updateDepartment } from "@/lib/departments/actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DialogShell, type DialogShellHandle } from "@/components/ui/dialog-shell";
import { Field, FieldError } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";
import type { DepartmentAdminRow, SelectableProfile } from "@/lib/departments/get-departments-admin";

export function DepartmentDialog({
  department,
  profiles,
  trigger,
}: {
  department?: DepartmentAdminRow;
  profiles: SelectableProfile[];
  trigger: React.ReactNode;
}) {
  const dialogRef = useRef<DialogShellHandle>(null);
  // Prefijo propio: la pantalla monta un diálogo por departamento más el de
  // "nuevo", así que un id fijo se repetiría N+1 veces en el documento.
  const uid = useId();
  const action = department ? updateDepartment.bind(null, department.id) : createDepartment;
  const [state, formAction] = useActionState(action, undefined);

  // Con `idGeneral`: el choque de UNIQUE(nombre, país) no es de un campo solo
  // —quien cambió únicamente el país lo causa igual— así que la acción lo manda
  // sin `field`, y acá tiene que QUEDARSE en pantalla: es corregible por el
  // usuario, y un toast se va antes de que vuelva a mirar el formulario.
  useErrorToast(state, (campo) => `${uid}-${campo}-error`, `${uid}-error`);
  const errorDe = selectorDeError(state);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      dialogRef.current?.close();
    }
  }, [state]);

  return (
    <>
      <span onClick={() => dialogRef.current?.open()}>{trigger}</span>
      <DialogShell ref={dialogRef} title={department ? "Editar departamento" : "Nuevo departamento"} maxWidthClassName="max-w-[420px]">
        <form action={formAction}>
          <div className="flex flex-col gap-4">
            <Field id={`${uid}-name`} label="Nombre" error={errorDe("name")}>
              <input
                name="name"
                required
                defaultValue={department?.name}
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
              />
            </Field>
            <Field id={`${uid}-country`} label="País (opcional)" error={errorDe("country")}>
              <input
                name="country"
                defaultValue={department?.country ?? ""}
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
              />
            </Field>
            <Field
              id={`${uid}-head_profile_id`}
              label="Responsable (opcional)"
              error={errorDe("head_profile_id")}
            >
              <select
                name="head_profile_id"
                defaultValue={department?.head_profile_id ?? ""}
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
              >
                <option value="">Sin asignar</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {state?.error && !state.field && (
            <div className="mt-4">
              <FieldError id={`${uid}-error`}>{state.error}</FieldError>
            </div>
          )}

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
