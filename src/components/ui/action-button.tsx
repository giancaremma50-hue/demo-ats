"use client";

import { forwardRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground border-transparent shadow-elevated hover:opacity-90",
  secondary: "bg-card text-foreground border-border hover:bg-muted",
  ghost: "bg-transparent text-muted-foreground border-transparent hover:bg-muted",
  destructive:
    "bg-destructive text-destructive-foreground border-transparent shadow-elevated hover:opacity-90",
};

/**
 * Todo botón que muta datos usa este componente — regla no negociable.
 * Cuando vive dentro de un <form action={serverAction}>, el estado de
 * carga sale de useFormStatus() y no hay que pasarlo a mano.
 */
export const ActionButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    pending?: boolean;
    pendingLabel?: string;
  }
>(function ActionButton(
  { variant = "primary", pending, pendingLabel, className, children, disabled, type = "submit", ...props },
  ref,
) {
  const formStatus = useFormStatus();
  const isPending = pending ?? formStatus.pending;

  return (
    <button
      ref={ref}
      type={type}
      aria-busy={isPending}
      disabled={disabled || isPending}
      className={cn(
        "inline-flex h-[42px] items-center justify-center gap-2 rounded-full border px-6 text-sm font-semibold",
        // Se hunde al presionar. Sin esto, entre el clic y la respuesta del
        // servidor no pasa NADA en pantalla y el usuario no sabe si la
        // interfaz lo escuchó — y este es el botón de toda mutación, así que
        // es el hueco que más veces al día se vive. 150ms con la curva fuerte
        // del proyecto; `active:` no dispara en un botón deshabilitado, así
        // que mientras corre la acción se queda quieto, que es lo correcto.
        // Se nombra `scale` y NO `transform`: Tailwind v4 compila `scale-*` a
        // la propiedad independiente `scale`, así que una transición sobre
        // `transform` no la toca y el botón saltaría de golpe.
        "transition-[scale,opacity] duration-150 ease-out active:scale-[0.97]",
        // Con `prefers-reduced-motion` no se encoge: la regla global deja la
        // duración en 0.01ms, que apaga la curva pero no el `scale`, así que
        // el botón daría un salto seco. El feedback sigue existiendo, sin
        // desplazamiento — que es lo que pide "menos movimiento, no cero".
        "motion-reduce:active:scale-100 motion-reduce:active:opacity-80",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
});
