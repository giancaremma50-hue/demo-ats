import Link from "next/link";
import type { JobListItem } from "@/lib/jobs/get-jobs";
import { JobStatusBadge } from "./job-status-badge";
import { isDevuelta } from "@/lib/jobs/job-groups";

// Sin pipeline todavía (nadie aceptó la vacante) — ahí sí hace falta el
// detalle clásico (aceptar/editar/publicar), no un tablero vacío.
const NO_PIPELINE_YET = new Set(["borrador", "pendiente_aprobacion"]);

export function JobCard({ job }: { job: JobListItem }) {
  const href = NO_PIPELINE_YET.has(job.status) ? `/vacantes/${job.id}` : `/vacantes/${job.id}/pipeline`;
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/30"
    >
      <div className="min-w-0">
        <p className="font-serif truncate text-lg">{job.title}</p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {job.code} · {job.country ?? "Sin país"} · {job.headcount} {job.headcount === 1 ? "plaza" : "plazas"}
        </p>
      </div>
      {/* Una devuelta es `borrador` en la base, pero mostrarla como "Borrador"
          esconde justo lo que importa: que hay que corregirla y reenviarla. */}
      {isDevuelta(job) ? (
        <span className="inline-flex flex-none items-center rounded-full border border-destructive/40 px-2.5 py-0.5 text-[11px] text-destructive">
          Devuelta — corregir
        </span>
      ) : (
        <JobStatusBadge status={job.status} />
      )}
    </Link>
  );
}
