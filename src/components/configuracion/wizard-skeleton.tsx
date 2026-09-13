import { Skeleton } from "@/components/ui/skeleton";
import { WizardLayout } from "@/components/configuracion/wizard/wizard-layout";

/**
 * El esqueleto del asistente de plantilla de puesto, compartido por sus dos
 * ramas: los seis pasos de edición (`[id]/paso-N`) y la creación (`nueva`).
 * Las dos pintan exactamente la misma forma —navegación lateral de 6 pasos,
 * encabezado, campos— así que un archivo por ruta serían siete lugares donde
 * desincronizarse. Sin esto, `nueva` caía en el esqueleto de la LISTA de
 * plantillas y se veía una tabla convertirse en un formulario de dos columnas.
 *
 * El armazón sale de `WizardLayout`, el mismo de las rutas: es lo único que
 * garantiza que el relevo no mueva nada de lugar. La navegación va como
 * esqueleto y no como la real porque `[id]/loading.tsx` cubre los seis pasos
 * y no sabe en cuál está.
 */
export function WizardSkeleton() {
  return (
    <WizardLayout
      nav={
        <>
          {/* En teléfono la navegación real es el contador con su barra de
              avance (`WizardStepsNav`), no la columna de seis: seis bloques
              acá harían saltar media pantalla en el relevo. */}
          <div className="md:hidden">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-1 w-full" />
          </div>
          <div className="hidden flex-col gap-3 md:flex">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </>
      }
    >
      <div className="mb-8">
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="mt-2 h-4 w-full max-w-[52ch]" />
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[42px] w-full" />
        <Skeleton className="h-[42px] w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-[42px] w-48" />
      </div>
    </WizardLayout>
  );
}
