import type { ReactNode } from "react";

/**
 * El armazón del asistente de plantilla de puesto, compartido por sus ocho
 * rutas (`nueva` y `[id]/paso-1..6`) y por el esqueleto.
 *
 * Vive en un solo lugar porque las clases de este armazón ya se editaron dos
 * veces en ocho archivos, y la segunda fue para arreglar el bug que causó la
 * primera: con `flex` a secas y un `aside` de 192px fijos, en un teléfono el
 * formulario quedaba con ~100px y la página entera se salía del ancho.
 *
 * Las tres decisiones que hay acá y no se pueden perder:
 *
 * - **Apilado hasta `md:`.** No `sm:`: a 640px de ventana la columna de
 *   contenido queda en 360px, lo mismo que en un teléfono, así que devolver la
 *   barra lateral ahí no compra nada y cuesta 192px. A 768px quedan 488, que
 *   sí alcanzan.
 * - **`min-w-0` en la columna de contenido.** Un hijo de flex trae
 *   `min-width: auto`, así que sin esto no encoge por debajo de su contenido y
 *   lo empuja fuera del ancho — y `html` recorta el eje X sin barra
 *   (`globals.css`), así que lo que sobra no se recupera ni con scroll.
 * - **La navegación llega por `nav`**, no se construye acá: las rutas pasan la
 *   real (`WizardStepsNav`) y el esqueleto la suya, que no puede saber en qué
 *   paso está porque `[id]/loading.tsx` cubre los seis.
 */
export function WizardLayout({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 md:flex-row md:gap-10">
      <aside className="w-full flex-none md:w-48 md:pt-2">{nav}</aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
