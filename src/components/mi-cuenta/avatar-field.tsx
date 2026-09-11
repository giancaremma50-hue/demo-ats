"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadAvatar, removeAvatar } from "@/lib/profile/actions";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

export function AvatarField({ currentUrl, displayName }: { currentUrl: string | null; displayName: string }) {
  const [state, formAction] = useActionState(uploadAvatar, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      notifySuccess("Foto de perfil actualizada");
      formRef.current?.reset();
    } else if (state?.error) {
      notifyError(state.error);
    }
  }, [state]);

  return (
    <div className="flex items-center gap-4">
      {/* El mismo <Avatar> que el resto de la app: esta es justo la pantalla
          donde se administra la foto, así que tener acá un respaldo distinto
          (iniciales serif grises) del que se ve en el encabezado y en las
          publicaciones (inicial blanca sobre verde) era la inconsistencia
          más confusa posible. */}
      <Avatar
        name={displayName}
        src={currentUrl}
        size={64}
        // Única pantalla donde la foto ES el contenido (no hay nombre al lado
        // que la explique): acá sí se anuncia, y dice si hay foto o no.
        label={currentUrl ? "Tu foto de perfil actual" : "Todavía no tienes foto de perfil"}
      />
      <div className="flex flex-1 flex-col gap-2">
        {/* flex-wrap: un <input type="file"> nativo no se achica por CSS —
            si no cabe junto al botón "Subir", este cae a la línea de abajo
            en vez de cortarse contra el borde en un celular angosto. */}
        <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="max-w-full text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-xs sm:w-[220px]"
          />
          <ActionButton variant="secondary" className="h-8 flex-none px-3 text-xs">
            Subir
          </ActionButton>
        </form>
        {currentUrl && (
          <DeleteButton
            itemLabel="foto de perfil"
            onDelete={removeAvatar}
            successMessage="Foto de perfil eliminada"
            confirmDescription="Volverás a mostrar tus iniciales hasta que subas otra."
            className="h-8 self-start px-3 text-xs"
          />
        )}
      </div>
    </div>
  );
}
