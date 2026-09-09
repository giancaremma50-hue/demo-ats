import type { JobListItem } from "./get-jobs";

/**
 * Los 4 grupos de la lista de vacantes, por LO QUE HAY QUE HACER y no por
 * estado (mockup C, elegido por el usuario 2026-09-09).
 *
 * Agrupar por estado daba siete encabezados para diez vacantes: mucho título y
 * poco contenido. Agrupar por acción da cuatro y contesta "¿qué me toca?" —
 * la insignia de cada tarjeta sigue diciendo el estado exacto, así que no se
 * pierde precisión.
 *
 * "Devuelta" no es un estado del enum: `returnJobRequest` regresa la vacante a
 * `borrador` y escribe `return_reason`. Sin distinguirla, lo único de la lista
 * que le pide algo a quien la solicitó se veía igual que un borrador
 * cualquiera — por eso `return_reason` entró a `JobListItem`.
 */
export type JobGroupKey = "accion" | "proceso" | "sin_enviar" | "historico";

export type JobGroup = {
  key: JobGroupKey;
  titulo: string;
  descripcion: string;
  /** Los cerrados llegan contraídos: son historia, no trabajo pendiente. */
  contraidoPorDefecto: boolean;
  jobs: JobListItem[];
};

/** Una vacante devuelta: volvió a borrador CON una razón escrita. */
export function isDevuelta(job: JobListItem): boolean {
  return job.status === "borrador" && Boolean(job.return_reason);
}

export function groupJobs(jobs: JobListItem[]): JobGroup[] {
  const grupos: JobGroup[] = [
    {
      key: "accion",
      titulo: "Requieren acción",
      descripcion: "Alguien tiene que decidir o corregir algo acá.",
      contraidoPorDefecto: false,
      jobs: [],
    },
    {
      key: "proceso",
      titulo: "En proceso",
      descripcion: "Publicadas o en pausa, recibiendo o esperando candidatos.",
      contraidoPorDefecto: false,
      jobs: [],
    },
    {
      key: "sin_enviar",
      titulo: "Sin enviar",
      descripcion: "Borradores que nadie ha mandado a aprobación.",
      contraidoPorDefecto: false,
      jobs: [],
    },
    {
      key: "historico",
      titulo: "Histórico",
      descripcion: "Cerradas y canceladas.",
      contraidoPorDefecto: true,
      jobs: [],
    },
  ];
  const por = (k: JobGroupKey) => grupos.find((g) => g.key === k)!.jobs;

  for (const job of jobs) {
    // El `switch` es exhaustivo sobre `JobStatus` a propósito: si mañana se
    // agrega un estado al enum, TypeScript marca este archivo en vez de
    // dejarlo caer en un `default` silencioso que lo esconde de la lista.
    switch (job.status) {
      case "borrador":
        por(isDevuelta(job) ? "accion" : "sin_enviar").push(job);
        break;
      case "pendiente_aprobacion":
      case "aceptada":
        por("accion").push(job);
        break;
      case "abierta":
      case "pausada":
        por("proceso").push(job);
        break;
      case "cerrada":
      case "cancelada":
        por("historico").push(job);
        break;
      default: {
        // La guarda de COMPILACIÓN se queda: agregar un valor al enum rompe el
        // typecheck en este archivo, que es el punto. Pero en RUNTIME no se
        // lanza. Si Postgres gana un estado antes de que se regeneren los tipos
        // —exactamente lo que pasó con `aceptada`, el bug que este mismo lote
        // arregla en la bitácora— un `throw` acá tumbaría TODA /vacantes al
        // error boundary. Degradar al histórico deja la vacante visible con su
        // insignia y el aviso queda en el log.
        const _exhaustivo: never = job.status;
        console.warn("[groupJobs] estado de vacante sin grupo asignado", { id: job.id, status: _exhaustivo });
        por("historico").push(job);
        break;
      }
    }
  }

  // Un grupo vacío no se muestra: cuatro encabezados con "0" debajo es
  // exactamente el ruido que este diseño vino a quitar.
  return grupos.filter((g) => g.jobs.length > 0);
}
