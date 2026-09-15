"use client";

import { useRef, useState } from "react";
import { ArrowUp, ArrowDown, X, Plus } from "lucide-react";
import { STAGE_TYPE_LABEL } from "@/lib/pipeline-templates/schema";
import type { PipelineTemplateWithStages } from "@/lib/pipeline-templates/get-pipeline-templates";
import type { TemplateStageDraft } from "@/lib/job-templates/wizard-schema";
import { ROW_INPUT_CLASS, ROW_SELECT_CLASS, ROW_WRAP_BASIS } from "@/components/configuracion/wizard/row-field-classes";
import { ERROR_CONTROL_CLASS, FieldError } from "@/components/ui/field";
import { campoSuelto } from "@/lib/forms/field-signals";
import { cn } from "@/lib/utils";

// Los tipos reservados para las etapas fijas (Bandeja de entrada/Contratado/
// Descartado, ver updateTemplateStep4) no son etapas intermedias válidas —
// un set guardado que las incluya (ej. el pipeline por defecto termina en
// "Contratado") no las copia, para no duplicar esas dos columnas del kanban.
type MiddleType = "preseleccion" | "entrevista" | "oferta";
const MIDDLE_TYPES: MiddleType[] = ["preseleccion", "entrevista", "oferta"];

type StageRow = TemplateStageDraft & { key: string };

function FixedStagePill({ label }: { label: string }) {
  return (
    <div className="flex h-10 items-center rounded-full border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function TemplateStagesEditor({
  initialStages,
  savedSets,
  idNombreSet,
  errorNombreSet,
  idErrorNombreSet,
}: {
  initialStages: TemplateStageDraft[];
  savedSets: PipelineTemplateWithStages[];
  /** Del input del nombre del set. **Obligatoria**: sin ella el `<label>` apunta
   *  a la nada, el input se queda con el placeholder como nombre accesible y la
   *  ayuda de la casilla cuelga de un literal `undefined-que-hace` — y nada de
   *  eso lo ve el compilador si la prop es opcional. */
  idNombreSet: string;
  /** El mensaje de ese campo, si el paso 4 lo recibió. */
  errorNombreSet?: string;
  /** El id del mensaje: lo apunta el control y lo busca `useErrorToast`.
   *  **Obligatorio**: `error` e `idError` son una unidad, y con uno solo
   *  `campoSuelto` se desactiva y el mensaje desaparece sin dejar rastro. */
  idErrorNombreSet: string;
}) {
  const nextKey = useRef(initialStages.length);
  const [stages, setStages] = useState<StageRow[]>(() =>
    initialStages.map((s, i) => ({ ...s, key: `stage-${i}` })),
  );
  const [saveAsReusable, setSaveAsReusable] = useState(false);
  const campo = campoSuelto(errorNombreSet, idErrorNombreSet);

  function updateStage(index: number, patch: Partial<TemplateStageDraft>) {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeStage(index: number) {
    setStages((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStage(index: number, direction: -1 | 1) {
    setStages((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addStage() {
    setStages((prev) => [...prev, { title: "", type: "preseleccion", key: `stage-${nextKey.current++}` }]);
  }

  function startFromSet(setId: string) {
    const set = savedSets.find((s) => s.id === setId);
    if (!set) return;
    // Reemplaza toda la lista intermedia — si ya había etapas escritas a
    // mano, se pierden. Confirmación nativa antes, no una que se pueda
    // cancelar sin querer con un clic de más (esto no es una eliminación
    // permanente en el servidor, así que no amerita <ConfirmDialog>).
    if (stages.length > 0 && !window.confirm(`Esto reemplaza las ${stages.length} etapas que ya escribiste. ¿Continuar?`)) {
      return;
    }
    const copied = set.stages
      .filter((s): s is { title: string; type: MiddleType } => (MIDDLE_TYPES as string[]).includes(s.type))
      .map((s) => ({ ...s, key: `stage-${nextKey.current++}` }));
    setStages(copied);
  }

  return (
    <div className="flex flex-col gap-4">
      {savedSets.length > 0 && (
        <label className="flex flex-col gap-1" data-tour="w4-set-guardado">
          <span className="text-xs text-muted-foreground">Empezar desde un set guardado (opcional)</span>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) startFromSet(e.target.value);
              e.target.value = "";
            }}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Elige un set…
            </option>
            {savedSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Copia sus etapas intermedias a esta plantilla — el set original no se toca.
          </span>
        </label>
      )}

      <input
        type="hidden"
        name="stages"
        value={JSON.stringify(stages.map(({ title, type }) => ({ title, type })))}
      />

      <div className="flex flex-col gap-2.5" data-tour="w4-kanban">
        <FixedStagePill label="Bandeja de entrada" />

        {stages.map((stage, i) => (
          // `flex-wrap` + un mínimo real en cada campo: sin eso la fila mide
          // ~480px y en un teléfono se sale del ancho. Y no se sale "con
          // scroll": `html` lleva `overflow-x: hidden` (globals.css), así que
          // lo que sobra se recorta sin barra — los botones de reordenar y
          // quitar quedaban pintados fuera de la pantalla, inalcanzables.
          // `min-w-0` solo en los campos que pueden encoger; el mínimo es lo
          // que fuerza el salto de línea en vez del recorte.
          <div key={stage.key} className="flex flex-wrap items-center gap-2 pl-4">
            <span className="w-5 flex-none text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <input
              value={stage.title}
              onChange={(e) => updateStage(i, { title: e.target.value })}
              placeholder="Nombre de la etapa"
              className={ROW_INPUT_CLASS}
            />
            <select
              value={stage.type}
              onChange={(e) => updateStage(i, { type: e.target.value as MiddleType })}
              className={`${ROW_SELECT_CLASS} ${ROW_WRAP_BASIS}`}
            >
              {MIDDLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {STAGE_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
            {/* Los tres juntos y `flex-none`: si envuelven, envuelven como
                grupo — un ✕ solo en su propia línea se lee como si fuera de
                otra etapa. */}
            <div className="ml-auto flex flex-none items-center gap-2">
              <button
                type="button"
                onClick={() => moveStage(i, -1)}
                disabled={i === 0}
                aria-label="Mover arriba"
                className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => moveStage(i, 1)}
                disabled={i === stages.length - 1}
                aria-label="Mover abajo"
                className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => removeStage(i)}
                aria-label="Quitar etapa"
                className="flex size-8 items-center justify-center rounded-full border border-destructive text-destructive"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        ))}

        <div className="pl-4">
          <button type="button" onClick={addStage} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
            <Plus className="size-4" aria-hidden />
            Agregar etapa
          </button>
        </div>

        <FixedStagePill label="Contratado" />
        <FixedStagePill label="Descartado" />
      </div>

      {stages.length > 0 && (
        /* **El `<label>` envuelve SOLO a la casilla.** Antes envolvía también al
           campo del nombre, y un `<label>` nombra a su primer control: hacer
           clic en "Nombre del set" —el gesto natural para enfocarlo— activaba
           la CASILLA, la desmarcaba, y el nombre recién escrito desaparecía sin
           deshacer. Además, el `<p role="alert">` del mensaje no es contenido
           válido dentro de un `<label>` y su texto entraba al nombre accesible
           de la casilla. */
        <div className="flex flex-col gap-1 border-t border-border pt-4" data-tour="w4-reutilizable">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={saveAsReusable}
              onChange={(e) => setSaveAsReusable(e.target.checked)}
              // Al sacar la explicación del `<label>` dejó de ser parte del
              // nombre de la casilla; sin esto se quedaba sin dueño y quien usa
              // lector de pantalla nunca se entera de qué hace marcarla.
              // `-que-hace` y no `-ayuda`: ese sufijo es el que `<Field>` reserva para su
              // `hint` del mismo id, y migrar este input a `<Field>` —el paso obvio—
              // dejaría dos elementos con el mismo id en la página.
              aria-describedby={`${idNombreSet}-que-hace`}
              className="size-4"
            />
            Guardar estas etapas intermedias como un set reutilizable
          </label>
          <span id={`${idNombreSet}-que-hace`} className="text-xs text-muted-foreground">
            Queda disponible para &ldquo;Empezar desde un set guardado&rdquo; en otras plantillas — esta plantilla no se toca.
          </span>
          {saveAsReusable && (
            <div className="mt-2 flex flex-col gap-1.5">
              {/* `<label htmlFor>` de verdad, no un `<span>`: sin eso el campo
                  se quedaba con el placeholder como nombre accesible, que es
                  justo lo que la regla 12 prohíbe. */}
              <label htmlFor={idNombreSet} className="text-xs text-muted-foreground">
                Nombre del set
              </label>
              <input
                id={idNombreSet}
                name="reusable_set_name"
                required
                maxLength={120}
                placeholder="Ventas con dos entrevistas"
                {...campo.props}
                className={cn(
                  "h-10 rounded-md border border-border bg-background px-3 text-sm",
                  campo.enError && ERROR_CONTROL_CLASS,
                )}
              />
              {campo.idMensaje && <FieldError id={campo.idMensaje}>{campo.mensaje}</FieldError>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
