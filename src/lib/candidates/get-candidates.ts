import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sanitizeIlikeTerm } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";
import type { z } from "zod";
import type { CandidateFiltersSchema } from "./schema";

export type CandidateFilters = z.infer<typeof CandidateFiltersSchema>;

export type CandidateRow = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string | null;
  stageName: string | null;
  status: Database["public"]["Enums"]["application_status"];
  rating: number | null;
  appliedAt: string;
};

const PAGE_LIMIT = 100;
// Cuando hay filtro de etapa, el recorte de la consulta pasa ANTES del
// filtro (ver comentario abajo) — se pide una ventana más grande para que
// filtrar después en memoria no se quede corto contra postulaciones reales
// que existían más allá de las primeras 100. No elimina el límite teórico
// (una organización con miles de postulaciones activas de una sola etapa
// puede seguir superándolo), pero lo hace mucho menos probable en la
// práctica sin tocar el join delicado de `job_stages`. Hallado en la
// auditoría de performance.
const RAW_LIMIT_WITH_STAGE_FILTER = PAGE_LIMIT * 5;

/**
 * Cursor keyset con desempate por `id`, no solo `applied_at`: varias
 * postulaciones sembradas en el mismo INSERT en lote (o simplemente
 * guardadas en la misma transacción) pueden compartir el mismo
 * `applied_at` exacto — con un cursor de una sola columna, `.lt()` estricto
 * nunca vuelve a igualar ese valor, así que cualquier fila con ese mismo
 * `applied_at` que no saliera ya en la página anterior desaparecía para
 * siempre de las siguientes. `id` no tiene orden cronológico real, pero no
 * hace falta — solo tiene que ser estable. Hallado en code-review.
 */
export type CandidateCursor = { appliedAt: string; id: string };

/** Un solo parámetro de URL (`?cursor=`) en vez de dos, para no ensuciar el resto de los query params de la página. */
export function encodeCandidateCursor(cursor: CandidateCursor): string {
  return `${cursor.appliedAt}|${cursor.id}`;
}

/** `undefined` ante cualquier valor roto (alguien lo escribió a mano) — el llamador simplemente no manda cursor, no hace falta un error. */
export function decodeCandidateCursor(raw: string | undefined): CandidateCursor | undefined {
  if (!raw) return undefined;
  const [appliedAt, id] = raw.split("|");
  return appliedAt && id ? { appliedAt, id } : undefined;
}

/** `nextCursor`: cursor de la última fila mostrada, para pedir la página siguiente — `null` cuando ya no queda más. */
export type CandidateRowsResult = { rows: CandidateRow[]; capped: boolean; nextCursor: CandidateCursor | null };

/**
 * RLS ya decide qué postulaciones ve este viewer — este archivo solo arma
 * filtros y columnas. `job_stages` se trae SIN `!inner`: un colaborador
 * sigue viendo la postulación de un referido aunque la vacante ya no le
 * sea visible (RLS de `job_stages`/`jobs` es más estricta que la de
 * `applications`), y forzar el inner join aquí borraría esa fila entera en
 * silencio en vez de solo mostrar la etapa como desconocida — mismo bug ya
 * corregido en Fase 5 con `jobs(title)`. Por la misma razón el filtro de
 * `stage_type` se aplica en JS, nunca con `.eq()` sobre el embed: un filtro
 * de PostgREST sobre una relación no-inner puede excluir la fila entera
 * cuando el embed no calza (por RLS o por el filtro), el mismo problema que
 * forzar `!inner` — no se pudo confirmar lo contrario sin RLS diferenciada
 * de verdad contra la que probarlo en este entorno, así que no se arriesga.
 *
 * `cursor` es paginación real por fecha (keyset, `applied_at`), no parte de
 * `CandidateFilters`/`SegmentSchema` a propósito: un segmento guardado es un
 * conjunto de filtros para volver a aplicar, nunca debe recordar "en qué
 * página se quedó" — se pasa aparte, solo en esta llamada, y nunca viaja al
 * guardar un segmento.
 */
export async function getCandidateRows(filters: CandidateFilters, cursor?: CandidateCursor): Promise<CandidateRowsResult> {
  const supabase = await createClient();
  const rawLimit = filters.stage_type ? RAW_LIMIT_WITH_STAGE_FILTER : PAGE_LIMIT;
  let query = supabase
    .from("applications")
    .select("id, status, rating, applied_at, jobs(title), job_stages(name, type), candidates!inner(full_name, email)")
    .order("applied_at", { ascending: false })
    .order("id", { ascending: false })
    // Una fila de más para saber si sigue habiendo datos más allá de esta
    // ventana sin una segunda consulta de conteo — comparar solo
    // `rows.length === rawLimit` no distingue "quedan exactamente rawLimit"
    // de "queda más", prometiendo una página siguiente vacía justo en el
    // múltiplo exacto. Hallado en code-review.
    .limit(rawLimit + 1);

  if (cursor) {
    // Sin `referencedTable`, esta condición usa la clave de query `or`
    // (a secas) — distinta de la del `.or()` de búsqueda más abajo, que
    // usa `candidates.or` por su `referencedTable`. Dos claves distintas,
    // se combinan con AND sin ambigüedad; no es el mismo `or=` repetido.
    query = query.or(`applied_at.lt.${cursor.appliedAt},and(applied_at.eq.${cursor.appliedAt},id.lt.${cursor.id})`);
  }
  if (filters.job_id) query = query.eq("job_id", filters.job_id);
  if (filters.status) query = query.eq("status", filters.status);

  const term = filters.q?.trim();
  if (term) {
    const safeTerm = sanitizeIlikeTerm(term);
    query = query.or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%`, { referencedTable: "candidates" });
  }

  const { data } = await query;
  const fetched = data ?? [];
  const hasMoreRaw = fetched.length > rawLimit;
  const rows = hasMoreRaw ? fetched.slice(0, rawLimit) : fetched;

  const filtered = filters.stage_type ? rows.filter((a) => a.job_stages?.type === filters.stage_type) : rows;
  const page = filtered.slice(0, PAGE_LIMIT);
  // "Puede haber más" es cierto si la ventana cruda no alcanzó a verlo todo
  // (hasMoreRaw) O si, dentro de lo que sí se trajo, el filtro de etapa dejó
  // más coincidencias que las que entran en una página — este segundo caso
  // se perdía antes (un review lo encontró): con menos de rawLimit filas
  // crudas pero más de PAGE_LIMIT coincidencias reales, `capped` daba
  // `false` y la página siguiente ni se ofrecía.
  const capped = hasMoreRaw || filtered.length > PAGE_LIMIT;
  const last = page[page.length - 1];

  return {
    rows: page.map((a) => ({
      id: a.id,
      candidateName: a.candidates!.full_name,
      candidateEmail: a.candidates!.email,
      jobTitle: a.jobs?.title ?? null,
      stageName: a.job_stages?.name ?? null,
      status: a.status,
      rating: a.rating,
      appliedAt: a.applied_at,
    })),
    capped,
    nextCursor: capped && last ? { appliedAt: last.applied_at, id: last.id } : null,
  };
}
