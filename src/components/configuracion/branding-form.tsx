"use client";

import { useActionState, useEffect, useState } from "react";
import { updateBranding } from "@/lib/organizations/actions";
import { ActionButton } from "@/components/ui/action-button";
import { notifySuccess } from "@/lib/notifications/toast";
import { DEFAULT_ACCENT } from "@/lib/color-contrast";
import { ERROR_CONTROL_CLASS, Field, FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { selectorDeError, useErrorToast } from "@/lib/forms/use-error-toast";

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

  useErrorToast(state, (campo) => `marca-${campo}-error`);

  useEffect(() => {
    if (state?.success) notifySuccess(state.success);
  }, [state]);

  const errorDe = selectorDeError(state);
  /** Un solo predicado para las cuatro señales del acento (borde,
   *  `aria-invalid`, `aria-describedby` y mensaje). Repetir la comparación en
   *  cada una es cómo se desincronizan. */
  const errorAcento = errorDe("accent_color");
  const enAcento = errorAcento !== undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field id="marca-platform_name" label="Nombre de la plataforma" error={errorDe("platform_name")}>
        <input
          name="platform_name"
          defaultValue={platformName}
          maxLength={60}
          required
          className="h-[42px] rounded-md border border-border bg-background px-3 text-sm"
        />
      </Field>

      {/* No pasa por `<Field>`: el control vive dentro de una fila junto a los
          presets y lleva DOS descripciones (la ayuda y el error), que `<Field>`
          resuelve solo cuando el control es su único hijo. El cableado va a
          mano, con las mismas piezas. */}
      <div className="flex flex-col gap-2.5">
        <label htmlFor="marca-accent_color" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
          Color de acento
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setColor(preset)}
              aria-label={`Usar ${preset}`}
              // Sin esto, un lector de pantalla no tiene forma de saber cuál
              // de los presets está elegido: la marca era puramente visual.
              aria-pressed={color === preset}
              style={{ backgroundColor: preset }}
              className={cn(
                "size-10 flex-none rounded-md border-2",
                color === preset
                  ? "border-foreground shadow-[0_0_0_4px_var(--background),0_0_0_6px_var(--foreground)]"
                  : "border-border",
              )}
            />
          ))}
          <input
            id="marca-accent_color"
            name="accent_color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            pattern="^#[0-9a-fA-F]{6}$"
            required
            aria-invalid={enAcento}
            // Los DOS ids: la ayuda dice qué hace el color y el error dice qué
            // tiene de malo el elegido. Sacarle la ayuda justo cuando falla le
            // quita la única referencia de cómo se ve un valor válido.
            aria-describedby={
              enAcento
                ? "marca-accent_color-ayuda marca-accent_color-error"
                : "marca-accent_color-ayuda"
            }
            // `cn` y no una plantilla cruda: `border` y `border-2` son la misma
            // propiedad y sin twMerge gana el orden de la hoja, no el de la
            // cadena — el campo en error podía quedarse en 1px.
            className={cn(
              "h-10 w-[116px] rounded-md border border-border bg-background px-3 font-mono text-sm uppercase",
              enAcento && ERROR_CONTROL_CLASS,
            )}
          />
        </div>
        <p id="marca-accent_color-ayuda" className="text-xs leading-relaxed text-muted-foreground">
          Se usa en enlaces, etiquetas, estados activos y el anillo de foco del teclado. Los botones primarios llevan el verde AJE fijo, y los colores de éxito, alerta y error no cambian.
        </p>
        {enAcento && <FieldError id="marca-accent_color-error">{errorAcento}</FieldError>}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-5">
        <ActionButton>Guardar cambios</ActionButton>
      </div>
    </form>
  );
}
