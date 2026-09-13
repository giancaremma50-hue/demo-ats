import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplateForWizard } from "@/lib/job-templates/get-job-templates";
import { WizardLayout } from "@/components/configuracion/wizard/wizard-layout";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep5Form } from "@/components/configuracion/wizard/wizard-step5-form";
import { NotifyOnMount } from "@/components/ui/notify-on-mount";
import { HelpTourButton } from "@/components/ui/help-tour-button";

const HELP_STEPS = [
  { selector: '[data-tour="w5-confidencial"]', title: "Confidencial", description: "Marcada, solo quien la creó (y super_admin, que ve todo) puede verla o elegirla — ni siquiera otro admin. Útil para un puesto sensible (ej. un reemplazo que todavía no se anuncia)." },
];

export default async function PlantillaPaso5Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardado?: string }>;
}) {
  const profile = await requireAdminOrAbove();
  const { id } = await params;
  const { guardado } = await searchParams;

  const template = await getJobTemplateForWizard(id, profile.organization_id);
  if (!template) notFound();

  return (
    <WizardLayout nav={<WizardStepsNav current={5} />}>
      {guardado && <NotifyOnMount message="Etapas guardadas" />}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <h2 className="font-extrabold tracking-heading text-2xl">Permisos y usos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Quién puede ver esta plantilla en el bolsón.</p>
        </div>
        <HelpTourButton
          intro={{ title: "El paso 5 de 6", description: "Permisos — un solo interruptor, pero cambia quién puede elegir esta plantilla al crear una vacante." }}
          steps={HELP_STEPS}
        />
      </div>
      <WizardStep5Form templateId={template.id} isConfidential={template.is_confidential} />
    </WizardLayout>
  );
}
