"use client";

import { Copy } from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";

export function CopyLoginLink({ url }: { url: string }) {
  return (
    <ActionButton
      type="button"
      variant="secondary"
      className="h-9 gap-2 px-3.5 text-xs font-medium"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          notifySuccess("Enlace copiado");
        } catch {
          notifyError("No se pudo copiar", "Copia el enlace manualmente: " + url);
        }
      }}
    >
      <Copy className="size-3.5" aria-hidden />
      Copiar enlace de acceso
    </ActionButton>
  );
}
