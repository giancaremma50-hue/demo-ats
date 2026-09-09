"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { addNote } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { activeMentionQuery, buildMentionToken, parseMentions } from "@/lib/applications/mentions";
import { normalizarTexto } from "@/lib/utils";
import type { MentionableProfile } from "@/lib/applications/get-applications";

/** Cuántas sugerencias se ofrecen. Más que esto y la lista tapa el drawer. */
const MAX_SUGERENCIAS = 6;

export function NoteForm({
  applicationId,
  mentionable,
  /** Solo admin+ puede marcar una nota como privada — ver get-drawer-data.ts. */
  canMarkPrivate,
  /** Si viene, este formulario es una respuesta dentro de ese hilo. */
  parentId,
  /** Heredado del padre y no editable en una respuesta — la base lo fuerza igual. */
  inheritedPrivate,
  /**
   * El drawer guarda sus datos en estado local y los lee UNA vez al abrirse,
   * así que sin este aviso la nota recién creada no aparece hasta cerrar y
   * volver a abrir. `revalidatePath` no alcanza: invalida caché de servidor,
   * no toca el `useState` del cliente. Mismo patrón que MeetingScheduler.
   */
  onSaved,
  onCancel,
}: {
  applicationId: string;
  mentionable: MentionableProfile[];
  canMarkPrivate: boolean;
  parentId?: string;
  inheritedPrivate?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const boundAction = addNote.bind(null, applicationId);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Div "espejo" detrás del textarea real, mismo font/padding/línea, que
  // pinta el @[Nombre](uuid) como negrita — ver el comentario en el JSX.
  const highlightRef = useRef<HTMLDivElement>(null);
  // Estable entre renders y único por instancia: hay un NoteForm por hilo.
  const listaId = useId();
  const isReply = Boolean(parentId);

  // El cuerpo es CONTROLADO porque el autocompletado tiene que insertar el
  // token `@[Nombre](uuid)` en la posición del cursor. Con un textarea no
  // controlado no hay forma de reescribir el valor sin perder el cursor.
  const [body, setBody] = useState("");
  const [cursor, setCursor] = useState(0);
  const [isPrivate, setIsPrivate] = useState(inheritedPrivate ?? false);
  const [elegido, setElegido] = useState(0);
  // Escape descarta la lista sin borrar el texto. Antes solo reseteaba el
  // resaltado: la lista seguía montada, así que escribir un poco más y pulsar
  // Enter insertaba la mención que se acababa de descartar.
  const [cerrada, setCerrada] = useState(false);

  /**
   * El envoltorio limpia el cuerpo en el MISMO tick del éxito.
   *
   * Al pasar el textarea a controlado se perdió el `formRef.reset()` que había
   * antes — y con estado controlado ese reset no habría servido igual, porque
   * el valor vuelve de `body`. Sin esto, tras guardar el texto seguía en
   * pantalla con el botón ya rehabilitado: se lee como "no guardó", el segundo
   * clic mete una nota DUPLICADA, y si `refresh()` falla el texto se queda
   * para siempre. Va acá y no en un `useEffect` porque un setState síncrono
   * dentro de un efecto es un ERROR de build en este proyecto; es el mismo
   * patrón que ya usaba `interview-form.tsx` (ver .claude/napkin.md).
   */
  const [state, formAction] = useActionState(
    async (prev: Awaited<ReturnType<typeof boundAction>> | undefined, formData: FormData) => {
      const resultado = await boundAction(prev, formData);
      if (resultado?.success) {
        setBody("");
        setCursor(0);
        setElegido(0);
        setCerrada(false);
      }
      return resultado;
    },
    undefined,
  );


  // En una nota privada solo admin+ puede leerla (`notes_select`), así que
  // solo ellos son mencionables — mismo predicado que revalida `addNote`.
  const candidatos = isPrivate ? mentionable.filter((m) => m.isAdminOrAbove) : mentionable;

  const activa = cerrada ? null : activeMentionQuery(body, cursor);
  const q = activa ? normalizarTexto(activa.query) : "";
  // Sin filtrar a los ya mencionados: `addNote` deduplica con un Set, así que
  // excluirlos solo impedía mencionar a alguien dos veces en la misma nota
  // ("@Ana revisa esto… y @Ana confirma la fecha") — el segundo quedaba como
  // texto plano sin negrita.
  const sugerencias =
    activa === null ? [] : candidatos.filter((m) => normalizarTexto(m.display_name).includes(q)).slice(0, MAX_SUGERENCIAS);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) {
      notifySuccess(state.success);
      onSaved?.();
    }
    // `onSaved` fuera de las dependencias a propósito: el caller lo pasa como
    // función nueva en cada render, e incluirlo re-dispararía este efecto (y
    // el aviso) en cada render posterior al éxito. El cuerpo NO se limpia acá
    // — un setState síncrono dentro de un efecto es un ERROR de build en este
    // proyecto; el caller remonta el formulario con `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function insertarMencion(m: MentionableProfile | undefined) {
    // `elegido` no se resetea en `onKeyUp`/`onClick`/el check de privada, y
    // esos tres cambian la lista de sugerencias: mover el cursor con la lista
    // abierta podía dejar el índice apuntando fuera del array y `undefined`
    // llegaba hasta `.display_name`. La guarda de antes miraba `length === 0`,
    // no si el índice seguía siendo válido.
    if (!m || !activa) return;
    const token = buildMentionToken(m.display_name, m.id);
    const nuevo = `${body.slice(0, activa.desde)}${token} ${body.slice(cursor)}`;
    const posicion = activa.desde + token.length + 1;
    setBody(nuevo);
    setElegido(0);
    // El cursor se reposiciona después del render, si no el navegador lo manda
    // al final del texto y escribir en medio de una nota se vuelve imposible.
    requestAnimationFrame(() => {
      areaRef.current?.setSelectionRange(posicion, posicion);
      areaRef.current?.focus();
      setCursor(posicion);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (sugerencias.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setElegido((i) => (i + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setElegido((i) => (i - 1 + sugerencias.length) % sugerencias.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      // Enter elige de la lista en vez de enviar el formulario. Sin esto, el
      // submit implícito de HTML guardaría la nota a medio escribir — la misma
      // trampa que ya se documentó con el buscador de MeetingScheduler.
      e.preventDefault();
      insertarMencion(sugerencias[elegido] ?? sugerencias[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setCerrada(true);
      setElegido(0);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      {/* Sin campo oculto de menciones: `addNote` saca los ids del CUERPO, que
          es la única fuente. Mandarlos también aparte era redundante y encima
          podía tumbar la nota completa — un fragmento de texto que se pareciera
          a un token (36 caracteres hex-o-guión) entraba al campo, no pasaba
          `z.uuid()` y devolvía "Persona inválida." por algo que ni era una
          mención. */}
      <div className="relative">
        {/*
         * Negrita EN VIVO mientras se escribe, no solo después de publicar
         * (pedido del usuario, 2026-09-09). Un <textarea> no puede pintar
         * texto parcialmente en negrita — es la técnica estándar de
         * "textarea con overlay": este div de atrás pinta el mismo texto con
         * `parseMentions` (la misma función que ya usa NoteBody para el
         * cuerpo publicado, cero lógica de resaltado duplicada), y el
         * textarea de encima queda con SU PROPIO texto transparente —
         * `caret-transparent` no: el cursor (`caret-color`) sigue visible,
         * solo las letras se vuelven invisibles porque lo que se LEE es este
         * div de abajo. Mismo font/padding/line-height en los dos a
         * propósito: si no calzan pixel a pixel, el cursor real cae en un
         * lugar y el texto pintado en otro.
         */}
        <div
          ref={highlightRef}
          aria-hidden
          className={`pointer-events-none absolute inset-0 overflow-hidden rounded-md border bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words ${state?.field === "body" ? "border-destructive" : "border-border"}`}
        >
          {parseMentions(body).map((parte, i) =>
            parte.tipo === "mencion" ? (
              <strong key={i} className="font-semibold text-accent">
                {parte.nombre}
              </strong>
            ) : (
              <span key={i}>{parte.valor}</span>
            ),
          )}
          {/* Un textarea cuyo valor termina en "\n" muestra una línea vacía
              extra — sin esto el div queda una línea más corto que el
              textarea real y el cursor cae por debajo del texto pintado. */}
          {body.endsWith("\n") && "​"}
        </div>
        <textarea
          ref={areaRef}
          name="body"
          required
          rows={isReply ? 2 : 3}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setCursor(e.target.selectionStart);
            setElegido(0);
            setCerrada(false);
          }}
          onKeyUp={(e) => setCursor(e.currentTarget.selectionStart)}
          onClick={(e) => setCursor(e.currentTarget.selectionStart)}
          onKeyDown={handleKeyDown}
          onScroll={(e) => {
            // El overlay no scrollea solo: es un div normal, no un textarea.
            if (highlightRef.current) highlightRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          role="combobox"
          aria-expanded={sugerencias.length > 0}
          aria-controls={listaId}
          aria-activedescendant={
            sugerencias.length > 0 ? `${listaId}-${(sugerencias[elegido] ?? sugerencias[0]).id}` : undefined
          }
          placeholder={isReply ? "Escribe tu respuesta… (@ para mencionar)" : "Escribe una nota… (@ para mencionar)"}
          aria-invalid={state?.field === "body"}
          // Mismo rounded-md/px-3/py-2/text-sm que el overlay, a propósito
          // (ver el comentario de arriba) — border-transparent en vez de
          // quitar el borde: mantiene el mismo tamaño de caja que el
          // overlay (un borde real ocupa espacio en box-sizing:border-box),
          // solo que invisible, porque el borde "de verdad" ya lo pinta el
          // overlay de atrás.
          className="relative w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-sm text-transparent caret-foreground placeholder:text-muted-foreground"
        />
        {sugerencias.length > 0 && (
          // `role="option"` va en el <li>, que es hijo DIRECTO del listbox: con
          // un <button> intermedio la relación que exige ARIA se rompe y un
          // lector de pantalla no anuncia ninguna opción. El textarea es el
          // combobox y `aria-activedescendant` es lo que dice cuál está
          // resaltada, porque las flechas mueven el resaltado y no el foco.
          <Card
            as="ul"
            id={listaId}
            role="listbox"
            aria-label="Personas que puedes mencionar"
            className="absolute z-10 mt-1 w-full max-w-xs rounded-md"
          >
            {sugerencias.map((m, i) => (
              <li
                key={m.id}
                id={`${listaId}-${m.id}`}
                role="option"
                aria-selected={i === elegido}
                onMouseDown={(e) => {
                  // mouseDown y no click: al hacer click el textarea pierde el
                  // foco primero, el cursor se resetea y la inserción caería en
                  // la posición equivocada.
                  e.preventDefault();
                  insertarMencion(m);
                }}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[13px] ${i === elegido ? "bg-muted" : ""}`}
              >
                <span className="truncate">{m.display_name}</span>
                {m.isAdminOrAbove && <span className="flex-none text-[10px] text-muted-foreground">admin</span>}
              </li>
            ))}
          </Card>
        )}
      </div>

      {state?.field === "mentions" && <p className="text-[11px] text-destructive">{state.error}</p>}

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
          <ActionButton className="h-9 px-4 text-xs">
            {isReply ? "Responder" : "Agregar nota"}
          </ActionButton>
        </div>
      </div>
    </form>
  );
}
