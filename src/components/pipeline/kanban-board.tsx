"use client";

import { useState, useTransition, type ReactNode } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { moveApplicationStage } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { KanbanColumn } from "./kanban-column";
import { CandidateDrawer } from "@/components/postulaciones/candidate-drawer";
import { normalizarTexto } from "@/lib/utils";
import type { KanbanData } from "@/lib/applications/get-applications";

export function KanbanBoard({
  initialData,
  jobTitle,
  jobInfoModal,
  initialOpenApplicationId = null,
}: {
  initialData: KanbanData;
  jobTitle: string;
  jobInfoModal: ReactNode;
  /**
   * Candidato a abrir al entrar, desde `?candidato=` — se abre aunque su
   * tarjeta NO esté en el tablero: el kanban solo trae postulaciones
   * activas, así que un enlace viejo a alguien ya contratado o descartado
   * igual tiene que poder abrirse (el drawer pide sus propios datos por id).
   * En ese caso solo queda oculto "Siguiente etapa", que sí necesita la
   * etapa actual del tablero.
   */
  initialOpenApplicationId?: string | null;
}) {
  const [cards, setCards] = useState(initialData.cards);
  const [, startTransition] = useTransition();
  const [openApplicationId, setOpenApplicationId] = useState<string | null>(initialOpenApplicationId);
  const [busqueda, setBusqueda] = useState("");
  // Qué columnas ya pidieron "ver más". Un Set en el tablero y no estado dentro
  // de cada columna: así arrastrar una tarjeta (que re-renderiza las columnas)
  // no colapsa las que el usuario ya había abierto.
  const [expandidas, setExpandidas] = useState<ReadonlySet<string>>(new Set());

  // Filtra por nombre, sin acentos ni mayúsculas. Con cientos de candidatos,
  // arrastrar no es cómo se encuentra a alguien — se escribe su nombre.
  const filtro = normalizarTexto(busqueda);
  const visibles =
    filtro === "" ? cards : cards.filter((c) => normalizarTexto(c.candidateName).includes(filtro));

  function moveCard(applicationId: string, fromStageId: string, toStageId: string) {
    const previousCards = cards;
    setCards((current) => current.map((c) => (c.id === applicationId ? { ...c, stageId: toStageId } : c)));

    startTransition(async () => {
      const res = await moveApplicationStage(applicationId, fromStageId, toStageId);
      if (res.error) {
        setCards(previousCards);
        notifyError(res.error);
      } else {
        notifySuccess(res.success ?? "Etapa actualizada");
      }
    });
  }

  function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    moveCard(draggableId, source.droppableId, destination.droppableId);
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex h-full flex-col">
          <div className="flex flex-none items-start justify-between gap-4 pb-4">
            <div>
              <h1 className="font-serif text-[28px]">{jobTitle}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{cards.length} postulaciones activas</p>
            </div>
            <div className="flex flex-none items-center gap-3">
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar candidato por nombre…"
                aria-label="Buscar candidato por nombre"
                className="h-9 w-56 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
              />
              {filtro !== "" && (
                <span className="flex-none text-xs tabular-nums text-muted-foreground">
                  {visibles.length} de {cards.length}
                </span>
              )}
              {jobInfoModal}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4">
            {initialData.stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                cards={visibles.filter((c) => c.stageId === stage.id)}
                onOpenCard={setOpenApplicationId}
                // El tope se aplica SIEMPRE, también con filtro. La versión
                // anterior lo desactivaba al buscar, asumiendo "ya son pocas"
                // — falso en el estado más común de escribir un nombre: con
                // 900 tarjetas, la primera letra casa con casi todas, así que
                // el filtro montaba 900 <Draggable> de golpe en cada
                // pulsación. Justo lo que el tope vino a evitar. El contador
                // "N de M" y el botón "Ver N más" ya dicen que hay más.
                expandido={expandidas.has(stage.id)}
                onExpandir={() => setExpandidas((prev) => new Set(prev).add(stage.id))}
              />
            ))}
          </div>
        </div>
      </DragDropContext>

      <CandidateDrawer
        key={openApplicationId ?? "closed"}
        applicationId={openApplicationId}
        onClose={() => setOpenApplicationId(null)}
        jobTitle={jobTitle}
        stages={initialData.stages}
        currentStageId={cards.find((c) => c.id === openApplicationId)?.stageId ?? null}
        onStageChange={(applicationId, fromStageId, toStageId) => moveCard(applicationId, fromStageId, toStageId)}
        onDiscarded={(applicationId) => setCards((current) => current.filter((c) => c.id !== applicationId))}
      />
    </>
  );
}
