import { Skeleton } from "@/components/ui/skeleton";

/**
 * El esqueleto del asistente de plantilla de puesto, compartido por sus dos
 * ramas: los seis pasos de edición (`[id]/paso-N`) y la creación (`nueva`).
 * Las dos pintan exactamente la misma forma —navegación lateral de 6 pasos,
 * encabezado, campos— así que un archivo por ruta serían siete lugares donde
 * desincronizarse. Sin esto, `nueva` caía en el esqueleto de la LISTA de
 * plantillas y se veía una tabla convertirse en un formulario de dos columnas.
 */
export function WizardSkeleton() {
  return (
    <div className="mx-auto flex max-w-4xl gap-10">
      <aside className="w-48 flex-none pt-2">
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex-1">
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
      </div>
    </div>
  );
}
