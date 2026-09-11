"use server";

import { createClient } from "@/lib/supabase/server";
import { sanitizeIlikeTerm } from "@/lib/utils";
import { KANBAN_CARD_SELECT, KANBAN_PAGE_SIZE, toKanbanCard, type KanbanCard } from "./get-applications";

/**
 * La página siguiente de UNA columna del kanban — ver KANBAN_PAGE_SIZE en
 * get-applications.ts sobre por qué es una consulta por etapa.
 *
 * Pide una fila DE MÁS (`KANBAN_PAGE_SIZE + 1`) para saber si queda más sin
 * una segunda consulta de conteo: comparar solo `cards.length ===
 * KANBAN_PAGE_SIZE` prometía "ver más" incluso cuando el resto era
 * exactamente una página completa y no quedaba nada detrás — hallado en
 * code-review, la fila de más lo evita sin un round-trip extra.
 */
export async function loadMoreKanbanCards(
  jobId: string,
  stageId: string,
  cursor: string,
): Promise<{ cards: KanbanCard[]; nextCursor: string | null }> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("applications")
    .select(KANBAN_CARD_SELECT)
    .eq("job_id", jobId)
    .eq("status", "activa")
    .eq("stage_id", stageId)
    .lt("applied_at", cursor)
    .order("applied_at", { ascending: false })
    .limit(KANBAN_PAGE_SIZE + 1);

  const fetched = (rows ?? []).map(toKanbanCard);
  const hasMore = fetched.length > KANBAN_PAGE_SIZE;
  const cards = hasMore ? fetched.slice(0, KANBAN_PAGE_SIZE) : fetched;
  const nextCursor = hasMore ? cards[cards.length - 1].appliedAt : null;
  return { cards, nextCursor };
}

/**
 * Buscar por nombre entre TODAS las postulaciones activas de la vacante, no
 * solo las ya cargadas — con paginación real por columna, filtrar en el
 * cliente ya no ve a alguien que quedó en la página 4 de una columna que
 * nadie expandió. Sin tope de página: un nombre buscado a propósito suele dar
 * pocos resultados, y el kanban ya no necesita levantar 1000 tarjetas para
 * mostrarlos.
 */
export async function searchKanbanCards(jobId: string, query: string): Promise<KanbanCard[]> {
  const term = query.trim();
  if (!term) return [];

  const supabase = await createClient();
  const safeTerm = sanitizeIlikeTerm(term);

  // Literal, no derivado de KANBAN_CARD_SELECT con un .replace(): el tipo que
  // infiere supabase-js sale de parsear el string de `select` en tiempo de
  // compilación — una versión armada en runtime (aunque el resultado sea
  // idéntico) pierde esa inferencia y todo lo de abajo pasa a `any`.
  const { data: rows } = await supabase
    .from("applications")
    .select("id, stage_id, rating, applied_at, candidates!inner(id, full_name)")
    .eq("job_id", jobId)
    .eq("status", "activa")
    .ilike("candidates.full_name", `%${safeTerm}%`)
    .order("applied_at", { ascending: false });

  return (rows ?? []).map(toKanbanCard);
}
