import { Droppable } from "@hello-pangea/dnd";
import { KanbanCard } from "./kanban-card";
import type { KanbanStage, KanbanCard as KanbanCardData } from "@/lib/applications/get-applications";

export function KanbanColumn({
  stage,
  cards,
  totalCount,
  hasMore,
  isLoadingMore,
  onOpenCard,
  onLoadMore,
}: {
  stage: KanbanStage;
  cards: KanbanCardData[];
  /** Total real de la columna en el servidor — puede ser mayor que `cards.length` mientras no se pidió "ver más". */
  totalCount: number;
  /** Si el servidor todavía tiene más filas de esta etapa por servir. */
  hasMore: boolean;
  isLoadingMore: boolean;
  onOpenCard: (applicationId: string) => void;
  onLoadMore: () => void;
}) {
  const ocultas = Math.max(0, totalCount - cards.length);

  return (
    // `min-w` bajo a propósito, no por descuido. Con 240px, seis etapas exigían
    // 6*240 + 5*16 = 1520px y en una pantalla de 1366 solo hay 1286 útiles: la
    // última columna quedaba cortada y aparecía scroll horizontal. Con 150px
    // caben hasta 7 etapas sin scroll en un portátil (flex-1 reparte el sobrante,
    // así que con 6 etapas cada columna termina en ~200px, no en 150). El
    // `overflow-x-auto` del tablero sigue ahí como red para pantallas angostas o
    // pipelines de muchas etapas — no hay un mínimo que haga caber CUALQUIER
    // número de etapas, y preferir el ajuste a la pantalla fue decisión del
    // usuario, pedida dos veces.
    <div className="flex h-full min-w-[150px] max-w-[420px] flex-1 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{stage.name}</p>
        <span className="text-xs tabular-nums text-muted-foreground">{totalCount}</span>
      </div>
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-1 min-h-24 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-background p-2 ${snapshot.isDraggingOver ? "border-foreground/30" : ""}`}
          >
            {cards.map((card, index) => (
              <KanbanCard key={card.id} card={card} index={index} onOpen={onOpenCard} />
            ))}
            {provided.placeholder}
            {/* Después del placeholder: es el hueco que dnd usa al arrastrar, y
                tiene que quedar entre las tarjetas, no debajo de este botón. */}
            {hasMore && (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                aria-busy={isLoadingMore}
                className="rounded-md border border-dashed border-border py-2 text-center text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground disabled:opacity-60"
              >
                {isLoadingMore ? "Cargando…" : `Ver ${ocultas} más`}
              </button>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
