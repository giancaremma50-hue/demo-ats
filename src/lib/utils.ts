import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Texto comparable: sin acentos, sin mayúsculas, sin espacios al borde.
 *
 * Vive acá porque la usan dos buscadores distintos (candidatos en el kanban,
 * personas en el autocompletado de menciones) y estaba copiada carácter por
 * carácter en los dos. El rango va escapado (`\u0300-\u036f`) y no con las
 * marcas combinantes literales: literales funcionan, pero son invisibles en
 * cualquier editor y una normalización de encoding del archivo las borra sin
 * que nadie note que el filtro dejó de quitar acentos.
 */
export function normalizarTexto(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Un término de búsqueda de usuario, listo para meterse en un patrón ILIKE de
 * PostgREST. Neutraliza sintaxis de filtros de PostgREST (`,()`), comodines
 * de ILIKE (`%_\`) y el alias `*` que PostgREST sustituye por `%` antes de
 * que Postgres vea el patrón — mismo saneo escrito primero para
 * `getCandidateRows` (src/lib/candidates/get-candidates.ts), extraído acá
 * para no copiarlo a mano en cada búsqueda nueva por `ilike`.
 */
export function sanitizeIlikeTerm(term: string): string {
  return term.replace(/[,()*]/g, "").replace(/[%_\\]/g, (c) => `\\${c}`);
}
