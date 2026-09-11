"use client";

import { useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { ConfirmDialog, type ConfirmDialogHandle } from "./confirm-dialog";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { cn } from "@/lib/utils";

/**
 * Todo botón de eliminar es rojo, usa el ícono X, y confirma antes de
 * actuar — regla no negociable. Nunca elimina en un solo clic.
 */
export function DeleteButton({
  itemLabel,
  onDelete,
  successMessage = "Se eliminó correctamente",
  confirmDescription,
  iconOnly = false,
  className,
}: {
  itemLabel: string;
  /** Si resuelve un texto, ese es el mensaje del toast — la regla de
   *  interacción 2 pide que la confirmación la devuelva la mutación y no la
   *  arme el cliente. `successMessage` queda como respaldo para las
   *  mutaciones que no devuelven nada. */
  onDelete: () => Promise<string | void> | void;
  successMessage?: string;
  confirmDescription?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const dialogRef = useRef<ConfirmDialogHandle>(null);
  const [pending, startTransition] = useTransition();
  const [errored, setErrored] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      try {
        const mensaje = await onDelete();
        notifySuccess(mensaje || successMessage);
        dialogRef.current?.close();
      } catch {
        setErrored(true);
        notifyError(
          "No se pudo eliminar",
          "Algo se rompió de nuestro lado. Puedes intentarlo de nuevo.",
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrored(false);
          dialogRef.current?.open();
        }}
        aria-label={iconOnly ? `Eliminar ${itemLabel}` : undefined}
        className={cn(
          iconOnly
            ? "flex size-8 items-center justify-center rounded-full border border-destructive text-destructive"
            : "inline-flex h-[38px] items-center gap-2 rounded-full bg-destructive px-4 text-sm font-semibold text-destructive-foreground shadow-elevated",
          className,
        )}
      >
        <X className="size-3.5" aria-hidden />
        {!iconOnly && <span>Eliminar</span>}
      </button>
      <ConfirmDialog
        ref={dialogRef}
        tone="destructive"
        title={`¿Eliminar ${itemLabel}?`}
        description={`${confirmDescription ?? "Esto no se puede deshacer."}${errored ? " El intento anterior falló — puedes volver a intentarlo." : ""}`}
        confirmLabel="Sí, eliminar"
        onConfirm={handleConfirm}
        pending={pending}
      />
    </>
  );
}
