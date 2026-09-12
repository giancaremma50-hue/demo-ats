"use client";

import { useActionState, useEffect, useState } from "react";
import { updateBranding } from "@/lib/organizations/actions";
import { ActionButton } from "@/components/ui/action-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { DEFAULT_ACCENT } from "@/lib/color-contrast";

// El primero es el verde AJE oscurecido: mismo matiz (144°) que `--aje-green`,
// bajado en luminosidad hasta que sirve para lo que el acento SE USA —texto
// chico, bordes y el anillo de foco sobre fondo blanco—, donde el #00B348 tal
// cual da 2.78:1 y es ilegible. El verde de marca sin tocar vive en
// `--primary` y rellena botones, que es donde un verde brillante funciona.
const PRESET_COLORS = [DEFAULT_ACCENT, "#1f4d3d", "#1b3a5c", "#6b2f2a", "#4a3f6b", "#8a5a1f"];

/**
 * Identidad de la plataforma. Las leyendas de la bolsa pública se fueron a
 * `/bolsa` con el resto de la bolsa (2026-09-11): son operación de
 * reclutamiento, no configuración de la plataforma.
 *
 * El padre debe montar esto con una `key` que incluya los valores que llegan
 * como prop (ver marca/page.tsx). Así, si otra pestaña guarda un valor
 * distinto y una revalidación trae ese dato fresco sin recargar la página,
 * React remonta el formulario en vez de dejar `color` o el `defaultValue` de
 * cualquier campo desactualizado con el que se montó.
 */
export function BrandingForm({ platformName, accentColor }: { platformName: string; accentColor: string }) {
  const [state, formAction] = useActionState(updateBranding, undefined);
  const [color, setColor] = useState(accentColor);

  useEffect(() => {
    if (state?.success) notifySuccess(state.success);
    else if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="platform_name" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
          Nombre de la plataforma
        </label>
        <input
          id="platform_name"
          name="platform_name"
          defaultValue={platformName}
          maxLength={60}
          required
          aria-invalid={state?.field === "platform_name"}
          className={`h-[42px] rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-accent ${state?.field === "platform_name" ? "border-destructive" : "border-border"}`}
        />
        {state?.field === "platform_name" && <p className="text-xs text-destructive">{state.error}</p>}
      </div>

      <div className="flex flex-col gap-2.5">
        <label htmlFor="accent_color" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
          Color de acento
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setColor(preset)}
              aria-label={`Usar ${preset}`}
              style={{ backgroundColor: preset }}
              className={`size-10 flex-none rounded-md border-2 ${color === preset ? "border-foreground outline outline-1 outline-offset-2 outline-foreground" : "border-border"}`}
            />
          ))}
          <input
            id="accent_color"
            name="accent_color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            pattern="^#[0-9a-fA-F]{6}$"
            required
            aria-invalid={state?.field === "accent_color"}
            className={`h-10 w-[116px] rounded-md border bg-background px-3 font-mono text-sm uppercase outline-none focus-visible:border-accent ${state?.field === "accent_color" ? "border-destructive" : "border-border"}`}
          />
        </div>
        {state?.field === "accent_color" ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Se usa en enlaces, etiquetas, estados activos y el anillo de foco del teclado. Los botones primarios llevan el verde AJE fijo, y los colores de éxito, alerta y error no cambian.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-5">
        <ActionButton>Guardar cambios</ActionButton>
      </div>
    </form>
  );
}
