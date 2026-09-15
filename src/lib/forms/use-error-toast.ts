"use client";

import { useEffect } from "react";
import { notifyError } from "@/lib/notifications/toast";


/**
 * Cómo se llama en el DOM el mensaje de un campo. `<Field id="x">` lo pinta con
 * id `x-error`, así que un formulario cuyos campos usan `useId()` como prefijo
 * pasa `(campo) => \`${uid}-${campo}-error\``. **No hay valor por defecto**: ver
 * el porqué en `useErrorToast`.
 */
export type IdDeMensaje = (campo: string) => string;

/** Lo mínimo que hace falta de un nodo para saber si se pinta — así la decisión
 *  se puede probar sin un DOM, que este proyecto no tiene en los tests. */
type Pintable = { getClientRects: () => { length: number } };

/**
 * ¿El mensaje está **pintado**? No es lo mismo que "está montado": un nodo con
 * `display:none`, dentro de un `<dialog>` cerrado, en una rama escondida por
 * punto de corte o en un `<details>` plegado existe en el DOM y no ocupa lugar.
 * `getClientRects()` vacío es exactamente eso.
 *
 * **Lo que NO cubre, y hay que tenerlo presente antes de confiar en esto:**
 * `visibility: hidden`, `opacity: 0` y un elemento fuera de la ventana **sí**
 * tienen cajas, así que acá cuentan como pintados. Ninguna pantalla esconde hoy
 * un `<FieldError>` de esas tres maneras; el día que un cajón se anime saliendo
 * con opacidad, este predicado deja de alcanzar y hay que mirar también
 * `checkVisibility()`.
 */
export function seVe(nodo: Pintable | null | undefined): boolean {
  return !!nodo && nodo.getClientRects().length > 0;
}

/**
 * El texto del error, pero solo para el campo que lo causó — la pieza que cada
 * formulario le pasa a `<Field error={…}>`. Vivía copiada verbatim en cinco
 * componentes; cambiar cómo se elige el error de un campo (soportar más de un
 * issue, normalizar paths anidados) significaba cinco ediciones y una que se
 * quedaba atrás.
 */
export function selectorDeError(state: { error?: string; field?: string } | undefined) {
  return (campo: string) => (state?.field === campo ? state.error : undefined);
}

export type DecisionDeError = {
  /** El texto a gritar por toast, o `null` si el mensaje ya está en pantalla. */
  toast: string | null;
  /** El id del mensaje que sí se pintó, para llevar al usuario hasta él. */
  llevarA: string | null;
};

/**
 * La decisión sola, sin React y sin DOM, para poder probarla: dado el resultado
 * de una acción, ¿hace falta el toast, o el mensaje ya se ve?
 *
 * `buscar` es lo que en producción es `document.getElementById`.
 */
export function decidirToast(
  state: { error?: string; field?: string } | undefined,
  idDeMensaje: IdDeMensaje,
  buscar: (id: string) => Pintable | null,
  /**
   * El id del mensaje **general** del formulario, si tiene uno propio en
   * pantalla (el público de postulación lo pinta junto al botón). Se consulta
   * solo cuando el campo no pintó el suyo: así el toast no repite algo que ya
   * está a la vista, y sigue hablando cuando no hay nada.
   */
  idGeneral?: string,
): DecisionDeError {
  if (!state?.error) return { toast: null, llevarA: null };
  const idCampo = state.field ? idDeMensaje(state.field) : null;
  if (idCampo && seVe(buscar(idCampo))) return { toast: null, llevarA: idCampo };
  if (idGeneral && seVe(buscar(idGeneral))) return { toast: null, llevarA: idGeneral };
  return { toast: state.error, llevarA: null };
}

/**
 * El aviso de error de un formulario, con la única condición que la regla 12
 * de `AGENTS.md` acepta: **el toast habla cuando el mensaje NO se ve**, y
 * cuando sí se ve, lleva al usuario hasta él.
 *
 * **Por qué mira el DOM y no una lista.** La versión anterior de esto era un
 * `MUESTRA_SU_MENSAJE: Record<string, boolean>` copiado en siete componentes,
 * que había que mantener a mano en sincronía con el JSX y con cada schema —
 * exactamente la "lista aparte" que la regla 11 llama trampa. Y falló como
 * falla una lista aparte: decía `true` para campos que en ese momento no se
 * veían (un diálogo que el usuario cerró mientras la acción corría), así que el
 * toast se callaba y el mensaje se pintaba dentro de un `<dialog>` cerrado. El
 * error quedaba **mudo**, que es el peor final posible (regla 5).
 *
 * **Y pintado no es lo mismo que visto.** En un formulario largo el mensaje
 * puede quedar a dos pantallas del botón que se acaba de tocar: sin toast y sin
 * nada que se mueva, el usuario solo ve que el botón dejó de girar. Por eso,
 * cuando el mensaje sí está pintado, el foco va al control que lo tiene por
 * descripción (`aria-describedby`) y el navegador lo trae a la vista. Es un
 * salto instantáneo, no una animación: no hay nada que reducir con
 * `prefers-reduced-motion`.
 *
 * **Límite conocido**: si el componente se desmonta mientras la acción corre
 * —cambiar de pestaña en el cajón del candidato— no queda nadie para avisar,
 * ni por toast ni debajo del campo. Eso no lo arregla este hook: hay que
 * mantener montado lo que tiene una mutación en vuelo.
 *
 * El éxito no pasa por acá: cada formulario hace algo distinto al guardar
 * (limpiar, cerrar el diálogo, avisar al padre), así que eso se queda en su
 * propio efecto.
 */
export function useErrorToast(
  state: { error?: string; field?: string } | undefined,
  /** **Obligatorio a propósito.** Hubo un default (`${campo}-error`) y era un
   *  espacio de ids del documento entero: cualquier elemento de la pantalla que
   *  cayera en ese nombre hacía creer al hook que el mensaje se ve, y se
   *  callaba. Pedirlo siempre convierte ese olvido en un error de compilación. */
  idDeMensaje: IdDeMensaje,
  /** Ver `decidirToast`: el mensaje general propio del formulario, si lo hay. */
  idGeneral?: string,
) {
  useEffect(() => {
    const { toast, llevarA } = decidirToast(state, idDeMensaje, (id) => document.getElementById(id), idGeneral);
    if (toast) {
      notifyError(toast);
      return;
    }
    if (!llevarA) return;
    // **Y si no se pudo llevar, el toast vuelve a hablar.** El mensaje está
    // pintado, pero el usuario tiene el foco en otro lado de la pantalla y
    // moverle la vista sería peor; sin esto se quedaba sin toast, sin salto y
    // sin nada — el fallo mudo por la puerta de atrás.
    if (!llevarAlCampo(llevarA, llevarA === idGeneral) && state?.error) notifyError(state.error);
    // `idDeMensaje` fuera de las dependencias a propósito: los formularios la
    // pasan como flecha en línea, o sea una función nueva en cada render, y con
    // ella adentro el efecto se re-dispararía —y el toast se repetiría— en cada
    // render posterior al error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, idGeneral]);
}

/**
 * ¿Se puede mover el foco (y la vista) al campo que falló?
 *
 * **Solo si nadie más lo tiene.** Una Server Action tarda, y en ese rato el
 * usuario puede haberse ido a escribir a otro formulario de la misma pantalla;
 * llevarle el cursor de vuelta le manda las teclas siguientes al campo
 * equivocado y le deja a medias lo que estaba escribiendo.
 *
 * Las tres situaciones en que sí:
 * - nadie tiene el foco (`null`) o lo tiene el `body`;
 * - lo tiene algo **dentro** del formulario que envió — lo normal, porque queda
 *   en el botón que se acaba de tocar;
 * - lo tiene un **ancestro** del formulario. Pasa siempre en un diálogo modal:
 *   al deshabilitarse el botón mientras la acción corre, el navegador devuelve
 *   el foco al `<dialog>`, que contiene al formulario y no al revés. Sin esta
 *   rama los dos diálogos del proyecto —descartar y referir— quedaban justo
 *   afuera de la ayuda escrita para ellos.
 *
 * Aparte, se exporta para poder probarla: es la única lógica con ramas de
 * `llevarAlCampo`, y el resto de ese cuerpo es DOM puro.
 */
export function puedeMoverElFoco(activo: Node | null, form: Node | null, body: Node | null): boolean {
  if (!activo || activo === body) return true;
  if (!form) return false;
  return form.contains(activo) || activo.contains(form);
}

/**
 * Trae a la vista el campo que falló y le da el foco. El control se encuentra
 * por su `aria-describedby`, que es justo la relación que `<Field>` ya crea
 * entre el control y su mensaje — no hace falta una segunda referencia que
 * mantener. `~=` porque el atributo puede llevar varios ids separados por
 * espacio (la ayuda permanente y el error).
 *
 * **Devuelve si de verdad movió**, y eso importa: si no pudo, el que llama
 * tiene que avisar por toast o el error se queda sin decir nada.
 */
function llevarAlCampo(idMensaje: string, esGeneral = false): boolean {
  // El id va dentro de COMILLAS en el selector, o sea contexto de string de
  // CSS, no de identificador: lo único que hay que escapar acá es la comilla y
  // la barra. `CSS.escape` es para identificadores y acá "funcionaba" solo por
  // cómo se solapan las dos gramáticas — su forma hexadecimal (`\31 abc`) es
  // una trampa esperando a que alguien reformatee el selector.
  const seguro = idMensaje.replace(/["\\]/g, "\\$&");
  const control = document.querySelector<HTMLElement>(`[aria-describedby~="${seguro}"]`);
  const destino = control ?? document.getElementById(idMensaje);
  if (!destino) return false;
  if (process.env.NODE_ENV !== "production" && !control && !esGeneral) {
    // El mensaje está en pantalla pero ningún control lo tiene por descripción:
    // falta el `aria-describedby`. Se puede desplazar hasta él, pero no darle el
    // foco al campo, y un lector de pantalla no lo lee al volver al control.
    // Sin este aviso, el cableado a mano se degrada en silencio. **Salvo el
    // mensaje general**, que por definición no es de ningún campo y no tiene
    // control que lo apunte: avisar ahí sería una falsa alarma en el camino
    // más común del formulario público.
    console.error(`Ningún control apunta a "${idMensaje}" con aria-describedby.`);
  }
  const form = control?.closest("form") ?? destino.closest("form");

  // El salto de vista va en la MISMA guardia que el foco: mover la ventana de
  // alguien que está escribiendo en otra parte molesta igual que robarle el
  // cursor, aunque las teclas sí lleguen a donde iban.
  if (!puedeMoverElFoco(document.activeElement, form, document.body)) return false;

  // `preventScroll` y después `scrollIntoView`: el scroll que hace el foco por
  // su cuenta deja el campo pegado al borde, y en este proyecto el borde de
  // abajo lo tapa la barra flotante.
  control?.focus({ preventScroll: true });
  destino.scrollIntoView({ block: "center" });
  return true;
}
