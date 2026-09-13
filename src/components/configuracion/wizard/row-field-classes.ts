/**
 * Las clases de una fila editable del asistente (una etapa en el paso 4, una
 * pregunta en el paso 3). Viven acá y no copiadas en cada editor porque las dos
 * filas ya divergieron una vez: la del paso 4 agrupó sus botones para que no
 * viajaran solos a la segunda línea y la del paso 3 no, y el ✕ de quitar una
 * pregunta terminó pegado al campo de otra.
 *
 * Lo que hay que entender antes de tocarlas: `html` lleva `overflow-x: hidden`
 * (`globals.css`), así que una fila que no entra **no** deja scroll — recorta,
 * y lo recortado son controles. Por eso cada campo lleva dos cosas y no una:
 * `min-w-0` para poder encoger, y un mínimo real para que, cuando ya no puede
 * encoger más, el padre (`flex-wrap`) corte línea en vez de que el navegador
 * empuje el resto fuera de la pantalla.
 */

/** El campo de texto: es el que manda, y el que fija el ancho mínimo de la fila. */
export const ROW_INPUT_CLASS =
  "h-9 min-w-[10rem] flex-1 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground";

/** El desplegable: encoge hasta donde haga falta y recupera su ancho fijo desde `sm:`. */
export const ROW_SELECT_CLASS =
  "h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm sm:w-40 sm:flex-none";

/**
 * La base que fuerza el salto de línea en un teléfono: sin un `flex-basis`
 * grande, `min-w-0` deja encoger hasta cero y la fila nunca envuelve — se
 * aprieta hasta que el campo de texto queda de 12px. Va en el hijo directo de
 * la fila, que en el paso 3 es el GRUPO (desplegable + ✕) y no el desplegable.
 */
export const ROW_WRAP_BASIS = "basis-36 sm:basis-auto";
