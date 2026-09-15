"use client";

import { useState } from "react";
import { ERROR_CONTROL_CLASS, FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { campoSuelto } from "@/lib/forms/field-signals";
import type { TeamMemberOption } from "@/lib/jobs/get-team-options";

/**
 * "Colaboradores adicionales" — checkboxes + un input oculto con el array de
 * ids en JSON (un <select multiple> perdería todo salvo el último valor al
 * pasar por Object.fromEntries(formData) del servidor). No excluye al
 * "Reclutador asignado" de la vacante — si coinciden,
 * createJob lo descarta server-side (agregar al mismo dos veces violaría el
 * UNIQUE de job_collaborators), evita sincronizar estado entre dos
 * componentes separados para un caso que no rompe nada de todos modos.
 */
export function CollaboratorsPicker({
  members,
  name = "collaborator_ids",
  emptyLabel = "No hay nadie más en la organización todavía.",
  idEtiqueta,
  error,
  idError,
}: {
  members: TeamMemberOption[];
  /** Nombre del campo oculto — reusado también para "extra_admin_ids" en el flujo de solicitud creada por un admin. */
  name?: string;
  emptyLabel?: string;
  /** El id del texto que nombra al grupo. No es un control único, así que lo
   *  que corresponde es `role="group"` + `aria-labelledby`, no un `<label>`.
   *  **Obligatorio**: un grupo sin nombre es peor que el `<div>` que reemplazó. */
  idEtiqueta: string;
  /** El mensaje de error de este campo, si el padre lo recibió. */
  error?: string;
  /** El id del mensaje: lo apunta el grupo y lo busca `useErrorToast`.
   *  **Obligatorio**: `error` e `idError` son una unidad. */
  idError: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const campo = campoSuelto(error, idError);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((existing) => existing !== id)));
  }

  return (
    <>
      {/* `tabIndex={-1}` cuando hay error: `llevarAlCampo` encuentra al "control"
          por su `aria-describedby`, y un `<div>` sin tabindex no puede recibir
          el foco — el salto quedaba a medias (scroll sí, foco no).
          Sin `aria-invalid`: `role="group"` no lo admite (ARIA 1.2 solo le da
          `aria-activedescendant`, `aria-disabled` y las globales), y un atributo
          que el rol no soporta lo ignora el lector y lo marca la auditoría. Acá
          los canales son la descripción, el borde y el mensaje. */}
      <div
        role="group"
        aria-labelledby={idEtiqueta}
        aria-describedby={campo.props["aria-describedby"]}
        tabIndex={campo.enError ? -1 : undefined}
        // `focus:` y no `focus-visible:`: a este div lo enfoca el hook por código,
        // y `:focus-visible` no matchea un foco programático salvo que la última
        // interacción haya sido de teclado — el foco caía en un destino invisible.
        className="focus:outline-2 focus:outline-offset-2 focus:outline-ring"
      >
        <input type="hidden" name={name} value={JSON.stringify(selected)} />
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div
            className={cn(
              "flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-md border border-border p-2.5",
              campo.enError && ERROR_CONTROL_CLASS,
            )}
          >
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(m.id)}
                  onChange={(e) => toggle(m.id, e.target.checked)}
                  className="size-4"
                />
                {m.display_name}
              </label>
            ))}
          </div>
        )}
      </div>
      {/* FUERA del grupo: adentro, el texto se lee TRES veces — como alerta al
          aparecer, como descripción del grupo al enfocarlo, y otra vez al
          recorrer su contenido. Afuera sigue siendo su descripción y se leen
          dos, que es el precio aceptado. */}
      {campo.idMensaje && <FieldError id={campo.idMensaje}>{campo.mensaje}</FieldError>}
    </>
  );
}
