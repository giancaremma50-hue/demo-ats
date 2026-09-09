import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
import { JobStatusBadge } from "@/components/vacantes/job-status-badge";
import type { JobAuditLogRow } from "@/lib/audit/get-job-audit-log";
import { JobStatusSchema } from "@/lib/jobs/schema";
import type { JobStatus } from "@/lib/jobs/get-jobs";

/** "Bitácora dentro de la vacante" — la única bitácora que queda en la app; la pestaña global de Configuración se quitó (Fase 18). */
export function JobAuditLog({ entries }: { entries: JobAuditLogRow[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Bitácora</h2>
      <div className="mt-3 flex flex-col gap-3">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              {entry.action === "job_status_changed" && isStatusDiff(entry.diff) ? (
                <span className="flex items-center gap-1.5">
                  <JobStatusBadge status={entry.diff.antes} />
                  <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                  <JobStatusBadge status={entry.diff.despues} />
                </span>
              ) : (
                <span className="font-mono rounded-sm bg-muted px-1.5 py-0.5 text-xs">{entry.action}</span>
              )}
              <span className="text-muted-foreground">{entry.actor?.display_name ?? "Sistema"}</span>
            </div>
            <span className="flex-none tabular-nums text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: es })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// Derivada del enum, NO copiada a mano. La versión anterior era una lista
// literal y se quedó vieja: `aceptada` se agregó al enum el 2026-09-03 y nadie
// la sumó acá, así que toda transición que pasara por ese estado fallaba este
// chequeo y caía al fallback que pinta el nombre técnico crudo
// ("job_status_changed" en monoespaciada) en vez de las dos insignias. El
// usuario lo reportó como "se ve feo"; era una lista blanca desincronizada.
// Así no puede volver a pasar: agregar un valor al enum lo incluye solo.
const VALID_STATUSES: ReadonlySet<JobStatus> = new Set(JobStatusSchema.options);

// Solo comprobar que existan las claves "antes"/"despues" no alcanza — si
// algún día otro trigger reusara esta misma forma para una acción distinta
// con valores que no son JobStatus, <JobStatusBadge> los buscaría en un
// mapa que no los tiene (sin romper, pero mostrando una insignia vacía).
function isStatusDiff(diff: unknown): diff is { antes: JobStatus; despues: JobStatus } {
  return (
    typeof diff === "object" &&
    diff !== null &&
    "antes" in diff &&
    "despues" in diff &&
    VALID_STATUSES.has((diff as { antes: unknown }).antes as JobStatus) &&
    VALID_STATUSES.has((diff as { despues: unknown }).despues as JobStatus)
  );
}
