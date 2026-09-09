"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addNote } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import type { MentionableProfile } from "@/lib/applications/get-applications";

export function NoteForm({
  applicationId,
  mentionable,
  canMarkPrivate,
  parentId,
  /** Heredado del padre y no editable en una respuesta — la base lo fuerza igual. */
  inheritedPrivate,
  onSaved,
  onCancel,
}: {
  applicationId: string;
  mentionable: MentionableProfile[];
  /** Solo admin+ puede marcar una nota como privada — ver get-drawer-data.ts. */
  canMarkPrivate: boolean;
  /** Si viene, este formulario es una respuesta dentro de ese hilo. */
  parentId?: string;
  inheritedPrivate?: boolean;
  /**
   * El drawer guarda sus datos en estado local y los lee UNA vez al abrirse,
   * así que sin este aviso la nota recién creada no aparece hasta cerrar y
   * volver a abrir. `revalidatePath` no alcanza: invalida caché de servidor,
   * no toca el `useState` del cliente. Mismo patrón que MeetingScheduler.
   */
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const action = addNote.bind(null, applicationId);
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const isReply = Boolean(parentId);

  // `isPrivate` vive en estado (no solo en el checkbox) porque filtra a quién
  // se puede mencionar: en una nota privada, solo admin+ puede leerla, así que
  // solo ellos son mencionables. En una respuesta no se elige, se hereda.
  const [isPrivate, setIsPrivate] = useState(inheritedPrivate ?? false);
  const [mentions, setMentions] = useState<string[]>([]);

  const candidatos = isPrivate ? mentionable.filter((m) => m.isAdminOrAbove) : mentionable;
  // Si se marca "privada" con un gestor ya elegido, ese gestor deja de ser
  // mencionable: se descarta al enviar en vez de dejar que el servidor
  // rechace el formulario completo.
  const mentionsValidas = mentions.filter((id) => candidatos.some((c) => c.id === id));

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) {
      notifySuccess(state.success);
      // Solo DOM, no estado de React: limpia el textarea al instante, sin
      // esperar a que vuelva la recarga. El estado local (menciones, privada)
      // se limpia por remontaje — el caller le pasa un `key` que cambia
      // cuando llegan los datos nuevos. Resetearlo acá sería un setState
      // síncrono dentro de un efecto, que esta regla del proyecto prohíbe
      // (bloquea el build) por los renders en cascada que provoca.
      formRef.current?.reset();
      onSaved?.();
    }
    // `onSaved` fuera de las dependencias a propósito: el caller lo pasa como
    // función nueva en cada render, e incluirlo re-dispararía este efecto (y
    // el aviso) en cada render posterior al éxito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function toggleMention(id: string) {
    setMentions((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2.5">
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      {/* Un <select multiple> se colapsa a un solo valor en
          `Object.fromEntries(formData)`, así que los ids viajan unidos en un
          campo oculto — es lo que `NoteSchema.mentions` espera. */}
      <input type="hidden" name="mentions" value={mentionsValidas.join(",")} />

      <textarea
        name="body"
        required
        rows={isReply ? 2 : 3}
        placeholder={isReply ? "Escribe tu respuesta…" : "Escribe una nota sobre este candidato…"}
        aria-invalid={state?.field === "body"}
        className={`rounded-md border bg-background px-3 py-2 text-sm ${state?.field === "body" ? "border-destructive" : "border-border"}`}
      />

      {candidatos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Mencionar:</span>
          {/* El error de menciones se pinta ACÁ, junto a los chips. Sin esto el
              toast decía "solo puedes mencionar a personas asignadas" y el
              usuario no tenía forma de saber cuál chip sobraba — pasa cuando
              alguien deja la vacante con el drawer abierto. */}
          {state?.field === "mentions" && <span className="text-[11px] text-destructive">{state.error}</span>}
          {candidatos.map((m) => {
            const elegido = mentions.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={elegido}
                onClick={() => toggleMention(m.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  elegido
                    ? "border-accent bg-accent text-white"
                    : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                {m.display_name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {isReply || !canMarkPrivate ? (
          <span className="text-xs text-muted-foreground">
            {isReply
              ? inheritedPrivate
                ? "La respuesta hereda la privacidad de la nota."
                : "Respuesta al hilo."
              : "Visible para el equipo de esta vacante."}
          </span>
        ) : (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              name="is_private"
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="size-3.5"
            />
            Solo visible para admin+
          </label>
        )}
        <div className="flex items-center gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-xs text-muted-foreground underline">
              Cancelar
            </button>
          )}
          <ActionButton className="h-9 rounded-md px-4 text-xs">
            {isReply ? "Responder" : "Agregar nota"}
          </ActionButton>
        </div>
      </div>
    </form>
  );
}
