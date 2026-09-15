"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { updateTemplateStep3 } from "@/lib/job-templates/wizard-actions";
import { ActionButton } from "@/components/ui/action-button";
import { useErrorToast } from "@/lib/forms/use-error-toast";
import { QuestionListEditor } from "@/components/configuracion/wizard/question-list-editor";
import type { QuestionDraft } from "@/lib/job-templates/wizard-schema";

export function WizardStep3Form({ templateId, initialQuestions }: { templateId: string; initialQuestions: QuestionDraft[] }) {
  const action = updateTemplateStep3.bind(null, templateId);
  const [state, formAction] = useActionState(action, undefined);
  // Prefijo propio aunque hoy no pinte ningún mensaje: el id por defecto
  // (`<campo>-error`) es del documento entero, y cualquier elemento que caiga
  // en ese nombre haría creer al hook que el mensaje se ve — y se callaría.
  const uid = useId();

  // `questions` es un path de un segmento, así que el error SÍ trae campo —
  // pero no hay ningún control que se llame así: el editor de preguntas son
  // filas, no un campo. Sin nada pintado con ese id, el hook lo manda al toast,
  // que es exactamente lo que corresponde.
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <QuestionListEditor initialQuestions={initialQuestions} />

      <div className="mt-6 flex justify-end gap-2.5">
        <Link
          href={`/configuracion/plantillas-vacante/${templateId}/paso-2`}
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
