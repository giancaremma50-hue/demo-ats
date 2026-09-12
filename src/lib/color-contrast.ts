/**
 * El acento por defecto: el verde AJE (`--aje-green`, #00B348) bajado en
 * luminosidad al mismo matiz (144°) hasta 5.01:1 contra el fondo blanco. El
 * #00B348 crudo da 2.78 y no sirve para lo que el acento SE USA —texto chico,
 * bordes y anillo de foco—; el verde de marca sin tocar vive en `--primary` y
 * rellena botones. Vive acá y no en `actions.ts` porque ese archivo es
 * `"use server"` y esto lo necesitan también componentes de cliente.
 */
export const DEFAULT_ACCENT = "#008134";

/** Contraste WCAG entre dos colores hex (#RRGGBB). */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}
