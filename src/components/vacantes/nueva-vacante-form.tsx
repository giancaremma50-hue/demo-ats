"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { createJob } from "@/lib/jobs/actions";
import { ActionButton } from "@/components/ui/action-button";
import { Field } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";
import { LabelSelect } from "@/components/ui/label-select";
import { EmploymentReasonSelect } from "@/components/vacantes/employment-reason-select";
import { CollaboratorsPicker } from "@/components/vacantes/collaborators-picker";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL, VACANCY_TYPE_LABEL } from "@/lib/jobs/schema";
import { COUNTRIES } from "@/lib/geo/countries";
import type { EmploymentReasonOption } from "@/lib/employment-reasons/get-employment-reasons";
import type { TeamMemberOption } from "@/lib/jobs/get-team-options";

const FIELD_CLASS = "h-11 rounded-md border border-border bg-background px-3 text-sm";

export type TemplateSummary = {
  id: string;
  name: string;
  title: string;
  description: string;
  requirements: string;
};

export function NuevaVacanteForm({
  templates,
  admins,
  members,
  employmentReasons,
  isAdmin,
}: {
  templates: TemplateSummary[];
  admins: TeamMemberOption[];
  members: TeamMemberOption[];
  employmentReasons: EmploymentReasonOption[];
  /** El formulario para admin+ gana "solicitar en nombre de" y "admins adicionales" — un gestor ni ve esos campos. */
  isAdmin: boolean;
}) {
  const [state, formAction] = useActionState(createJob, undefined);
  const [templateId, setTemplateId] = useState("");
  const selected = templates.find((t) => t.id === templateId);

  const uid = useId();
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);
  const errorDe = selectorDeError(state);

  if (templates.length === 0) {
    return (
      <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Todavía no hay plantillas publicadas para elegir.{" "}
        <Link href="/configuracion/plantillas-vacante/nueva" className="font-medium text-accent underline">
          Crear una plantilla
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field
        id={`${uid}-template_id`}
        label="Plantilla de puesto"
        error={errorDe("template_id")}
        data-tour="nv-plantilla"
      >
        <select
          name="template_id"
          required
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className={FIELD_CLASS}
        >
          <option value="" disabled>
            Elige una plantilla…
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      {selected && (
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm" data-tour="nv-preview">
          <p className="font-medium">{selected.title}</p>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{selected.description}</p>
          <p className="mt-3 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Requisitos</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.requirements}</p>
        </div>
      )}

      {/* País/ubicación/modalidad/tipo de contrato son de ESTA solicitud, no
          de la plantilla — un mismo puesto puede abrirse en más de un país o
          modalidad sin duplicar la plantilla. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${uid}-country`} label="País" error={errorDe("country")}>
          <select name="country" required defaultValue="" className={FIELD_CLASS}>
            <option value="" disabled>
              Elige un país
            </option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${uid}-location`} label="Ubicación" error={errorDe("location")}>
          <input name="location" required maxLength={120} placeholder="Ciudad de Guatemala" className={FIELD_CLASS} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${uid}-work_mode`} label="Modalidad" error={errorDe("work_mode")}>
          <LabelSelect name="work_mode" required labels={WORK_MODE_LABEL} className={FIELD_CLASS} />
        </Field>
        <Field id={`${uid}-employment_type`} label="Tipo de contrato" error={errorDe("employment_type")}>
          <LabelSelect name="employment_type" required labels={EMPLOYMENT_TYPE_LABEL} className={FIELD_CLASS} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-tour="nv-salario">
        <Field id={`${uid}-salary_min`} label="Salario mín. (opcional)" error={errorDe("salary_min")}>
          <input name="salary_min" type="number" min={0} className={`${FIELD_CLASS} tabular-nums`} />
        </Field>
        <Field id={`${uid}-salary_max`} label="Salario máx. (opcional)" error={errorDe("salary_max")}>
          <input name="salary_max" type="number" min={0} className={`${FIELD_CLASS} tabular-nums`} />
        </Field>
        <Field id={`${uid}-headcount`} label="Plazas" error={errorDe("headcount")}>
          <input name="headcount" type="number" min={1} defaultValue={1} className={`${FIELD_CLASS} tabular-nums`} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-tour="nv-tipo">
        <Field id={`${uid}-vacancy_type`} label="Tipo de vacante" error={errorDe("vacancy_type")}>
          <LabelSelect name="vacancy_type" required labels={VACANCY_TYPE_LABEL} className={FIELD_CLASS} />
        </Field>
        {/* `EmploymentReasonSelect` no es un control: es un `<select>` más una
            fila para agregar un motivo nuevo, así que no puede ser el hijo
            único de `<Field>`. Etiqueta y mensaje van a mano. */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor={`${uid}-employment_reason_id`}
            className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase"
          >
            Motivo de la vacante
          </label>
          <EmploymentReasonSelect
            initialReasons={employmentReasons}
            id={`${uid}-employment_reason_id`}
            error={errorDe("employment_reason_id")}
            idError={`${uid}-employment_reason_id-error`}
          />
        </div>
      </div>

      <div className="border-t border-border pt-5" data-tour="nv-equipo">
        <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Equipo de reclutamiento</span>
        <div className="mt-3 flex flex-col gap-4">
          {isAdmin && (
            <>
              <Field
                id={`${uid}-requester_id`}
                label="Solicitar en nombre de (opcional — por defecto, tú)"
                error={errorDe("requester_id")}
              >
                <select name="requester_id" defaultValue="" className={FIELD_CLASS}>
                  <option value="">Yo mismo</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </Field>
              {/* Un grupo de casillas no es un control único, así que no
                  puede ir dentro de un `<label>` ni de `<Field>`: lo nombra
                  `role="group"` + `aria-labelledby`. */}
              <div className="flex flex-col gap-2">
                <span id={`${uid}-extra_admin_ids-label`} className="text-xs text-muted-foreground">
                  Admins adicionales (opcional)
                </span>
                <CollaboratorsPicker
                  members={admins}
                  name="extra_admin_ids"
                  emptyLabel="No hay otros admins en la organización."
                  idEtiqueta={`${uid}-extra_admin_ids-label`}
                  error={errorDe("extra_admin_ids")}
                  idError={`${uid}-extra_admin_ids-error`}
                />
              </div>
            </>
          )}
          <div className="flex flex-col gap-2">
            <span id={`${uid}-collaborator_ids-label`} className="text-xs text-muted-foreground">
              Colaboradores adicionales (opcional)
            </span>
            <CollaboratorsPicker
              members={members}
              idEtiqueta={`${uid}-collaborator_ids-label`}
              error={errorDe("collaborator_ids")}
              idError={`${uid}-collaborator_ids-error`}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <ActionButton>Crear vacante</ActionButton>
      </div>
    </form>
  );
}
