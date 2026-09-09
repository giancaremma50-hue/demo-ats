/**
 * Menciones incrustadas en el cuerpo de la nota, como `@[Nombre](uuid)`.
 *
 * Antes las menciones eran solo una lista de ids en `notes.mentions` y el
 * cuerpo era texto plano: el nombre NO estaba en el texto, así que no había
 * nada que poner en negrita — solo se podía imprimir "mencionó a X" abajo.
 * Guardar el token dentro del cuerpo es lo que permite escribir `@` y ver el
 * nombre resaltado donde va (decisión del usuario, 2026-09-09).
 *
 * Dos consecuencias que conviene tener presentes:
 *
 * 1. **La nota guarda el nombre del momento.** Si alguien cambia de nombre
 *    después, las notas viejas conservan el anterior. Es lo correcto para un
 *    registro histórico: dice a quién se mencionó tal como se leía ese día.
 * 2. **`notes.mentions` sigue existiendo** y sigue siendo la fuente para
 *    notificar y para validar permisos. El token es presentación; los ids son
 *    el dato. Nunca se confía en los ids del token para notificar.
 *
 * Las notas anteriores a este cambio no tienen tokens y se ven como texto
 * plano — sin negrita, pero sin romperse.
 */

/**
 * `@[Nombre](uuid)`.
 *
 * El nombre excluye `]` (cerraría el token antes) y **también saltos de línea**:
 * una clase negada casa `\n`, así que sin excluirlo un nombre de 120 caracteres
 * podía ser una cita inventada de varias líneas pintada en negrita con el color
 * de acento — el sello visual que la interfaz reserva para una mención resuelta
 * por el sistema. Un token multilínea ahora no casa y se lee como texto
 * literal, que es lo correcto. Hallado en /security-review.
 */
const TOKEN = /@\[([^\]\n\r]{1,120})\]\(([0-9a-fA-F-]{36})\)/g;

export type MentionPart = { tipo: "texto"; valor: string } | { tipo: "mencion"; nombre: string; profileId: string };

/**
 * Parte el cuerpo en texto y menciones para renderizar.
 *
 * Devuelve partes en vez de HTML a propósito: el componente pinta cada trozo
 * como `{parte.valor}` de React, así que un cuerpo con `<script>` se muestra
 * como texto literal. Con `dangerouslySetInnerHTML` esto sería un XSS
 * almacenado — cualquiera con permiso de escribir una nota podría inyectar.
 */
export function parseMentions(body: string): MentionPart[] {
  const partes: MentionPart[] = [];
  let ultimo = 0;
  // `matchAll` sobre una regex global: no comparte `lastIndex` entre llamadas,
  // que es la trampa clásica de reusar una regex `/g` con `.test()`/`.exec()`.
  for (const m of body.matchAll(TOKEN)) {
    const inicio = m.index;
    if (inicio > ultimo) partes.push({ tipo: "texto", valor: body.slice(ultimo, inicio) });
    partes.push({ tipo: "mencion", nombre: m[1], profileId: m[2].toLowerCase() });
    ultimo = inicio + m[0].length;
  }
  if (ultimo < body.length) partes.push({ tipo: "texto", valor: body.slice(ultimo) });
  return partes;
}

/** Los ids mencionados en el cuerpo. Se usa para CONTRASTAR contra lo que manda el cliente, no para confiar. */
export function extractMentionIds(body: string): string[] {
  return [...new Set([...body.matchAll(TOKEN)].map((m) => m[2].toLowerCase()))];
}

/**
 * Reescribe cada token con el nombre AUTORITATIVO del perfil.
 *
 * El servidor validaba el `uuid` contra la lista blanca pero se quedaba con el
 * nombre que venía en el texto — y ese nombre se pinta en negrita con el color
 * de acento, o sea con el sello de "esto lo resolvió el sistema". Dos abusos
 * salían de ahí, los dos dentro del registro que sostiene decisiones de
 * contratación:
 *
 * 1. **Suplantación**: escribir `@[Ana Ramírez (Directora de RH)](uuid-de-otro)`
 *    y que se lea como una mención legítima.
 * 2. **Repudio**: usar el uuid PROPIO — pasa la lista blanca, se filtra de las
 *    notificaciones por ser uno mismo, y queda constancia de "se lo avisé a RH"
 *    sin que a RH le llegara nada.
 *
 * Canonicalizar mata las dos de una vez: el token auto-mencionado se delata
 * porque se pinta con el nombre del propio autor. Hallado en /security-review.
 */
export function canonicalizeMentions(body: string, nombrePorId: ReadonlyMap<string, string>): string {
  return body.replace(TOKEN, (original, _nombre: string, id: string) => {
    const real = nombrePorId.get(id.toLowerCase());
    return real ? buildMentionToken(real, id.toLowerCase()) : original;
  });
}

/**
 * Arma el token que se inserta en el textarea al elegir a alguien del
 * autocompletado. Un nombre con `]` rompería el formato, así que se limpia
 * acá y no en el llamador.
 */
export function buildMentionToken(nombre: string, profileId: string): string {
  return `@[${nombre.replace(/[[\]()]/g, "").trim()}](${profileId})`;
}

/**
 * Lo que se está escribiendo después de un `@` en la posición del cursor, si
 * es que hay algo. `null` = no hay un `@` activo y el autocompletado no va.
 *
 * Solo dispara cuando el `@` arranca palabra (inicio del texto o precedido por
 * espacio/salto de línea): así un correo escrito en la nota
 * ("ana@empresa.com") no abre el buscador en medio de la palabra.
 */
export function activeMentionQuery(texto: string, cursor: number): { query: string; desde: number } | null {
  const antes = texto.slice(0, cursor);
  const arroba = antes.lastIndexOf("@");
  if (arroba === -1) return null;

  const anterior = arroba === 0 ? "" : antes[arroba - 1];
  if (anterior !== "" && !/\s/.test(anterior)) return null;

  const query = antes.slice(arroba + 1);
  // Un salto de línea cierra la búsqueda; un espacio simple no, para poder
  // escribir "@ana lu" y encontrar "Ana Lucía".
  if (/[\n\r]/.test(query) || query.length > 40) return null;
  return { query, desde: arroba };
}
