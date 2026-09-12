import { cn } from "@/lib/utils";

/**
 * Superficie de contenido del look AJE (ver AGENTS.md): `rounded-md` + la
 * sombra sutil de elevación. La sombra es lo que la distingue de la
 * estructura —campos, separadores, filas de una lista densa—, que va con
 * borde de 1px. `overflow-hidden` siempre puesto para
 * que un `border-b` interno (encabezado de panel) no asome por la esquina
 * redondeada — ningún uso actual necesita que algo interno se desborde.
 *
 * `as` cubre los contenedores reales que hoy llevan esta receta a mano:
 * `div` (paneles, filas de lista), `section` (landmark de página), `ul`
 * (lista con `divide-y`), `Link` (fila clicable de vacante/empleo).
 */
export function Card<T extends React.ElementType = "div">({
  as,
  className,
  children,
  ...props
}: {
  as?: T;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children">) {
  const Component = (as ?? "div") as React.ElementType;
  return (
    <Component className={cn("overflow-hidden rounded-md bg-card shadow-elevated", className)} {...props}>
      {children}
    </Component>
  );
}
