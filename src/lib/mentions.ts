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
 * 2. **El CUERPO es la fuente de a quién se notifica.** Los ids salen de los
 *    tokens del texto (`extractMentionIds`) y se validan en el servidor
 *    contra perfiles reales antes de notificar o de guardarse en la columna
 *    `mentions`; esa columna es el resultado de esa validación, no su
 *    entrada. Antes había además un array que mandaba el cliente y se
 *    contrastaba contra el cuerpo — se eliminó (en Postulaciones y en
 *    Conectados): era la misma información dos veces y la copia del cliente
 *    fue justo por donde entraron los dos huecos que documentan
 *    `canonicalizeMentions` y `resolveMentionTokens`.
 *
 * Las notas anteriores a este cambio no tienen tokens y se ven como texto
 * plano — sin negrita, pero sin romperse.
 *
 * Movido desde `src/lib/applications/mentions.ts` (2026-09-11): el algoritmo
 * no tiene nada específico de postulaciones y AJE Conectados lo necesita
 * también — ver `.claude/napkin.md` sobre el mismo hueco de seguridad de
 * menciones reintroducido en Conectados por no mirar este precedente.
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

/**
 * Los ids mencionados en el cuerpo. Es la ENTRADA a validar, nunca una lista
 * en la que ya se pueda confiar: el `uuid` sale de texto que escribió quien
 * publica, así que quien la use tiene que contrastarla contra perfiles reales
 * (misma organización, activos) antes de notificar o guardar nada.
 *
 * Ojo: el grupo de id del token es `[0-9a-fA-F-]{36}`, que también casa
 * basura como 36 guiones — no es un validador de UUID. Filtrar antes de
 * meterlo en una consulta (un id inválido hace fallar el `in (...)` entero).
 */
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
  // Deja intacto el token que no resolvió: acá el llamador (`addNote`) ya
  // rechaza el envío completo si el cuerpo menciona a alguien fuera de la
  // lista blanca, así que nunca llega a guardarse uno sin validar.
  return rewriteTokens(body, nombrePorId, (original) => original);
}

/** Un nombre no puede traer los caracteres que delimitan un token: si los
 * conserva, el texto degradado puede volver a formar un token válido. Mismo
 * saneo que `buildMentionToken` aplica al construirlo. */
function limpiarNombre(nombre: string): string {
  return nombre.replace(/[[\]()]/g, "").trim();
}

/** Recorre los tokens una sola vez; lo único que cambia entre los dos modos
 * (canonicalizar vs. degradar) es qué hacer con un uuid que no resolvió. */
function rewriteTokens(
  body: string,
  nombrePorId: ReadonlyMap<string, string>,
  sinResolver: (original: string, nombre: string) => string,
): string {
  return body.replace(TOKEN, (original: string, nombre: string, id: string) => {
    const real = nombrePorId.get(id.toLowerCase());
    return real ? buildMentionToken(real, id.toLowerCase()) : sinResolver(original, nombre);
  });
}

/**
 * Como `canonicalizeMentions`, pero además DEGRADA a texto plano cualquier
 * token cuyo uuid no esté en el mapa de perfiles válidos.
 *
 * `canonicalizeMentions` deja intacto el token desconocido, y eso alcanza en
 * Postulaciones porque ahí `addNote` rechaza el envío completo si el cuerpo
 * menciona a alguien fuera de la lista blanca. Donde no hay ese rechazo
 * (AJE Conectados: el muro es abierto, fallar una publicación entera por un
 * token raro escrito a mano sería peor), el token desconocido sobreviviría y
 * `MentionText` lo pintaría en negrita con el color de acento — el sello
 * visual de "esto lo resolvió el sistema" — con el nombre que haya escrito
 * quien publica. Es la misma suplantación que documenta
 * `canonicalizeMentions`, por la puerta de al lado.
 *
 * Con esto, TODO token que sobrevive apunta a un perfil real y muestra su
 * nombre autoritativo; lo demás queda como texto común y corriente.
 *
 * El nombre degradado se limpia de `[](` a propósito: sin eso, un token
 * ANIDADO se vuelve a armar solo. Con `@[@[Directora de RH](uuid-basura)](uuid-real)`
 * el regex casa el tramo externo con nombre `@[Directora de RH`; al degradarlo
 * tal cual quedaba `@[Directora de RH` seguido del `](uuid-real)` que no
 * casó — o sea, un token nuevo, válido y jamás validado, con el nombre que
 * eligió quien publica. Hallado en /code-review sobre este mismo arreglo.
 */
export function resolveMentionTokens(body: string, nombrePorId: ReadonlyMap<string, string>): string {
  return rewriteTokens(body, nombrePorId, (_original, nombre) => limpiarNombre(nombre));
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
