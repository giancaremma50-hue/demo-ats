"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendCandidateMessage } from "@/lib/applications/actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import type { MessageTemplate } from "@/lib/message-templates/get-message-templates";
import { Field } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";

export function MessageForm({
  applicationId,
  candidateEmail,
  templates,
}: {
  applicationId: string;
  candidateEmail: string;
  templates: MessageTemplate[];
}) {
  const action = sendCandidateMessage.bind(null, applicationId);
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // No controladas: precargar desde una plantilla solo escribe el DOM
  // directo (igual que un reset nativo del form), sin pasar por setState —
  // necesario para que el reset tras enviar no dispare otro render en el
  // mismo efecto que muestra el toast.
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Ids con prefijo: este formulario vive en un cajón montado ENCIMA de otra
  // pantalla, y `subject`/`body`/`cc` a secas son los ids más fáciles de chocar
  // que hay. Un id repetido rompe `htmlFor` y `aria-describedby`, que resuelven
  // por la primera coincidencia del documento.
  useErrorToast(state, (campo) => `mensaje-${campo}-error`);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  const errorDe = selectorDeError(state);

  function applyTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (!template || !subjectRef.current || !bodyRef.current) return;
    subjectRef.current.value = template.subject;
    bodyRef.current.value = template.body;
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2.5">
      {/* Fijo, no editable: el destinatario principal sale SIEMPRE del
          candidato real en la base, nunca de lo que el cliente mande — ver el
          comentario de sendCandidateMessage. Un select/input editable acá
          dejaría mandar correo con el remitente de la plataforma a cualquier
          dirección. Pasa por `<Field>` como el resto para que todas las
          etiquetas de este formulario se vean iguales. */}
      <Field id="mensaje-para" label="Para">
        <input
          value={candidateEmail}
          disabled
          className="h-9 rounded-md border border-border bg-muted px-2.5 text-sm text-muted-foreground"
        />
      </Field>

      <Field id="mensaje-cc" label="Copia (opcional)" error={errorDe("cc")} hint="Separa varios correos con coma. Máximo 5.">
        <input name="cc" type="text" className="h-9 rounded-md border border-border bg-background px-2.5 text-sm" />
      </Field>

      {templates.length > 0 && (
        <Field id="mensaje-plantilla" label="Plantilla">
          <select
            defaultValue=""
            onChange={(e) => applyTemplate(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2.5 text-xs"
          >
            <option value="">Usar una plantilla…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Etiqueta visible, no placeholder: el placeholder desaparece al
          escribir y deja de decir qué campo es — y si el asunto vuelve con
          error, no queda nada que lo nombre (AGENTS.md, regla 12). */}
      <Field id="mensaje-subject" label="Asunto" error={errorDe("subject")}>
        <input
          ref={subjectRef}
          name="subject"
          required
          maxLength={160}
          className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
        />
      </Field>

      <Field id="mensaje-body" label="Mensaje" error={errorDe("body")}>
        <textarea
          ref={bodyRef}
          name="body"
          required
          rows={4}
          maxLength={4000}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>

      <div className="flex justify-end">
        <ActionButton className="h-9 px-4 text-xs" pendingLabel="Enviando…">
          Enviar mensaje
        </ActionButton>
      </div>
    </form>
  );
}
