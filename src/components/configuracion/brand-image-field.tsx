"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import Image from "next/image";
import { ImageUp } from "lucide-react";
import { uploadBrandImage, removeBrandImage } from "@/lib/organizations/actions";
import { BRAND_FIELD_COPY, type BrandImageField } from "@/lib/organizations/brand-fields";
import { ActionButton } from "@/components/ui/action-button";
import { LicenseNote } from "./license-note";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

export function BrandImageField({ field, currentUrl }: { field: BrandImageField; currentUrl: string | null }) {
  const copy = BRAND_FIELD_COPY[field];
  const [state, formAction, subiendo] = useActionState(uploadBrandImage, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // Un solo useId y sufijos derivados: la etiqueta visible vive fuera del
  // <form> que contiene el input, así que sin htmlFor + id un lector de
  // pantalla anuncia los tres campos de subida como "elegir archivo" y no hay
  // forma de distinguir el logo de la portada. La pista Y la nota de licencia
  // (que es una regla sobre qué se puede subir) van por aria-describedby.
  const id = useId();
  const inputId = `${id}-file`;
  const hintId = `${id}-hint`;
  const licenseId = `${id}-licencia`;

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
    } else if (state?.error) {
      notifyError(state.error);
    }
  }, [state]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
        {copy.label}
      </label>
      {/* flex-col en celular: miniatura+texto y el resto (subir/eliminar)
          nunca caben en una sola fila sin desbordarse — el input de archivo
          (w-32 fijo) + el botón "Subir" + el ícono de eliminar por sí solos
          ya pasan de 200px, más los 62px de la miniatura. */}
      <div className="flex flex-col gap-3 rounded-md border border-dashed bg-background p-3.5 sm:flex-row sm:items-center sm:gap-3.5">
        <div className="flex min-w-0 items-center gap-3.5 sm:flex-1">
          <div className="flex h-11 w-[62px] flex-none items-center justify-center rounded-md border border-border bg-card">
            {currentUrl ? (
              <Image src={currentUrl} alt="" width={56} height={36} className="object-contain" />
            ) : (
              <ImageUp className="size-4 text-muted-foreground" aria-hidden />
            )}
          </div>
          <p id={hintId} className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
            {copy.hint}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* flex-wrap, no min-w-0/flex-1 en el input: un <input type="file">
              nativo tiene un ancho mínimo propio que el navegador no deja
              achicar por CSS por más flex-1 que se le ponga — en vez de
              pelear por encogerlo, se deja que el botón "Subir" caiga a la
              línea de abajo cuando no cabe al lado, en vez de cortarse
              contra el borde de la pantalla. */}
          <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="field" value={field} />
            <input
              id={inputId}
              aria-describedby={`${hintId} ${licenseId}`}
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp"
              required
              className="max-w-full text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-xs sm:w-32"
            />
            <ActionButton variant="secondary" className="h-8 flex-none px-3 text-xs">
              Subir
            </ActionButton>
          </form>
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
        </div>
        <LicenseNote id={licenseId} />
      </div>
    </div>
  );
}
