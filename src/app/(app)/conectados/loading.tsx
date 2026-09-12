import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * El feed es la pantalla con la espera más larga del módulo: trae
 * publicaciones, comentarios, encuestas y la gente mencionable en el mismo
 * viaje. Sin esqueleto, entrar a Conectados era una pantalla en blanco.
 *
 * NO dibuja el compositor, aunque la mayoría de la gente lo vea: quién puede
 * publicar depende del permiso (`canPost`), y acá todavía no se sabe. Un
 * placeholder que después desaparece se lee como que algo se quitó; que el
 * compositor APAREZCA empujando la lista hacia abajo se lee como contenido
 * que terminó de cargar, que es lo que de verdad pasó.
 *
 * Las tarjetas van con el radio por defecto de `<Card>`, sin pisarlo: el feed
 * real usa ese mismo componente y cualquier otro radio cambia las esquinas
 * justo en el momento del relevo.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </header>

      {/* `gap-4` y no el `gap-5` de la columna: el feed real anida sus
          tarjetas en su propio contenedor con ese gap, y la diferencia se
          acumula tarjeta a tarjeta justo en el relevo. */}
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 flex-none rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[85%]" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
