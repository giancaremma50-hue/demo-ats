"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { updateTemplateStep5 } from "@/lib/job-templates/wizard-actions";
import { ActionButton } from "@/components/ui/action-button";
import { useErrorToast } from "@/lib/forms/use-error-toast";

export function WizardStep5Form({ templateId, isConfidential }: { templateId: string; isConfidential: boolean }) {
  const action = updateTemplateStep5.bind(null, templateId);
  const [state, formAction] = useActionState(action, undefined);
  // Prefijo propio aunque hoy no pinte ningún mensaje: el id por defecto
  // (`<campo>-error`) es del documento entero, y cualquier elemento que caiga
  // en ese nombre haría creer al hook que el mensaje se ve — y se callaría.
  const uid = useId();

  // No tiene ningún campo que Zod pueda rechazar por su contenido, así que el
  // toast es el único canal posible. Pasa por el hook igual para que haya un
  // solo mecanismo en todo el producto.
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex items-start justify-between gap-4 rounded-md border border-border p-4" data-tour="w5-confidencial">
        <span>
          <span className="block text-sm font-medium">Confidencial</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Solo vos vas a poder ver esta plantilla en el bolsón — al resto de la organización no le aparece, ni
            siquiera a otro admin.
          </span>
        </span>
        <input type="checkbox" name="is_confidential" defaultChecked={isConfidential} className="mt-1 size-4 flex-none" />
      </label>

      <div className="mt-6 flex justify-end gap-2.5">
        <Link
          href={`/configuracion/plantillas-vacante/${templateId}/paso-4`}
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
