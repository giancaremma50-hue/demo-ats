"use client";

import { useState, useTransition } from "react";
import { toggleTask, deleteTask } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { DeleteButton } from "@/components/ui/delete-button";
import { Card } from "@/components/ui/card";
import { dueDateLabel } from "@/lib/org-today";
import type { ApplicationTask } from "@/lib/applications/get-applications";

/** Fecha límite de una tarea, en rojo si ya venció. */
function DueDate({ dueDate }: { dueDate: string }) {
  const due = dueDateLabel(dueDate);
  return <span className={due.overdue ? "text-destructive" : undefined}>{due.text}</span>;
}

/** Exportado: el hilo de Seguimientos la reusa para intercalar tareas entre notas por fecha. */
export function TaskRow({
  task,
  applicationId,
  onChanged,
}: {
  task: ApplicationTask;
  applicationId: string;
  onChanged?: () => void;
}) {
  const [isDone, setIsDone] = useState(task.isDone);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const previous = isDone;
    setIsDone(!previous);
    startTransition(async () => {
      const result = await toggleTask(task.id, applicationId, !previous);
      if (result.error) {
        setIsDone(previous);
        notifyError(result.error);
      } else {
        notifySuccess(result.success ?? "Actualizado");
        // El check ya se pintó optimista arriba; esto es para lo DERIVADO
        // (contadores del tablero, "vencidas" de la agenda), que sale de la
        // misma consulta del drawer.
        onChanged?.();
      }
    });
  }

  return (
    <Card as="li" className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
      <label className="flex min-w-0 items-center gap-2.5">
        <input
          type="checkbox"
          checked={isDone}
          disabled={pending}
          onChange={handleToggle}
          className="size-4 disabled:opacity-50"
        />
        <span className={isDone ? "truncate text-muted-foreground line-through" : "truncate"}>{task.description}</span>
      </label>
      <div className="flex flex-none items-center gap-2 text-xs text-muted-foreground">
        {task.dueDate && !isDone && <DueDate dueDate={task.dueDate} />}
        {task.assignedToName && <span>{task.assignedToName}</span>}
        <DeleteButton
          itemLabel="esta tarea"
          iconOnly
          // Sin esto la fila borrada se queda en pantalla: la lista viene de
          // props y el drawer no vuelve a leer por su cuenta.
          onDelete={async () => {
            await deleteTask(task.id, applicationId);
            onChanged?.();
          }}
          successMessage="Tarea eliminada"
        />
      </div>
    </Card>
  );
}

export function TaskList({
  tasks,
  applicationId,
  onChanged,
}: {
  tasks: ApplicationTask[];
  applicationId: string;
  /** Ver el comentario en NoteForm: el drawer no se refresca solo. */
  onChanged?: () => void;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin tareas todavía. Agrega la primera arriba.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} applicationId={applicationId} onChanged={onChanged} />
      ))}
    </ul>
  );
}
