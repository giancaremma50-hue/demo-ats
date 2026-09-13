import type { z } from "zod";

/**
 * Único punto que traduce un fallo de Zod a `{ error, field }`. Sin esto, cada
 * acción repetía `parsed.error.issues[0]?.message` y el campo que falló se
 * perdía — el usuario solo veía un toast genérico sin saber cuál corregir.
 *
 * **`field` sale del path del primer issue, y SOLO si ese path tiene un único
 * segmento.** Con un segmento, coincide con el `name` del input (los
 * formularios se construyen con `Object.fromEntries(formData)`, así que las
 * claves del schema y los `name` de los inputs son literalmente las mismas) y
 * el mensaje tiene dónde ir. Un path anidado —`["questions", 2, "prompt"]` de
 * un schema del asistente— no nombra a ningún control del DOM: devolver
 * `"questions"` mandaba el mensaje a un campo que no existe, o sea a ningún
 * lado. Ahí `field` queda `undefined` a propósito y el mensaje cae en el canal
 * general, que sí se ve.
 */
export function zodFieldError(error: z.ZodError): { error: string; field?: string } {
  // `issues[0]` siempre existe: un `safeParse` que falla trae al menos un
  // issue, y todo issue de Zod trae `message` (el suyo o el genérico). Esta
  // función tenía un segundo parámetro `fallback` para cuando no lo hubiera,
  // que 28 llamadas pasaban con textos escritos como si el usuario fuera a
  // leerlos —"Revisa la tarea.", "Revisa las etapas."— y que no se mostraron
  // nunca. Se quitó: una copia muerta que parece viva es peor que no tenerla,
  // porque alguien la edita creyendo que arregla algo.
  const issue = error.issues[0]!;
  // **Solo cuando el path tiene UN segmento.** Un schema anidado o de arreglo
  // da paths como `["questions", 0, "prompt"]`, y ahí `path[0]` es el nombre
  // del contenedor — no el de ningún control. Devolverlo mandaría el mensaje a
  // un campo que no existe, o sea a ninguna parte; sin `field`, el formulario
  // cae en el mensaje general, que se ve. Quedarse mudo es peor que ser vago.
  const unico = issue.path.length === 1 ? issue.path[0] : undefined;
  return { error: issue.message, field: typeof unico === "string" ? unico : undefined };
}
