import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getJobById } from "@/lib/jobs/get-jobs";
import { getJobCollaborators } from "@/lib/jobs/get-collaborators";
import { getKanbanData } from "@/lib/applications/get-applications";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { JobInfoModal } from "@/components/vacantes/job-info-modal";

export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `?candidato=` abre el drawer directo — es a donde redirige /postulaciones/[id], el destino de las notificaciones y de la agenda. */
  searchParams: Promise<{ candidato?: string }>;
}) {
  const { id } = await params;
  const { candidato } = await searchParams;
  await requireProfile();
  const job = await getJobById(id);
  if (!job) notFound();

  const [data, collaborators] = await Promise.all([getKanbanData(id), getJobCollaborators(id)]);

  return (
    // Se sale del ancho centrado de <main> (max-w-6xl) a propósito — el
    // pipeline necesita todo el ancho de la ventana, no el de lectura de
    // una página de texto. calc(100vh - 13.5rem) replica exactamente el
    // encabezado (h-16) + el padding vertical de <main> (pt-10 + pb-28) del
    // layout compartido, para que el tablero llene el alto real disponible
    // sin generar scroll de página (cada columna scrollea la suya). El
    // encabezado (título + buscador) vive DENTRO de KanbanBoard, no acá:
    // así comparten una sola fila y no se pierde una fila entera de alto
    // (título arriba, buscador abajo) del poco espacio vertical fijo que hay.
    // Los gutters replican los de <main>/AppHeader (`px-4 sm:px-6 lg:px-10`):
    // esta página se sale del <main> a 100vw, así que no los hereda — sin el
    // paso `sm` quedaba 8px más adentro que el encabezado en un teléfono.
    <div className="mx-[calc(50%-50vw)] flex h-[calc(100vh-13.5rem)] flex-col px-4 sm:px-6 lg:px-10">
      <KanbanBoard
        jobId={id}
        initialData={data}
        jobTitle={job.title}
        jobInfoModal={<JobInfoModal job={job} collaborators={collaborators} />}
        initialOpenApplicationId={candidato ?? null}
      />
    </div>
  );
}
