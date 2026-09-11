"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { uploadBrandImage, removeBrandImage } from "@/lib/organizations/actions";
import { BRAND_FIELD_COPY, type BrandImageField } from "@/lib/organizations/brand-fields";
import { ActionButton } from "@/components/ui/action-button";
import { MediaPicker } from "@/components/ui/media-picker";
import { LicenseNote } from "./license-note";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

export function BrandImageField({ field, currentUrl }: { field: BrandImageField; currentUrl: string | null }) {
  const copy = BRAND_FIELD_COPY[field];
  const [state, formAction, subiendo] = useActionState(uploadBrandImage, undefined);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const licenseId = useId();

  // Reset al guardar, calculado EN EL RENDER y no en un efecto: `setState`
  // dentro de un efecto es error de build en este proyecto (regla de pureza
  // de React). Cuando `state` cambia a éxito, el `key` del picker cambia y se
  // remonta: se olvida el archivo elegido y el cuadro pasa a mostrar lo que
  // acaba de devolver el servidor. El toast sí vive en el efecto — mostrarlo
  // es un efecto de verdad, no un ajuste de estado.
  const [estadoVisto, setEstadoVisto] = useState(state);
  if (state !== estadoVisto) {
    setEstadoVisto(state);
    if (state?.success) {
      setArchivo(null);
      setPickerKey((k) => k + 1);
    }
  }

  useEffect(() => {
    if (state?.success) notifySuccess(state.success);
    else if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="field" value={field} />
      <MediaPicker
        key={pickerKey}
        inputName="file"
        label={copy.label}
        hint={copy.hint}
        accept="image/png,image/jpeg,image/webp"
        currentUrl={currentUrl}
        describedBy={licenseId}
        disabled={subiendo}
        onSelect={setArchivo}
      />
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton variant="secondary" disabled={!archivo} className="h-8 px-3 text-xs" pendingLabel="Subiendo…">
          Subir
        </ActionButton>
        {/* Nada de eliminar mientras una subida está en vuelo: el borrado
            pone la columna en NULL y quita el archivo, y la subida que
            termina después vuelve a escribir la URL — quedaría una columna
            apuntando a un objeto que ya no existe. */}
        {currentUrl && !subiendo && (
          <DeleteButton
            iconOnly
            itemLabel={copy.label.toLowerCase()}
            onDelete={() => removeBrandImage(field)}
            confirmDescription={copy.confirm}
          />
        )}
        <LicenseNote id={licenseId} className="w-full sm:ml-auto sm:w-auto sm:text-right" />
      </div>
    </form>
  );
}
