/**
 * Las señales de error de un control, **sin React y sin `"use client"`**.
 *
 * Viven en su propio módulo a propósito: `ui/field.tsx` los usa y no lleva
 * directiva, así que importarlos desde `use-error-toast.ts` —que sí es de
 * cliente— convertía a `<Field>` en un componente que revienta al renderizarse
 * desde el servidor. Son funciones puras: no tienen por qué arrastrar esa marca.
 */

/**
 * El cableado de error de **un control suelto** que no puede pasar por
 * `<Field>` porque tiene layout propio: un `<select>` con su fila de alta al
 * lado, un grupo de casillas, una caja de texto dentro de una `<Card>`.
 *
 * Devuelve las cuatro señales desde una sola fuente. Repetirlas a mano —
 * `aria-invalid={Boolean(error)}`, `aria-describedby={error ? id : undefined}`,
 * la clase del borde y el `<FieldError>`— es como terminan diciendo cosas
 * distintas: el control marcado en rojo y el mensaje sin renderizar.
 *
 * **Exige que HAYA mensaje, no solo campo**, por lo mismo que `camposDeFila`.
 */
export function campoSuelto(error: string | undefined, idError: string | undefined) {
  const activo = Boolean(error) && Boolean(idError);
  return {
    /** ¿Está en error? Para la clase del borde. */
    enError: activo,
    /** Las dos referencias que van en el control. */
    props: {
      "aria-invalid": activo,
      "aria-describedby": activo ? idError : undefined,
    },
    /** El id del mensaje, o `undefined` si no hay nada que mostrar. */
    idMensaje: activo ? idError : undefined,
    /** El texto, o `undefined`. */
    mensaje: activo ? error : undefined,
  };
}

/**
 * El cableado de error de una **fila** de formulario: los campos comparten
 * línea con el botón, así que el mensaje no puede ir dentro de la columna de
 * un campo —con `items-end` empujaría el botón hacia abajo al fallar— y
 * `<Field>` no sirve. Esto da las mismas piezas a mano, desde una sola fuente.
 *
 * Vivía copiado en cuatro filas (invitar, agregar motivo, tarea, miembros) con
 * formas ligeramente distintas, que es como se desincronizan.
 *
 * **Exige que HAYA mensaje, no solo campo**: un resultado con `field` y sin
 * `error` pintaba el borde rojo y un `role="alert"` vacío, que un lector de
 * pantalla anuncia como nada — y `useErrorToast` lo veía pintado y se callaba.
 */
export function camposDeFila<const T extends readonly string[]>(
  state: { error?: string; field?: string } | undefined,
  /** Prefijo de los ids, siempre un `useId()`. */
  prefijo: string,
  /** Los campos que esta fila PINTA. Un campo del schema que no esté acá cae
   *  en el toast, que es lo correcto: no tiene dónde mostrarse. */
  campos: T,
) {
  const cual = campos.find((c) => c === state?.field);
  // Se apoya en `campoSuelto` en vez de repetir el contrato: son las mismas
  // cuatro señales, y escribirlas dos veces es exactamente cómo terminan
  // diciendo cosas distintas — el motivo por el que estos helpers existen.
  const campo = campoSuelto(cual ? state?.error : undefined, cual ? `${prefijo}-${cual}-error` : undefined);
  const sinError = { "aria-invalid": false, "aria-describedby": undefined };
  return {
    /** ¿Hay algún campo de esta fila en error? Mismo tipo y mismo nombre que en
     *  `campoSuelto`: si uno devolviera el nombre del campo y el otro un
     *  booleano, un `=== true` en el lugar equivocado descartaría el mensaje. */
    enError: campo.enError,
    /** CUÁL falló, si alguno. */
    cual: campo.enError ? cual : undefined,
    mensaje: campo.mensaje,
    idMensaje: campo.idMensaje,
    /** ¿Es ESTE el campo que falló? Para la clase del borde. */
    es: (nombre: T[number]) => campo.enError && cual === nombre,
    /** Las dos referencias que van en el control. */
    props: (nombre: T[number]) => (campo.enError && cual === nombre ? campo.props : sinError),
  };
}
