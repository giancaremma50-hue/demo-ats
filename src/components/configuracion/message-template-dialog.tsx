"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { createMessageTemplate, updateMessageTemplate } from "@/lib/message-templates/actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DialogShell, type DialogShellHandle } from "@/components/ui/dialog-shell";
import { Field, FieldError } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";
import type { MessageTemplate } from "@/lib/message-templates/get-message-templates";

export function MessageTemplateDialog({
  template,
  trigger,
}: {
  template?: MessageTemplate;
  trigger: React.ReactNode;
}) {
  const dialogRef = useRef<DialogShellHandle>(null);
  // Prefijo propio: esta pantalla monta un diálogo por plantilla más el de
  // "nueva", así que un id fijo se repetiría N+1 veces en el documento.
  const uid = useId();
  const action = template ? updateMessageTemplate.bind(null, template.id) : createMessageTemplate;
  const [state, formAction] = useActionState(action, undefined);

  // Con `idGeneral`, igual que el diálogo de departamentos: un "no se pudo
  // crear" dentro de un `<dialog>` abierto solo tenía el toast, que se va
  // mientras el usuario sigue mirando el formulario.
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
      <DialogShell ref={dialogRef} title={template ? "Editar plantilla" : "Nueva plantilla"} maxWidthClassName="max-w-[480px]">
        <form action={formAction}>
          <div className="flex flex-col gap-4">
            <Field id={`${uid}-name`} label="Nombre" error={errorDe("name")}>
              <input
                name="name"
                required
                maxLength={80}
                defaultValue={template?.name}
                placeholder="Rechazo — no cumple experiencia"
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
              />
            </Field>
            <Field id={`${uid}-subject`} label="Asunto" error={errorDe("subject")}>
              <input
                name="subject"
                required
                maxLength={160}
                defaultValue={template?.subject}
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
              />
            </Field>
            <Field id={`${uid}-body`} label="Cuerpo" error={errorDe("body")}>
              <textarea
                name="body"
                required
                rows={6}
                maxLength={4000}
                defaultValue={template?.body}
                className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
              />
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
