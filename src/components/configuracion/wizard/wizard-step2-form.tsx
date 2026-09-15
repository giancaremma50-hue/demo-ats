"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { updateTemplateStep2 } from "@/lib/job-templates/wizard-actions";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { ERROR_CONTROL_CLASS, FieldError } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";
import { campoSuelto } from "@/lib/forms/field-signals";
import { cn } from "@/lib/utils";
import { CANDIDACY_FIELD_LABEL, CANDIDACY_STATE_LABEL, type CandidacyFields, type CandidacyFieldKey } from "@/lib/job-templates/candidacy-fields";

const FIELD_KEYS = Object.keys(CANDIDACY_FIELD_LABEL) as CandidacyFieldKey[];

export function WizardStep2Form({ templateId, initialFields }: { templateId: string; initialFields: CandidacyFields }) {
  const action = updateTemplateStep2.bind(null, templateId);
  const [state, formAction] = useActionState(action, undefined);

  const uid = useId();
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);
  const errorDe = selectorDeError(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Card className="flex flex-col divide-y divide-border" data-tour="w2-campos">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm">Correo electrónico</span>
          <span className="text-xs text-muted-foreground">Obligatorio — no se puede cambiar</span>
        </div>
        {FIELD_KEYS.map((key) => {
          const campo = campoSuelto(errorDe(key), `${uid}-${key}-error`);
          return (
            /* `<label htmlFor>` y no un `<span>` suelto: el texto de la
               izquierda se veía como etiqueta pero no lo era, así que el
               `<select>` quedaba sin nombre accesible. No pasa por `<Field>`
               porque acá etiqueta y control comparten fila, no columna. */
            <div key={key} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <label htmlFor={`${uid}-${key}`} className="text-sm">
                  {CANDIDACY_FIELD_LABEL[key]}
                </label>
                <select
                  id={`${uid}-${key}`}
                  name={key}
                  defaultValue={initialFields[key]}
                  {...campo.props}
                  className={cn(
                    "h-9 shrink-0 rounded-md border border-border bg-background px-2.5 text-sm",
                    campo.enError && ERROR_CONTROL_CLASS,
                  )}
                >
                  {Object.entries(CANDIDACY_STATE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {campo.idMensaje && <FieldError id={campo.idMensaje}>{campo.mensaje}</FieldError>}
            </div>
          );
        })}
      </Card>

      <div className="mt-6 flex justify-end gap-2.5">
        <Link
          href={`/configuracion/plantillas-vacante/${templateId}/paso-1`}
          className="inline-flex h-[42px] items-center rounded-full border border-border px-5 text-sm text-muted-foreground hover:bg-muted"
        >
          Atrás
        </Link>
        <ActionButton type="submit" pendingLabel="Guardando…">
          Siguiente
        </ActionButton>
      </div>
    </form>
  );
}
