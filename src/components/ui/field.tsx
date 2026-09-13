import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * El aspecto de un control en error: **borde de 2px y fondo tenue**, no solo el
 * color del borde (`AGENTS.md`, regla 12 — el grosor es una señal que no
 * depende de ver el rojo). Se exporta porque los controles con layout propio
 * que no pueden pasar por `<Field>` tienen que pintar exactamente esto: con la
 * cadena escrita a mano en cada archivo, cambiarla significaba editar seis
 * lugares y no notar el séptimo. Con `box-sizing: border-box` el campo no
 * cambia de tamaño, solo su área interior.
 *
 * **Excepción declarada**: `note-form` se queda en 1px y por eso importa
 * `ERROR_CONTROL_TINT` (el color y el fondo, sin el grosor) en vez de esto. Su
 * caja de texto es un textarea transparente encima de un div que pinta el mismo
 * texto, y los dos tienen que medir EXACTAMENTE lo mismo o el cursor se
 * desalinea de las letras; un borde de 2px cambia la caja. El tinte va aparte
 * justamente para que esa excepción no tenga que volver a escribir la cadena:
 * cambiar el color sigue siendo un solo lugar.
 */
export const ERROR_CONTROL_TINT = "border-destructive bg-destructive-soft";
export const ERROR_CONTROL_CLASS = `border-2 ${ERROR_CONTROL_TINT}`;

/**
 * Avisos de desarrollo ya emitidos, por **campo Y motivo**. El aviso corre en
 * cada render: sin deduplicar, un campo controlado escupe un error por tecla —y
 * en StrictMode, dos—, que es exactamente cómo se aprende a ignorar la consola.
 * Y la clave lleva el motivo porque con solo el id, arreglar el primer problema
 * de un campo dejaba mudo al segundo.
 */
const yaAvisado = new Set<string>();

function avisarUnaVez(clave: string, mensaje: string) {
  if (yaAvisado.has(clave)) return;
  yaAvisado.add(clave);
  console.error(mensaje);
}

type Control = ReactElement<{
  className?: string;
  id?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
}>;

/**
 * Envoltorio de campo de formulario: etiqueta, control y mensaje de error, con
 * el cableado hecho por el componente y no por quien lo usa.
 *
 * **Por qué existe.** La auditoría del 2026-09-13 encontró que 18 de los 24
 * formularios solo avisaban con un toast: el mensaje se iba solo, no decía qué
 * campo, y no quedaba nada en pantalla. El texto ya estaba bien escrito —el
 * problema era dónde aparecía—, así que la regla tiene que vivir en un
 * componente y no en la disciplina de cada formulario, igual que
 * `<ActionButton>` para las mutaciones.
 *
 * **Las cuatro cosas que hace y que no se pueden perder:**
 *
 * - El mensaje va **debajo del campo**, en rojo y con ícono: color **y** texto,
 *   nunca color solo (un daltónico no ve un borde rojo).
 * - `aria-invalid` en el control, y `aria-describedby` apuntando al mensaje —
 *   sin eso un lector de pantalla dice "inválido" y se detiene ahí, con la
 *   explicación a un párrafo de distancia y nada que las conecte.
 * - `role="alert"` en el mensaje, así se **anuncia** al aparecer. Antes no había
 *   un solo `role="alert"` en todo el proyecto.
 * - El estado de error se marca con **borde de 2px y fondo tenue**, no solo con
 *   el color del borde: se distingue sin depender de ver el rojo.
 *
 * **El error NO toca el foco.** El anillo (`:focus-visible` de `globals.css`) va
 * por fuera con `outline-offset`, así que convive con el borde rojo. Antes los
 * dos usaban el mismo borde de 1px y la regla con pseudo-clase ganaba: al entrar
 * al campo para corregirlo, el rojo se volvía verde y la señal desaparecía justo
 * cuando hacía falta. Un campo nunca lleva `outline-none`.
 */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  /** El texto del error de ESTE campo. Un error que no es de ningún campo
   *  ("No se pudo guardar") sigue yendo al toast, que es donde corresponde. */
  error?: string | null;
  /** Ayuda permanente: formato esperado, límite, ejemplo. **Se queda cuando
   *  hay error**, y los dos textos entran en `aria-describedby`: quitarla justo
   *  cuando el campo falla le saca al usuario la única referencia de cómo se ve
   *  un valor correcto, que es lo que necesita para corregirlo. */
  hint?: string;
  children: Control;
}) {
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;
  const esElemento = isValidElement(children);

  if (process.env.NODE_ENV !== "production") {
    if (!esElemento) {
      // Sin un elemento, el `<label htmlFor>` apunta a la nada y el mensaje
      // queda sin dueño — y en silencio, porque el tipo `Control` solo estrecha
      // en el punto de llamada y cualquier `ReactNode` de más arriba se cuela.
      avisarUnaVez(`${id}:sin-elemento`, `<Field id="${id}"> espera un único elemento como hijo.`);
    }
    if (esElemento && children.props.id) {
      // `aria-describedby` SÍ se fusiona (ver abajo); `id` y `aria-invalid` se
      // pisan, porque `<Field>` es quien los define. Un control que traiga los
      // suyos —un combobox que calcula su propia validez, un `id` que es el
      // destino de un `aria-controls`— los perdería en silencio, que es
      // exactamente el bug que la fusión de `aria-describedby` vino a arreglar.
      // Acá no se puede fusionar (un elemento tiene UN id y UNA validez), así
      // que lo que corresponde es avisar.
      avisarUnaVez(`${id}:id`, `<Field id="${id}">: el hijo ya traía id="${children.props.id}" y se va a perder.`);
    }
    if (esElemento && children.props["aria-invalid"] !== undefined) {
      avisarUnaVez(`${id}:aria-invalid`, `<Field id="${id}">: el hijo ya traía aria-invalid y lo decide <Field>, no él.`);
    }
  }

  // La guardia va ANTES de leer `children.props`: con un hijo que no es
  // elemento (`{cond ? <input/> : null}`) esto reventaba con un TypeError y se
  // llevaba puesto el formulario entero, justo en el caso que el aviso de
  // arriba existe para reportar.
  // Se FUSIONA con lo que el control ya traía, no se pisa: un hijo que apunta a
  // su propia descripción la perdía en silencio y quedaba huérfana en el árbol
  // de accesibilidad. Varios ids separados por espacio es lo que acepta
  // `aria-describedby`.
  const descrito = [
    esElemento ? children.props["aria-describedby"] : null,
    hint ? idAyuda : null,
    error ? idError : null,
  ]
    .filter(Boolean)
    .join(" ");

  const control = esElemento
    ? cloneElement(children, {
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": descrito || undefined,
        className: cn(children.props.className, error && ERROR_CONTROL_CLASS),
      })
    : children;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </label>
      {control}
      {hint && (
        <p id={idAyuda} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && <FieldError id={idError}>{error}</FieldError>}
    </div>
  );
}

/**
 * El mensaje de error de un campo, suelto — para los formularios que todavía no
 * pasan por `<Field>` (una fila editable, un control con su propio layout).
 * Quien lo usa tiene que poner `aria-describedby={id}` y `aria-invalid` en su
 * control: eso es justo lo que `<Field>` hace solo, así que preferilo siempre
 * que se pueda.
 *
 * **Por qué lleva `role="alert"` Y es el destino de `aria-describedby`.** Al
 * aparecer se anuncia solo (que es lo que hacía falta: antes un error podía
 * pasar sin que nada lo dijera), y al volver al campo se vuelve a leer como su
 * descripción. Sí, se escucha dos veces en ese caso — es el precio de que
 * ninguna de las dos situaciones quede muda, y es lo que recomienda la práctica
 * habitual para un error de validación.
 *
 * No contradice la nota de `application-form` sobre la casilla de privacidad:
 * allá el texto **es la etiqueta** del control (va dentro del `<label>`), así
 * que apuntarlo además como descripción repetía el nombre; acá el texto no es
 * la etiqueta de nadie.
 */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
      <AlertCircle className="size-3.5 flex-none translate-y-px" strokeWidth={2.5} aria-hidden />
      {/* `min-w-0` + `break-words`, en par: un mensaje puede traer el valor que
          el usuario escribió («"usuario@subdominio-largo.empresa.com.gt" no es
          un correo válido»), y sin los dos el `<span>` no baja de su tamaño
          min-content, se sale del ancho y `html` lo recorta sin barra — el
          usuario ve media frase y nunca se entera de qué fue lo rechazado. */}
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
