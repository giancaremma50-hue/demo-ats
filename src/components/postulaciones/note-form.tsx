"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { addNote } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { activeMentionQuery, buildMentionToken } from "@/lib/applications/mentions";
import { normalizarTexto } from "@/lib/utils";
import type { MentionableProfile } from "@/lib/applications/get-applications";

/** Cuántas sugerencias se ofrecen. Más que esto y la lista tapa el drawer. */
const MAX_SUGERENCIAS = 6;

/**
 * Un tramo de `body` (en sus propios índices de caracter) que es una
 * mención real, no solo texto que se parece a un nombre.
 */
type RangoMencion = { start: number; end: number; nombre: string; profileId: string };

/**
 * `body` reemplaza [oldStart, oldEnd) por un texto de `newLength`
 * caracteres — recalcula qué menciones siguen siendo válidas.
 *
 * Una mención enteramente ANTES del tramo tocado no se mueve. Una
 * enteramente DESPUÉS se corre por el delta de longitud. Una que se
 * SOLAPA con el tramo tocado se descarta: si el usuario escribió o borró
 * encima del nombre, ya no es la mención que se insertó — queda como
 * texto plano, no una mención rota apuntando a un tramo que ya no dice
 * ese nombre.
 */
function ajustarMenciones(mentions: RangoMencion[], oldStart: number, oldEnd: number, newLength: number): RangoMencion[] {
  const delta = newLength - (oldEnd - oldStart);
  const resultado: RangoMencion[] = [];
  for (const m of mentions) {
    if (m.end <= oldStart) resultado.push(m);
    else if (m.start >= oldEnd) resultado.push({ ...m, start: m.start + delta, end: m.end + delta });
    // si no, se solapa con el tramo reemplazado: se descarta.
  }
  return resultado;
}

/**
 * Cuánto prefijo/sufijo comparten dos strings — la forma barata de saber
 * QUÉ tramo cambió entre el `body` viejo y el nuevo valor de un
 * `<textarea>`, sin que el evento de cambio tenga que decirlo (un solo
 * `onChange` cubre tipear, borrar, pegar, cortar, autocompletar del
 * navegador, todos por igual). ponytail: heurística ingenua — con
 * caracteres repetidos justo en el borde del cambio puede recortar de más
 * o de menos: pasa `newLength` calculado del mismo par de índices), el
 * peor caso es que una mención se dé por rota cuando no lo estaba, nunca
 * un índice fuera de rango. Subir a un diff real si esto se vuelve un
 * problema de verdad.
 */
function tramoCambiado(antes: string, despues: string): { oldStart: number; oldEnd: number; newLength: number } {
  const maxComun = Math.min(antes.length, despues.length);
  let prefijo = 0;
  while (prefijo < maxComun && antes[prefijo] === despues[prefijo]) prefijo++;
  const maxSufijo = Math.min(antes.length - prefijo, despues.length - prefijo);
  let sufijo = 0;
  while (sufijo < maxSufijo && antes[antes.length - 1 - sufijo] === despues[despues.length - 1 - sufijo]) sufijo++;
  return { oldStart: prefijo, oldEnd: antes.length - sufijo, newLength: despues.length - sufijo - prefijo };
}

/** El texto final que se manda al servidor: cada mención reemplazada por su token `@[Nombre](uuid)`. */
function serializar(body: string, mentions: RangoMencion[]): string {
  const ordenadas = [...mentions].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const m of ordenadas) {
    out += body.slice(cursor, m.start);
    out += buildMentionToken(m.nombre, m.profileId);
    cursor = m.end;
  }
  out += body.slice(cursor);
  return out;
}

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
  // pinta los tramos marcados en `mentions` como negrita — ver el JSX.
  const highlightRef = useRef<HTMLDivElement>(null);
  // Estable entre renders y único por instancia: hay un NoteForm por hilo.
  const listaId = useId();
  const isReply = Boolean(parentId);

  // `body` es lo que se VE y lo que hay de verdad en el textarea — el
  // nombre de la persona, nunca el token `@[Nombre](uuid)`. Guardar el
  // token completo acá (como se hacía antes) rompe el truco de "textarea
  // con overlay": el div de atrás pintaba solo el nombre (más corto) y el
  // textarea de encima tenía el token completo (más largo) — los dos
  // textos no medían lo mismo, así que el cursor real quedaba mucho más
  // adelante de donde se veía el nombre en negrita. `mentions` guarda
  // APARTE qué tramos de `body` son menciones reales; el token completo
  // recién se arma en `serializar()`, al enviar.
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<RangoMencion[]>([]);
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
        setMentions([]);
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

  function handleChange(nuevoBody: string) {
    const { oldStart, oldEnd, newLength } = tramoCambiado(body, nuevoBody);
    setMentions((prev) => ajustarMenciones(prev, oldStart, oldEnd, newLength));
    setBody(nuevoBody);
  }

  function insertarMencion(m: MentionableProfile | undefined) {
    // `elegido` no se resetea en `onKeyUp`/`onClick`/el check de privada, y
    // esos tres cambian la lista de sugerencias: mover el cursor con la lista
    // abierta podía dejar el índice apuntando fuera del array y `undefined`
    // llegaba hasta `.display_name`. La guarda de antes miraba `length === 0`,
    // no si el índice seguía siendo válido.
    if (!m || !activa) return;
    // Mismo saneo que `buildMentionToken`: un nombre con "]"/"(" rompería el
    // token al serializar, así que se limpia también en lo que se VE.
    const nombreLimpio = m.display_name.replace(/[[\]()]/g, "").trim();
    const oldStart = activa.desde;
    const oldEnd = cursor;
    const nuevoBody = `${body.slice(0, oldStart)}${nombreLimpio} ${body.slice(oldEnd)}`;
    const fin = oldStart + nombreLimpio.length;
    setMentions((prev) => [
      ...ajustarMenciones(prev, oldStart, oldEnd, nombreLimpio.length + 1),
      { start: oldStart, end: fin, nombre: nombreLimpio, profileId: m.id },
    ]);
    setBody(nuevoBody);
    setElegido(0);
    const posicion = fin + 1;
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

  // Para pintar el overlay: `body` partido en tramos plano/mención, en el
  // mismo orden en que aparecen — a diferencia de `serializar()`, acá no
  // hace falta ordenar por separado porque se recorre `body` de una pasada.
  const ordenadasPorInicio = [...mentions].sort((a, b) => a.start - b.start);
  const segmentos: { texto: string; esMencion: boolean }[] = [];
  {
    let cur = 0;
    for (const m of ordenadasPorInicio) {
      if (m.start > cur) segmentos.push({ texto: body.slice(cur, m.start), esMencion: false });
      segmentos.push({ texto: body.slice(m.start, m.end), esMencion: true });
      cur = m.end;
    }
    if (cur < body.length) segmentos.push({ texto: body.slice(cur), esMencion: false });
  }

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      {/* El textarea visible NO lleva name="body" — lo que se manda al
          servidor es el hidden de abajo, con el token @[Nombre](uuid) ya
          armado. Sin campo aparte de menciones: `addNote` saca los ids del
          CUERPO serializado, que es la única fuente. */}
      <input type="hidden" name="body" value={serializar(body, mentions)} />
      <div className="relative">
        {/*
         * Resaltado EN VIVO mientras se escribe (pedido del usuario,
         * 2026-09-09) — color de acento, NUNCA negrita acá (ver el
         * comentario junto a `text-accent` más abajo: cambia el ancho del
         * texto y desalinea el cursor). La negrita real queda para
         * `NoteBody`, sobre la nota ya publicada. Técnica de "textarea con
         * overlay": este div de atrás pinta el MISMO texto que hay en el
         * textarea (nunca el token completo, ver el comentario de `body`
         * arriba), y el textarea de encima queda con SU PROPIO texto
         * transparente — el cursor (`caret-color`) sigue visible, solo las
         * letras se vuelven invisibles porque lo que se LEE es este div de
         * abajo. Mismo font/padding/line-height/font-weight en los dos a
         * propósito, y el mismo STRING exacto: si difieren en contenido,
         * longitud, O ANCHO RENDERIZADO, el cursor real cae en un lugar y
         * el texto pintado en otro — los dos bugs que tuvo esto antes.
         */}
        <div
          ref={highlightRef}
          aria-hidden
          className={`pointer-events-none absolute inset-0 overflow-hidden rounded-md border bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words ${state?.field === "body" ? "border-destructive" : "border-border"}`}
        >
          {segmentos.map((s, i) =>
            s.esMencion ? (
              // Color, NUNCA font-weight/letter-spacing/font distinto: una
              // negrita real es más ANCHA que el mismo texto en peso normal
              // (medido: ~8px de más en un nombre de 24 caracteres) — el
              // textarea invisible mide el ancho de SU texto en peso normal
              // (un <textarea> no puede tener negrita parcial), así que
              // cualquier cambio de ancho acá desalinea el cursor real
              // respecto al texto pintado, más se nota cuanto más se escribe
              // después de la mención. Encontrado por el usuario 2026-09-09:
              // "el cursor está incrustado dentro de la palabra". La negrita
              // de verdad queda para NoteBody, sobre la nota ya publicada,
              // donde no hay cursor que alinear contra nada.
              <span key={i} className="text-accent">
                {s.texto}
              </span>
            ) : (
              <span key={i}>{s.texto}</span>
            ),
          )}
          {/* Un textarea cuyo valor termina en "\n" muestra una línea vacía
              extra — sin esto el div queda una línea más corto que el
              textarea real y el cursor cae por debajo del texto pintado. */}
          {body.endsWith("\n") && "​"}
        </div>
        <textarea
          ref={areaRef}
          required
          rows={isReply ? 2 : 3}
          value={body}
          onChange={(e) => {
            handleChange(e.target.value);
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
