import { cn } from "@/lib/utils";

/**
 * Recordatorio de procedencia junto a cada campo de subida de marca.
 *
 * Es lo único que el software puede hacer por el copyright de las imágenes:
 * verificar de dónde salió un archivo subido no es algo que el código pueda
 * comprobar. La auditoría de 2026-09-08 encontró el proyecto limpio (fuentes
 * OFL, iconos ISC, `public/` vacía, cero stock), así que el riesgo es
 * enteramente futuro — entra con lo que suba el cliente.
 *
 * En un solo componente y no repetido en cada campo: la frase la comparten
 * los 5 puntos de subida de `/configuracion/marca` y así no se desvía.
 *
 * Tenía una variante `dark` para el único campo que se dibujaba sobre fondo
 * de color (el logo para fondo oscuro). Ese campo se quitó el 2026-09-11 y
 * con él la variante: todos los campos que quedan van sobre `bg-background`.
 */
export function LicenseNote({ id, className }: { id?: string; className?: string }) {
  return (
    <p id={id} className={cn("text-[11px] leading-snug text-muted-foreground/80", className)}>
      Sube solo material propio o con licencia de uso comercial.
    </p>
  );
}
