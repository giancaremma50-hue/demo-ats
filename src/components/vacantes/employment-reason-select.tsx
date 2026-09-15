"use client";

import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createEmploymentReason } from "@/lib/employment-reasons/actions";
import { EmploymentReasonSchema } from "@/lib/employment-reasons/schema";
import { zodFieldError } from "@/lib/forms/zod-error";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { ERROR_CONTROL_CLASS, FieldError } from "@/components/ui/field";
import { campoSuelto } from "@/lib/forms/field-signals";
import { cn } from "@/lib/utils";
import type { EmploymentReasonOption } from "@/lib/employment-reasons/get-employment-reasons";

const FIELD_CLASS = "h-11 rounded-md border border-border bg-background px-3 text-sm";

/**
 * Lista con alta inline — "mantengamos la opción de lista con la opción de
 * agregar nuevos motivos desde esa lista desplegable" (decisión del
 * usuario). No es un combobox de autocompletar: un botón "+" revela un
 * input de texto chico; "Agregar" invoca la Server Action directo (sin un
 * <form> anidado — este componente vive DENTRO del form de crear vacante,
 * y HTML no permite <form> dentro de <form>), y al guardar agrega la
 * opción a la lista local y la deja seleccionada.
 *
 * El input de texto necesita su propio manejo de Enter: al vivir dentro del
 * <form> de crear vacante, sin esto Enter dispara el envío IMPLÍCITO de ese
 * form entero (el botón "Agregar" de acá es type="button", así que el
 * navegador usa el submit real del form — "Crear vacante" — como default).
 */
export function EmploymentReasonSelect({
  initialReasons,
  id,
  error,
  idError,
}: {
  initialReasons: EmploymentReasonOption[];
  /** Del `<select>`, para que la etiqueta del formulario padre lo nombre.
   *  **Obligatoria**: sin ella el `<label htmlFor>` del padre cuelga de la nada
   *  y el control se queda sin nombre accesible, y el compilador no lo ve. */
  id: string;
  /** El mensaje de error de este campo, si el padre lo recibió. */
  error?: string;
  /** El id del mensaje, para atarlo al control y para que `useErrorToast` lo
   *  encuentre. **Obligatorio**: `error` e `idError` son una unidad, y con uno
   *  solo `campoSuelto` se desactiva y el mensaje desaparece sin dejar rastro. */
  idError: string;
}) {
  const [reasons, setReasons] = useState(initialReasons);
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  /** El error del alta inline, con su propio estado: esta fila no pasa por
   *  `useActionState` —llama a la acción dentro de un `useTransition`, porque
   *  vive DENTRO del `<form>` de crear vacante y HTML no permite anidarlos—,
   *  así que el mensaje lo guarda ella. */
  const [errorAlta, setErrorAlta] = useState<string | undefined>(undefined);
  const uidAlta = useId();
  const idErrorAlta = `${uidAlta}-nuevo-motivo-error`;
  const campoAlta = campoSuelto(errorAlta, idErrorAlta);
  const campoMotivo = campoSuelto(error, idError);

  function handleAdd() {
    // Enter no pasa por el botón, así que tampoco por su `disabled`: dos Enter
    // seguidos disparaban dos altas, y la segunda respondía cuando la fila ya
    // se había cerrado por la primera — el mensaje se guardaba en un estado que
    // nadie pinta, y no quedaba nada en pantalla (regla 5).
    if (isPending) return;
    // El botón está deshabilitado por debajo de 2 caracteres, pero Enter no
    // pasa por el botón: sin este mensaje, apretar Enter con "a" escrito no
    // hacía absolutamente nada en pantalla (AGENTS.md, regla 5).
    // El mensaje sale del MISMO schema que valida en el servidor, no de una
    // copia: reescribirlo allá dejaba a este camino con el texto viejo.
    const previo = EmploymentReasonSchema.safeParse({ label: newLabel });
    if (!previo.success) {
      setErrorAlta(zodFieldError(previo.error).error);
      return;
    }
    setErrorAlta(undefined);
    const formData = new FormData();
    formData.set("label", newLabel);
    startTransition(async () => {
      const result = await createEmploymentReason(undefined, formData);
      if (result.error) {
        // Debajo del campo SOLO si el error es de ese campo. Un "no se pudo
        // agregar" —RLS, conexión, un error de Postgres cualquiera— no es culpa
        // de lo que el usuario escribió, y ponerlo bajo el input lo lee como
        // "tu texto está mal". Ese va al toast, que es su canal (regla 12).
        if (result.field === "label") setErrorAlta(result.error);
        else notifyError(result.error);
        return;
      }
      if (result.id && result.label) {
        setReasons((prev) => [...prev, { id: result.id!, label: result.label! }].sort((a, b) => a.label.localeCompare(b.label)));
        setSelected(result.id);
        notifySuccess("Motivo agregado");
      }
      setNewLabel("");
      setErrorAlta(undefined);
      setAdding(false);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        id={id}
        name="employment_reason_id"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        {...campoMotivo.props}
        className={cn(FIELD_CLASS, campoMotivo.enError && ERROR_CONTROL_CLASS)}
      >
        <option value="">Sin especificar</option>
        {reasons.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      {/* Pegado al `<select>`, no al final del componente: abajo está la fila de
          alta con su propio mensaje, y ahí este se leía como error de ESA fila. */}
      {campoMotivo.idMensaje && <FieldError id={campoMotivo.idMensaje}>{campoMotivo.mensaje}</FieldError>}

      {adding ? (
        // `flex-wrap` + mínimo real en el campo: a 320px el campo, "Agregar" y
        // "Cancelar" en una línea suman más que el ancho útil, y `html` recorta
        // el eje X sin barra — "Cancelar" se pintaba fuera de la pantalla, que
        // es el mismo fallo que la auditoría del 2026-09-13 ya encontró tres
        // veces (AGENTS.md, responsividad).
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${uidAlta}-nuevo-motivo`} className="w-full text-xs text-muted-foreground">
            Nombre del motivo nuevo
          </label>
          <input
            id={`${uidAlta}-nuevo-motivo`}
            value={newLabel}
            // Limpiar acá y no solo en el envío: el aviso de "al menos 2
            // caracteres" quedaba en rojo con el botón ya habilitado, diciendo
            // algo que había dejado de ser cierto.
            onChange={(e) => {
              setNewLabel(e.target.value);
              setErrorAlta(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            autoFocus
            maxLength={80}
            placeholder="Reemplazo por renuncia"
            {...campoAlta.props}
            className={cn(
              "h-9 min-w-[10rem] flex-1 rounded-md border border-border bg-background px-2.5 text-sm",
              campoAlta.enError && ERROR_CONTROL_CLASS,
            )}
          />
          <ActionButton
            type="button"
            variant="secondary"
            pending={isPending}
            pendingLabel="Agregando…"
            onClick={handleAdd}
            disabled={newLabel.trim().length < 2}
            className="h-9 shrink-0 px-3 text-xs"
          >
            Agregar
          </ActionButton>
          {/* Deshabilitado mientras corre: cerrar la fila desmonta el mensaje
              que está por llegar, y como acá el aviso es local (esta fila no
              pasa por `useActionState`, así que no hay toast de respaldo) el
              error se quedaría sin decir nada — el peor final posible
              (AGENTS.md, regla 5). */}
          <ActionButton
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setErrorAlta(undefined);
              setAdding(false);
            }}
            className="h-9 shrink-0 px-2 text-xs"
          >
            Cancelar
          </ActionButton>
          {/* Debajo de la FILA: adentro empujaría los dos botones hacia abajo. */}
          {campoAlta.idMensaje && (
            <div className="w-full">
              <FieldError id={campoAlta.idMensaje}>{campoAlta.mensaje}</FieldError>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-accent"
        >
          <Plus className="size-3.5" aria-hidden />
          Agregar motivo nuevo
        </button>
      )}
    </div>
  );
}
