import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];
type Permission = Database["public"]["Enums"]["job_collaborator_permission"];

/**
 * Niveles que otorgan escritura, como lista de PERMITIDOS — nunca de negados.
 * El enum de Postgres conserva valores históricos que ya no se asignan (no se
 * pueden borrar valores de un enum), y un valor futuro no debe otorgar
 * escritura por omisión (deny-by-default, AGENTS.md). Este set es el espejo
 * exacto de `private.can_write_application` en SQL — esa función solo acepta
 * `'lectura_escritura'`, así que ningún otro valor va acá (auditoría
 * 2026-09-11: `interviewer`/`approver`/`owner` estaban en este Set sin tener
 * contraparte en el SQL — 0 filas los usan hoy, pero de aparecer una,
 * `canWriteApplication()` habría dicho `true` mientras la base seguía
 * rechazando el `INSERT`/`UPDATE`).
 */
const WRITE_PERMISSIONS = new Set<Permission>(["lectura_escritura"]);

/**
 * De dónde sale el permiso sobre UNA postulación — dos niveles, sin
 * ambigüedad (decisión del usuario, 2026-09-03):
 *
 * - **Decidir** (mover etapa, descartar, contratar, agendar reunión, mensaje
 *   al candidato) = admin/super_admin, o el RECLUTADOR ASIGNADO de esa
 *   vacante (`jobs.owner_id`). Nadie más, ni siquiera quien la solicitó.
 * - **Escribir** (seguimientos, archivos, tareas, calificación de estrellas)
 *   = quien puede decidir, o el solicitante (`jobs.requested_by`), o un
 *   miembro con nivel de lectura y escritura.
 * - **Ver** = lo que ya resuelve `can_access_job` en RLS; acá no se repite.
 *
 * Antes esto no exigía nada: la única rama miraba si el rol era `colaborador`
 * (extinto), así que devolvía `true` para todo el mundo y los niveles de
 * `job_collaborators` eran decorativos. El espejo en SQL
 * (`private.can_decide_application` / `can_write_application`, que usa el
 * trigger de `applications` y las políticas de notas y tareas) se actualizó
 * en la misma migración: si se cambian los umbrales acá, hay que replicarlos
 * allá o se vuelven a desincronizar — fue exactamente el hueco que un review
 * encontró en este cambio.
 */
export type JobPermissions = { canDecide: boolean; canWrite: boolean };

/** Una sola lectura para los dos flags — antes se resolvía dos veces (4 consultas para las mismas 2 filas). */
export async function getApplicationPermissions(
  actorRole: AppRole,
  actorId: string,
  jobId: string,
): Promise<JobPermissions> {
  if (ADMIN_ROLES.has(actorRole)) return { canDecide: true, canWrite: true };

  const supabase = await createClient();
  const [{ data: job }, { data: membership }] = await Promise.all([
    supabase.from("jobs").select("owner_id, requested_by").eq("id", jobId).maybeSingle(),
    supabase.from("job_collaborators").select("permission").eq("job_id", jobId).eq("profile_id", actorId).maybeSingle(),
  ]);

  const isOwner = job?.owner_id === actorId;
  const isRequester = job?.requested_by === actorId;
  const writesAsMember = membership?.permission != null && WRITE_PERMISSIONS.has(membership.permission);

  return { canDecide: isOwner, canWrite: isOwner || isRequester || writesAsMember };
}

/** Mover etapa, descartar, contratar, agendar reunión, mensaje al candidato. */
export async function canDecideApplication(actorRole: AppRole, actorId: string, jobId: string): Promise<boolean> {
  return (await getApplicationPermissions(actorRole, actorId, jobId)).canDecide;
}

/** Seguimientos, archivos, tareas y calificación de estrellas. */
export async function canWriteApplication(actorRole: AppRole, actorId: string, jobId: string): Promise<boolean> {
  return (await getApplicationPermissions(actorRole, actorId, jobId)).canWrite;
}
