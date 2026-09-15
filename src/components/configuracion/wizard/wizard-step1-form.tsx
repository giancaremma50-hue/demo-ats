"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { createTemplateDraftStep1, updateTemplateStep1 } from "@/lib/job-templates/wizard-actions";
import { ActionButton } from "@/components/ui/action-button";
import { Field } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";

const FIELD_CLASS = "h-11 rounded-md border border-border bg-background px-3 text-sm";
const TEXTAREA_CLASS = "rounded-md border border-border bg-background px-3 py-2 text-sm";

export type Step1InitialValues = {
  name: string;
  title: string;
  department_id: string | null;
  description: string;
  requirements: string;
};

/**
 * Sin `templateId`: crea una plantilla nueva (Siguiente → paso 2 recién
 * creado). Con `templateId`: reedita el paso 1 de una plantilla ya
 * existente (llegado desde "Atrás" del paso 2, o "Continuar" en el
 * listado) — mismo patrón create-vs-update que JobTemplateDialog.
 */
export function WizardStep1Form({
  departments,
  templateId,
  initialValues,
}: {
  departments: { id: string; name: string }[];
  templateId?: string;
  initialValues?: Step1InitialValues;
}) {
  const action = templateId ? updateTemplateStep1.bind(null, templateId) : createTemplateDraftStep1;
  const [state, formAction] = useActionState(action, undefined);

  // Prefijo propio: el paso 1 se monta para crear y para reeditar, y el
  // asistente vive dentro del layout de Ajustes junto a otras pantallas.
  const uid = useId();
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);
  const errorDe = selectorDeError(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field id={`${uid}-name`} label="Puesto" error={errorDe("name")} data-tour="w1-puesto">
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Vendedor Junior"
          defaultValue={initialValues?.name}
          className={FIELD_CLASS}
        />
      </Field>
      <Field
        id={`${uid}-title`}
        label="Título del anuncio de la vacante"
        error={errorDe("title")}
        data-tour="w1-titulo"
      >
        <input name="title" required maxLength={120} defaultValue={initialValues?.title} className={FIELD_CLASS} />
      </Field>
      <Field id={`${uid}-department_id`} label="Departamento (opcional)" error={errorDe("department_id")}>
        <select name="department_id" defaultValue={initialValues?.department_id ?? ""} className={FIELD_CLASS}>
          <option value="">Sin asignar</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id={`${uid}-description`}
        label="Descripción del puesto"
        error={errorDe("description")}
        data-tour="w1-descripcion"
      >
        <textarea name="description" required rows={4} defaultValue={initialValues?.description} className={TEXTAREA_CLASS} />
      </Field>
      <Field id={`${uid}-requirements`} label="Requisitos" error={errorDe("requirements")}>
        <textarea name="requirements" required rows={3} defaultValue={initialValues?.requirements} className={TEXTAREA_CLASS} />
      </Field>

      <div className="mt-6 flex justify-end gap-2.5">
        <Link
          href="/configuracion/plantillas-vacante"
          className="inline-flex h-[42px] items-center rounded-full border border-transparent px-5 text-sm text-muted-foreground hover:bg-muted"
        >
          Cancelar
        </Link>
        <ActionButton type="submit" pendingLabel="Guardando…">
          Siguiente
        </ActionButton>
      </div>
    </form>
  );
}
