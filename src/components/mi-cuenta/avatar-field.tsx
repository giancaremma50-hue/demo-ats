"use client";

import { useActionState, useEffect, useState } from "react";
import { uploadAvatar, removeAvatar } from "@/lib/profile/actions";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { MediaPicker } from "@/components/ui/media-picker";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

export function AvatarField({ currentUrl, displayName }: { currentUrl: string | null; displayName: string }) {
  const [state, formAction, subiendo] = useActionState(uploadAvatar, undefined);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

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
    // El mismo cuadro que los campos de marca: se ve la foto elegida ANTES de
    // guardarla, en redondo porque así es como se va a mostrar después. Antes
    // acá había una miniatura decorativa a la izquierda y un input de archivo
    // nativo aparte, que solo mostraba el nombre del archivo.
    <form action={formAction} className="flex flex-col gap-2">
      <MediaPicker
        key={pickerKey}
        inputName="file"
        label="Foto de perfil"
        labelHidden
        hint="PNG, JPG o WebP, máx. 3 MB. Se ve en tus publicaciones, seguimientos y en el encabezado."
        accept="image/png,image/jpeg,image/webp"
        currentUrl={currentUrl}
        shape="circle"
        // Sin foto, las iniciales sobre el verde de marca — el MISMO respaldo
        // que el encabezado y las publicaciones. Un ícono genérico acá, justo
        // en la pantalla donde se administra la foto, era la inconsistencia
        // más confusa posible (ver .claude/napkin.md, 2026-09-11).
        fallback={<Avatar name={displayName} src={null} size={64} />}
        disabled={subiendo}
        onSelect={setArchivo}
      />
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton variant="secondary" disabled={!archivo} className="h-8 px-3 text-xs" pendingLabel="Subiendo…">
          Subir
        </ActionButton>
        {currentUrl && !subiendo && (
          <DeleteButton
            itemLabel="foto de perfil"
            onDelete={removeAvatar}
            confirmDescription="Volverás a mostrar tus iniciales hasta que subas otra."
            className="h-8 px-3 text-xs"
          />
        )}
      </div>
    </form>
  );
}
