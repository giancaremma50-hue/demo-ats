import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getJobById } from "@/lib/jobs/get-jobs";
import { getJobCollaborators, getAddableProfiles } from "@/lib/jobs/get-collaborators";
import { getOrgAdmins } from "@/lib/jobs/get-team-options";
import { canEditJob, TERMINAL_JOB_STATUSES } from "@/lib/jobs/permissions";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import { JobStatusBadge } from "@/components/vacantes/job-status-badge";
import { ApprovalActions } from "@/components/vacantes/approval-actions";
import { ReferCandidateDialog } from "@/components/vacantes/refer-candidate-dialog";
import { CollaboratorsPanel } from "@/components/vacantes/collaborators-panel";
import { NotifyOnMount } from "@/components/ui/notify-on-mount";
import { CopyJobLink } from "@/components/vacantes/copy-job-link";
import { JobAuditLog } from "@/components/vacantes/job-audit-log";
import { getJobAuditLog } from "@/lib/audit/get-job-audit-log";
import { getEmailContext } from "@/lib/notifications/notify";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL, VISIBILITY_LABEL } from "@/lib/jobs/schema";
import type { WorkMode, EmploymentType } from "@/lib/jobs/schema";

export default async function VacanteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creada?: string }>;
}) {
  const { id } = await params;
  const { creada } = await searchParams;
  const profile = await requireProfile();
  const job = await getJobById(id);

  if (!job) notFound();

  // Vale la pena solo si el link de verdad funciona hoy — /api/postular
  // exige exactamente esta misma combinación (status "abierta" + visibilidad pública).
  const showPublicLink = job.status === "abierta" && job.visibility === "publica" && job.slug;
  const publicUrl = showPublicLink ? `${(await getEmailContext()).siteUrl}/empleos/${job.slug}` : null;

  // Referir depende del estado de la vacante, no del rol: RLS (jobs_select_*)
  // ya decide quién llega a ver esta página.
  const canRefer = !TERMINAL_JOB_STATUSES.has(job.status);
  const canEdit = canEditJob(profile.role, profile.id, job);
  const canManageCollaborators = ADMIN_ROLES.has(profile.role);
  const [collaborators, addable, auditEntries, admins] = await Promise.all([
    canManageCollaborators ? getJobCollaborators(job.id) : Promise.resolve([]),
    canManageCollaborators ? getAddableProfiles(job.id, job.organization_id) : Promise.resolve([]),
    // RLS (audit_log_select) ya filtra a quien tenga acceso real a esta
    // vacante — un colaborador sin ese acceso recibe [] directo de la
    // base, no hace falta acotar por rol acá también.
    getJobAuditLog(job.id),
    // Solo hace falta para los selectores de aceptar/publicar (elegir
    // encargado) — nadie más los ve.
    canManageCollaborators ? getOrgAdmins(job.organization_id) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      {creada && <NotifyOnMount message="Vacante creada" />}
      {/* `sm:flex-nowrap`: el corte de línea de flex usa el tamaño
          max-content de cada ítem, que `min-w-0` NO baja — sin esto un título
          largo hacía saltar el estado y el "Editar" a una segunda línea
          también en escritorio, y ahí `justify-between` los deja pegados a la
          izquierda. Envolver es para el teléfono. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 sm:flex-nowrap">
        <div className="min-w-0">
          <p className="text-xs tabular-nums text-muted-foreground">{job.code}</p>
          {/* `break-words` NO encoge a un hijo de flex por su cuenta:
              `overflow-wrap: break-word` no baja el tamaño min-content, que en
              flex es el mínimo automático. Sin el `min-w-0` del contenedor (la
              línea de arriba) la fila no encoge y el estado y el "Editar" quedan
              fuera de la pantalla. Los dos juntos, o ninguno sirve. */}
          <h1 className="font-black tracking-display mt-1.5 text-[28px] leading-tight break-words min-[400px]:text-[34px]">
            {job.title}
          </h1>
        </div>
        {/* `shrink-0`: la acción no encoge; lo que se adapta es la columna
            del título (AGENTS.md, responsividad). */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <JobStatusBadge status={job.status} />
          {canEdit && (
            <Link href={`/vacantes/${job.id}/editar`} className="text-xs text-muted-foreground underline">
              Editar
            </Link>
          )}
        </div>
      </div>

      {job.status === "borrador" && job.return_reason && (
        <div className="mt-6 border-l-2 border-[#9A6B1F] bg-[#9A6B1F]/5 p-4">
          <p className="text-[11px] tracking-[0.06em] text-[#9A6B1F] uppercase">RH devolvió esta solicitud</p>
          <p className="mt-1.5 text-sm leading-relaxed">{job.return_reason}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Corrige lo señalado y vuelve a enviarla a aprobación.
          </p>
        </div>
      )}

      {publicUrl && (
        <div className="mt-6">
          <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Link público</p>
          <p className="mt-1 mb-2 text-xs text-muted-foreground">
            Para publicar donde ya publiquen hoy — LinkedIn, Computrabajo, u otra bolsa.
          </p>
          <CopyJobLink url={publicUrl} />
        </div>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border py-6 text-sm sm:grid-cols-3">
        <Item label="País" value={job.country ?? "—"} />
        <Item label="Ubicación" value={job.location ?? "—"} />
        <Item label="Modalidad" value={job.work_mode ? WORK_MODE_LABEL[job.work_mode as WorkMode] : "—"} />
        <Item
          label="Tipo de contrato"
          value={job.employment_type ? EMPLOYMENT_TYPE_LABEL[job.employment_type as EmploymentType] : "—"}
        />
        <Item label="Plazas" value={String(job.headcount)} />
        <Item
          label="Rango salarial"
          value={
            job.salary_min || job.salary_max
              ? `${job.salary_min ?? "?"} – ${job.salary_max ?? "?"}`
              : "No especificado"
          }
        />
        <Item label="Visibilidad" value={VISIBILITY_LABEL[job.visibility]} />
      </dl>

      <section className="mt-8">
        <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Descripción</h2>
        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed">{job.description}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Requisitos</h2>
        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed">{job.requirements}</p>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-2.5 border-t border-border pt-6">
        <ApprovalActions job={job} role={profile.role} actorId={profile.id} admins={admins} />
        {canRefer && <ReferCandidateDialog jobId={job.id} />}
        {!["borrador", "pendiente_aprobacion"].includes(job.status) && (
          <Link href={`/vacantes/${job.id}/pipeline`} className="text-sm font-medium text-accent underline">
            Ver pipeline
          </Link>
        )}
      </div>

      {canManageCollaborators && (
        <CollaboratorsPanel
          jobId={job.id}
          collaborators={collaborators}
          addable={addable}
          admins={admins}
          ownerId={job.owner_id}
          requesterId={job.requested_by}
        />
      )}

      <JobAuditLog entries={auditEntries} />
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 tabular-nums">{value}</dd>
    </div>
  );
}
