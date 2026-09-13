import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getDepartmentsForOrg } from "@/lib/jobs/get-departments";
import { WizardLayout } from "@/components/configuracion/wizard/wizard-layout";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep1Form } from "@/components/configuracion/wizard/wizard-step1-form";
import { HelpTourButton } from "@/components/ui/help-tour-button";

const HELP_STEPS = [
  { selector: '[data-tour="w1-puesto"]', title: "Puesto", description: "El nombre interno de la plantilla — lo ve tu equipo al elegirla para crear una vacante, nunca el candidato." },
  { selector: '[data-tour="w1-titulo"]', title: "Título del anuncio", description: "Este sí lo ve el candidato: es el título que aparece en la bolsa de empleo pública." },
  { selector: '[data-tour="w1-descripcion"]', title: "Descripción del puesto", description: "También pública — se copia tal cual a cada vacante creada desde esta plantilla." },
];

export default async function NuevaPlantillaWizardPage() {
  await requireAdminOrAbove();
  const departments = await getDepartmentsForOrg();

  return (
    <WizardLayout nav={<WizardStepsNav current={1} />}>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <h2 className="font-extrabold tracking-heading text-2xl">Nueva plantilla de puesto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Detalles de la vacante — la información general que trae cada vacante creada desde esta plantilla.
          </p>
        </div>
        <HelpTourButton
          intro={{
            title: "El paso 1 de 6",
            description: "Vas a armar un puesto recurrente en 6 pasos cortos — cada \"Siguiente\" guarda de una vez, así que \"Atrás\" nunca pierde nada.",
          }}
          steps={HELP_STEPS}
        />
      </div>
      <WizardStep1Form departments={departments} />
    </WizardLayout>
  );
}
