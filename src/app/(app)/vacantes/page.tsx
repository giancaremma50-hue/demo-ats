import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { getJobsForViewer } from "@/lib/jobs/get-jobs";
import { JobGroupsList } from "@/components/vacantes/job-groups-list";

export default async function VacantesPage() {
  // Sin asignar: acá `requireProfile()` es solo la puerta (redirige si no hay
  // perfil o está inactivo). Ya no hace falta el rol para decidir qué mostrar
  // — los 3 roles que existen pueden solicitar una vacante: el gestor la pide,
  // admin y super admin la crean ya aceptada (ver createJob).
  await requireProfile();
  const jobs = await getJobsForViewer();

  return (
    <div>
      {/* `flex-wrap` + `gap`: el título es una sola palabra y no envuelve,
          así que sin esto el control de la derecha se iba fuera de la
          pantalla — y `html` recorta el eje X sin barra. El `min-w-0` va
          con `break-words`: solo, deja que el título se recorte en silencio
          en vez de desbordarse. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="min-w-0 font-black tracking-display text-[32px] break-words">Vacantes</h1>
        <Link
          href="/vacantes/nueva"
          className="inline-flex h-10 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-medium whitespace-nowrap text-accent-foreground"
        >
          Solicitar vacante
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">Todavía no hay vacantes para mostrar.</p>
          <Link href="/vacantes/nueva" className="text-sm font-medium text-accent underline">
            Solicitar la primera vacante
          </Link>
        </div>
      ) : (
        <JobGroupsList jobs={jobs} />
      )}
    </div>
  );
}
