"use client";

import { useId, useRef, useState } from "react";
import { Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createBrandVideoUploadUrl,
  confirmBrandVideoUpload,
  removeBrandVideo,
} from "@/lib/organizations/actions";
import { BRAND_FIELD_COPY, type BrandVideoField } from "@/lib/organizations/brand-fields";
import { LicenseNote } from "./license-note";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["video/mp4", "video/webm"]);

/**
 * Sube el archivo directo del navegador a Supabase Storage con una URL
 * firmada — no pasa por ninguna Server Action de Next, así que no choca con
 * el límite de tamaño de body de las funciones de Vercel (~4.5 MB). El
 * servidor solo autoriza la ruta (createBrandVideoUploadUrl) y confirma
 * después de que el archivo ya está en Storage (confirmBrandVideoUpload).
 */
export function BrandVideoField({ field, currentUrl }: { field: BrandVideoField; currentUrl: string | null }) {
  const copy = BRAND_FIELD_COPY[field];
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ver el comentario en BrandImageField: la etiqueta visible no está
  // asociada al input por anidamiento, así que sin htmlFor + id el campo
  // queda sin nombre para un lector de pantalla.
  const id = useId();
  const inputId = `${id}-file`;
  const hintId = `${id}-hint`;
  const licenseId = `${id}-licencia`;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      notifyError("Formato no admitido. Usa MP4 o WebM.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      notifyError("El video pesa más de 20 MB. Usa uno más corto o comprímelo.");
      e.target.value = "";
      return;
    }

    setPending(true);
    try {
      const prepared = await createBrandVideoUploadUrl(field, file.type, file.size);
      if (!prepared.ok) {
        notifyError(prepared.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("marca-publico")
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (uploadError) {
        notifyError("No se pudo subir el video. Inténtalo de nuevo.");
        return;
      }

      const confirmed = await confirmBrandVideoUpload(field, prepared.path);
      if (confirmed?.error) {
        notifyError(confirmed.error);
        return;
      }
      // `?? copy.uploaded` y no un `if`: este flujo son tres await seguidos y
      // cada salida sin mensaje se lee como "no pasó nada" — el usuario
      // reintenta sobre algo que sí se guardó.
      notifySuccess(confirmed?.success ?? copy.uploaded);
    } catch {
      // Sin este catch, un rechazo de cualquiera de las tres llamadas (500,
      // red caída, un deploy que invalida el id de la Server Action) salía
      // como unhandled rejection: `finally` apagaba "Subiendo…" y no
      // aparecía ningún mensaje. Regla 5 — todo error se muestra.
      notifyError("No se pudo subir el video", "Algo se rompió de nuestro lado. Puedes intentarlo de nuevo.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
        {copy.label}
      </label>
      {/* Mismo patrón que BrandImageField: flex-col en celular, la fila
          única de escritorio no cabe en un teléfono. */}
      <div className="flex flex-col gap-3 rounded-md border border-dashed bg-background p-3.5 sm:flex-row sm:items-center sm:gap-3.5">
        <div className="flex min-w-0 items-center gap-3.5 sm:flex-1">
          <div className="flex h-11 w-[62px] flex-none items-center justify-center rounded-md border border-border bg-card">
            <Video className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p id={hintId} className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
            {copy.hint}
          </p>
        </div>
        {/* flex-wrap, no min-w-0/flex-1 en el input: ver el comentario en
            BrandImageField — un <input type="file"> nativo no se achica por
            CSS, así que si no cabe junto al botón de eliminar, este cae a
            la línea de abajo en vez de cortarse contra el borde. */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id={inputId}
            aria-describedby={`${hintId} ${licenseId}`}
            type="file"
            accept="video/mp4,video/webm"
            onChange={handleUpload}
            disabled={pending}
            className="max-w-full text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-xs sm:w-32"
          />
          {pending && <span className="flex-none text-xs text-muted-foreground">Subiendo…</span>}
          {/* Ver BrandImageField: eliminar con una subida en vuelo dejaría la
              columna apuntando a un objeto ya borrado. */}
          {currentUrl && !pending && (
            <DeleteButton
              iconOnly
              itemLabel={copy.label.toLowerCase()}
              onDelete={() => removeBrandVideo(field)}
              confirmDescription={copy.confirm}
            />
          )}
        </div>
        <LicenseNote id={licenseId} />
      </div>
    </div>
  );
}
