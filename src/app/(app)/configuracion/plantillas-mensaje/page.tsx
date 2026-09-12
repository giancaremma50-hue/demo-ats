import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getMessageTemplates } from "@/lib/message-templates/get-message-templates";
import { MessageTemplateRow } from "@/components/configuracion/message-template-row";
import { MessageTemplateDialog } from "@/components/configuracion/message-template-dialog";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";

export default async function PlantillasMensajePage() {
  const profile = await requireAdminOrAbove();
  const templates = await getMessageTemplates(profile.organization_id);

  return (
    <Card as="section" className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-extrabold tracking-heading text-2xl">Plantillas de mensaje</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Mensajes reutilizables para enviar a candidatos desde una postulación.
          </p>
        </div>
        <MessageTemplateDialog trigger={<ActionButton type="button">Nueva plantilla</ActionButton>} />
      </div>

      <div className="mt-6">
        {templates.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Todavía no hay plantillas configuradas.</p>
        ) : (
          templates.map((t) => <MessageTemplateRow key={t.id} template={t} />)
        )}
      </div>
    </Card>
  );
}
