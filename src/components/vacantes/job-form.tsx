"use client";

import { forwardRef, useActionState, useEffect } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Field } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";
import { LabelSelect } from "@/components/ui/label-select";
import { notifySuccess } from "@/lib/notifications/toast";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL, VISIBILITY_LABEL } from "@/lib/jobs/schema";
import { COUNTRIES } from "@/lib/geo/countries";
import type { JobActionResult } from "@/lib/jobs/actions";
import type { JobDetail } from "@/lib/jobs/get-jobs";

type Department = { id: string; name: string };

/**
 * `ref` expone el <form> — lo usa NuevaVacanteForm para fusionar los datos
 * de una plantilla de puesto campo por campo (solo los que están vacíos),
 * sin pasar por `defaultValues` (que un formulario no controlado solo lee
 * al montar, nunca al recibir props nuevas).
 */
export const JobForm = forwardRef<
  HTMLFormElement,
  {
    action: (prevState: JobActionResult | undefined, formData: FormData) => Promise<JobActionResult>;
    departments: Department[];
    defaultValues?: Partial<JobDetail>;
    submitLabel: string;
    // Solo NuevaVacanteForm lo usa (un <input type="hidden" name="template_id">
    // que va dentro del <form> real) — editar/page.tsx no lo necesita y no
    // debe cargar con marcado de un flujo del que no participa.
    children?: React.ReactNode;
  }
>(function JobForm({ action, departments, defaultValues, submitLabel, children }, ref) {
  const [state, formAction] = useActionState(action, undefined);

  // El `<Field>` del departamento solo existe cuando hay departamentos, así que
  // un error de `department_id` puede no tener dónde mostrarse. Quien decide si
  // el toast habla es el hook, mirando si el mensaje se pinta de verdad.
  useErrorToast(state, (campo) => `vacante-${campo}-error`);

  const errorDe = selectorDeError(state);

  useEffect(() => {
    if (state?.success) notifySuccess(state.success);
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-5">
      {children}

      <Field id="vacante-title" label="Título del puesto" error={errorDe("title")}>
        <input
          name="title"
          required
          defaultValue={defaultValues?.title}
          className="h-11 rounded-md border border-border bg-background px-3 text-sm"
        />
      </Field>

      {departments.length > 0 && (
        <Field
          id="vacante-department_id"
          label="Departamento"
          error={errorDe("department_id")}
        >
          <select
            name="department_id"
            defaultValue={defaultValues?.department_id ?? ""}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Sin asignar</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="vacante-country" label="País" error={errorDe("country")}>
          <select
            name="country"
            required
            defaultValue={defaultValues?.country ?? ""}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Elige un país
            </option>
            {/* Una vacante creada antes de que "País" fuera un select fijo
                puede traer un valor que ya no está en la lista — mostrarlo
                (en vez de que el <select> caiga en el primer país de la
                lista sin que nadie lo note) deja claro qué había antes,
                pero no se puede volver a guardar tal cual: JobFormSchema
                exige uno de los 4 países reales, así que guardar cualquier
                otro cambio en este formulario obliga primero a elegir uno
                de la lista aquí. */}
            {defaultValues?.country && !(COUNTRIES as readonly string[]).includes(defaultValues.country) && (
              <option value={defaultValues.country} disabled>
                {defaultValues.country} (elige uno de la lista para guardar)
              </option>
            )}
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field id="vacante-location" label="Ubicación" error={errorDe("location")}>
          <input
            name="location"
            required
            defaultValue={defaultValues?.location ?? ""}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="vacante-work_mode" label="Modalidad" error={errorDe("work_mode")}>
          <LabelSelect
            name="work_mode"
            required
            labels={WORK_MODE_LABEL}
            defaultValue={defaultValues?.work_mode ?? undefined}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm"
          />
        </Field>
        <Field
          id="vacante-employment_type"
          label="Tipo de contrato"
          error={errorDe("employment_type")}
        >
          <LabelSelect
            name="employment_type"
            required
            labels={EMPLOYMENT_TYPE_LABEL}
            defaultValue={defaultValues?.employment_type ?? undefined}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm"
          />
        </Field>
      </div>

      <Field
        id="vacante-description"
        label="Descripción del puesto"
        error={errorDe("description")}
      >
        <textarea
          name="description"
          required
          rows={5}
          defaultValue={defaultValues?.description}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>

      <Field
        id="vacante-requirements"
        label="Requisitos"
        error={errorDe("requirements")}
      >
        <textarea
          name="requirements"
          required
          rows={4}
          defaultValue={defaultValues?.requirements}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          id="vacante-salary_min"
          label="Salario mín. (opcional)"
          error={errorDe("salary_min")}
        >
          <input
            name="salary_min"
            type="number"
            min={0}
            defaultValue={defaultValues?.salary_min ?? undefined}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm tabular-nums"
          />
        </Field>
        <Field
          id="vacante-salary_max"
          label="Salario máx. (opcional)"
          error={errorDe("salary_max")}
        >
          <input
            name="salary_max"
            type="number"
            min={0}
            defaultValue={defaultValues?.salary_max ?? undefined}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm tabular-nums"
          />
        </Field>
        <Field id="vacante-headcount" label="Plazas" error={errorDe("headcount")}>
          <input
            name="headcount"
            type="number"
            min={1}
            defaultValue={defaultValues?.headcount ?? 1}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm tabular-nums"
          />
        </Field>
      </div>

      <Field id="vacante-visibility" label="Visibilidad" error={errorDe("visibility")}>
        <select
          name="visibility"
          required
          defaultValue={defaultValues?.visibility ?? "confidencial"}
          className="h-11 rounded-md border border-border bg-background px-3 text-sm"
        >
          {Object.entries(VISIBILITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <div className="border-t border-border pt-5">
        <ActionButton>{submitLabel}</ActionButton>
      </div>
    </form>
  );
});
