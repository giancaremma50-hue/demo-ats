"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createBrandVideoUploadUrl,
  confirmBrandVideoUpload,
  removeBrandVideo,
} from "@/lib/organizations/actions";
import { BRAND_FIELD_COPY, type BrandVideoField } from "@/lib/organizations/brand-fields";
import { ActionButton } from "@/components/ui/action-button";
import { MediaPicker } from "@/components/ui/media-picker";
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
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const licenseId = useId();

  // El archivo se elige y se sube en dos pasos, igual que en los campos de
  // imagen: antes se subía solo con elegirlo, sin botón y sin vista previa,
  // así que no había ni forma de ver qué se había elegido ni de arrepentirse.
  // Vacía el cuadro: el archivo elegido se olvida y el picker se remonta con
  // `key` nuevo, volviendo a mostrar lo guardado. Se usa al guardar Y al
  // rechazar — un archivo inválido que se queda en pantalla con el botón
  // "Subir" encendido solo repite el mismo error a cada clic.
  function limpiarEleccion() {
    setArchivo(null);
    setPickerKey((k) => k + 1);
  }

  async function handleUpload() {
    if (!archivo) return;

    if (!ALLOWED_TYPES.has(archivo.type)) {
      notifyError("Formato no admitido. Usa MP4 o WebM.");
      limpiarEleccion();
      return;
    }
    if (archivo.size > MAX_BYTES) {
      notifyError("El video pesa más de 20 MB. Usa uno más corto o comprímelo.");
      limpiarEleccion();
      return;
    }

    setPending(true);
    try {
      const prepared = await createBrandVideoUploadUrl(field, archivo.type, archivo.size);
      if (!prepared.ok) {
        notifyError(prepared.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("marca-publico")
        .uploadToSignedUrl(prepared.path, prepared.token, archivo, { contentType: archivo.type });
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
      limpiarEleccion();
    } catch {
      // Sin este catch, un rechazo de cualquiera de las tres llamadas (500,
      // red caída, un deploy que invalida el id de la Server Action) salía
      // como unhandled rejection: `finally` apagaba el estado de carga y no
      // aparecía ningún mensaje. Regla 5 — todo error se muestra.
      notifyError("No se pudo subir el video", "Algo se rompió de nuestro lado. Puedes intentarlo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <MediaPicker
        key={pickerKey}
        label={copy.label}
        hint={copy.hint}
        kind="video"
        accept="video/mp4,video/webm"
        currentUrl={currentUrl}
        describedBy={licenseId}
        disabled={pending}
        onSelect={setArchivo}
      />
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          type="button"
          variant="secondary"
          onClick={handleUpload}
          pending={pending}
          disabled={!archivo}
          className="h-8 px-3 text-xs"
          pendingLabel="Subiendo…"
        >
          Subir
        </ActionButton>
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
        <LicenseNote id={licenseId} className="w-full sm:ml-auto sm:w-auto sm:text-right" />
      </div>
    </div>
  );
}
