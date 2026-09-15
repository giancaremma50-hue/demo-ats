"use client";

import { useActionState, useEffect, useId } from "react";
import { updateCareersContent } from "@/lib/organizations/actions";
import { ActionButton } from "@/components/ui/action-button";
import { notifySuccess } from "@/lib/notifications/toast";
import { Field } from "@/components/ui/field";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";

/**
 * Las leyendas que ve quien entra a /empleos. Vivían dentro del formulario de
 * marca; se separaron con el resto de la bolsa (2026-09-11) porque son dos
 * cosas distintas: la identidad de la plataforma la define quien manda la
 * marca, y el texto de bienvenida de la bolsa lo escribe quien recluta.
 *
 * Con `key` desde el padre, igual que BrandingForm: si el dato cambia por una
 * revalidación, el formulario se remonta en vez de quedarse con el
 * `defaultValue` con el que se montó.
 */
export function CareersForm({
  careersHeadline,
  careersIntro,
}: {
  careersHeadline: string | null;
  careersIntro: string | null;
}) {
  const [state, formAction] = useActionState(updateCareersContent, undefined);

  const uid = useId();
  useErrorToast(state, (campo) => `${uid}-${campo}-error`);
  const errorDe = selectorDeError(state);

  useEffect(() => {
    if (state?.success) notifySuccess(state.success);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field
        id={`${uid}-careers_headline`}
        label="Título de la bolsa (opcional)"
        error={errorDe("careers_headline")}
      >
        <input
          name="careers_headline"
          defaultValue={careersHeadline ?? ""}
          maxLength={120}
          placeholder="Vacantes abiertas"
          className="h-[42px] rounded-md border border-border bg-background px-3 text-sm"
        />
      </Field>

      <Field
        id={`${uid}-careers_intro`}
        label="Texto de bienvenida (opcional)"
        error={errorDe("careers_intro")}
      >
        <textarea
          name="careers_intro"
          defaultValue={careersIntro ?? ""}
          rows={3}
          maxLength={500}
          placeholder="Cuéntale a quien visita la bolsa por qué vale la pena trabajar aquí…"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>

      <ActionButton className="self-start">Guardar cambios</ActionButton>
    </form>
  );
}
