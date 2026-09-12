"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

function PopoverContent({
  className,
  align = "center",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          // Look AJE (AGENTS.md): elevación con sombra, nunca borde de 1px;
          // radio de la escala del proyecto (rounded-lg = --radius-lg), no
          // un radio de Tailwind por default sin relación con esa escala.
          "z-50 w-72 rounded-lg bg-popover p-2 text-popover-foreground shadow-elevated outline-none",
          // Crece DESDE el botón que lo abrió, no desde su propio centro:
          // Radix publica el origen en esa variable y sin ella el menú
          // aparece como salido de ningún lado. (Un diálogo modal es la
          // excepción: no cuelga de ningún disparador y se queda centrado.)
          "origin-[var(--radix-popover-content-transform-origin)]",
          // Sale más rápido de lo que entra: al abrir el usuario todavía está
          // leyendo dónde apareció; al cerrar ya decidió y lo único que
          // quiere es que se quite de encima.
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-200 data-[state=open]:ease-out",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-125 data-[state=closed]:ease-out",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
