"use client";

import { useState, useTransition } from "react";
import { uploadAvatar, removeAvatar } from "@/lib/profile/actions";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  avatarHint,
  avatarRejectionMessage,
} from "@/lib/profile/avatar-fields";
import { Avatar } from "@/components/ui/avatar";
import { MediaPicker } from "@/components/ui/media-picker";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

export function AvatarField({ currentUrl, displayName }: { currentUrl: string | null; displayName: string }) {
  const [subiendo, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);

  /** Vacía el cuadro: olvida el archivo elegido y borra el "Guardado" de la
   * subida anterior. Va en TODA salida por rechazo — dejar "Guardado" al lado
   * de un mensaje de error es la peor combinación posible. */
  function descartar() {
    setPickerKey((k) => k + 1);
    setGuardado(false);
  }

  // Ver el comentario equivalente en BrandMediaField: al llegar la URL nueva
  // del servidor, el cuadro vuelve a "idle" en vez de quedarse en "Guardado"
  // con la vista previa local pegada.
  const [urlVista, setUrlVista] = useState(currentUrl);
  if (currentUrl !== urlVista) {
    setUrlVista(currentUrl);
    if (guardado) descartar();
  }

  // Se sube al elegir, sin un segundo botón que se pueda olvidar (regla de
  // diseño 8). La acción se llama directo con un FormData armado acá, en vez
  // de un `<form action>` + `requestSubmit()`: el input se limpia en cada
  // cambio (para poder reelegir el mismo archivo) y eso dejaría el formulario
  // sin archivo que enviar, dependiendo de un orden de eventos muy frágil.
  //
  // La foto de perfil sí puede viajar dentro de la Server Action: su tope
  // propio (3 MB) está por debajo del límite de cuerpo de Vercel, y las dos
  // guardias de abajo lo cortan en el cliente ANTES de mandar nada — que es
  // lo que evita el fallo mudo cuando alguien elige una foto de 8 MB del
  // carrete (ver `createBrandUploadUrl` para el caso de marca).
  function elegir(file: File | null) {
    if (!file) return;
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      notifyError(avatarRejectionMessage("formato"));
      descartar();
      return;
    }
    if (file.size <= 0) {
      notifyError(avatarRejectionMessage("vacio"));
      descartar();
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      notifyError(avatarRejectionMessage("tamano"));
      descartar();
      return;
    }

    setGuardado(false);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      try {
        const resultado = await uploadAvatar(undefined, formData);
        if (resultado?.error) {
          notifyError(resultado.error);
          descartar();
          return;
        }
        notifySuccess(resultado?.success ?? "Foto de perfil actualizada");
        // Sin descartar(): la vista previa local se queda hasta que la
        // revalidación traiga la URL nueva.
        setGuardado(true);
      } catch {
        notifyError("No se pudo subir la foto", "Algo se rompió de nuestro lado. Puedes intentarlo de nuevo.");
        descartar();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <MediaPicker
        key={pickerKey}
        label="Foto de perfil"
        labelHidden
        hint={avatarHint()}
        accept={AVATAR_MIME_TYPES.join(",")}
        currentUrl={currentUrl}
        shape="circle"
        // Sin foto, las iniciales sobre el verde de marca — el MISMO respaldo
        // que el encabezado y las publicaciones. Un ícono genérico acá, justo
        // en la pantalla donde se administra la foto, era la inconsistencia
        // más confusa posible (ver .claude/napkin.md, 2026-09-11).
        fallback={<Avatar name={displayName} src={null} size={64} />}
        status={subiendo ? "subiendo" : guardado ? "guardado" : "idle"}
        onSelect={elegir}
      />
      {currentUrl && !subiendo && (
        <DeleteButton
          itemLabel="foto de perfil"
          onDelete={async () => {
            const mensaje = await removeAvatar();
            descartar();
            return mensaje;
          }}
          confirmDescription="Volverás a mostrar tus iniciales hasta que subas otra."
          className="h-8 self-start px-3 text-xs"
        />
      )}
    </div>
  );
}
