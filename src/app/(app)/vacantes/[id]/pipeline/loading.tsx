import { Skeleton } from "@/components/ui/skeleton";

/**
 * Replica la geometría del tablero real, no solo su forma: el mismo escape a
 * todo el ancho (`mx-[calc(50%-50vw)]` + los gutters de `<main>`), el mismo
 * alto (`calc(100dvh - 13.5rem)`) y columnas flexibles como las de
 * `KanbanColumn`, no de 256px fijos. Con anchos fijos y dentro del `max-w-6xl`
 * de `<main>`, el relevo movía las columnas de lugar y cambiaba el alto de
 * golpe — y en un teléfono cuatro columnas de 256 medían 1072px, que el
 * `overflow-x: hidden` de `html` recortaba sin dejar barra.
 */
export default function PipelineLoading() {
  return (
    <div className="mx-[calc(50%-50vw)] flex h-[calc(100dvh-13.5rem)] flex-col px-4 sm:px-6 lg:px-10">
      <div className="flex-none pb-4">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="mt-2 h-4 w-48 max-w-full" />
      </div>
      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-full min-w-[150px] max-w-[420px] flex-1" />
        ))}
      </div>
    </div>
  );
}
