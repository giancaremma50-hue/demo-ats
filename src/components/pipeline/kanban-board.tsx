"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { moveApplicationStage } from "@/lib/applications/actions";
import { loadMoreKanbanCards, searchKanbanCards } from "@/lib/applications/kanban-actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { KanbanColumn } from "./kanban-column";
import { CandidateDrawer } from "@/components/postulaciones/candidate-drawer";
import { normalizarTexto } from "@/lib/utils";
import type { KanbanData } from "@/lib/applications/get-applications";

/** Espera esto quieto antes de pedirle al servidor los candidatos que buscar — no en cada tecla. */
const BUSQUEDA_DEBOUNCE_MS = 300;

/**
 * Agrega tarjetas nuevas SIN pisar las que ya están en memoria — nunca
 * reemplaza una entrada existente por id. Usado tanto por la búsqueda
 * (hidrata candidatos fuera de las páginas cargadas) como por "ver más"
 * (puede volver a traer, de la página siguiente, algo que la búsqueda ya
 * había hidratado antes). Si sobrescribiera, un drag optimista recién
 * aplicado a una tarjeta podía perderse contra la foto vieja que trae la
 * búsqueda, y sin dedupe una misma tarjeta terminaba dos veces en el array
 * (misma `key` de React) — los dos, hallados en code-review.
 */
function addMissingCards<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const existingIds = new Set(current.map((c) => c.id));
  const nuevas = incoming.filter((c) => !existingIds.has(c.id));
  return nuevas.length > 0 ? [...current, ...nuevas] : current;
}

export function KanbanBoard({
  jobId,
  initialData,
  jobTitle,
  jobInfoModal,
  initialOpenApplicationId = null,
}: {
  jobId: string;
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
  // Total real y cursor de "ver más" por etapa — separado de `cards` porque
  // el total de una columna sigue siendo válido aunque todavía no se haya
  // cargado ni una sola página extra de esa columna.
  const [stageMeta, setStageMeta] = useState(initialData.stageMeta);
  const [loadingStages, setLoadingStages] = useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = useTransition();
  const [openApplicationId, setOpenApplicationId] = useState<string | null>(initialOpenApplicationId);
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);

  // Filtra por nombre, sin acentos ni mayúsculas, sobre lo que ya está en
  // memoria — instantáneo para lo que ya se cargó. El efecto de abajo, con
  // debounce, hidrata en `cards` lo que todavía no se hubiera cargado (una
  // columna de la que nadie pidió "ver más" todavía).
  const filtro = normalizarTexto(busqueda);
  const buscandoActivo = filtro !== "";
  const visibles = buscandoActivo ? cards.filter((c) => normalizarTexto(c.candidateName).includes(filtro)) : cards;

  useEffect(() => {
    const termino = busqueda.trim();
    if (termino === "") return;

    let cancelado = false;
    const timeout = setTimeout(() => {
      setBuscando(true);
      searchKanbanCards(jobId, termino)
        .then((encontrados) => {
          if (cancelado) return;
          setCards((current) => addMissingCards(current, encontrados));
        })
        .catch(() => {
          if (!cancelado) notifyError("No se pudo completar la búsqueda. Intenta de nuevo.");
        })
        .finally(() => {
          if (!cancelado) setBuscando(false);
        });
    }, BUSQUEDA_DEBOUNCE_MS);

    return () => {
      cancelado = true;
      clearTimeout(timeout);
    };
  }, [busqueda, jobId]);

  const totalActivas = Object.values(stageMeta).reduce((suma, meta) => suma + meta.totalCount, 0);

  async function handleLoadMore(stageId: string) {
    const cursor = stageMeta[stageId]?.nextCursor;
    if (!cursor || loadingStages.has(stageId)) return;

    setLoadingStages((prev) => new Set(prev).add(stageId));
    try {
      const { cards: more, nextCursor } = await loadMoreKanbanCards(jobId, stageId, cursor);
      setCards((current) => addMissingCards(current, more));
      setStageMeta((prev) => ({ ...prev, [stageId]: { totalCount: prev[stageId]?.totalCount ?? more.length, nextCursor } }));
    } catch {
      notifyError("No se pudieron cargar más postulaciones. Intenta de nuevo.");
    } finally {
      setLoadingStages((prev) => {
        const next = new Set(prev);
        next.delete(stageId);
        return next;
      });
    }
  }

  function adjustStageCount(stageId: string, delta: number) {
    setStageMeta((prev) =>
      prev[stageId] ? { ...prev, [stageId]: { ...prev[stageId], totalCount: Math.max(0, prev[stageId].totalCount + delta) } } : prev,
    );
  }

  function moveCard(applicationId: string, fromStageId: string, toStageId: string) {
    setCards((current) => current.map((c) => (c.id === applicationId ? { ...c, stageId: toStageId } : c)));
    adjustStageCount(fromStageId, -1);
    adjustStageCount(toStageId, 1);

    startTransition(async () => {
      const res = await moveApplicationStage(applicationId, fromStageId, toStageId);
      if (res.error) {
        // Revierte SOLO este movimiento, nunca un snapshot completo de
        // antes: restaurar `cards`/`stageMeta` tal como estaban al empezar
        // este drag pisaría cualquier OTRO drag que haya terminado mientras
        // este seguía en vuelo (dos arrastres casi seguidos, el primero
        // falla tarde). Hallado en code-review.
        setCards((current) => current.map((c) => (c.id === applicationId ? { ...c, stageId: fromStageId } : c)));
        adjustStageCount(fromStageId, 1);
        adjustStageCount(toStageId, -1);
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
              <p className="mt-1 text-sm text-muted-foreground">{totalActivas} postulaciones activas</p>
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
              {buscandoActivo && (
                <span className="flex-none text-xs tabular-nums text-muted-foreground">
                  {buscando ? "Buscando…" : `${visibles.length} de ${totalActivas}`}
                </span>
              )}
              {jobInfoModal}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4">
            {initialData.stages.map((stage) => {
              // Ordenadas por fecha SIEMPRE, no solo confiadas al orden de
              // llegada del array: una tarjeta hidratada por búsqueda (de
              // una página que nadie había cargado) se agrega al final de
              // `cards`, no en su lugar cronológico — sin este sort quedaría
              // fuera de orden entre las demás de su columna.
              const stageCards = visibles.filter((c) => c.stageId === stage.id).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
              const meta = stageMeta[stage.id];
              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  cards={stageCards}
                  // Mientras se busca ya se tiene el universo completo que
                  // calza (searchKanbanCards no pagina) — el total de la
                  // columna pasa a ser lo que se ve, sin "ver más".
                  totalCount={buscandoActivo ? stageCards.length : (meta?.totalCount ?? stageCards.length)}
                  hasMore={buscandoActivo ? false : !!meta?.nextCursor}
                  isLoadingMore={loadingStages.has(stage.id)}
                  onOpenCard={setOpenApplicationId}
                  onLoadMore={() => handleLoadMore(stage.id)}
                />
              );
            })}
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
        onDiscarded={(applicationId) => {
          const card = cards.find((c) => c.id === applicationId);
          setCards((current) => current.filter((c) => c.id !== applicationId));
          if (card) adjustStageCount(card.stageId, -1);
        }}
      />
    </>
  );
}
