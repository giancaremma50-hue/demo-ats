"use client";

import { useActionState, useEffect } from "react";
import { updateCareersContent } from "@/lib/organizations/actions";
import { ActionButton } from "@/components/ui/action-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

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

  useEffect(() => {
    if (state?.success) notifySuccess(state.success);
    else if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="careers_headline" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
          Título de la bolsa (opcional)
        </label>
        <input
          id="careers_headline"
          name="careers_headline"
          defaultValue={careersHeadline ?? ""}
          maxLength={120}
          placeholder="Vacantes abiertas"
          className="h-[42px] rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-accent"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="careers_intro" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
          Texto de bienvenida (opcional)
        </label>
        <textarea
          id="careers_intro"
          name="careers_intro"
          defaultValue={careersIntro ?? ""}
          rows={3}
          maxLength={500}
          placeholder="Cuéntale a quien visita la bolsa por qué vale la pena trabajar aquí…"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-accent"
        />
      </div>

      <ActionButton className="self-start">Guardar cambios</ActionButton>
    </form>
  );
}
