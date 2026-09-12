"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { JobCard } from "./job-card";
import { groupJobs, type JobGroupKey } from "@/lib/jobs/job-groups";
import type { JobListItem } from "@/lib/jobs/get-jobs";

/**
 * La lista de vacantes en cuatro grupos contraíbles.
 *
 * Cliente solo por el contraer/expandir — el agrupado es una función pura
 * (`groupJobs`) que también corre en el servidor si algún día hace falta. El
 * estado de cada grupo es por sesión y por persona, nada se guarda: es una
 * preferencia de lectura, no un ajuste del producto.
 */
export function JobGroupsList({ jobs }: { jobs: JobListItem[] }) {
  const grupos = groupJobs(jobs);
  /**
   * Los grupos que el usuario ALTERNÓ, no los que están cerrados.
   *
   * La versión anterior sembraba el estado con los grupos contraídos del primer
   * render, y el inicializador de `useState` solo corre al montar: si al entrar
   * no había ninguna vacante cerrada, "Histórico" no existía, el Set nacía
   * vacío, y cuando ese grupo apareciera después (un `router.refresh()`, o al
   * cerrar una vacante) se habría mostrado EXPANDIDO pese a su
   * `contraidoPorDefecto`. Guardando lo que el usuario tocó, el default se
   * respeta siempre y su elección también.
   */
  const [alternados, setAlternados] = useState<ReadonlySet<JobGroupKey>>(new Set());

  function alternar(key: JobGroupKey) {
    setAlternados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(key)) siguiente.delete(key);
      else siguiente.add(key);
      return siguiente;
    });
  }

  return (
    <div className="mt-8 flex flex-col gap-7">
      {grupos.map((grupo) => {
        // Sin tocar: manda el default del grupo. Tocado: lo contrario.
        const abierto = alternados.has(grupo.key) ? grupo.contraidoPorDefecto : !grupo.contraidoPorDefecto;
        const regionId = `grupo-${grupo.key}`;
        return (
          <section key={grupo.key}>
            <button
              type="button"
              onClick={() => alternar(grupo.key)}
              aria-expanded={abierto}
              aria-controls={regionId}
              className="group flex w-full items-baseline gap-2.5 border-b border-border pb-2.5 text-left"
            >
              <span className="font-extrabold tracking-heading text-[19px]">{grupo.titulo}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{grupo.jobs.length}</span>
              <ChevronDown
                className={`ml-auto size-4 flex-none text-muted-foreground transition-transform ease-in-out ${abierto ? "" : "-rotate-90"}`}
                aria-hidden
              />
            </button>
            {/* La descripción va dentro de la región contraíble: con el grupo
                cerrado, explicar qué contiene ocupa espacio sin decir nada. */}
            <div id={regionId} hidden={!abierto}>
              <p className="mt-2 text-xs text-muted-foreground">{grupo.descripcion}</p>
              <div className="mt-3 grid gap-3">
                {grupo.jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
