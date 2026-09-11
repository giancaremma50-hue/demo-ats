"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createBrandUploadUrl, confirmBrandUpload, removeBrandMedia } from "@/lib/organizations/actions";
import {
  BRAND_FIELD_COPY,
  BRAND_FIELD_SPEC,
  brandFieldHint,
  brandRejectionMessage,
  type BrandMediaField,
} from "@/lib/organizations/brand-fields";
import { MediaPicker } from "@/components/ui/media-picker";
import { LicenseNote } from "./license-note";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

/**
 * Un único campo para los 5 archivos de marca — antes eran dos componentes
 * casi idénticos (uno para imagen, otro para video) con dos mecanismos de
 * subida distintos, y el de imagen era el que fallaba.
 *
 * Dos cosas cambian respecto de esa versión, las dos por el mismo reporte
 * (2026-09-11: "cargué el logo y la portada y no se ven"):
 *
 * 1. **Se sube al elegir el archivo, sin un segundo paso.** Había un botón
 *    "Subir" aparte, debajo del cuadro: con la miniatura ya puesta, el campo
 *    se lee como listo y ese botón se olvida. En un teléfono elegir la foto
 *    ES guardarla — así funciona cualquier selector de foto de perfil.
 *    El estado `pending` que exige la regla de interacción 1 lo muestra el
 *    propio cuadro (spinner + `aria-busy` + deshabilitado).
 * 2. **El archivo va directo a Storage con URL firmada**, nunca dentro del
 *    cuerpo de una Server Action — ver el comentario largo en
 *    `createBrandUploadUrl`: el tope de ~4.5 MB de Vercel rechaza la petición
 *    antes de que corra código propio y la interfaz se queda muda.
 */
export function BrandMediaField({ field, currentUrl }: { field: BrandMediaField; currentUrl: string | null }) {
  const copy = BRAND_FIELD_COPY[field];
  const spec = BRAND_FIELD_SPEC[field];
  const [status, setStatus] = useState<"idle" | "subiendo" | "guardado">("idle");
  // Remontar el picker es la forma de vaciarlo: olvida el archivo elegido y
  // vuelve a mostrar lo guardado. Se usa al RECHAZAR y al borrar — nunca al
  // guardar bien, donde la vista previa local tiene que quedarse hasta que
  // llegue el valor nuevo del servidor.
  const [pickerKey, setPickerKey] = useState(0);
  const licenseId = useId();

  function descartar() {
    setPickerKey((k) => k + 1);
    setStatus("idle");
  }

  // Cuando la revalidación trae la URL nueva, el cuadro vuelve a "idle" y se
  // remonta. Sin esto, "Guardado" era un estado terminal: la vista previa
  // local (`blob:`) se quedaba pegada toda la sesión —reteniendo el archivo en
  // memoria y tapando lo que el servidor devolvió— y la línea de estado nunca
  // volvía a decir que se puede elegir otro archivo. Se calcula EN EL RENDER
  // porque `setState` en un efecto es error de build en este proyecto.
  const [urlVista, setUrlVista] = useState(currentUrl);
  if (currentUrl !== urlVista) {
    setUrlVista(currentUrl);
    if (status === "guardado") descartar();
  }

  async function subir(file: File | null) {
    if (!file) return;

    // Guardias en el cliente además de las del servidor: dan el mensaje
    // concreto sin una ida y vuelta, y evitan empezar una subida que Storage
    // va a rechazar igual por el límite del bucket.
    if (!spec.mimeTypes.includes(file.type)) {
      notifyError(brandRejectionMessage(field, "formato"));
      descartar();
      return;
    }
    if (file.size <= 0) {
      notifyError(brandRejectionMessage(field, "vacio"));
      descartar();
      return;
    }
    if (file.size > spec.maxBytes) {
      notifyError(brandRejectionMessage(field, "tamano"));
      descartar();
      return;
    }

    setStatus("subiendo");
    try {
      const prepared = await createBrandUploadUrl(field, file.type, file.size);
      if (!prepared.ok) {
        notifyError(prepared.error);
        descartar();
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("marca-publico")
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (uploadError) {
        notifyError("No se pudo subir el archivo", "Revisa tu conexión e inténtalo de nuevo.");
        descartar();
        return;
      }

      const confirmed = await confirmBrandUpload(field, prepared.path);
      if (confirmed?.error) {
        notifyError(confirmed.error);
        descartar();
        return;
      }

      notifySuccess(confirmed?.success ?? copy.uploaded);
      // Sin descartar(): la vista previa local se queda hasta que la
      // revalidación traiga la URL nueva. Vaciarla acá dejaba el cuadro en
      // blanco justo después de guardar.
      setStatus("guardado");
    } catch {
      // Sin este catch, el rechazo de cualquiera de las tres llamadas (500,
      // red caída, un deploy que invalida el id de la Server Action) salía
      // como unhandled rejection y la pantalla no decía nada. Regla 5.
      notifyError("No se pudo subir el archivo", "Algo se rompió de nuestro lado. Puedes intentarlo de nuevo.");
      descartar();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <MediaPicker
        key={pickerKey}
        label={copy.label}
        hint={brandFieldHint(field)}
        kind={spec.kind}
        accept={spec.mimeTypes.join(",")}
        currentUrl={currentUrl}
        describedBy={licenseId}
        status={status}
        onSelect={subir}
      />
      <div className="flex flex-wrap items-center gap-2">
        {currentUrl && status !== "subiendo" && (
          <DeleteButton
            iconOnly
            itemLabel={copy.label.toLowerCase()}
            onDelete={async () => {
              const mensaje = await removeBrandMedia(field);
              // Vaciar el cuadro: si quedara la vista previa local, el archivo
              // recién borrado seguiría en pantalla como si existiera.
              descartar();
              return mensaje;
            }}
            confirmDescription={copy.confirm}
          />
        )}
        <LicenseNote id={licenseId} className="w-full sm:ml-auto sm:w-auto sm:text-right" />
      </div>
    </div>
  );
}
