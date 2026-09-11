# Napkin Runbook — ATS

> **Cómo leer esto.** `MÁXIMA PRIORIDAD` marca las trampas transversales: lo
> que hay que saber ANTES de tocar código, sin importar en qué se trabaje.
> Los registros de fase y de entrega de funcionalidad quedan abajo sin marca
> — son historia de la construcción, se consultan cuando se toca esa parte.
> Curado el 2026-09-11: la marca estaba en 52 de 72 secciones, o sea en
> ninguna. Al agregar una entrada, re-evaluar si de verdad es transversal.

_Última actualización: 2026-09-11 (una barra que se esconde deja rastro, y el rastro es ELLA plegada; y paginación real del kanban, con 3 bugs de concurrencia encontrados por `/code-review`)_

## Una barra que se esconde tiene que dejar rastro, y el rastro tiene que ser ELLA (2026-09-11) — MÁXIMA PRIORIDAD

La barra flotante se desmontaba al bajar y no quedaba nada en pantalla: el
usuario reportó que "desapareció". Las primeras propuestas —un asa aparte, un
riel, un botón circular— se descartaron con una frase suya que vale como
regla: *"lo único que quiero es que se contraiga, que se haga una línea
delgada visible"*. La señal no es un objeto nuevo al lado del menú: es el menú
plegado. Lo que costó, en orden de cuánto tardó en aparecer:

1. **CSS no sabe animar de `auto` a un tamaño fijo.** La píldora mide lo que
   mide su contenido, así que contraerla a 108 px saltaba en vez de animar. Se
   MIDE el ancho abierto y se escribe como variable CSS en el DOM desde un
   efecto (escribir en el DOM no es `setState`, que en un efecto es error de
   build acá). Se re-mide con `ResizeObserver`, no con el `resize` de la
   ventana: la tipografía que llega tarde y el zoom de texto del navegador
   cambian el ancho sin disparar `resize` ni cambiar de ruta.
2. **Esa misma transición hay que APAGARLA al re-medir.** Cambiar de módulo
   cambia el contenido y el ancho: con la transición viva, el ancho anima 300 ms
   con el contenido nuevo YA pintado y se lo ve asomar fuera de la píldora. Se
   apaga (`transitionProperty = "none"`), se escribe el valor, se fuerza el
   recálculo leyendo `getBoundingClientRect()` y recién ahí se devuelve. La
   transición es para plegar y desplegar, no para medir.
3. **Medir con `scrollWidth`, no con la caja.** Cuando el contenido no cabe se
   le da scroll propio, y desde ese momento su caja mide lo que el recorte le
   deja: medir eso encoge la píldora un poco más en cada vuelta del observer.
4. **El recorte solo mientras está plegada.** `overflow: hidden` hace falta
   para que el contenido no asome mientras se encoge, pero desplegada tiene
   que ser `visible` o se come los tooltips, que viven arriba de la píldora
   (CSS Overflow 3: fijar un eje arrastra al otro, y `clip` no salva el caso
   porque acá el eje que importa es el mismo). Y cuando de verdad no cabe
   —teléfono de 320 con el nombre del módulo y cuatro submenús— se paga el
   precio: scroll horizontal propio. Y el scroll es el valor POR DEFECTO, con
   la medición LEVANTÁNDOLO cuando comprueba que cabe, nunca al revés: hasta
   que hidrate no hay atributo que leer, y un contenido que no puede encogerse
   (hijos `flex-none`) se sale de la píldora y lo recorta el `overflow-x:
   hidden` del `<body>`, sin scroll con el que alcanzarlo. Sin salida de
   emergencia, el selector y el engranaje (dos de las tres anclas) se recortan
   contra el borde. Y el tope de ancho
   va TAMBIÉN en CSS (`max-w-[calc(100vw-1rem)]`), no solo en la medición:
   hasta que hidrate —y para siempre si la hidratación falla— el ancho es
   `auto`, y lo que se sale por la izquierda de un elemento centrado no se
   alcanza ni con scroll.
5. **"Plegada" y "el contenido no se ve" NO son lo mismo, y de confundirlas
   sale todo el lío del foco.** Al plegar, el contenido deja de servir en el
   acto; al desplegar tarda 300 ms en aparecer (espera + fundido). Una sola
   bandera para las tres cosas que dependen de eso —`inert`, si la píldora
   puede tener el foco, y cuándo devolvérselo al contenido— porque atarlas a
   `plegada` rompía cada una por su lado: enlaces invisibles que igual reciben
   el clic (el mismo con el que se abrió la barra), y un `tabIndex` que
   desaparece mientras el foco está encima, que el navegador resuelve
   soltándolo en `<body>`. La opacidad va con demora asimétrica: al plegar se
   desvanece de inmediato (si no, se ve aplastado), al desplegar espera.
6. **Mientras el contenido no sirve, la píldora ES el botón** (`role` +
   `aria-label` + `tabIndex` + `aria-expanded`, las cuatro cosas atadas a la
   MISMA bandera: desplegada contiene enlaces y un botón no puede contenerlos,
   pero dejarla focusable sin nombre ni rol durante la animación deja al
   lector de pantalla con un elemento anónimo enfocado, que es WCAG 4.1.2).
   Y el foco hay que anotarlo **antes** de cada commit, en los DOS sentidos:
   la regla de *focus fixup* del HTML dice que el navegador suelta en `<body>`
   el foco de un elemento que dejó de ser focusable, así que para cuando corre
   el efecto ya no hay nada que preguntar. Vale al plegar (el `inert` se traga
   el foco del enlace) y vale al terminar de desplegar (quitarle el `tabIndex`
   a la píldora se traga el foco que se le había aparcado). Cada anotación se
   consume en el efecto siguiente; una que sobreviva le roba el foco minutos
   después a lo que el usuario esté escribiendo. Y
   Radix devuelve el foco al disparador del Popover al cerrarse — si la barra
   se plegó con el selector abierto, ese disparador quedó `inert`: se atiende
   en `onCloseAutoFocus`, preguntándole al DOM (no al estado, que en un
   desmontaje es el del render de entonces). Todo `focus()` sobre un elemento
   `fixed` va con `{ preventScroll: true }`: en iOS el navegador corre la
   página unos píxeles para "traerlo a la vista" y eso dispara el manejador de
   scroll, que vuelve a plegar la barra recién abierta.
7. **12 px de alto no alcanzan para un destino táctil** (WCAG 2.5.8 pide
   24×24). El parche invisible que lo lleva a 26 va AFUERA de la píldora
   (plegada es `overflow: hidden` y recorta cualquier cosa que le cuelgue) y
   crece hacia ABAJO, hacia el aire que la barra ya ocupa: una franja gruesa
   por encima del lomo se traga los toques de lo último de la página sin que
   se vea ningún control ahí. Y vive tanto como el lomo se vea, no como dure
   el estado "plegada": desmontarlo en el primer fotograma del despliegue deja
   el segundo toque —el que todos damos cuando el primero no pareció hacer
   nada— cayendo en la página.
8. **TypeScript no conserva el estrechamiento de un `const` en una función
   DECLARADA adentro del efecto** (se iza sobre la comprobación de `null`).
   Con `const medir = () => {}` sí lo conserva. Trampa de sintaxis pura, pero
   cuesta cinco minutos cada vez.

## `env(safe-area-inset-*)` vale 0 mientras el viewport no declare `viewport-fit=cover` (2026-09-11) — MÁXIMA PRIORIDAD

Hay `env(safe-area-inset-bottom)` en el padding de `<main>`, en la barra
flotante y en varios `calc()` de alto. **Hoy todos resuelven a 0**: la app no
exporta ningún `viewport` (Next emite el `width=device-width, initial-scale=1`
por defecto), y sin `viewport-fit=cover` iOS recorta el viewport él mismo, así
que las insets quedan en cero. O sea que la barra ya está por encima del home
indicator por otra razón, no por el `env()`.

No son código muerto —la cuenta sigue cerrando si algún día se declara
`viewport-fit: "cover"`, y es justo el término que haría falta— pero sí lo son
las justificaciones. Dos veces se escribió en un comentario que sin ese
término "en un iPhone el borde queda 34px más abajo": describe un
comportamiento que la app no tiene. **Antes de usar un `env()` como argumento
de un cálculo o de un comentario, comprobar si hay `viewport-fit=cover`.** Y
al declararlo algún día, hay que revisar TODA pantalla que hoy asume un
viewport ya recortado, porque pasarían a pintarse debajo de la barra de inicio.


## Paginación real del kanban: 3 bugs de estado que solo salen con volumen o con dos acciones casi simultáneas (2026-09-11)

Pendiente #17. `getKanbanData` traía TODAS las postulaciones activas de la
vacante en un solo payload; el tope de 50 por columna era solo del cliente.
Se rediseñó a una consulta por etapa (50 + conteo real), "ver más" por
cursor (`applied_at`), y búsqueda por nombre movida al servidor (con
debounce) para no perder resultados fuera de lo cargado. Nada de esto se
pudo probar visualmente: la base de este proyecto no tiene ninguna etapa con
más de 1 postulación activa hoy, y el login real (Google OAuth) no se puede
completar desde este entorno — verificado por `npm run build` completo +
`/code-review` a `medium` (4 ángulos en paralelo), no por navegador.

1. **Los 3 hallazgos reales que salieron del review son del mismo género:
   "funciona con una sola cosa pasando a la vez", y ni las pruebas unitarias
   ni un build limpio lo agarran.**
   - `moveCard` revertía con un snapshot completo (`previousCards`) en vez de
     deshacer solo SU movimiento — dos arrastres casi seguidos donde el
     primero falla tarde hacían que el rollback del primero borrara el éxito
     del segundo. Fix: revertir puntualmente (volver esa tarjeta a su etapa
     de origen), nunca restaurar una foto vieja completa.
   - La búsqueda hidrataba tarjetas escribiendo por encima cualquier entrada
     existente — un drag optimista corriendo al mismo tiempo que una
     búsqueda debounced para ese candidato podía perder el cambio visual.
     Fix: `addMissingCards()` solo AGREGA lo que falta, nunca pisa una
     entrada que ya está en memoria.
   - Ese mismo `addMissingCards()` cerró de paso un segundo bug: una tarjeta
     hidratada por búsqueda podía volver a llegar sin deduplicar cuando
     después se pedía "ver más" en esa columna — dos entradas con la misma
     `key` de React.
   Do instead: **cuando dos fuentes de datos (una acción optimista del
   usuario y una respuesta de red que llega después) pueden escribir la
   MISMA pieza de estado, la de la red nunca gana por default** — o se
   fusiona con cuidado (agregar, no reemplazar) o se descarta si es más
   vieja que lo que ya hay. "Restaurar el snapshot de antes" es tentador
   como manejo de error porque es una línea, pero asume que nada más cambió
   ese estado mientras tanto — falso en cuanto hay dos acciones en vuelo.
2. **Un cálculo de "hay más" y un cálculo de "cuántas hay en total" tienen
   que usar la MISMA fuente, o divergen en el borde exacto.** La carga
   inicial marcaba `nextCursor` solo si `cards.length === PAGE_SIZE Y
   totalCount > cards.length`; "ver más" solo miraba lo primero — con un
   resto de exactamente una página completa (100 en total, columna con 50 +
   50), prometía una tercera página vacía. Fix: pedir una fila de más
   (`LIMIT PAGE_SIZE + 1`) en vez de una segunda consulta de conteo en cada
   "ver más" — barato y sin el desfase.
3. **Combinar dos consultas en una no es solo más rápido, evita que dos
   números que deberían coincidir se calculen por caminos distintos.**
   `{ count: "exact" }` en la MISMA consulta que trae las filas (PostgREST
   cuenta sobre el total que cumple los filtros, antes del `LIMIT`) reemplazó
   una segunda consulta `head: true` aparte — la mitad de los round-trips en
   la carga inicial, y un solo lugar del que sale tanto `cards` como
   `totalCount`.
4. **Un `.select()` armado con `.replace()` en tiempo de ejecución pierde el
   tipo que `supabase-js` infiere del string literal.** Se intentó compartir
   la lista de columnas (`KANBAN_CARD_SELECT`) también para la consulta con
   `candidates!inner(...)` reemplazando el texto a mano — compiló distinto:
   la fila pasó a `any`/`GenericStringError`. El `.select()` de esa consulta
   quedó como string literal propio, sin derivar del compartido. Do instead:
   compartir la lista de columnas entre consultas CON EL MISMO tipo de join
   (interno o no) es seguro; para una variante con un join distinto,
   escribir el literal aparte es más simple y más seguro en tipos que
   derivarlo a mano.

## El proyecto ya tiene runner de tests: vitest (2026-09-11)

Pendiente #18 de `docs/PENDIENTE.md`. La lógica pura de menciones
(`src/lib/mentions.ts`: `parseMentions`, `extractMentionIds`,
`canonicalizeMentions`, `resolveMentionTokens`, `activeMentionQuery`) se había
verificado a mano el 2026-09-09 con un script suelto que nunca quedó en el
repo — `node` exige `.ts` en el import y `tsc` lo prohíbe
(`allowImportingTsExtensions`), así que dejarlo habría roto el `typecheck`
del CI. Sin runner, esa lógica no tenía red.

1. **`vitest@5` pide `@types/node` ^22 o ^24; el proyecto tenía `^20`.**
   Bloqueó el install con un conflicto de peer dependency. Se subió
   `@types/node` a `^24` (types-only, sin efecto en runtime) en vez de fijar
   una versión vieja de vitest — el proyecto ya corre Node 24 en CI
   (`.github/workflows/ci.yml`) y en producción (Vercel, Node 24 LTS por
   default), así que las declaraciones de tipos ya deberían decir eso.
2. **Al escribir la prueba del caso de anidamiento
   (`@[@[Directora](idFalso)](idReal)`), la primera aserción
   (`not.toContain('](idReal)')`) fue la equivocada** — el string degradado
   real SÍ contiene ese fragmento (`"@Directora](idReal)"`, resultado
   correcto y esperado), lo que hizo fallar la prueba aunque el código de
   `resolveMentionTokens` estuviera bien. El invariante real no es "el string
   no contiene tal substring" sino "el string, vuelto a pasar por
   `parseMentions`, no produce ninguna mención" — eso es lo que
   `resolveMentionTokens` promete (que no se reconstruya un token nuevo), no
   una forma textual específica del resultado degradado.
   Do instead: al probar una función que transforma texto para IMPEDIR que
   se vuelva a interpretar de cierta forma, la aserción correcta pasa el
   resultado de nuevo por el parser real (acá, `parseMentions`) y comprueba
   la ausencia del efecto — no por una forma de string a mano, que puede
   acertar por casualidad o fallar por un detalle irrelevante (como sucedió).
3. **`vitest.config.ts` sin alias de `@/`** — `mentions.ts` no importa nada
   con ese alias (es la única lógica pura sin dependencias del árbol de
   `src/lib` hoy), así que no hizo falta `vite-tsconfig-paths` todavía.
   Agregar esa dependencia recién cuando el primer archivo de test necesite
   importar algo vía `@/...`.

## Dos flujos nunca notificaban a nadie: agendar entrevista y asignar tarea (2026-09-11)

Pendiente #16 de `docs/PENDIENTE.md`, dejado aparte a propósito el 2026-09-09.
`scheduleInterview` y `addTask` guardaban la fila pero nunca llamaban a
`notify()` para los destinatarios internos — solo el candidato se enteraba de
la entrevista; de la tarea no se enteraba nadie.

1. **No era un bug de lógica rota, era lógica que nunca se escribió** — mismo
   patrón ya usado para `mencion_nota` (`src/lib/applications/actions.ts`) y
   `vacante_pendiente_aprobacion` (`notifyPendingApproval` en
   `src/lib/jobs/actions.ts`), solo que nadie lo replicó acá. Se copió ese
   patrón exacto: `notifyBestEffort()` después del insert (nunca antes — la
   fila ya tiene que estar guardada), auto-exclusión de quien dispara la
   acción (nadie se notifica a sí mismo), y reuso de `isProfileAssignable`
   que ya validaba destinatarios antes de esta sesión.
2. **`/code-review` a `medium` encontró dos hallazgos reales, ninguno de
   lógica.** (a) La función nueva `notifyAttendeesOfInterview` nació con 10
   argumentos posicionales — mismo tipo de riesgo que un `WRITE_PERMISSIONS`
   mal mantenido: nada evita trastocar `jobTitle` por `candidateName` en el
   call site salvo mirar con cuidado. Se convirtió a un solo objeto de
   opciones. (b) La plantilla nueva (`emails/entrevista-agendada-interno.tsx`)
   copió el cálculo de fecha de `entrevista-programada.tsx` a mano y **ya
   había perdido una línea** (la aclaración "se muestra en tu propia zona
   horaria") — la duplicación ni llegó a un segundo commit antes de
   divergir. Se extrajo `formatInterviewWhenUTC()` a
   `src/lib/interviews/calendar-link.ts`, el mismo archivo que ya compartía
   `buildInterviewCalendarUrl` entre los dos correos.
   Do instead: **dos plantillas de correo que muestran la misma fecha
   calculada de la misma forma comparten la función que la calcula, no el
   copy-paste del bloque de tres líneas** — un cálculo de zona horaria es
   exactamente el tipo de detalle que diverge en silencio (nadie prueba a
   mano las dos plantillas lado a lado) y ya lo hizo en el primer intento.
3. **Dos `notification_type` nuevos (`entrevista_agendada`, `tarea_asignada`)
   vía `ALTER TYPE ... ADD VALUE`**, cada uno en su propia migración
   separada de cualquier uso — Postgres permite usar un valor de enum recién
   agregado en la MISMA sesión, pero conviene no depender de en qué versión
   corre para saber si hace falta separarlo en dos transacciones. Tipos
   regenerados con `generate_typescript_types` y pegados sobre
   `database.types.ts` (diff de 4 líneas, nada más cambió — confirma que no
   hubo drift de otro schema mientras tanto).


## Una pantalla "compartida" no puede quedarse sin el botón de volver (2026-09-11) — MÁXIMA PRIORIDAD

Al hacer que `/configuracion` dejara de fingir que pertenece a un módulo, la
barra flotante pasó a mostrar ahí una composición "neutral" (puerta a los dos
módulos + Ajustes). Resolvía el problema de que "Inicio" llevara al ATS estando
en Conectados… y creaba uno peor: **Inicio desaparecía**. El usuario lo reportó
de inmediato.

1. **Hay ítems que no se negocian por contexto.** El selector de módulos y el
   Inicio del módulo son anclas: si cambian o desaparecen según la pantalla, la
   barra deja de ser un mapa y se vuelve adivinanza. Lo que se adapta son los
   submenús, no los anclas.
2. **"Técnicamente correcto" no gana contra "me quedé sin salida".** La barra
   neutral era más honesta (el selector no marcaba un módulo falso como
   activo), pero costaba el botón de volver a la pantalla principal. Entre las
   dos, la salida siempre.
3. **Una pantalla escondida dentro de la configuración es una pantalla que no
   existe.** La portada y las leyendas de la bolsa de empleo vivían en una
   sección de `/configuracion/marca`, tres niveles adentro de un menú de super
   admin. Ahora es `/bolsa`, un ítem del módulo, al lado de Vacantes y
   Candidatos. Pregunta que lo decide: **¿quién hace esta tarea?** Si la hace
   quien recluta, va en el módulo de reclutamiento; si la hace quien administra
   la plataforma, va en Ajustes.
4. **Separar una pantalla obliga a separar su Server Action.** `updateBranding`
   guardaba identidad + leyendas de la bolsa en un solo `update`; con dos
   formularios en dos pantallas, cada uno tendría que reenviar los campos del
   otro para no borrarlos. Dos acciones (`updateBranding` y
   `updateCareersContent`), cada una con su esquema.
5. **Una vista previa no se parece al destino: ES el destino.** El primer
   intento copiaba el degradado y el respaldo del título del héroe de
   `/empleos`; con eso, oscurecer el héroe real dejaría a la vista previa
   aprobando portadas ilegibles. Las dos pintan ahora el MISMO componente
   (`CareersHero`), con un `compact` para la escala. Y replica las DOS ramas:
   sin portada subida, `/empleos` no pinta un héroe oscuro sino un encabezado
   normal — una vista previa que muestra siempre el héroe hace afinar el
   título contra un contraste que nadie va a ver.
6. **Poner TEXTO sobre el color de marca obliga a rehacer el contraste de toda
   la barra.** Al meter el nombre del módulo en la píldora apareció el primer
   texto sobre el verde AJE, y blanco sobre `#00b348` da 2.8:1. Pasarlo a tinta
   oscura (`--aje-dark`, 6.5:1) dejó en evidencia que los íconos vecinos
   estaban peor: blanco al 60% sobre ese verde es 1.9:1, y son los destinos de
   navegación. Toda la barra pasó a tinta oscura. La regla: el primer elemento
   de texto que se apoya en un color de marca es el momento de medir TODO lo
   que ya estaba apoyado ahí.
7. **Un contenedor con `overflow-x` recorta también el eje vertical.** Por
   CSS Overflow 3, si un eje no es `visible` el otro pasa de `visible` a
   `auto`. La píldora con `overflow-x-auto` se comía los tooltips, que están
   `-top-9` — o sea afuera —, y los tooltips son la ÚNICA etiqueta que tienen
   los íconos cuando no están activos. Queda `overflow-x-auto sm:overflow-visible`:
   el deslizamiento hace falta en pantallas de 320px, donde no hay hover.
8. **Un nombre que dice dónde estás miente si la pantalla no es de nadie.**
   `/configuracion` cae en Reclutamiento por descarte (alguien tiene que poner
   el Home y los submenús), pero eso no autoriza a afirmar que el usuario está
   en ese módulo: quien llegó desde Conectados leería "Reclutamiento". El
   nombre se oculta en las rutas sin módulo; los tres anclas se quedan.
9. **Dos ítems activos a la vez rompen un `layoutId` compartido.** Con
   `/conectados` y un hipotético `/conectados/ajustes`, el match por prefijo
   marcaba los dos. El activo es el de la ruta MÁS ESPECÍFICA que coincide.
10. **Cinco ítems son el tope de la barra flotante, y el tope se verifica en
   píxeles.** Al agregar "Bolsa" la píldora llegó a ~406px: en un teléfono de
   390px se recortaba por los dos lados, comiéndose el selector de módulos y
   Ajustes. La etiqueta del ítem activo es lo más ancho de todo, así que en
   móvil se oculta (queda el fondo blanco como marca de "estás acá") y el
   padding se achica. `max-w-[calc(100vw-1.5rem)]` como red de seguridad.
11. **Un `.delete()` sin `.select()` reporta éxito cuando RLS filtró todo.**
   Devuelve `error: null` con cero filas: la tarjeta desaparece de la pantalla
   y vuelve al recargar. Todo borrado tiene que mirar cuántas filas tocó.
12. **Un `.then()` sin `.catch()` deja la pantalla cargando para siempre.** El
   hilo de comentarios se quedaba en "Cargando comentarios…" ante cualquier
   fallo de red, con un unhandled rejection en la consola y nada en pantalla.

## El cuerpo de una Server Action tiene un tope de ~4.5 MB en Vercel que `bodySizeLimit` NO sube — y pasarlo es un fallo MUDO (2026-09-11) — MÁXIMA PRIORIDAD

Reporte: "cargué el logo y la portada del login y no se ven". Verificado
contra la base antes de tocar nada: las cinco columnas de marca en `NULL` y el
bucket `marca-publico` con **cero objetos**. O sea que el archivo nunca llegó
al servidor, y la pantalla no dijo absolutamente nada.

1. **`serverActions.bodySizeLimit` es un límite de Next, no de la
   plataforma.** El proyecto lo tenía en `6mb` con un comentario que explicaba
   por qué se había subido desde 1 MB — y aun así fallaba, porque **Vercel
   corta el cuerpo de una petición a una función serverless en ~4.5 MB** antes
   de que Next lo vea. Una foto o una captura de un teléfono de hoy pasa ese
   tope sin esfuerzo.
2. **Lo peor no es que falle: es que falla en silencio.** La petición se
   rechaza antes de que corra una línea propia, así que `useActionState` nunca
   cambia de estado: no hay `state.error` que mostrar, no hay toast, no hay
   nada. El usuario toca "Subir" y la pantalla se queda igual. Un `try/catch`
   alrededor del `await` tampoco alcanza cuando el envío lo hace React por un
   `<form action>`.
   Do instead: **ningún archivo dentro del cuerpo de una Server Action.** URL
   firmada de Storage y subida directa desde el navegador
   (`createSignedUploadUrl` → `uploadToSignedUrl` → confirmar). El tope pasa a
   ser el del bucket, que es el que la interfaz promete. El flujo del video de
   login ya lo hacía por esta misma razón y estaba documentado en el propio
   archivo — el de imágenes no, y ese fue el que falló.
3. **La misma trampa estaba en los adjuntos del muro, con una consecuencia
   peor.** `uploadPostAttachment` prometía 10 MB por el mismo camino; cuando el
   `await` lanzaba, vivía dentro de un `startTransition` sin `catch`, así que
   moría el resto del envío: la publicación quedaba creada, la lista de
   archivos sin limpiar y ni un mensaje en pantalla. Todo `await` dentro de un
   transition necesita su `catch`.
4. **Un límite anunciado que la plataforma no aguanta es una promesa falsa.**
   Antes de escribir "máx. 10 MB" en una pista, el camino tiene que soportar
   10 MB de punta a punta: bucket, plataforma y validación. Si no, o se baja el
   número o se cambia el camino.
5. **Dos pasos para guardar es uno de más.** El cuadro mostraba la miniatura y
   el botón "Subir" quedaba abajo, chico y secundario: con la foto ya puesta,
   el campo se lee como listo. No se puede saber a distancia si el usuario no
   tocó el botón o si lo tocó y la petición murió muda — las dos hipótesis
   explican la misma evidencia, así que se arreglaron las dos. Ahora elegir el
   archivo ES guardarlo, con el spinner en el propio cuadro.
6. **Al guardar bien, NO limpiar la vista previa local.** La URL nueva del
   servidor llega por revalidación, unos cientos de ms después; si se remonta
   el cuadro al confirmar, queda vacío en el medio y eso se lee exactamente
   como "no se guardó". Se limpia solo al rechazar un archivo o al borrarlo.
7. **Una ruta fija + `upsert: true` pisa lo publicado ANTES de confirmar.** Si
   algo falla después de la subida (la confirmación, la red, un rechazo por
   tamaño real), el archivo bueno ya fue reemplazado mientras la pantalla dice
   que no se guardó — y borrar el que sobra deja la columna apuntando a un
   objeto que ya no existe: 404 en todo el producto. Ruta nueva por subida
   (`{stem}-{uuid}.{ext}`), la columna se actualiza recién al confirmar, y las
   versiones viejas se limpian después. De paso desaparece el `?v=` de
   cache-busting: la URL ya es distinta.
8. **El tamaño que valida el servidor al AUTORIZAR la subida lo declara el
   cliente.** Con URL firmada, pedir permiso para 1 MB y subir 19 no cuesta
   nada; el único tope que queda vivo es el del bucket. Al confirmar hay que
   preguntarle a Storage cuánto pesa de verdad. Y `metadata.size` ausente es
   **no verificable**, no cero: `Number(x ?? 0) > tope` convierte la
   verificación en un no-op silencioso.
9. **Un `list` de Storage que FALLA no prueba que el archivo no llegó.**
   Descartar ahí pierde una subida buena y deja un huérfano. Solo una respuesta
   correcta y vacía prueba la ausencia (`if (!listError && !subido)`). Y
   `search` es coincidencia parcial: siempre exigir el nombre exacto.
10. **Guardias de tamaño y tipo en el cliente, además de las del servidor.** No
   por seguridad (el servidor y el bucket siguen validando) sino porque son las
   únicas que pueden dar un mensaje cuando el problema es que el archivo ni
   siquiera va a poder viajar. En el compositor del muro son todavía más
   importantes: sin ellas el archivo se rechazaba DESPUÉS de crear la
   publicación, que ya había salido para toda la organización sin su adjunto y
   sin forma de agregarlo.
11. **Dos toasts en el mismo tick: el último tapa al primero.** El aviso de
   "un adjunto se perdió" salía junto con "Publicación creada" y el verde se
   leía primero. Cuando parte de una operación falla, va UN mensaje que lo
   diga, no dos que se contradigan.

## Un `<input type="file">` con `hidden` queda inalcanzable por teclado, y su vista previa tiene tres trampas propias (2026-09-11) — MÁXIMA PRIORIDAD

Al unificar todas las subidas en un solo cuadro que es vista previa + selector
(`<MediaPicker>`, regla de diseño 8), salieron cuatro cosas que se repiten en
cualquier patrón de "input oculto dentro de un label".

1. **`className="hidden"` (o sea `display:none`) saca al input del orden de
   tabulación Y del árbol de accesibilidad.** El compositor de Conectados lo
   tenía así: adjuntar un archivo era imposible sin mouse. Siempre `sr-only`,
   que lo mantiene enfocable, más `focus-within:ring` en el contenedor para
   que el foco se vea. Encontrado en review, en el mismo diff que agregaba la
   regla que dice justamente esto.
2. **El texto del `<label>` ES el nombre accesible del control.** Un cuadro que
   contiene la etiqueta + la pista + el estado ("Sin guardar: foto.jpg") le
   arma al input un nombre de tres renglones que además CAMBIA cada vez que se
   elige un archivo. El nombre va por `aria-label` y la pista por
   `aria-describedby`; el texto visible se queda como está.
3. **Reelegir el MISMO archivo no dispara `change`.** El `value` del input no
   cambió, así que quitar un adjunto y volver a elegirlo desde el carrete no
   hacía nada en pantalla. `e.target.value = ""` al final del manejador.
4. **Una vista previa con `object-contain` miente sobre un avatar.** La foto se
   guarda y se muestra recortada al centro (`object-cover`); previsualizarla
   completa, con bandas grises, promete algo que después no se ve. El ajuste
   de la miniatura tiene que ser el mismo que el del destino final.

Además, de este mismo cambio:

5. **`URL.createObjectURL` solo en manejadores, nunca en un efecto ni dentro de
   un actualizador de estado.** `setState` en un efecto es error de build acá y
   un actualizador tiene que ser puro. El patrón que funciona: crear y revocar
   en el evento, guardar la URL vigente en un `useRef`, y un solo efecto de
   desmontaje —sin `setState`— que revoca lo que quede.
6. **Para limpiar un hijo después de guardar, `key` nuevo, no `setState` en un
   efecto.** El "ya guardé, olvidá el archivo elegido" se calcula EN EL RENDER
   comparando el `state` de `useActionState` contra el último visto
   (`if (state !== estadoVisto) { setEstadoVisto(state); ... }`) y se aplica
   remontando con un `key`. El toast sí va en el efecto: mostrarlo es un efecto
   de verdad, limpiar estado no.
7. **Una función exportada desde un módulo `"use client"` no se puede llamar
   desde un componente de servidor** — se convierte en una referencia de
   cliente. `kindOfMime` empezó dentro de `media-picker.tsx` y funcionaba de
   casualidad: su otro consumidor (`AttachmentGallery`) llega al bundle de
   cliente por `PostCard`. Vive en `src/lib/media-kind.ts`, sin directiva.
8. **Un campo de configuración con un archivo RECHAZADO se queda pegado.** El
   video validaba tipo/tamaño al subir y devolvía temprano sin limpiar: el
   archivo inválido seguía en el cuadro con "Subir" encendido, repitiendo el
   mismo error a cada clic. Toda salida temprana que rechaza un archivo tiene
   que vaciar la elección, igual que el éxito.
9. **Una pantalla "compartida" no puede fingir que pertenece a un módulo.**
   `/configuracion` caía en el módulo de Reclutamiento por descarte, así que
   entrar a Ajustes desde AJE Conectados cambiaba la barra entera al ATS y su
   "Inicio" ya no volvía a Conectados. Ahora esa ruta tiene su propia barra
   neutral (puerta a los dos módulos + Ajustes activo) y el selector no marca
   ninguno como activo, que es la verdad.

## Un campo que sube, guarda y no pinta nada es un bug de confianza, no una función incompleta (2026-09-11) — MÁXIMA PRIORIDAD

`/configuracion/marca` tenía un campo "Logo para fondo oscuro" que funcionaba
de punta a punta —subía a `marca-publico`, guardaba `organizations.logo_dark_url`,
mostraba "Logo para fondo oscuro actualizado"— y **ninguna pantalla lo
renderizaba**. Su pista decía "Se usa en el menú flotante y correos": el menú
flotante solo lleva iconos y los correos no llevan logo. Las dos cosas falsas.

1. **Antes de dar por buena una pantalla de configuración, `grep` del nombre
   de la columna.** Si solo aparece en `database.types.ts` y en el formulario
   que la escribe, nadie la muestra. Verificar desde el lado del render, no
   desde el lado del guardado: que el toast diga "actualizado" solo prueba que
   el `update` no falló.
2. **La pista de un campo es una promesa y se verifica como tal.** "Se usa en
   X" hay que poder abrir X y verlo. Una pista inventada es peor que ninguna:
   el usuario sube el archivo, no ve el cambio y concluye que la plataforma
   está rota — no que el campo nunca existió.
3. **Quitar el campo y dejar la columna deja un huérfano inalcanzable.**
   `BrandImageFieldSchema` es la única puerta de `uploadBrandImage` **y** de
   `removeBrandImage`: sacar el valor de la lista blanca sin borrar la columna
   significa que si algún día tuvo un archivo, ya no hay forma de limpiarlo —
   ni UI, ni acción, y el archivo sigue sirviéndose desde un bucket público.
   Se borró la columna (`quitar_logo_dark_url`) después de confirmar `NULL` +
   bucket sin objetos. Postgres sí deja borrar una columna; el caso del enum
   `colaborador` se quedó solo porque ahí Postgres no deja.
4. **Al quitar la única etiqueta masculina apareció un bug de idioma que
   llevaba meses tapado.** El componente armaba el toast con
   `` `${label} actualizado` ``, y de las tres etiquetas que quedaron dos son
   femeninas: "Imagen del inicio de sesión actualizado". **La concordancia de
   género no se puede interpolar** — los mensajes van escritos uno por uno
   (`BRAND_UPLOADED_MESSAGE`/`BRAND_REMOVED_MESSAGE` en
   `src/lib/organizations/brand-fields.ts`) y el texto lo devuelve la mutación,
   como manda la regla de interacción 2.
5. **Un `Record` de mensajes no puede vivir en un módulo `"use server"`**: solo
   admite exportar funciones async. De ahí el módulo aparte — y encima sirve
   para que `DeleteButton`, que recibe el texto como prop y no como resultado,
   use el mismo.
6. **"Se quitó esto" no se documenta con un comentario-lápida en el JSX.**
   El primer intento dejó 9 líneas de comentario en `page.tsx` donde estaba el
   campo, más la misma historia en otros dos archivos: tres copias que se
   desincronizan y una que encima mentía ("reponerlo es agregar este bloque de
   vuelta" — hacen falta 3 ediciones más y ahora también una migración).
   `git log -S nombre_de_columna` ya responde "qué había acá". La decisión va
   en esta bitácora, una vez.
7. **Un artboard de `design/` desactualizado vuelve a meter el campo.**
   `design/Configurador.dc.html` seguía mostrando el logo oscuro (y prometiendo
   SVG, que la app rechaza a propósito, con un `logo-claro.svg` de ejemplo).
   Se quitó el campo y se corrigió la copia — pero el canvas sigue cubriendo
   solo el bloque de identidad de su fase: le faltan 3 de los 5 puntos de
   subida de hoy, porque nadie lo rediseñó al agregarlos. En vez de dejar que
   eso se lea como regresión de la implementación, el archivo lleva ahora un
   comentario de ALCANCE que dice qué cubre y qué no. **Un canvas a medias sin
   declarar su alcance es peor que uno viejo y rotulado.**
8. **Etiqueta visible ≠ etiqueta accesible.** Los campos de subida de marca
   tenían `<label>` sin `htmlFor` y el input dentro de un `<form>` aparte, así
   que un lector de pantalla anunciaba tres veces "elegir archivo" sin forma de
   distinguir logo de portada. Arreglado con `useId()` + `htmlFor` +
   `aria-describedby` en los dos componentes (imagen y video).

9. **Segunda ronda del mismo review: `revalidatePath("/", "layout")` no
   alcanza para una ruta ISR anidada.** Las acciones de imagen revalidaban solo
   el layout raíz; las de video, además `/login` y `/empleos`. `/empleos` tiene
   `export const revalidate = 60`, así que cambiar (o **borrar**) la foto de
   portada podía seguir sirviéndose vieja — y después de un borrado, apuntando
   a un archivo que ya no existe en el bucket. Cuando dos mutaciones hermanas
   revalidan distinto, una de las dos está mal: se unificó en
   `revalidateBrandSurfaces()`, que usan las cinco (incluida `updateBranding`,
   que escribe las leyendas de /empleos).
10. **Un `try`/`finally` sin `catch` alrededor de un `await` a una Server
   Action es una falla silenciosa.** `BrandVideoField` apagaba "Subiendo…" en
   el `finally` y, si la acción **rechazaba** (500, red caída, un deploy que
   invalida el id de la acción), no mostraba ni éxito ni error: la pantalla
   volvía sola a su estado inicial. Eso se lee como "no pasó nada" y el usuario
   reintenta. Todo `await` a una acción necesita `catch` con mensaje, no solo
   la rama `if (resultado.error)` — esa cubre el fallo ESPERADO, no el rechazo.
11. **Un botón de eliminar visible durante una subida en vuelo deja la base
   apuntando a un archivo borrado.** El borrado pone la columna en `NULL` y
   quita el objeto; la subida que termina después vuelve a escribir la URL
   pública de algo que ya no existe. Los dos campos ocultan el `DeleteButton`
   mientras hay una subida corriendo (`!pending` / `!subiendo`, este último del
   tercer valor de `useActionState`, que ya existía sin usarse).
12. **El diálogo de confirmación se olvidó en el primer arreglo de género.**
   Se corrigieron los toasts y quedó `confirmDescription` fijo en masculino
   ("…hasta que subas uno nuevo") para tres campos, dos femeninos — y es el
   texto que la persona lee ANTES de borrar, no después. Al arreglar una copia
   por concordancia hay que barrer **todas** las superficies del mismo campo:
   etiqueta, pista, toast de subida, toast de borrado y diálogo. Por eso la
   copia terminó en un solo registro por campo (`BRAND_FIELD_COPY`): estaba
   repartida en tres archivos y ya se había desincronizado (el diálogo decía
   "foto de portada de la bolsa de empleo" y el toast "Foto de portada").

## Una columna denormalizada que copia datos de `profiles` no se muestra nunca directo (2026-09-11) — MÁXIMA PRIORIDAD

Reporte real: "ya cargué mi foto de perfil pero no se ve en las
publicaciones". La foto SÍ estaba en `profiles.avatar_url` y sí se veía en el
encabezado; lo que se veía en el muro era `posts.author_avatar_url`, una copia
escrita al momento de publicar — y esa copia traía el avatar viejo que genera
Google automáticamente (el círculo de color con la inicial, que se confunde
fácil con un respaldo de la propia app).

1. **`posts.author_avatar_url` / `post_comments.author_avatar_url` /
   `author_name` existen para sobrevivir al borrado del perfil
   (`author_id` es `on delete set null`), no para ser lo que se pinta.**
   Mostrarlas directo significa que cualquier cambio de foto (o de nombre) no
   se refleja en nada de lo ya publicado, y lo peor: si la persona BORRA su
   foto, `removeAvatar` elimina también el archivo del bucket, así que la copia
   apunta a un archivo que ya no existe y queda una imagen rota.
   Do instead: resolver contra el perfil actual AL LEER, con el embed de
   PostgREST en la misma consulta (`.select("*, autor:profiles(avatar_url)")`),
   y dejar la copia solo como respaldo. Una segunda consulta manual no hace
   falta y además cuesta un viaje por feed y otro por cada hilo de comentarios
   que alguien expanda.
2. **El embed distingue dos estados que un `??` confunde.** `autor === null`
   = no hay perfil (recién ahí vale la copia); `autor = { avatar_url: null }`
   = el perfil existe y no tiene foto. Con `avatarPorId.get(id) ?? copia`, el
   caso "me borré la foto" caía en la copia y resucitaba la foto vieja —
   encima rota, por el archivo borrado del bucket. Cualquier resolución de
   este tipo tiene que preguntar por la EXISTENCIA de la fila, no por si el
   valor es falsy.
3. **Lo que llega por Realtime es la fila CRUDA: trae la copia, no lo
   resuelto.** Igual que con las URLs firmadas de adjuntos, al mezclar un
   evento hay que conservar lo que el servidor ya resolvió
   (`existing ? existing.author_avatar_url : incoming.author_avatar_url`), o
   una reacción sobre un post viejo hace reaparecer la foto vieja en vivo.
4. **`next/image` no degrada: una URL fuera de `remotePatterns` revienta el
   render en desarrollo y devuelve 400 en producción** (un `<img>` crudo
   pintaba cualquier cosa). Un componente de avatar compartido necesita su
   propio `onError` que caiga a la inicial — y tiene que guardar **la URL que
   falló, no un booleano**: con un booleano, subir una foto nueva después de
   un fallo deja el respaldo pegado (React conserva el estado porque el
   componente ocupa el mismo lugar del árbol) y la foto nueva no aparece
   hasta recargar.
5. **Decisión, no descuido: se resuelve la FOTO pero NO el nombre.** El nombre
   guardado es el del momento, que es lo correcto para un registro histórico
   (misma regla que ya está escrita para las menciones de las notas). Si
   alguna vez se decide mostrar el nombre actual, el embed ya está ahí: es
   agregar `display_name` y resolverlo igual.

---

## Degradar un token de mención sin sanear el nombre lo vuelve a armar — el parche de suplantación tenía su propio hueco (2026-09-11) — MÁXIMA PRIORIDAD

Conectados guardaba el cuerpo del post tal cual y confiaba en el array
`mentions` del cliente, así que escribir a mano `@[Directora de RH](uuid-de-otro)`
se pintaba idéntico a una mención resuelta por el sistema (negrita + color de
acento). Es la MISMA suplantación que `canonicalizeMentions` documenta desde
2026-09-09 para Postulaciones, reintroducida por tercera vez en este módulo.

1. **El arreglo obvio —degradar a texto plano el token que no resuelve— abre
   un bypass si se devuelve el nombre capturado sin limpiar.** El grupo de
   nombre del regex es `[^\]\n\r]{1,120}`: acepta `@[`. Con
   `@[@[Directora de RH](uuid-basura)](uuid-real)` el regex casa el tramo
   EXTERNO con nombre `@[Directora de RH` e id `uuid-basura`; al degradarlo
   textual queda `@[Directora de RH` pegado al `](uuid-real)` que no casó —
   o sea un token nuevo, bien formado y jamás validado, con el nombre que
   eligió quien publica. Lo encontró `/code-review` sobre el propio arreglo,
   no sobre el código original.
   Do instead: al degradar, pasar el nombre por el MISMO saneo que usa
   `buildMentionToken` (`replace(/[[\]()]/g, "")`). Y verificarlo con casos
   reales antes de darlo por cerrado: un script de 20 líneas que corra el
   regex sobre el token anidado, el anidado al revés, el uuid desconocido y
   un id basura, y que afirme que **todo token sobreviviente apunta a un
   perfil real Y lleva el nombre autoritativo**. Razonar el regex de cabeza
   no alcanza — el tramo que casa no es el que uno cree.
2. **El id del token NO es un uuid validado: `[0-9a-fA-F-]{36}` casa 36
   guiones.** Meter eso en un `.in("id", ids)` hace que Postgres rechace la
   consulta ENTERA (22P02), y si el llamador solo desestructura `data` (sin
   mirar `error`), el mapa queda vacío y TODAS las menciones legítimas del
   mismo post se degradan a texto plano en silencio, con toast de éxito.
   Antes no pasaba porque los ids venían de `z.string().uuid()` del cliente.
   Do instead: filtrar por un regex de uuid real antes de consultar, y nunca
   tratar el `error` de la consulta como "no resolvió ninguna".
3. **Mencionar no puede saltarse la audiencia del post.** Un post restringido
   a un departamento/rol mandaba aviso Y CORREO con los primeros 120
   caracteres a cualquier mencionado de la organización, aunque `posts_select`
   no lo dejara abrirlo. `getPostAudience` (que ya existía, para `post_nuevo`)
   es el filtro que faltaba cruzar; en comentarios, la audiencia es la del
   POST padre, no la del comentario.

---

## `typecheck` y `lint` no ven un import de VALOR desde un módulo `server-only` — solo el build (2026-09-11)

Mover un helper puro (`isScheduled`) a `queries.ts` y consumirlo desde un
componente cliente pasó `npm run typecheck` y `npm run lint` sin una queja, y
reventó `npm run build` con "Ecmascript file had an error" apuntando a
`./src/lib/conectados/queries.ts [Client Component Browser]`.

1. **`import type { X } from "<módulo server-only>"` desde un cliente es
   legal (los tipos se borran); `import { valorX }` del mismo módulo es error
   de build.** Por eso el archivo ya se venía importando sin problema desde
   componentes cliente: todos los imports previos eran de tipo. El día que se
   agrega uno de valor, las dos herramientas rápidas siguen en verde.
   Do instead: un helper que usen los dos lados no va en un módulo con
   `import "server-only"` — va en el módulo compartido del dominio (acá
   `schema.ts`, que ya lo importan cliente y servidor). Y antes de cerrar un
   cambio que mueve código entre capas, correr `npm run build`, no solo
   typecheck+lint.

---

## Un cron con frecuencia menor a diaria rompe TODO deploy de Vercel en plan Hobby — sin avisar en ningún log local (2026-09-11) — MÁXIMA PRIORIDAD

Al abrir el PR del feed de AJE Conectados, el deploy de Vercel del PR falló:
`"Hobby accounts are limited to daily cron jobs. This cron expression (0 * * * *)
would run more than once per day."` — `vercel.json` traía el cron de liberación de
posts programados (Task 19 de la fase de backend, agregado varios días antes) con
`"0 * * * *"` (cada hora).

1. **BUG REAL Y CARO: esa misma configuración ya estaba en `main` desde la fase de
   backend — cada deploy de producción desde entonces venía fallando, y Vercel
   sencillamente se queda sirviendo el ÚLTIMO build exitoso sin avisar en ningún
   lugar visible para quien no entra a mirar el dashboard.** El usuario reportó
   "aún no se reflejan los cambios" viendo en `demo-atrio.vercel.app` una versión
   VIEJA (tipografía serif, sin el rediseño "AJE look", sin selector de módulos) —
   se leía como que faltaba mergear trabajo, pero `main` ya tenía todo eso. La causa
   real: producción llevaba congelada desde el último build que sí compiló, de antes
   de que el cron se agregara. `npm run dev`/`typecheck`/`lint` en local nunca lo
   iban a agarrar — el límite de crons es una restricción del PLAN de Vercel, no del
   código ni de ninguna herramienta que corra en este repo.
   Do instead: **cualquier cron en `vercel.json` con una frecuencia menor a "una vez
   por día" es candidato a romper TODOS los deploys en un proyecto de plan Hobby.**
   Antes de agregar o cambiar un cron, confirmar el plan del proyecto de Vercel — en
   Hobby, la única frecuencia segura es diaria (`0 H * * *`), nunca por hora/minuto.
   Y ante un reporte de "no veo mis cambios en producción" cuando `git log` confirma
   que sí están mergeados, el primer sospechoso no es "falta mergear" — es que el
   ÚLTIMO deploy exitoso es más viejo que el cambio, y hay que revisar el estado de
   los deploys (o los checks del PR/commit) antes de asumir cualquier otra cosa.
2. **Encontrado por el check de Vercel en el PR (comentario automático de
   `vercel[bot]`), no por nada que yo corriera antes de abrirlo.** Ningún
   `typecheck`/`lint`/`npm run dev` local hubiera mostrado esto — el límite es
   externo al código. Revisar los comentarios/checks automáticos de un PR recién
   abierto (no solo los checks "propios" del repo) antes de dar un deploy por
   sano.
3. **Fix**: se bajó el cron a una vez al día (`"0 12 * * *"`). Costo real: un post
   "programado" puede tardar hasta ~24h en liberarse en vez de hasta 1h — trade-off
   aceptado por la restricción de plan, no un error de diseño. Si alguna vez se
   necesita liberación más frecuente, la alternativa es subir el proyecto a Vercel
   Pro, no inventar un cron externo.

---


## Estado de cliente sembrado con `useState(prop)` se congela si el prop cambia después — Realtime lo expone de inmediato (2026-09-11) — MÁXIMA PRIORIDAD

Al construir `PostCard` (feed de AJE Conectados), cada tarjeta guarda su post en
`useState(initialPost)` para poder aplicar reacciones/votos de encuesta de forma
optimista. `/code-review` encontró que ninguna actualización ajena (otra
persona reaccionando, votando, o el autor editando) se veía nunca — solo un
recargado de página las mostraba.

1. **BUG REAL: `useState(prop)` solo lee el valor inicial UNA vez, en el primer render — nunca vuelve a mirar el prop después, aunque el padre le pase un objeto distinto en cada render.** Con `key={post.id}` estable (nunca cambia, es el mismo post durante toda su vida en el feed), React nunca vuelve a montar `PostCard`, así que no hay ningún punto natural en el que ese `useState` se re-inicialice. El componente sí recibía el post actualizado por prop (ConectadosFeed sí mezclaba bien los eventos de Realtime en su propio array) — el bug estaba un nivel más abajo, en que nadie miraba ese prop nuevo. Encontrado por `/code-review`, no en la escritura del componente: leer el código no lo delata, porque "funciona" para la única persona que interactúa (sus propios toggles optimistas sí se ven, porque van directo al `useState` local) — el síntoma solo aparece con una SEGUNDA sesión mirando el mismo post.
   Do instead: cuando un componente necesita estado LOCAL derivado de un prop (para poder mutarlo de forma optimista) pero el prop en sí puede cambiar por una fuente externa (Realtime, polling, un padre que revalida), agregar una sincronización explícita: comparar el prop contra una copia guardada y, si cambió, actualizar el estado local **durante el render** (`if (synced !== prop) { setSynced(prop); setState(prop); }`), nunca solo `useState(prop)` a secas. Este proyecto además prohíbe hacerlo con un `useEffect` + `setState` síncrono (es error de build, ver la entrada de abajo sobre notas) — el ajuste en render es el patrón correcto para esto, no un rodeo.
2. **La revisión de recuperación (revertir un optimista fallido) tenía el mismo tipo de bug, dos veces: "togglear de nuevo" no es lo mismo que "restaurar el valor anterior".** `ReactionBar` revertía una reacción fallida llamando a la misma función de toggle con el mismo tipo — que solo deshace correctamente si el estado previo era "sin reacción"; si la persona ya tenía otra reacción puesta y cambiaba a una nueva que el servidor rechazaba, el revert la dejaba en "sin reacción" en vez de devolverla a la que tenía. Mismo patrón en `PollWidget`, que directamente no revertía nada. Do instead: una función de actualización optimista que también sirve para revertir tiene que recibir el valor EXACTO al que debe quedar (`onOptimisticSet(valor | null)`), nunca un "toggle" — capturar el valor previo ANTES de aplicar el cambio optimista, y pasar ESE valor exacto de vuelta si el servidor rechaza, no repetir la operación que lo cambió.
3. **Un `read-modify-write` de un array `jsonb` hecho en paralelo pierde escrituras, aunque cada llamada individual sea correcta.** El compositor subía varios adjuntos con `Promise.all`, y cada subida hacía SELECT de `posts.attachments`, agregaba su propia entrada, y hacía UPDATE — sin ningún lock ni expresión atómica. Con 3 archivos en paralelo, los 3 SELECT leían la lista vacía (ninguno había terminado de escribir todavía), y el último UPDATE en confirmar ganaba, pisando a los otros dos. Do instead: cuando una mutación es "leer una columna, modificarla en memoria, escribirla de vuelta" (sin una expresión SQL atómica tipo `columna = columna || nuevo_valor`), disparar esas llamadas en SECUENCIA (`for...of` con `await`), nunca en paralelo — cada lectura necesita ver lo que la escritura anterior ya confirmó. Si el volumen lo justifica alguna vez, la alternativa real es una expresión atómica del lado de la base (o una RPC), no paralelizar un read-modify-write del lado del cliente.

---

## Un MCP de Supabase conectado a la sesión no es necesariamente LA base de este proyecto (2026-09-11) — MÁXIMA PRIORIDAD

Al pedir una auditoría completa de seguridad/RLS, la sesión tenía DOS servidores
MCP de Supabase disponibles: uno genérico (acepta `project_id`) y uno nombrado
`ferco-produccion` (ya "conectado", sin pedir `project_id`). Se corrió
`get_advisors`/`list_tables` contra `ferco-produccion` primero, por ser el más
directo de invocar.

1. **Casi se audita y casi se migra la base equivocada.** `ferco-produccion`
   resultó ser el ERP comercial de Ferco (tablas `area_comercial_*`, ninguna
   relación con el ATS) — un proyecto Supabase totalmente distinto,
   simplemente conectado a la misma sesión de Claude Code. Se notó porque los
   nombres de tabla no calzaban con nada del dominio de reclutamiento, no por
   ningún aviso del sistema. Si el mismatch hubiera sido menos obvio (dos
   bases del mismo dominio, o nombres de tabla parecidos), una `apply_migration`
   mal dirigida habría alterado la base de otro sistema en producción sin
   ningún error — el MCP no rechaza queries solo porque "no es la base
   correcta para esta tarea", ejecuta lo que se le pida contra el proyecto que
   tiene configurado.
   Do instead: **antes de correr `get_advisors`, `execute_sql` o
   `apply_migration` contra cualquier servidor MCP de Supabase — sobre todo si
   hay más de uno conectado — comparar su `get_project_url()` (o el `id` de
   `list_projects()`) contra `NEXT_PUBLIC_SUPABASE_URL` de `.env.local`.** El
   nombre del servidor MCP (`ferco-produccion`, o el que sea) es una etiqueta
   puesta por quien configuró la sesión, no una garantía — puede apuntar a
   cualquier proyecto de la organización. El proyecto real de este ATS es
   `cgudnnlcwcotovcslgzu`.

---

## RLS de `jobs`: el `WITH CHECK` no repetía el estado/rol — un `gestor` se auto-publicaba saltando RH (2026-09-11)

Auditoría de seguridad completa (agente `security-auditor` + verificación manual
contra la base real). Mismo tipo de hueco que `applications` ya había cerrado
con un trigger — acá no se había replicado.

1. **BUG REAL DE SEGURIDAD: la política `jobs_update` dejaba pasar a un
   no-admin (`USING`: dueño + `status = 'borrador'`, correcto), pero el
   `WITH CHECK` solo validaba `organization_id = private.auth_org_id()`.**
   Nada impedía que ese mismo `UPDATE` trajera `status: "abierta"`,
   `owner_id: "<su-propio-id>"`, `visibility: "publica"` en una sola llamada
   — la máquina de estados completa (`VALID_TRANSITIONS`,
   `adminOnly`/`ownerOrAdmin`/`cancelGuard`) vivía únicamente en
   `src/lib/jobs/actions.ts`, nunca en la base. Cualquier `gestor` con su
   propia sesión (anon key + JWT, ambos ya expuestos en el navegador) podía
   saltarse la interfaz por completo con un `PATCH` directo a
   `/rest/v1/jobs` y publicar su propia vacante sin pasar por
   `pendiente_aprobacion`/`aceptada`, quedando además como dueño
   (`owner_id`) — `can_decide_application` pasa a `true` para siempre sobre
   esa vacante.
   Do instead: **cuando una Server Action implementa una máquina de estados
   (`VALID_TRANSITIONS` o equivalente) y la tabla tiene RLS, el `WITH CHECK`
   de esa tabla NO puede comparar `OLD` contra `NEW` — hace falta un trigger
   `BEFORE UPDATE`**, igual al patrón que `applications` ya usa
   (`private.enforce_application_permission_tiers`, ver napkin 2026-09 más
   abajo). El fix acá fue deliberadamente MÁS SIMPLE que replicar el grafo
   completo de `VALID_TRANSITIONS` en SQL (eso sería una segunda copia para
   mantener sincronizada, el mismo riesgo de drift que ya documenta AGENTS.md
   para `permissions.ts`): como `USING` ya garantiza que un no-admin solo
   toca su propia fila en `borrador`, el trigger
   (`private.enforce_job_permission_tiers`) solo necesita acotar QUÉ puede
   escribir ahí — `status` solo a `pendiente_aprobacion`/`cancelada`, y
   `owner_id`/`visibility` intocables para no-admin. Cero cambios en
   TypeScript, cero cambios de comportamiento para la UI real.
2. **Se encontró leyendo la política real de Postgres (`pg_policies`), no
   el código de la Server Action.** El código de `transitionJob()` se ve
   perfectamente seguro leído solo — el hueco es invisible sin comparar
   contra el `WITH CHECK` real de la base. Do instead: cualquier auditoría de
   permisos donde exista una Server Action "gatekeeper" tiene que verificar
   que el `WITH CHECK`/trigger de la tabla imponga la MISMA restricción, no
   asumir que la única puerta de entrada es la función de TypeScript.
3. **Revisado el 2026-09-11: `job_templates`/`pipeline_templates` y sus 4 tablas satélite NO tienen este hueco.** Las 6 tablas exigen `private.is_admin_or_above()` en el `USING` **y** el `WITH CHECK` de INSERT/UPDATE/DELETE por igual — a diferencia de `jobs`, ningún no-admin pasa siquiera el `USING`, así que no hay fila que puedan tocar y no existe la pregunta de "qué pueden escribir una vez adentro". La diferencia real: `jobs` tiene autoservicio a propósito (un gestor solicita su propia vacante); las plantillas son 100% admin-only de punta a punta, sin ninguna ruta de escritura para otro rol que verificar.

---

## Espejo TS↔SQL de permisos con drift real: `permissions.ts` tenía 3 valores que el SQL ya no acepta (2026-09-11)

Mismo audit. `WRITE_PERMISSIONS` en `src/lib/applications/permissions.ts` traía
`["lectura_escritura", "interviewer", "approver", "owner"]`; `private.can_write_application`
en Postgres solo reconoce `'lectura_escritura'` en su `IN`.

1. **No explotable hoy (verificado: 0 filas de `job_collaborators` usan esos 3
   valores), pero rompía la regla propia del proyecto de que el espejo se
   actualiza en la misma sesión que el umbral.** Si alguna vez apareciera una
   fila vieja sin migrar con `permission = 'owner'`,
   `canWriteApplication()` habría devuelto `true` en TypeScript mientras la
   base seguía rechazando el `INSERT`/`UPDATE` — un permiso fantasma que se ve
   en la UI (el botón aparece habilitado) y falla recién al enviar, el peor
   tipo de bug de permisos porque no se nota hasta que alguien lo intenta.
   Do instead: el Set de TypeScript de una lista blanca de permisos se recorta
   para que sea EXACTAMENTE lo que el `IN`/`= ANY` del lado de Postgres acepta
   — nunca "lo que aceptaba antes más lo que acepta ahora", ni siquiera "por
   si acaso queda una fila vieja": si una fila vieja necesita seguir
   funcionando, se migra la fila, no se infla la lista blanca de TypeScript
   para taparla.

---

## Comparación del secreto del cron no era tiempo-constante (2026-09-11)

`src/app/api/cron/release-scheduled-posts/route.ts` comparaba el header
`Authorization` contra `Bearer ${CRON_SECRET}` con `!==` de string normal.

1. **Canal lateral de tiempo teórico, mismo tipo de cuidado que ya se aplicó
   en `/api/postular` (ver napkin 2026-09-08) — impráctico de explotar contra
   un endpoint remoto por el jitter de red, pero es la misma clase de bug.**
   Fix: `crypto.timingSafeEqual` sobre dos hashes SHA-256 (`secretMatches()`),
   nunca sobre los strings crudos — `timingSafeEqual` exige buffers del MISMO
   largo o lanza, y hashear primero evita tener que ramificar por longitud
   antes de comparar (esa rama sería en sí misma otro canal lateral).
   Do instead: cualquier comparación de un secreto contra un valor que llega
   del exterior (header, query param, body) pasa por `timingSafeEqual` sobre
   hashes de largo fijo, nunca por `===`/`!==` de string — sin importar qué
   tan remoto se vea el ataque de temporización, es el mismo costo escribirlo
   bien la primera vez.

---

## Storage `cvs_privado_insert` sin acotar por organización — cualquier autenticado podía escribir en la carpeta de otra empresa (2026-09-11)

1. **BUG REAL: la política de `INSERT` del bucket privado de CVs
   (`cvs_privado_insert`) solo exigía `bucket_id = 'cvs-privado'`** — a
   diferencia de `cvs_privado_select`/`cvs_privado_delete`, que sí llaman
   `private.can_access_candidate(...)` sobre el segundo segmento de la ruta.
   Cualquier usuario autenticado, de cualquier organización, podía subir un
   archivo a la carpeta de candidatos de OTRA organización — no permitía leer
   CVs ajenos (la lectura sí estaba bien acotada), pero sí abuso de
   almacenamiento y plantar archivos sin fila en `attachments`.
   Do instead: al agregar un bucket privado nuevo, las políticas de
   `INSERT`/`SELECT`/`DELETE` se escriben JUNTAS y se comparan entre sí antes
   de aplicarlas — quedan más fácil "abiertas por default" que una tabla,
   porque no hay una fila con `organization_id` a la vista para notar el
   hueco a simple lectura.
2. **Fix: se ELIMINÓ la política en vez de acotarla.** Verificado por grep
   (`cvs-privado` en `src/`) que el único escritor real es
   `src/app/api/postular/route.ts`, con el cliente **admin** (service role,
   que ignora RLS de todas formas) — ningún componente cliente sube CVs
   directo. Deny-by-default sin política es más simple y más seguro que
   acotar un `INSERT` que nadie legítimo necesita.

---

## Un array de UUIDs "mentions" del cliente sin validar = notificar/emailear a cualquiera (2026-09-10) — MÁXIMA PRIORIDAD

Al construir AJE Conectados, `mentions: z.array(z.string().uuid())` en el
schema de `createPost`/`addComment` solo valida FORMATO (que sea un UUID),
nunca que ese UUID pertenezca a alguien real de la misma organización. El
`/code-review` final de la fase lo encontró: `notify()` busca el email del
destinatario por `id` **sin filtrar por `organization_id`** — así que un
UUID de perfil de OTRA empresa recibía notificación + correo igual.

1. **Ya se había corregido este MISMO patrón una vez, en otro módulo.**
   `src/lib/applications/mentions.ts` documenta, con nombre y fecha
   (`/security-review`), los dos abusos de confiar en el id que manda el
   cliente: suplantación (decir que mencionó a alguien que el uuid no es) y
   repudío (mencionarse a uno mismo para que el filtro "nunca a uno mismo" lo
   tape). Ese módulo resuelve extrayendo los ids del TEXTO (`extractMentionIds`)
   y usa esos, nunca lo que manda el cliente en un campo aparte. Conectados
   reintrodujo el problema desde cero porque su diseño de menciones es
   distinto (UUIDs resueltos por autocompletado, no texto con tokens) — la
   lección no viajó de un módulo al otro porque el mecanismo se ve diferente,
   aunque el hueco es idéntico.
   Do instead: **cualquier campo que traiga "a quién avisar/mencionar" desde
   el cliente, sea como sea que se calcule (parseado de texto, autocompletado,
   lo que sea), se valida contra la base ANTES de usarse** — como mínimo,
   perfil real + `organization_id` igual al actor + activo. `z.string().uuid()`
   valida forma, no pertenencia; no alcanza solo, sin importar qué tan
   "resuelto" venga el dato del lado del cliente. Grep de `mentions`/`notify(`
   antes de dar por buena una feature nueva de menciones, para ver si ya existe
   un helper de validación reusable en el módulo más parecido.
2. **`notify()` en sí (`src/lib/notifications/notify.ts`) tampoco filtra por
   organización al buscar el email del destinatario** — es genérico a
   propósito (lo llaman módulos de toda la app), así que la responsabilidad de
   no pasarle un id ajeno a la organización es de CADA llamador, no de la
   función compartida. Si alguna vez se decide mover el filtro de organización
   adentro de `notify()` mismo (más seguro por defecto, un solo lugar), hay que
   revisar los demás llamadores (`jobs`, `applications`, `errors`) para
   confirmar que todos calzan con esa restricción nueva antes de imponerla.
3. **Fix aplicado**: filtrar `mentions` contra `profiles` (mismo
   `organization_id`, `is_active`) con el cliente admin, ANTES de guardarlas en
   la fila y ANTES de notificar — no solo antes de notificar, porque la
   columna `mentions` de `posts`/`post_comments` también queda como dato sucio
   si no se filtra ahí.

---


## Todo Route Handler sin cookie de sesión necesita entrar a `PUBLIC_PATHS` (2026-09-10) — se repitió

Al agregar el cron de liberación de AJE Conectados (`/api/cron/release-scheduled-posts`,
protegido con `Bearer CRON_SECRET`, sin sesión de usuario), la prueba local con `curl`
devolvía `307` a `/login` en vez de que la ruta corriera su propio chequeo de secreto.

1. **Ya había pasado exactamente esto con `/api/postular`** (ver el comentario que ya
   vive en `src/lib/supabase/proxy.ts`, líneas 10-16) — el proxy de sesión intercepta
   TODA ruta que no esté en `PUBLIC_PATHS` y la manda a `/login` con 307 antes de que el
   Route Handler llegue a ejecutar una sola línea, sin importar que la ruta tenga su
   propia autenticación (Zod, rate limit, o acá un `Bearer` secreto). El invocador real
   (Vercel Cron, o el `fetch` del formulario público) no manda cookie de sesión — nunca
   la va a mandar — así que sin este registro la ruta queda "protegida" pero también
   inalcanzable en producción, sin ningún error visible hasta que alguien mira los logs
   del cron y ve que nunca corrió.
   Do instead: CUALQUIER Route Handler nuevo bajo `src/app/api/` cuya autenticación NO
   sea "cookie de sesión de Supabase" (webhooks, crons, endpoints públicos con su propio
   secreto/token/firma) tiene que sumarse a `PUBLIC_PATHS` en `src/lib/supabase/proxy.ts`
   — con la ruta EXACTA, nunca un prefijo (`/api/cron` completo expondría cualquier
   cron futuro sin querer). Antes de dar por buena la prueba local de un endpoint así,
   probar primero SIN el header de sesión (`curl` sin cookies, como lo haría el
   invocador real) — probarlo solo con una sesión de navegador abierta esconde
   exactamente este bug, porque esa sesión sí trae la cookie que el invocador real nunca
   va a tener.
2. **Se encontró en la verificación local de esta misma tarea**, no en code review
   después — el primer intento de `curl` con el secreto correcto devolvió el HTML de
   `/login`, no el JSON esperado. Reproducir el fallo con el invocador real (o lo más
   parecido posible: `curl` sin cookies) antes de asumir que "el código está bien
   porque compiló" sigue siendo la única forma de agarrar esta clase de bug.

---


## Un wrapper shadcn "estándar" no respeta el look AJE por defecto — repasar contra `card.tsx` (2026-09-10)

Al agregar `src/components/ui/popover.tsx` (primer componente que envuelve un
primitivo Radix en este repo), el código salió con `rounded-2xl border
border-border ... shadow-md` — la receta genérica de shadcn/ui que cualquier
LLM produce de memoria. Ninguno de esos tres valores es del proyecto.

1. **No es un bug de lógica, es no revisar contra el sistema de diseño real antes de commitear.** AGENTS.md prohíbe borde de 1px para elevación (solo sombra) y define una escala de radio propia (4/6/8/10/12px vía `--radius`/`--radius-lg`, no el `2xl` de Tailwind sin relación con esa escala) y un token de sombra concreto (`shadow-elevated`, ya usado en `card.tsx`). Un wrapper "que compila y typechequea" no prueba que respete el diseño — compilar nunca fue el problema acá.
   Do instead: antes de escribir CUALQUIER superficie elevada nueva (popover, dropdown, tooltip, card, modal), abrir `src/components/ui/card.tsx` primero y copiar su receta (`rounded-lg`/`shadow-elevated`, sin borde) en vez de recordar el patrón genérico de shadcn. Si el componente es el PRIMERO de su tipo en el repo (como este Popover, primer uso de Radix), no hay otro archivo igual con qué comparar — comparar contra la superficie elevada más cercana que sí exista (`card.tsx`), no asumir que "es un wrapper de librería, no aplica el look".
2. **Se agarró en `/code-review` de la propia sesión, no al escribir el código.** La revisión comparó contra `card.tsx` explícitamente porque no había otro wrapper Radix previo — ese paso (buscar la superficie elevada real más parecida cuando no hay precedente exacto) es lo que lo encontró.

---


## `(jsonb ->> clave) = valor` da NULL (no `false`) si la clave no existe — rompe un `if not v_flag` (2026-09-10) — MÁXIMA PRIORIDAD

Al construir `toggle_post_reaction`/`toggle_post_comment_reaction` (RPCs de reacciones de
AJE Conectados), la verificación end-to-end mostró que el aviso al autor NUNCA se
disparaba en el único caso que debía: la primera reacción de otra persona a un post.

1. **BUG REAL: `reactions ->> v_uid_txt` es SQL `NULL` cuando `v_uid_txt` todavía no es
   una clave del jsonb (primera reacción de esa persona) — y `NULL = p_type` es `NULL`,
   no `false` (lógica de tres valores de SQL).** El código guardaba ese resultado en
   `v_already boolean` vía `select ... (reactions ->> v_uid_txt) = p_type into ..., v_already ...`.
   Con `v_already = NULL`, la condición de aviso `if not v_already and v_author_id is
   not null and v_author_id <> v_uid then` nunca es `true` (`not NULL` sigue siendo
   `NULL`, y un `IF` de plpgsql solo entra con `true` exacto) — el toggle de datos
   funcionaba perfecto (agregar/quitar la reacción), pero la función SIEMPRE devolvía
   `null`, así que quien consume ese valor para mandar la notificación nunca mandaba
   nada. Encontrado recién al probar el flujo real con dos sesiones simuladas — con
   solo confirmar que la migración "aplicó sin error" esto se hubiera colado.
   Do instead: cualquier `boolean` que salga de comparar un valor de `jsonb ->> clave`
   (o cualquier expresión que pueda ser SQL NULL) con `=` tiene que pasar por
   `coalesce(..., false)` ANTES de usarse en un `if`/`not` — nunca asumir que "la clave
   no está" se comporta como `false` en la comparación, en SQL se comporta como
   "no sé", que es `NULL`. Ojo: esto NO aplica igual dentro de un `CASE WHEN` (`case
   when (reactions ->> v_uid_txt) = p_type then ... else ...` sí toma el `ELSE` cuando
   la condición da `NULL`, ese caso no tiene el bug) — el problema es específico de
   guardar la comparación en una variable `boolean` y negarla después con `not`.
2. **Cómo se probó y se corrigió**: la migración original solo se verificó con
   `apply_migration` (sin error) + un `select` con UUID inventado (confirma el guard
   de "No autenticado", nada más). El bug salió recién al simular DOS sesiones reales
   (`set local role authenticated; set local "request.jwt.claims"` con un UUID
   distinto al autor del post) y comparar el jsonb devuelto contra lo esperado en cada
   paso (reaccionar, quitar, reaccionar de nuevo). Fix de una línea en las dos
   funciones: `coalesce((reactions ->> v_uid_txt) = p_type, false)` al armar
   `v_already`. Para cualquier RPC que dispare notificaciones/side-effects según un
   flag calculado de datos jsonb variables, probar SIEMPRE el camino de "primera vez"
   (clave ausente) con una sesión simulada real, no solo que la migración compile.

---


## `jsonb_set(..., true)` NO crea niveles intermedios del path — solo el último (2026-09-10) — MÁXIMA PRIORIDAD

Al agregar `department_id` al JWT (mismo mecanismo que ya usan `app_role`/`organization_id`
en `custom_access_token_hook`), la verificación manual daba `claims: {}` — como si la
función no encontrara el perfil, pese a que `select role from profiles where id = ...`
sí lo encontraba perfectamente por fuera.

1. **NO es un bug de la función — es un bug del MÉTODO DE PRUEBA.** `jsonb_set(target, path, new_value, true)`:
   el 4º argumento (`create_missing`) solo crea el ÚLTIMO elemento del path si falta.
   Si un nivel INTERMEDIO no existe como objeto, la llamada entera es un no-op silencioso
   (sin error) y devuelve el `target` sin tocar. Reproducido a mano:
   `select jsonb_set('{}'::jsonb, '{app_metadata,app_role}', to_jsonb('gestor'::text), true)`
   → devuelve `{}`, no `{"app_metadata":{"app_role":"gestor"}}`, porque `{}` no tiene
   `app_metadata`. En producción esto NUNCA pasa porque GoTrue invoca el hook con un
   `event.claims` que YA trae `app_metadata: {}` poblado de fábrica — pero un test manual
   armado a mano con `'claims', '{}'::jsonb` no lo tiene, y el resultado vacío se lee
   como "la función no encuentra el perfil" cuando en realidad el perfil se encontró bien
   y el problema es un nivel de JSON que el test no sembró.
   Do instead: para probar `custom_access_token_hook` (o cualquier función que reciba el
   `event` de un Auth Hook) a mano por SQL, sembrar SIEMPRE
   `'claims', jsonb_build_object('app_metadata', '{}'::jsonb, 'user_metadata', '{}'::jsonb, 'aud', 'authenticated')`
   — nunca `'claims', '{}'::jsonb` a secas. Y en general: si un `jsonb_set` con
   `create_missing = true` "no hace nada" sin tirar error, sospechar primero de un nivel
   intermedio faltante en el `target`, no de la lógica que arma `new_value`.
2. **Cómo se descartó paso a paso** (por si vuelve a pasar algo parecido): se aisló primero
   RLS/roles (descartado: `postgres` tiene `rolbypassrls=true`, y `pg_temp` vs `public`
   daban resultados distintos con la MISMA lógica, lo cual ya apuntaba a otra cosa). Se
   fue recortando la función a copias mínimas hasta aislar la única diferencia real: un
   `select ... into` de una sola columna con `return jsonb_build_object(...)` funcionaba;
   el mismo `select` de 3 columnas seguido de `jsonb_set` anidado no. El `RAISE`/debug
   paso a paso (guardar el valor de `claims` en cada línea dentro de un array de debug)
   ubicó la línea exacta donde `claims` se quedaba en `{}`.

---


## El overlay de menciones tuvo un SEGUNDO bug: negrita = más ancho (2026-09-09)

Con el bug de largo (punto de abajo) ya resuelto, el usuario probó de nuevo y
encontró otro: "el cursor está incrustado dentro de la palabra".

1. **BUG REAL, distinto al anterior y más sutil: la técnica de "textarea con overlay" exige que las dos capas tengan el MISMO ANCHO renderizado, no solo el mismo número de caracteres — y `font-semibold` (negrita) en el overlay lo rompe.** Medido en este mismo navegador: "Carlos Mauricio Sandoval" en peso normal mide 161.97px, la MISMA cadena en `font-semibold` mide 170.38px — 8.4px de más para un nombre de 24 caracteres. El `<textarea>` invisible no puede tener negrita parcial (es un elemento de texto plano, un solo peso para todo su contenido), así que su cursor se posiciona según el ancho en peso NORMAL — pero el overlay pintaba ese mismo tramo más ancho (en negrita), y todo el texto que viniera después quedaba corrido respecto al cursor real. Un bug de LARGO de string (el de abajo) se ve inmediato; uno de ANCHO renderizado recién se nota después de escribir varios caracteres más allá de la mención — por eso pasó una ronda de prueba sin que se notara.
   Do instead: en un "textarea con overlay", cualquier estilo que la capa visual aplique a un tramo tiene que preservar el ancho exacto que el textarea (con un solo peso/tracking para todo) le daría a esos mismos caracteres — practicamente esto excluye `font-weight`, `letter-spacing`, y cualquier familia tipográfica distinta para un tramo. Antes de estilizar un tramo en un overlay de este tipo, medir con `getBoundingClientRect().width` el mismo string en ambos estilos y confirmar 0px de diferencia — no asumir que "solo cambiar el peso" es inocuo.
2. **Resuelto quitando la negrita del resaltado EN VIVO — queda solo el color de acento (`text-accent`, sin `font-semibold`), que no cambia el ancho de nada.** La negrita de verdad se mantiene en `NoteBody`, sobre la nota ya publicada (texto estático, sin cursor que alinear contra nada). Es una limitación real y aceptada de esta técnica, no un descuido: un textarea con overlay puede resaltar POR COLOR mientras se escribe, no por peso — para negrita en vivo de verdad hace falta un editor `contentEditable` (mucho más grande, se evaluó y se descartó por alcance al principio de esta sesión).

---

## El primer overlay de menciones tenía un bug real: el cursor se corría (2026-09-09)

1. **BUG REAL, encontrado por el usuario apenas lo probó: la técnica de "textarea con overlay" (ver la entrada de más abajo) exige que el overlay y el textarea muestren EXACTAMENTE el mismo string, mismo largo — la primera versión no cumplía eso.** `body` guardaba el token completo `@[Carlos Mauricio Sandoval](uuid)` (lo que de verdad hay en el textarea), pero el overlay lo pintaba pasado por `parseMentions()`, que lo reduce a solo "Carlos Mauricio Sandoval" para mostrar. Dos strings de largo distinto, mismo contenedor: el textarea (más largo, invisible) posiciona el cursor real según SU longitud, el overlay (más corto, visible) pinta el nombre en negrita terminando mucho antes — el cursor visualmente quedaba lejos del texto pintado. Screenshot del usuario lo mostró de inmediato.
   Do instead: en cualquier técnica de "overlay sobre un input real", el overlay tiene que ser una función *puramente visual* del MISMO string que el input — nunca una transformación que cambie caracteres o longitud (recortar, reemplazar, resumir). Si hace falta mostrar algo más corto que el dato real (acá: el nombre en vez del token), el dato-completo tiene que vivir APARTE (ver el punto 2) y reconstruirse recién al final, no dentro del string que comparten las dos capas.
2. **La corrección: `body` pasa a ser el texto que se VE (el nombre, nunca el token), y un array `mentions` aparte guarda en qué rango de `body` vive cada mención real — el token `@[Nombre](uuid)` se arma recién al enviar (`serializar()`).** Cada edición del textarea (tipear, borrar, pegar — todo entra por el mismo `onChange`) recalcula qué rangos siguen siendo válidos comparando el `body` viejo contra el nuevo por prefijo/sufijo común (`tramoCambiado`): lo que quedó antes o después del tramo editado se conserva (corriéndose por el delta de longitud si hace falta), lo que se solapa con la edición se descarta — si alguien escribe o borra ENCIMA de un nombre mencionado, deja de ser una mención y pasa a ser texto plano, no queda apuntando a un tramo que ya no dice ese nombre. Verificado con 6 casos de prueba (insertar, tipear antes, tipear después, editar adentro, serializar, largo body=overlay) antes de tocar el componente real.
3. **`react-mentions` se probó y se descartó por deprecado (`npm install` avisó "no longer supported" + 4 vulnerabilidades) antes de llegar a integrarlo — ver el resto del feedback de esta sesión, sección de arriba, para el detalle completo.**

---

## Negrita en vivo al mencionar: textarea con overlay, no un editor nuevo (2026-09-09)

Pedido del usuario: que `@Nombre` se vea en negrita MIENTRAS se escribe, no
solo después de publicar (un `<textarea>` no puede pintar texto parcialmente
en negrita — es una limitación real, no un bug).

1. **Se evaluó `react-mentions` primero y se descartó: `npm install` avisó "Package no longer supported" y sumó 4 vulnerabilidades nuevas.** Do instead: cuando `npm install` imprime `deprecated`/`no longer supported` para el paquete que se acaba de pedir instalar (no una dependencia transitiva vieja, el paquete mismo), no seguir adelante integrándolo — desinstalar y buscar la alternativa sin esa bandera, aunque signifique más código propio. Confirmado con `npm info <paquete> peerDependencies` ANTES de instalar la próxima vez, pero el aviso de deprecación solo aparece al instalar de verdad.
2. **La solución fue "textarea con overlay", no un editor `contentEditable` nuevo**: un `<div aria-hidden>` detrás pinta el texto real con `parseMentions` (la misma función que ya usa `NoteBody` para el cuerpo publicado — cero lógica de resaltado duplicada) con las menciones en negrita, y el `<textarea>` de encima queda con su propio texto invisible (`text-transparent`) pero el cursor sigue visible (`caret-foreground`, una utilidad real de Tailwind v4 que resuelve al token de color — se verificó con `getComputedStyle(el).caretColor` antes de confiar en que existía). Todo el manejo de cursor/selección/IME/copiar-pegar lo sigue haciendo el textarea nativo gratis — nada de eso se reescribió.
3. **Los dos elementos necesitan el mismo `rounded-md`/padding/`text-sm`/line-height para calzar pixel a pixel, y el textarea mantiene `border-transparent` (no `border-0`)**: un borde real ocupa espacio en `box-sizing: border-box`, así que quitarlo del todo desalinea el tamaño de caja contra el overlay, que sí lo pinta. El estado de error (`border-destructive`) vive en el overlay, no en el textarea invisible.
4. **El scroll no se sincroniza solo**: el overlay es un `<div>` normal, no un textarea — necesita `onScroll` en el textarea copiando `scrollTop` al overlay a mano. Verificado en vivo (texto largo que desborda las 3 filas, `scrollHeight > clientHeight`, overlay siguiendo el scroll) antes de darlo por bueno, sin eso una nota larga se ve perfecta hasta que se scrollea y el texto pintado se desalinea del cursor real.

---

## Segunda ronda de feedback sobre el drawer (2026-09-09)

1. **BUG REAL: un botón de acción que solo cambia de pestaña (`setTab("seguimiento")`) no dispara nada visible si el usuario YA está en esa pestaña.** El botón "Asignar tarea" de la barra de acciones abría el formulario cuando venías de otra pestaña, pero parado en Seguimientos, el clic no hacía nada — se leía como "el botón está roto". Do instead: si un botón de acción tiene que producir un efecto visible además de navegar (acá: abrir un formulario), ese efecto no puede vivir en el estado del componente HIJO de la pestaña de destino — hay que subirlo al padre que controla ambas cosas (`tab` y `mostrarTarea` viven los dos en `CandidateDrawer` ahora), o el "ya estoy ahí" se come el segundo efecto.
2. **Decisión de seguridad, no bug: el campo "Para" de mandar mensaje al candidato quedó fijo (`disabled`), no editable — la dirección real sigue resolviéndose 100% server-side.** El pedido original era "que se prellene con el correo y se puedan agregar más" — agregar más SÍ se hizo (campo `cc`, hasta 5, cada dirección validada con `z.email()` en la Server Action), pero el "para" del candidato no se volvió editable a propósito: el comentario ya existente en `sendCandidateMessage` explica por qué (el remitente es la plataforma; un "para" que viniera del cliente permitiría usarla para mandar cualquier cosa a cualquier dirección). Do instead: cuando un pedido de UX choca con una barrera anti-abuso ya documentada en el código, no ceder la barrera para cumplir la letra del pedido — resolver el problema real (loopear a alguien más) por el lado que no la rompe (cc, no to).

---

## `revalidatePath` sobre la ruta que se está viendo remonta el árbol de cliente (2026-09-09) — MÁXIMA PRIORIDAD

Reporte real del usuario: "cuando se responde un hilo se sale el drawer lateral,
no debería de pasar eso, debería de actualizar pero sin modificar la pantalla."

1. **BUG REAL: revalidar la ruta actualmente montada, si esa ruta tiene un `loading.tsx` (Suspense boundary), puede remontar todo el árbol de cliente por debajo — perdiendo `useState` que no está atado a la URL.** `addNote`/`addTask`/`toggleTask`/`deleteTask`/`sendCandidateMessage` llamaban `revalidateApplication(...)`, que revalida `/vacantes/[id]/pipeline` — la MISMA ruta que ya está abierta con el drawer del candidato encima (`KanbanBoard` → `CandidateDrawer`). Esa ruta tiene `pipeline/loading.tsx`, así que Next la envuelve en Suspense; una revalidación sobre la ruta activa puede volver a suspenderla, y al remontar, `KanbanBoard`'s `useState(initialOpenApplicationId)` vuelve a su valor inicial (casi siempre `null`, salvo que la URL traiga `?candidato=`) — el drawer se cierra solo, sin que nadie haya llamado `onClose()`.
   Do instead: `revalidateApplication()` ahora acepta `{ pipeline?: boolean }` — cualquier acción que muta algo que NO se pinta en la tarjeta del kanban (`KanbanCard` solo muestra nombre y rating) pasa `{ pipeline: false }` y se salva de este problema, porque nunca tenía necesidad real de revalidar esa ruta. Antes de agregar una `revalidatePath` nueva sobre una ruta con `loading.tsx`, preguntar: ¿esta acción se puede disparar DESDE DENTRO de esa misma ruta, con estado de cliente (drawer abierto, tab seleccionado, filtro escrito) que no vive en la URL? Si sí, revisar si de verdad hace falta revalidar esa ruta específica — casi siempre el callback `onSaved`/`onChanged` del lado del cliente ya cubre lo que el usuario ve.
2. **Decisión, mismo día: Tareas se fusionó DENTRO del hilo de Seguimientos (mismo componente, notas y tareas ordenadas por fecha, más reciente arriba) y dejó de tener pestaña propia.** `NoteList` ahora recibe `tasks` además de `notes` y arma un solo feed ordenado — una respuesta a un hilo no "sube" la nota raíz, se ordena por la fecha de la raíz, no de la última respuesta, para que sea un histórico estable.
3. **Decisión: el orden del kanban pasó de "más antiguo arriba" (con justificación explícita: "quien lleva más esperando es por quien hay que actuar") a "más reciente arriba", a pedido directo del usuario.** Si en el futuro alguien reintroduce el orden viejo pensando que es un bug, no lo es — es una preferencia de producto que ya se revirtió una vez con conocimiento de causa.

---

## Rama de seguridad estancada 30 commits + migración de diseño AJE (2026-09-09) — MÁXIMA PRIORIDAD

Esta rama (`claude/ats-security-audit-cea7ed`) nació de un punto de `main` de
hace días y nunca se sincronizó — mientras tanto `main` recibió ~30 commits de
trabajo real (roles sin `colaborador`, drawer de candidato, menciones,
dashboard, competencias eliminadas, y su propia ronda de seguridad). El PR se
abrió igual y GitHub lo marcó con decenas de conflictos.

1. **[2026-09-09] Lección de proceso: una rama de vida larga sin sincronizar con `main` no avisa que está podrida hasta que se abre el PR — `git status` en la rama siempre se ve limpio.** `git log HEAD..origin/main --oneline` (o `git branch -vv`, columna `[origin/main: behind N]`) lo muestra al toque, pero nadie lo corrió hasta que GitHub ya mostraba la lista de conflictos. Do instead: antes de empezar cualquier trabajo largo en una rama que no es `main`, correr `git fetch && git log HEAD..origin/main --oneline` — si hay más de un puñado de commits, decidir si conviene rebasar/mergear ANTES de invertir horas, no después.
2. **[2026-09-09] BUG DE SEGURIDAD REAL, activo en producción: `domainMismatch` en `auth/callback/route.ts` era fail-OPEN, no fail-closed.** Se calculaba como `!!allowedDomain && emailDomain !== allowedDomain.toLowerCase()` — con `allowed_email_domain` vacío (el estado real hoy), la expresión daba `false` y el bloque entero que exige invitación (`profile_invites`) se saltaba, dejando entrar a CUALQUIER cuenta de Google como `colaborador`/`gestor` (según el rol vigente). Corregido invirtiendo a `domainAllowed = !!allowedDomain && emailDomain === allowedDomain.toLowerCase()` y gateando con `!domainAllowed`. Do instead: una condición de seguridad que combina "¿hay una regla configurada?" con "¿la cumple?" en un solo booleano corto-circuita al valor equivocado cuando la regla no existe — separar ambas preguntas y decidir explícitamente el caso "no hay regla todavía" (acá: negar, no permitir).
3. **[2026-09-09] Dos sesiones en paralelo, mismo día, decisiones de diseño opuestas: una unificó tarjetas bajo "editorial sobrio" (`rounded-md border`), la otra (esta) migró todo a "AJE look" (sombra difusa + píldora).** La de "editorial sobrio" ya estaba en `main` cuando ésta abrió PR. Decisión del usuario: AJE pisa esa unificación (la otra sesión ya había terminado, sin trabajo activo que coordinar). Do instead: cuando dos ramas tocan la MISMA regla de diseño el mismo día, preguntar explícitamente cuál gana antes de mergear — no asumir que "la más reciente en el tiempo de reloj" o "la que se está mergeando ahora" es automáticamente la decisión final.
4. **[2026-09-09] `docs/PENDIENTE.md` afirmaba "`/security-review` completo... Sin hallazgos" (Fase 19, resuelto 2026-09-02) mientras un reporte real del MISMO día (`CLAUDE-SECURITY-20260902-095525/REPORT.md`, pipeline adversarial de 3 votos) tenía 9 hallazgos confirmados, 2 HIGH.** No es necesariamente falso — parecen alcances distintos (ese sweep cubrió CSP + RLS de tablas nuevas + patrones comunes; el reporte adversarial cazó IDOR/SSRF específicos vía simulación de rol) — pero nadie cruzó los dos documentos hasta hoy. Do instead: un método de review no reemplaza a otro con alcance/técnica distinta — "Sin hallazgos" de un sweep de patrones no es lo mismo que "sin hallazgos" de un panel adversarial con simulación de rol real. Si existen dos reportes de seguridad del mismo período, cruzarlos explícitamente antes de marcar algo "Resuelto".

---

## Menciones inline, kanban con volumen y lista por acción

1. **[2026-09-09] El hallazgo que más me costó ver: validé el ID de la mención y me quedé con el NOMBRE que venía en el texto.** `permitidos` era un `Map<id, display_name>` con los nombres reales y solo usaba `.has(id)` — el nombre autoritativo se consultaba y se tiraba. Y ese nombre se pinta en negrita con el color de acento, o sea con el sello visual de "esto lo resolvió el sistema". Salían dos abusos: suplantar (`@[Ana Ramírez (Directora de RH)](uuid-de-otro)`) y repudiar (usar el uuid PROPIO — pasa la lista blanca, se filtra de las notificaciones por ser uno mismo, y queda constancia de "se lo avisé a RH" sin que a RH le llegara nada). Lo encontró `/security-review`. Do instead: **cuando se valida una referencia contra una lista y esa lista ya trae el dato canónico, USARLO.** Si el servidor solo verifica el puntero y confía en la etiqueta que lo acompaña, la etiqueta es entrada del atacante con apariencia de dato del sistema.
2. **[2026-09-09] Pasar un `<textarea>` a controlado borró un `reset()` y abrió una ventana de doble guardado.** Al reescribir NoteForm para el autocompletado se perdió `formRef.current?.reset()` — y con estado controlado ese reset ya no habría servido, porque el valor vuelve de `body`. Efecto: tras guardar, el texto seguía en pantalla con el botón rehabilitado; se lee como "no guardó", el segundo clic mete una nota DUPLICADA, y si el `refresh()` falla el texto se queda para siempre. Do instead: la limpieza va **dentro del envoltorio de la action**, justo después del `await`, no en un `useEffect` (setState síncrono en efecto es ERROR de build acá). Es el mismo patrón que ya estaba en `interview-form.tsx`; lo tenía escrito en este mismo napkin y lo volví a perder al reescribir el componente.
3. **[2026-09-09] Un `never` de compilación NO debe ir con un `throw` en runtime.** `groupJobs` lanzaba si `job_status` traía un valor fuera del switch: si Postgres gana un estado antes de que se regeneren los tipos —exactamente lo que pasó con `aceptada`— eso tumbaba TODA `/vacantes` al error boundary. Ahora la guarda de compilación se queda (agregar un valor al enum rompe el typecheck ahí, que es el punto) y el runtime degrada al histórico con un `console.warn`. Do instead: el `never` protege al programador en tiempo de build; el usuario necesita que la pantalla siga viva.
4. **[2026-09-09] Desactivar un tope "porque con filtro ya son pocas" es falso en el estado intermedio de escribir.** El buscador del kanban levantaba el tope de 50 al filtrar, y con 900 tarjetas la PRIMERA letra casa con casi todas: montaba 900 `<Draggable>` de golpe en cada pulsación, justo lo que el tope vino a evitar. Ahora el tope se aplica siempre y el contador "N de M" dice que hay más. Do instead: al razonar sobre un filtro, evaluar la consulta de UNA letra, no la completa.
5. **[2026-09-09] Una lista blanca copiada a mano se quedó vieja y el usuario lo reportó como un problema de diseño ("se ve feo").** `job-audit-log.tsx` tenía `VALID_STATUSES` escrita como literal; `aceptada` entró al enum el 2026-09-03 y nadie la sumó ahí, así que toda transición que pasara por ese estado fallaba el chequeo y caía a un fallback que pintaba `job_status_changed` en monoespaciada. `JobStatusBadge` ya sabía traducir `aceptada` — el único eslabón roto era la lista. Ahora se deriva de `JobStatusSchema.options`. Do instead: **una lista blanca de valores de un enum se DERIVA del enum, nunca se copia.** Y ojo con el patrón inverso al de permisos: ahí la lista blanca escrita a mano es obligatoria (que un valor nuevo no nazca con permiso); acá, donde solo decide cómo se PINTA algo, derivarla es lo correcto. La pregunta que separa los dos casos: ¿un valor nuevo debería entrar solo? Para permisos no; para presentación sí.
6. **[2026-09-09] Guardar la mención DENTRO del cuerpo (`@[Nombre](uuid)`) es lo que permite la negrita, y trae dos consecuencias que hay que decidir a propósito.** Antes `notes.mentions` era solo una lista de ids y el cuerpo texto plano: el nombre no estaba en el texto, así que no había nada que resaltar. Con el token: (a) la nota conserva el nombre del momento — correcto para un registro histórico, pero si alguien se cambia el nombre las notas viejas no se actualizan; (b) hay dos fuentes para la misma verdad. Se resolvió con una regla explícita: **gana el CUERPO.** `addNote` saca los ids con `extractMentionIds(body)` y el campo oculto del formulario solo sirve para registrar una discrepancia (`console.warn`). Do instead: cuando un dato queda duplicado en dos lugares, escribir cuál manda antes de escribir el código — si no, cada lector del código asume uno distinto.
7. **[2026-09-09] El cuerpo de una nota se renderiza como PARTES de texto de React, nunca con `dangerouslySetInnerHTML`.** `parseMentions` devuelve `{tipo:"texto"|"mencion"}` y `NoteBody` pinta cada trozo como `{parte.valor}`. Con `innerHTML` esto sería un XSS almacenado directo: cualquiera con permiso de escritura en la vacante podría inyectar script en una nota que después lee todo el equipo. Comprobado: un cuerpo `<script>alert(1)</script>` se muestra literal.
8. **[2026-09-09] Enter con la lista de sugerencias abierta tiene que hacer `preventDefault()`.** Si no, el submit implícito del `<form>` guarda la nota a medio escribir en cuanto alguien elige a quién mencionar. Es exactamente la misma trampa que ya había mordido con el buscador de destinatarios de `MeetingScheduler` — segunda vez, mismo mecanismo: un input nuevo dentro de un form con submit habilitable.
9. **[2026-09-09] Recortar una lista arrastrable NO rompe @hello-pangea/dnd si el `index` sale del array RENDERIZADO.** El tope de 50 por columna y el filtro de búsqueda re-indexan 0..n-1 sobre lo que de verdad se pinta, que es lo que la librería exige. Lo verifiqué además leyendo `handleDragEnd`: **nunca lee `destination.index`**, mueve por `draggableId` y solo cambia `stageId`. Do instead: antes de paginar o filtrar una lista con drag & drop, comprobar dos cosas — que el índice se calcule sobre lo visible, y qué campos del `DropResult` se usan de verdad.
10. **[2026-09-09] Un tope sin `ORDER BY` convierte "las primeras 50" en 50 arbitrarias.** `getKanbanData` no tenía `.order()` en `applications`: sin tope daba igual (se pintaban todas), pero al recortar, qué 50 se ven queda a criterio de Postgres y puede cambiar entre cargas. Encontrado por mí al revisar mi propio cambio. Do instead: **paginar o recortar exige un orden determinista.** Si no había uno antes, el tope es lo que lo vuelve obligatorio.
---

## Hilos de seguimiento, menciones y el drawer que no se refrescaba

1. **[2026-09-09] Decidimos una regla completa sobre una premisa falsa, y la cachó `/code-review`, no yo.** Di por bueno que "una nota privada solo la leen los admins", el usuario confirmó sobre eso, y construí la herencia de privacidad del hilo encima. `notes_select` dice otra cosa: admin+ **o el propio autor**. Consecuencia real: un gestor creaba una privada, la veía él solo, un admin respondía, y el gestor no veía nunca esa respuesta. Do instead: **antes de construir sobre "X solo lo ve Y", leer la política de RLS palabra por palabra.** La cláusula que rompe la premisa casi siempre es la excepción del autor/dueño, que se olvida porque suena obvia. Y si el usuario confirma una premisa que yo le di, el error sigue siendo mío.
2. **[2026-09-09] El bug "no aparece lo que registro" tenía DOS causas, y la que salta a la vista no era la real.** Las 13 llamadas a `revalidatePath` apuntaban a una ruta que hoy solo redirige — vistoso, pero irrelevante: el drawer es cliente y guarda sus datos en `useState` tras UNA lectura, así que `revalidatePath` nunca lo iba a refrescar. La prueba estaba a la vista: las reuniones SÍ aparecían, porque `MeetingScheduler` era el único con callback de recarga. Do instead: cuando algo "no se actualiza", primero preguntar **de dónde lee esa pantalla**. Si es estado local de cliente, ninguna invalidación de servidor la va a tocar; y buscar el caso que sí funciona, que suele traer el patrón correcto ya escrito.
3. **[2026-09-09] Una `key` de remontaje calculada sobre un contador tiene que contar SOLO lo que debe resetear.** Puse `key={notes.length}` en el formulario de nota nueva; ese total incluye las respuestas, así que responder en cualquier hilo remontaba el formulario de arriba y borraba el borrador que el usuario tuviera escrito. Corregido a `notes.filter(n => !n.parentId).length`. Y la key del formulario de respuesta se quitó del todo: era inútil (el padre lo desmonta al guardar) y dañina (el refresco disparado por otro borraba el borrador propio). Do instead: al usar el patrón `key` para resetear estado, escribir explícitamente qué evento debe resetearlo y comprobar que el contador no cambia por nada más.
4. **[2026-09-09] Un `revalidatePath` a una ruta que dejó de renderizar nada no falla: no hace nada, en silencio.** Sobrevivió 13 veces al rediseño que convirtió `/postulaciones/[id]` en un `redirect()`. Do instead: al convertir una página en redirect, `grep` su ruta en todo el repo — los `revalidatePath`, los enlaces de correo y los destinos de notificación la siguen nombrando, y ninguno se queja.
5. **[2026-09-09] En un script de edición, un anclaje ambiguo entra en el lugar equivocado y el error aparece lejos.** `'assignable,'` existía en el destructuring de un `Promise.all` Y en el objeto de retorno; el reemplazo cayó en el primero dos veces, metiendo `isAdminOrAbove: ...` dentro de un array de destructuring. Lo delató `tsc`, no el script (que reportó "ok"). Do instead: anclar con suficiente contexto para que la cadena sea única, y correr `typecheck` después de CADA script de edición, no al final del bloque.
6. **[2026-09-09] Un comentario JSX no puede ser el primer hijo suelto de una rama de ternario.** `{cond ? ( {/* … */} <Comp/> ) : ...}` es un error de sintaxis: son dos hijos sin fragmento. El comentario va fuera del ternario. Cuesta un minuto y el mensaje de `tsc` ("')' expected") no apunta a la causa.
7. **[2026-09-09] Si `/mi-cuenta` ofrece campana Y correo por tipo de notificación, un tipo nuevo tiene que mandar los dos.** Iba a dejar la mención solo en campana; el interruptor de correo de esa fila habría quedado decorativo. Se agregó `emails/mencion-nota.tsx`. Do instead: al sumar un `notification_type` a `PREFERENCE_TYPES`, verificar que `notify()` reciba `email` — la preferencia promete un canal que alguien tiene que cumplir.
8. **[2026-09-09] Un aviso de mención NO lleva el contenido de la nota.** La nota puede ser privada, y el correo sale del servidor de correo sin pasar por `notes_select`. El correo dice qué pasó y dónde verlo; el contenido se lee dentro de la plataforma, donde RLS decide. Mismo principio para cualquier notificación de un registro con visibilidad restringida.
9. **[2026-09-09] Filtro de cliente y validación de servidor tienen que compartir el predicado, y el error tiene que ser accionable.** Los chips de mención se filtran en el cliente por `isPrivate`; el servidor revalida con el mismo predicado contra una lista FRESCA. Si alguien deja la vacante con el drawer abierto, el submit falla — y el toast genérico no decía qué chip sobraba. Se pinta el error junto a los chips (`state.field === "mentions"`). Do instead: cuando el cliente filtra una lista que el servidor revalida, asumir que van a desincronizarse y decir CUÁL campo sobra, no solo que algo falló.
10. **[2026-09-09] Escribir un campo en un `payload` que nadie lee es deuda, no información.** `es_respuesta` entró al evento `nota_agregada` y la bitácora nunca lo mostró: un hilo y una nota raíz se ven idénticos. Do instead: un campo nuevo en un payload se agrega junto con el código que lo lee, o no se agrega.

---

## Privacidad, consentimiento y el portal que nunca recibió nada

1. **[2026-09-08] Igualar la RESPUESTA no cierra un oráculo si el TIEMPO sigue delatando.** Para tapar la enumeración de "quién postuló a qué", hice que `/api/postular` devolviera lo mismo ante duplicado y ante nuevo. Medí después: duplicado 0,51 s, nuevo 2,69 s — 5x, porque el chequeo temprano de duplicado se saltaba las subidas de archivos. El oráculo seguía abierto por el reloj. Lo cerró **borrar** ese chequeo temprano (una optimización que era justamente el canal lateral) y dejar que el `UNIQUE` de la base detecte el duplicado, con la limpieza de archivos en `after()` sin `await` para no delatar por el otro lado. Verificado: rangos solapados. Do instead: al igualar respuestas para cerrar un oráculo, **medir los tiempos de los dos caminos** — y desconfiar de todo atajo tipo "si ya sé que esto va a fallar, me salto el trabajo caro", porque ese ahorro ES la señal.
2. **[2026-09-08] Abrir una ruta al público no solo la vuelve alcanzable: vuelve explotable código que llevaba años ahí sin riesgo.** Al meter `/api/postular` en `PUBLIC_PATHS`, un `update` que ya existía —`candidates.update({ cv_file_path }).eq("id", candidateId)`, incondicional— pasó a ser un vector real: la única prueba de identidad que pide el formulario es escribir un correo, así que cualquiera que conociera el correo de un candidato ya registrado podía sobrescribir el CV de SU perfil, el que el reclutador abre en todos sus procesos, incluidos los de vacantes confidenciales. Hallado por `/security-review`, no por el `/code-review` (que miró el diff; esto vive en una línea que el diff no tocaba). Corregido con `if (cvPath && isNewCandidate)` y verificado simulando el ataque: el perfil ajeno quedó intacto. Do instead: **al hacer pública una ruta, auditar TODA la función, no el diff.** Lo peligroso suele ser el código viejo que asumía un llamador autenticado.
3. **[2026-09-08] "Verificado extremo a extremo" en LOCAL no es verificado en PRODUCCIÓN, y por poco lo reporto como cerrado.** Arreglé el enrutamiento de `/api/postular`, probé el POST completo contra `localhost` (201, consentimiento guardado) y lo di por hecho. Al comprobarlo contra `demo-atrio.vercel.app` seguía fallando: `404 "Esta vacante ya no está disponible"` para una vacante que la base tiene `abierta`+`publica` y que `/empleos` sí lista. La diferencia: `/empleos` usa el cliente anón y `/api/postular` el admin, así que la variable que difiere es `SUPABASE_SERVICE_ROLE_KEY` en Vercel. **Cerrado el 2026-09-09 y la causa raíz vale por sí sola: la key tenía un `•` (U+2022) pegado dentro.** No falló como credencial inválida (401/403) sino como `TypeError: Cannot convert argument to a ByteString because the character at index 8 has a value of 8226`, porque la key viaja como header HTTP y un header no admite nada sobre 255. O sea: el síntoma no se parecía en nada a un problema de auth, y solo se vio porque un `console.error` imprimió el error completo. Do instead: **un arreglo de una ruta pública se verifica contra el dominio de producción, no solo contra localhost** — local y producción no comparten `.env`, un `curl` al dominio real cuesta un segundo. Y ante un `ByteString` roto en un cliente de Supabase, el sospechoso es la variable de entorno (copiada de un lugar con autoformato), nunca el dato de la consulta.
4. **[2026-09-08] Descartar el `error` de una consulta de Supabase convierte un fallo de credenciales en un mensaje que culpa al usuario.** `const { data: job } = await admin...` (sin `error`) hacía que un 401 de PostgREST se viera igual que "esa vacante no existe": el candidato leía "Esta vacante ya no está disponible" y no quedaba rastro en los logs. Do instead: cuando `data: null` puede venir de "no hay filas" O de "no tengo permiso", **hay que separar los dos casos** — `PGRST116` es 0 filas, cualquier otro código es un fallo real que merece 503 y un `console.error`. Sin eso, un problema de configuración del servidor se disfraza de estado normal del negocio.
5. **[2026-09-08] EL BUG MÁS CARO ENCONTRADO HASTA HOY, y llevaba desde el primer commit de auth: `/api/postular` no estaba en `PUBLIC_PATHS`, así que el portal público NUNCA pudo recibir una postulación.** El proxy lo redirigía a `/login` (307), el `fetch` del formulario recibía HTML, `res.json()` lanzaba, y el candidato veía "Se perdió la conexión. Tus datos no se enviaron" — mensaje falso, en bucle, sin salida. Con 3 vacantes públicas abiertas. Nadie lo notó porque las 11 postulaciones existentes son semilla sembrada por SQL, no entradas reales por el formulario. Do instead: **un endpoint público necesita una prueba de extremo a extremo desde fuera de la sesión, no solo que su código se lea bien.** Un `curl` sin cookies contra cada ruta que un anónimo debe alcanzar habría encontrado esto el primer día. Y ojo con el patrón: `PUBLIC_PATHS` lista PÁGINAS y es fácil olvidar que un Route Handler del portal también es una ruta pública.
6. **[2026-09-08] Datos de semilla escondieron un bug de producción durante semanas.** 11 candidatos `@demo-candidatos.com` insertados por SQL hacían ver el pipeline poblado y el portal "funcionando". Do instead: sembrar por el MISMO camino que usa el usuario real (POST al endpoint) siempre que se pueda; una semilla que se salta la ruta de entrada también se salta el bug que vive en esa ruta.
7. **[2026-09-08] Una casilla sin marcar NO viaja en el `FormData`.** `formData.get("x")` devuelve `null`, no `"false"`. Por eso el consentimiento se valida con `z.literal("on")` (lo que manda un checkbox marcado sin `value`) y **nunca** con `z.coerce.boolean()`: cualquier string no vacío coerciona a `true`, así que un `privacy_consent=no` fabricado habría pasado la validación. Verificado con 4 POSTs: sin casilla / `=no` / `=false` dan 400, solo `=on` pasa.
8. **[2026-09-08] Un mensaje de error en español dentro de `.min(1)` no cubre el caso "la clave no vino".** Si falta la clave, Zod falla primero en el chequeo de tipo y devuelve su texto en inglés ("Invalid input: expected string, received undefined") directo a la pantalla. El `required` del navegador lo tapaba; al volverse alcanzable el endpoint, quedó expuesto. Do instead: en un campo obligatorio, el mensaje va en **los dos** lugares — `z.string({ error })` y `.min(1, { error })`.
9. **[2026-09-08] Poner `public = false` en un bucket de Supabase NO retira lo ya servido: Cloudflare sigue entregando su copia en caché.** El origen respondía `{"code":"NoSuchBucket"}` mientras la URL exacta seguía dando 200 con `CF-Cache-Status: HIT` y `max-age=3600`. Do instead: para comprobar que una mitigación de exposición funcionó, pedir con un cache-buster (`?cb=$(date +%s%N)`) — sin eso se confirma la caché, no el arreglo. Y decirle al usuario que la ventana de caché existe, en vez de declarar el asunto cerrado.
10. **[2026-09-08] Una justificación escrita ("no hay tráfico real todavía") puede ser cierta por el motivo equivocado.** El comentario de `rate-limit.ts` defendía el limitador en memoria con eso; el tráfico real era cero porque el endpoint estaba roto, no por falta de demanda. Al arreglarlo, la premisa cayó. Do instead: cuando un comentario justifica no hacer algo apoyándose en un hecho del entorno, revisarlo en cuanto ese hecho cambie — y sospechar de los "todavía no hace falta" que nadie midió.
---

## El rol `colaborador`, fuera de verdad

1. **[2026-09-03] LECCIÓN PRINCIPAL: por tres sesiones seguidas escribí que el rol "sigue siendo invitable porque `invite-form.tsx` lo ofrece". Era falso, y me impidió buscar la causa real.** El formulario no tenía una lista de roles: la generaba con `Object.keys(ROLE_LABEL)`, y `ROLE_LABEL` es un `Record<AppRole, string>`, exhaustivo sobre el enum por obligación del tipo. La causa real estaba en la base — `profiles.role` y `profile_invites.role` con DEFAULT `'colaborador'`, y `handle_new_user()` cayendo a `'colaborador'` para todo login sin invitación. **Todo usuario nuevo nacía con un rol que ya no existía en el producto.** Do instead: cuando un valor retirado "sigue apareciendo", no anotar el archivo donde se ve — buscar de dónde sale la LISTA. Si se deriva del esquema (`Object.keys` de un Record exhaustivo, un `z.enum` del enum completo, un `SELECT enum_range`), el síntoma va a reaparecer en cada lugar nuevo que muestre ese dato, y la causa está en el esquema o en sus defaults, no en la interfaz.
2. **[2026-09-03] Un desplegable de opciones NUNCA se deriva de las llaves de un tipo exhaustivo sobre un enum.** Ahora son dos cosas separadas: `ROLE_LABEL` (exhaustivo, para traducir un valor heredado que aparezca) y `ASSIGNABLE_ROLES` (lista blanca escrita a mano, la única fuente de los desplegables) + `DEFAULT_ROLE`. Mismo principio que `WRITE_PERMISSIONS`: un valor del enum no se vuelve elegible por accidente, hay que escribirlo.
3. **[2026-09-03] HUECO REAL: limpiar solo la interfaz habría dejado el rol asignable por red.** `updateUserRole` y `createInvite` validaban con `z.enum(["colaborador","gestor","admin","super_admin"])` — el enum completo. El desplegable ya no lo ofrecía, pero un POST a mano sí lo pasaba. Ahora ambos usan `z.enum(ASSIGNABLE_ROLES)`. Do instead: quitar una opción de un `<select>` no quita nada; el Server Action es el endpoint, y hasta que su Zod lo rechace la opción sigue viva.
4. **[2026-09-03] Orden de las guardias: se quitan AL FINAL, después de comprobar que ya no se puede llegar al estado.** Se quitaron una vez antes, asumiendo que el rol estaba muerto, y fue un bug real de review. Esta vez el orden fue: (1) defaults y función de la base, (2) lista blanca y validación de los Server Actions, (3) ramas de la interfaz, (4) recién entonces las guardias de `createJob`, `/vacantes/nueva` y `createEmploymentReason`. Y se verificó en la base antes de tocar el paso 4: 0 perfiles, 0 invitaciones pendientes, 0 políticas y 0 funciones que nombren el rol.
5. **[2026-09-03] `requireProfile()` no es solo un getter, es la puerta de autenticación** (redirige a `/auth/auth-error` si no hay perfil o está inactivo). Al quedar sin usarse la variable en `/vacantes/page.tsx`, el lint marcó `profile` como no usada — borrar la LÍNEA habría quitado el control de acceso de la página. Se dejó `await requireProfile();` sin asignar, con un comentario que dice por qué. Do instead: una advertencia de "variable no usada" sobre una llamada con efectos secundarios se arregla quitando la asignación, nunca la llamada.
6. **[2026-09-03] Un `ilike '%palabra%'` sobre `pg_get_functiondef` da falsos positivos con los COMENTARIOS del propio SQL.** El chequeo final dijo "TODAVÍA colaborador" y era mi propia línea `-- Antes: 'colaborador'.` dentro de la función. Se confirmó partiendo la definición por líneas y mirando la del `else`. Do instead: para verificar que un valor salió del código, mirar la línea concreta, no si la cadena aparece en algún lado del cuerpo.
7. **[2026-09-03] Con 3 roles, el piso subió y hay que decirlo.** Quien entra sin invitación quedaba `colaborador` (solo vacantes públicas + sus referidos); ahora queda `gestor` (puede solicitar vacantes). Con `organizations.allowed_email_domain` sin definir, cualquier cuenta de Google recibe ese nivel. El rol nunca fue lo que cerraba esa puerta, pero eliminarlo amplía lo que recibe un desconocido — sube la prioridad de configurar el dominio.

---

## Permisos de 2 niveles, competencias fuera, agenda protagonista

1. **[2026-09-03] EL PEOR BUG DE SEGURIDAD ENCONTRADO EN EL PROYECTO, y lo introdujimos nosotros: cambiar TypeScript sin tocar el SQL espejo dejó el trigger de `applications` sin aplicar NADA.** `private.can_decide_application` y `can_rate_application` probaban `auth_role() <> 'colaborador'`. Cuando la migración `remove_colaborador_role` dejó ese rol sin nadie, la condición pasó a ser **verdadera siempre** — un miembro `solo_lectura` podía hacer `PATCH /rest/v1/applications` (mover etapa, contratar, descartar, calificar) o insertar notas y tareas directo por PostgREST con su propia sesión, saltándose toda Server Action. Confirmado en vivo con simulación de JWT, no teórico. Do instead: **las funciones `private.*` de Postgres son un ESPEJO de `src/lib/applications/permissions.ts`, y un espejo no se actualiza solo.** Si cambia un umbral, un rol o un nivel en TypeScript, las funciones SQL cambian en la MISMA sesión — la que gobierna de verdad es la de SQL, es la última línea, la que ve quien se salta la interfaz. Al terminar cualquier cambio de permisos: `grep` las funciones `private.can_*` y leerlas contra el TS, línea por línea.
2. **[2026-09-03] Corolario del anterior, y regla nueva del proyecto: los permisos se escriben como LISTA BLANCA, nunca como lista negra.** La primera versión de `canWriteApplication` decía "puede escribir cualquiera que no sea `solo_lectura`" — con eso, cada valor nuevo del enum (o cada valor viejo huérfano) nace con permiso de escritura por accidente. Ahora es `const WRITE_PERMISSIONS = new Set([...])` y todo lo que no esté ahí no escribe. Deny-by-default no es solo una regla de RLS, aplica igual en TypeScript.
3. **[2026-09-03] Un valor de enum de Postgres NO se puede borrar. Se huerfaniza.** `viewer`/`interviewer`/`approver`/`owner` siguen en `job_collaborator_permission` y `colaborador` sigue en `app_role`: se migran los DATOS, se deja de ofrecerlos en la interfaz, y los mapas de etiquetas los siguen traduciendo por si aparece una fila vieja. Además: `ALTER TYPE ... ADD VALUE` va en su PROPIA migración, separada de cualquiera que USE el valor nuevo — Postgres no lo ve confirmado dentro de la misma transacción y falla.
4. **[2026-09-03] Decisión de arquitectura: DOS fuentes de permiso, no tres. Los "2 niveles" describen solo a quien se AÑADE a la vacante.** Decidir (mover etapa, contratar, descartar, agendar, mandar mensaje) = `is_admin_or_above() OR jobs.owner_id = actor`. Escribir (seguimientos, archivos, tareas, calificar) = eso, más `jobs.requested_by`, más miembro con `lectura_escritura`. El reclutador asignado manda porque es `owner_id`, **no** por su fila en `job_collaborators` — si su poder viniera de la fila, quitarle la fila le quitaría la vacante en silencio. Por eso `removeJobCollaborator` se niega a borrar la fila del `owner_id` y la interfaz ofrece "Reasignar" en su lugar.
5. **[2026-09-03] BUG REAL de flujo, encontrado en review: se le podían asignar tareas y reuniones a un miembro de solo lectura** — una tarea que la persona asignada nunca va a poder cerrar. `getAssignableProfiles` ahora devuelve encargado + solicitante + miembros activos y excluye `solo_lectura`/`viewer`. Do instead: cuando una acción crea trabajo PARA otra persona, la lista de candidatos a asignar se filtra por "¿puede esta persona completar esto?", no por "¿puede verlo?".
6. **[2026-09-03] BUG REAL: la página vieja `/postulaciones/[id]` seguía existiendo con su propia copia de la interfaz — y esa copia mostraba "Contratar"/"Descartar" a miembros de solo lectura, porque los permisos nuevos se aplicaron solo en el drawer.** Se resolvió borrando la interfaz duplicada: la ruta ahora es un `redirect` a `/vacantes/[jobId]/pipeline?candidato=[id]`, así los enlaces viejos (correos, notificaciones) siguen funcionando y hay UNA sola implementación. Do instead: dos pantallas que hacen lo mismo son dos lugares donde aplicar cada regla nueva; en cuanto una queda como "la principal", la otra se vuelve un `redirect`, no se mantiene en paralelo.
7. **[2026-09-03] "Hoy" se calcula con la fecha de la ORGANIZACIÓN (UTC-6), no la del servidor ni la del navegador — y la constante vive en UN solo archivo.** `src/lib/org-today.ts` (a propósito SIN `server-only`: la usan un componente de servidor y uno de cliente) exporta `ORG_UTC_OFFSET_HOURS`, `getOrgToday`, `isTaskOverdue`, `dueDateLabel`; `org-clock.ts` la importa de ahí en vez de declarar su copia. Detectado por mí mismo antes de commitear: la primera versión duplicó la lógica de vencimiento en dos componentes y usó `new Date().toISOString()` (UTC) — en Vercel una tarea que vence hoy se habría pintado como vencida 6 horas antes. Tercera vez que este proyecto tropieza con el mismo cálculo de "hoy" (ver `today-label.tsx` y `org-clock.ts`).
8. **[2026-09-03] `toggleTask`/`deleteTask` reportaban éxito cuando RLS bloqueaba la fila (0 filas afectadas ≠ error en Supabase).** Encontrado en review. Corregido agregando `.select()` al `update`/`delete` y tratando `data.length === 0` como error. Do instead: todo `update`/`delete` que dependa de RLS lleva `.select()`, o un rechazo silencioso se le muestra al usuario como "listo".
9. **[2026-09-03] Al borrar una funcionalidad, borrar también sus tablas — no dejarlas huérfanas "por si acaso".** Competencias se fue completa: `application_competency_scores`, `job_competencies`, `job_templates.competencies`, 5 archivos de código y sus menciones en la documentación. Decisión explícita del usuario ("borrarlas de verdad"). Una tabla sin código que la lea es una tabla cuya RLS nadie va a revisar en la próxima auditoría.
10. **[2026-09-03] Regresión de interfaz que yo mismo introduje y cacé en review: al agregarle fecha límite a las tareas de la agenda, la fecha REEMPLAZABA el nombre del candidato en la fila (mostraba una o el otro, nunca los dos)** — la tarea dejaba de decir de quién era. Do instead: cuando se agrega un dato a una fila que ya está llena, revisar si el layout lo SUMA o lo sustituye; un ternario `A ? fecha : candidato` en el JSX es la forma más fácil de perder información sin darse cuenta.

---

## Flujo de solicitud de vacante

1. **[2026-09-03] BUG REAL, encontrado en review antes de commitear: al "limpiar" código que asumía que el rol `colaborador` ya no existía (por la migración de datos que lo pasó todo a `gestor`), se quitaron por error las guardias que le bloquean solicitar vacantes (`createJob` y `/vacantes/nueva/page.tsx`).** El rol sigue siendo invitable HOY — `invite-form.tsx` lo ofrece por defecto — así que no es un rol muerto, es un rol sin nadie asignado todavía. Do instead: una migración de DATOS (perfiles existentes migrados a otro rol) no es lo mismo que ELIMINAR un rol del sistema — mientras el rol siga siendo asignable desde la interfaz (invitaciones), todo el código que lo trata como especial sigue siendo necesario. Verificar "¿todavía se puede llegar a este estado desde la UI?" antes de borrar una guardia que lo previene.
2. **[2026-09-03] BUG REAL: el buzón de RH en Inicio (`getPendingApprovals`) se armó ANTES de que existiera el estado `aceptada`, y no se actualizó al agregarlo — solo mostraba `pendiente_aprobacion`.** Una vacante ya aceptada (esperando publicarse) desaparecía del buzón sin que nadie lo notara. El propio comentario del código, escrito la sesión anterior, ya predecía este problema ("cuando exista el estado aceptada, este query cambia") y aun así no se actualizó al construir esa fase. Do instead: cuando un comentario deja escrito "esto va a cambiar cuando pase X", tratarlo como una tarea pendiente real, no como una nota informativa — revisar ese archivo específico en cuanto X pasa, no confiar en acordarse solo.
3. **[2026-09-03] Decisión: "aceptar" y "publicar" una vacante son dos pasos separados, no uno.** Antes: `approveAndPublish` hacía las dos cosas de un clic. Ahora: `acceptJobRequest` (asigna encargado) → `publishJob` (exige elegir visibilidad, sin default silencioso). Se quitó también el atajo `borrador → abierta` ("Publicar directamente") — todo camino a `abierta` pasa por `aceptada`, una sola forma de publicar en vez de dos con comportamiento distinto.
4. **[2026-09-03] La plantilla de puesto se volvió general — país/ubicación/modalidad/tipo de contrato pasaron del wizard de plantilla a la solicitud de vacante.** Arreglo de paso un bug real que ya existía sin que nadie lo hubiera notado: `job_templates.is_public` nunca se preguntaba ni se escribía en ningún lado, así que toda vacante creada desde plantilla nacía invisible en el portal público — no había forma de arreglarlo desde la interfaz. Se resolvió de raíz: la visibilidad ya no vive en la plantilla, se elige explícitamente al publicar (`publishJob`), nunca se hereda de ningún lado.
5. **[2026-09-03] Visibilidad de 3 niveles (`publica`/`interna`/`confidencial`) reemplaza el booleano `is_public` — un solo selector, no un checkbox, porque dos booleanos independientes permiten combinaciones contradictorias ("pública y confidencial a la vez").** El nivel `interna` no existía antes — es el que el manual de uso ya prometía ("vacantes publicadas al público interno para referir") y el código nunca tuvo. Migración de datos verificada antes de aplicar: las 3 vacantes públicas de antes pasaron a `publica`, el resto a `confidencial` — mismo comportamiento exacto que ya tenían, nadie vio más de lo que ya veía.
6. **[2026-09-03] `createJob` fija `visibility: "confidencial"` explícito en el insert, aunque coincida con el default de la columna — encontrado en review como inconsistencia, no como bug real hoy.** El resto del flujo (`publishJob`) exige elegir visibilidad a propósito, sin default silencioso — dejar la creación colgada de un default implícito de Postgres rompía ese mismo principio un paso antes.
7. **[2026-09-03] `job_collaborators` en `createJob` se arma con un `Map<profileId, permission>` insertado de menor a mayor nivel (hoy `solo_lectura` → `lectura_escritura`; en su versión original `viewer` → `approver` → `owner`), no un array plano — así, si la misma persona cae en dos baldes a la vez (ej. el solicitante también aparece como colaborador adicional por error del formulario), gana el nivel más alto sin violar el `UNIQUE(job_id, profile_id)`.** Patrón reusable: cuando varias fuentes pueden nombrar a la misma persona con distinto nivel, un Map con inserción ordenada de menor a mayor es más simple que deduplicar un array después.
8. **Pendiente, a propósito, no por olvido:** (a) ~~rewire de `canDecideApplication`~~ — hecho; ese pendiente resultó ser un agujero de seguridad activo, no una deuda cosmética. (b) ~~Eliminar de verdad el rol `colaborador`~~ — hecho, ver la sección "El rol `colaborador`, fuera de verdad"; y la razón por la que estuvo abierto tres sesiones es que este mismo ítem nombraba mal la causa (`invite-form.tsx` en vez de los defaults de la base). (c) Filtro de plantillas por área del solicitante — bloqueado en datos reales del cliente (`profiles.department_id` sin poblar).

---

## Inicio: buzón + embudo + agenda + informe

1. **[2026-09-03] BUG REAL, encontrado en review antes de commitear: "candidatos activos" (KPI) y la suma de las barras del embudo por etapa mostraban números distintos.** `moveApplicationStage` solo cambia `stage_id`, nunca `status` — arrastrar una tarjeta a la columna "Descartado" del kanban deja la postulación `activa` pero en una etapa tipo `descartado`. El KPI la contaba (cuenta todo `status='activa'`), el desglose por etapa no (`STAGE_TYPE_ORDER` no incluía `descartado`). Corregido excluyendo esas filas de ambos cálculos, no solo de uno. Do instead: cuando dos números en la misma pantalla se calculan del mismo conjunto de filas pero con filtros ligeramente distintos, verificar que compartan la MISMA definición — sumar las partes de un desglose y compararlo contra el total es la prueba barata que hubiera encontrado esto antes del review.
2. **[2026-09-03] BUG REAL, mismo patrón ya conocido reintroducido del lado del servidor: "Tu agenda de hoy" calculaba el rango del día con la hora local del servidor (UTC en Vercel), no la de la organización.** `today-label.tsx` ya documentaba y resolvía este exacto problema para un texto (calculándolo en cliente) — get-agenda.ts lo reintrodujo porque acá el rango alimenta un query server-side, no se puede resolver solo en cliente. Corregido con `src/lib/dashboard/org-clock.ts`: offset fijo UTC-6, válido porque los 4 países que opera la plataforma (Guatemala, El Salvador, Honduras, Nicaragua) están TODOS en UTC-6 todo el año sin horario de verano — no es una suposición, es un hecho geográfico estable de este cliente en particular. Do instead: un bug ya resuelto en un componente cliente no significa que esté resuelto en toda la app — el mismo cálculo de "hoy"/"este mes" hecho server-side (para alimentar un query, no solo un texto) necesita su propia solución.
3. **[2026-09-03] BUG REAL: el panel de embudo/KPIs se mostraba también al rol `colaborador`, cuyo alcance de RLS es distinto entre tablas — `jobs_select` le deja ver todas las vacantes abiertas de la organización, `applications_select` lo limita a lo que él mismo refirió.** Un colaborador sin referidos veía "Vacantes abiertas: 8" junto a "Candidatos activos: 0" en el mismo panel — lee como roto, no como vacío. Corregido ocultando el embudo para ese rol (ve solo su agenda personal + un enlace a vacantes). Do instead: antes de mostrar dos KPIs lado a lado, confirmar que ambos comparten el mismo alcance de visibilidad para TODOS los roles que van a ver esa pantalla — no alcanza con que cada query individual esté bien scopeada por RLS, si dos queries bien scopeadas por separado tienen alcances distintos entre sí, el panel conjunto no tiene sentido para ese rol.
4. **[2026-09-03] Reloj fijo por país en vez de zona horaria real por organización: `org-clock.ts` usa UTC-6 a secas porque los 4 países de esta plataforma comparten esa zona horaria todo el año — no hay columna de zona horaria en el esquema (mismo límite ya documentado en `emails/entrevista-programada.tsx`, que por eso muestra la hora en UTC explícito en vez de fingir una hora local).** Documentado en el propio archivo como techo conocido (comentario `ponytail:`): se rompe si la organización opera fuera de Centroamérica, y ahí el arreglo correcto es una columna de zona horaria real, no subir el número.
5. **[2026-09-03] `applications` no guarda cuándo una postulación pasó a "contratada" — ni columna ni evento en `application_events` (el enum de tipos de evento no tiene `contratada`).** "Días a contratación" y "contrataciones del mes" usan `applications.updated_at` como aproximación, documentado explícitamente en el código como no garantizado (cualquier otro update a la fila después de contratar lo movería). Pendiente decidir junto con el resto de las migraciones del flujo de solicitud de vacante (ver `docs/superpowers/specs/2026-09-03-flujo-solicitud-vacante-design.md`): agregar la columna, o loguear el evento en `hireApplication`.
6. **[2026-09-03] Informe por encargado (`get-recruiter-report.ts`) traía `jobs`+`applications` de TODA la organización sin límite — encontrado en review como un problema de eficiencia, no de correctitud (nada roto hoy, con 5 vacantes).** Corregido acotando a los 300 jobs más recientes antes de traer sus postulaciones (no al revés) — evita cargar en memoria un historial que va a crecer sin parar cada vez que un admin abre Inicio. Do instead: un query "trae todo, se agrupa en memoria" (patrón ya usado en este proyecto para páginas de UN registro, `getKanbanData`/`getDrawerData`) deja de ser gratis en cuanto se vuelve org-wide — necesita su propio límite, no heredar el patrón sin pensar en el volumen.

---

## Un `<input type="file">` nativo no respeta `flex-1`/`min-w-0` — MÁXIMA PRIORIDAD

Ronda 3 de la auditoría de responsividad: el arreglo de la ronda 2 para `BrandImageField`/`BrandVideoField`
(`flex-1 min-w-0` en el input de archivo para que se achicara junto al botón "Subir") **no funcionó** — el usuario
mandó otra captura mostrando el botón "Subir" todavía cortado contra el borde de la pantalla. Causa real: el control
nativo de un `<input type="file">` (el botón "Seleccionar archivo" + el texto "Sin archivos seleccionados") tiene un
ancho mínimo intrínseco que el navegador **no deja achicar por flexbox**, sin importar `flex-1`/`min-w-0`/`w-0` — es
una limitación del control nativo, no de CSS. Confirmado en `avatar-field.tsx`, `brand-image-field.tsx` y
`brand-video-field.tsx`, las 3 pantallas del proyecto donde un `<input type="file">` comparte fila con un botón.

**Do instead**: no pelear por achicar el input — usar `flex-wrap` en el contenedor de esa fila (más `max-w-full` en
el input, sin `flex-1`/`min-w-0`, y `flex-none` en el botón vecino). Si no caben en una línea, el botón cae a la de
abajo, en vez de cortarse contra el borde. **Regla para todo campo nuevo con `<input type="file">` junto a un
botón: `flex flex-wrap`, nunca `flex` a secas ni `flex-1` en el input esperando que se achique — no lo va a hacer.**

## Auditoría de responsividad completa — MÁXIMA PRIORIDAD

Reporte real del usuario: "estoy usando la web en celular y no está la adaptación". Causa: nadie había hecho un
barrido explícito de responsividad — cada pantalla se construyó y se probó (cuando se pudo) en escritorio; el
sandbox de desarrollo nunca tuvo salida de red hacia Supabase para probar en un viewport móvil real. Trabajado en
un worktree aislado (`git worktree add`) para no interferir con otra sesión activa sobre el mismo repo.

**Ronda 2 (post-despliegue):** el usuario mandó capturas reales de su celular tras el primer despliegue. Confirmaron
que la auditoría de código por sí sola no basta — dos patrones sobrevivieron a la ronda 1 porque nunca se grepearon
explícitamente (ítems 6 y 7 abajo). **Lección de proceso**: cuando no se puede probar visualmente (sin salida de
red), pedir al usuario una captura real de celular ANTES de dar por cerrada una auditoría de responsividad es más
confiable que asumir que el grep cubrió todos los patrones posibles.

1. **BUG REAL, el más grave: `grid-cols-[Npx_...]` sin ningún prefijo `sm:`/`lg:` fuerza columnas de ancho fijo en CUALQUIER pantalla, celular incluido.** Encontrado en el panel maestro-detalle de `/configuracion/errores` (`grid-cols-[380px_1fr]` — 380px solo para la lista, ya más ancho que cualquier teléfono), y en las "tablas" de `/configuracion/usuarios` y `/configuracion/departamentos` (`grid-cols-[1fr_180px_120px]` / `grid-cols-[1fr_140px_180px_160px]`, 300-480px de columnas fijas). Corregido apilando en una sola columna por defecto (`grid-cols-1`) y volviendo al layout de escritorio desde `sm:`/`lg:` — patrón mobile-first correcto que SÍ se seguía en otras partes del código (`lg:grid-cols-[560px_1fr]` en marca, `lg:grid-cols-[1fr_320px]` en postulaciones) pero no en estas tres pantallas. **Regla para toda pantalla nueva con `grid-cols-[Npx...]`: el valor en px SIEMPRE va detrás de un prefijo de breakpoint, nunca en la clase base.**
2. **BUG REAL: sin `overflow-x: hidden` en `html`/`body`, un solo elemento desbordado arrastra TODA la página a scroll horizontal en celular**, no solo se ve mal — se pierde el layout completo de la pantalla. Agregado en `globals.css` como red de seguridad (no reemplaza corregir cada componente, solo evita que un descuido futuro rompa la app entera).
3. **`AppHeader` (aparece en TODAS las páginas autenticadas) tenía 7 elementos en una sola fila `flex` sin `flex-wrap` ni truncado**: logo, nombre de plataforma, insignia "Super admin", campana, etiqueta de rol, nombre+avatar, botón de salir. Corregido con `min-w-0 truncate` en el nombre de la plataforma y ocultando (`hidden sm:inline`/`md:inline`) los elementos decorativos/redundantes en celular — insignia, etiqueta de rol, nombre junto al avatar. El avatar solo, como link a "Mi cuenta", es affordance suficiente en pantallas angostas.
4. **Todo `<dialog>` nativo mostrado con `showModal()` usaba `w-full` + `max-w-[Npx]` — en celular, `width:100%` no deja espacio para el `margin:auto` que lo centra, así que toca los dos bordes de la pantalla sin aire.** Corregido en los 4 diálogos del proyecto (`DialogShell`, `ConfirmDialog`, `job-info-modal`, `refer-candidate-dialog`) cambiando a `w-[calc(100%-2rem)]` — deja 1rem de margen fijo a cada lado sin importar el ancho de viewport.
5. **`grid-cols-2`/`grid-cols-3` (sin corchetes, con `1fr`, no rompen el layout pero sí aprietan de más un formulario en celular)** — no es tan grave como el punto 1 (usan fracciones, no px fijos, así que nunca desbordan), pero sigue sin ser "adaptado". Convertidos a `grid-cols-1 sm:grid-cols-2` (o `sm:grid-cols-3`) en los formularios de vacante (`job-form`, `nueva-vacante-form`, wizard paso 1) y en los paneles de info del drawer de candidato.
6. **BUG REAL, encontrado en la captura del usuario: `ConfigTabs` (la barra "Marca | Usuarios y roles | Departamentos | ...") es un `flex gap-6` sin `overflow-x-auto` ni `whitespace-nowrap` — con 7 pestañas, en celular el texto envuelve a 2 líneas ("Usuarios y roles", "Motivos de rechazo") Y la barra igual se corta contra el borde de la pantalla.** El grep de la ronda 1 buscó `grid-cols-[...]`/`w-[Npx]` pero no este patrón (una barra de pestañas horizontal sin scroll). Corregido con `overflow-x-auto` en el `<nav>` y `flex-none whitespace-nowrap` en cada pestaña — patrón estándar de barra de pestañas: si no caben, se deslizan horizontalmente en vez de envolver o cortarse.
7. **BUG REAL, mismo hallazgo por captura: `BrandImageField`/`BrandVideoField` (subir logo/imagen/video en `/configuracion/marca`) metían miniatura + texto de ayuda + input de archivo (`w-32` fijo) + botón "Subir" + botón eliminar en una sola fila `flex items-center` sin wrap — 5 elementos, varios con ancho fijo, nunca caben en un teléfono.** Mismo problema de fondo que el punto 1 (fila sin wrap con anchos fijos) pero en un componente de subida de archivos, no en un grid de tabla — otro patrón que el grep de grid-cols no iba a encontrar. Corregido con `flex-col sm:flex-row`: en celular, primero la fila miniatura+texto, luego la fila de subir/eliminar (con el input de archivo en `flex-1 min-w-0` para que se achique en vez de desbordar).
8. **BUG REAL en `candidate-drawer.tsx`, encontrado por `/code-review` durante la ronda 1 (no relacionado con responsividad, pero en un archivo que se estaba tocando): `BitacoraView` mostraba "(en curso)" y seguía sumando días contra `new Date()` para una postulación YA CERRADA (contratada/rechazada).** `hireApplication()` no inserta un evento propio, así que no hay una marca de tiempo real de cierre. Corregido pasando `application.status` a `BitacoraView` y dejando de mostrar una duración fabricada para el último tramo cuando la postulación ya no está "activa" — más honesto no mostrar nada que mostrar un número que sigue creciendo solo.
9. **Verificación real de estos cambios NO fue posible en este sandbox** — sin salida de red hacia Supabase, ni `npm run dev` ni `next start` pueden renderizar una página que llame a `getOrganization()`/`requireProfile()` (se cuelgan esperando la conexión, no hay error rápido que capturar). Verificado solo con `typecheck`/`lint`/`build` + inspección de código + `/code-review`, exactamente el mismo límite documentado para Fase 17/tooltips del menú — **pendiente de confirmación visual real del usuario en producción o en su celular.**

---

## Pipeline pantalla completa + drawer de candidato

1. **[2026-09-09] "El tablero ocupa toda la pantalla" y "las columnas caben en la pantalla" son dos cosas distintas, y solo la primera estaba hecha.** El contenedor sí rompía el `max-w-6xl` con `mx-[calc(50%-50vw)]` y medía los 1366px completos — pero cada columna tenía `min-w-[240px]`, así que seis etapas exigían 6·240 + 5·16 = **1520px** contra **1286px** útiles, y la última quedaba cortada tras un scroll horizontal. El usuario lo reportó dos veces como "el kanban está recortado" y las dos veces revisé el ancho del CONTENEDOR, que estaba bien. Do instead: cuando algo "no cabe", medir `scrollWidth` contra `clientWidth` del contenedor que scrollea — la culpa suele estar en el `min-width` de los hijos, no en el ancho del padre. `flex-1` no puede encoger por debajo de `min-width`.
2. **[2026-09-09] Un cambio de puro layout se puede verificar sin iniciar sesión, replicando las clases reales en un HTML suelto y MIDIENDO con puppeteer.** El drawer y el pipeline están detrás de Google OAuth y no puedo autenticarme; en vez de afirmar "ahora sí cabe", copié las clases exactas (main `max-w-6xl px-10`, la breakout, el flex `gap-4 overflow-x-auto`, la columna `flex-1 min-w max-w`) y saqué `scrollWidth`/`clientWidth`/ancho de columna en 4 escenarios. Confirmó la aritmética y de paso el caso de 7 etapas. Do instead: si no se puede entrar a la pantalla real, una réplica medida vale mucho más que un "debería funcionar" — y las medidas van en el commit.
3. **[2026-09-02] BUG REAL, encontrado en review antes de commitear: "Asignar tarea" se ocultaba en la UI detrás de `canDecideApplication` (approver/owner), pero `addTask` en el servidor solo exige `can_access_job` (cualquier colaborador con acceso a la vacante) — la UI insinuaba una garantía de seguridad que el servidor nunca tuvo.** No era una fuga nueva (`candidate_tasks` siempre fue de nivel más permisivo), pero ocultar el botón sin restringir el server es peor que no ocultarlo: alguien podía pensar que ese nivel de protección existía. Do instead: cuando un botón de la UI se oculta por un permiso, verificar que la Server Action detrás exige ese mismo nivel — si exige uno más laxo, la UI no debe fingir uno más estricto. Corregido quitando el `hidden` de "Asignar tarea" (igual que "Seguimientos", que ya estaba correctamente sin ese gate por la misma razón).
4. **[2026-09-02] BUG REAL: el fetch de datos del drawer (`getApplicationDrawerData`) no tenía `.catch()` — un fallo de red dejaba el skeleton de carga para siempre, sin mensaje ni salida.** `loading` nunca volvía a `false` si la promesa rechazaba. Corregido con `.catch()` que llama `notifyError` y baja `loading`, más un estado explícito "No se pudo cargar esta postulación" en vez de asumir que `!loading` implica `data` presente.
5. **[2026-09-02] `interviews.interviewer_id` (un solo entrevistador) reemplazado por `interview_attendees` (tabla nueva, varios destinatarios reales) — la tabla estaba vacía en producción (0 filas), se pudo rediseñar limpio sin backfill.** `interviewer_id` quedó nullable en vez de dropeada de una — más barato revertir si algo se pasó por alto; ya no se escribe en ningún lado.
6. **[2026-09-02] Patrón: el drawer de candidato se remonta por `key={applicationId ?? "closed"}` en el padre (`KanbanBoard`) en vez de resetear su estado local dentro de un `useEffect`.** El lint `react-hooks/set-state-in-effect` (ERROR real de build, no warning) bloqueaba `setLoading(true)`/`setData(null)` síncronos al inicio de un efecto — la solución no fue silenciar el lint, fue dejar que el cambio de `key` remonte el componente entero cuando cambia el candidato seleccionado, así el estado local nace limpio solo. Efecto colateral bueno: elimina la condición de carrera entre abrir el candidato A y B rápido (la promesa vieja de A no puede escribir sobre un componente ya desmontado). Misma trampa, mismo arreglo en `interview-form.tsx`: el reset de `attendeeIds` se movió del `useEffect` que observa `state` al wrapper `action()` mismo, justo después de `await boundAction(...)`.
7. **[2026-09-02] CV siempre servido con URL firmada generada en el momento del clic (`getCvViewUrl`), nunca pre-cargada al abrir el drawer.** El drawer puede quedar abierto mucho más de 60s (vigencia de la firma) — pedirla al abrir la habría dejado vencida antes de que alguien la use.
8. **Gotcha de entorno (Windows/PowerShell): `Remove-Item` encadenado en el mismo comando justo después de un `WriteAllText` sobre `database.types.ts` truncó el archivo a 0 bytes una vez, sin motivo claro ("Remove-Item on system path blocked").** Recuperado con `git checkout -- src/lib/supabase/database.types.ts` (archivo limpio/tracked, sin pérdida). Do instead: la limpieza de archivos temporales después de regenerar tipos se hace con Bash `rm`, nunca con `Remove-Item` de PowerShell, en un paso separado.
9. **[2026-09-02] BUG REAL, encontrado en review antes de commitear: en el rediseño de "Destinatarios" de `MeetingScheduler` (buscador + chips en vez de checkboxes), el nuevo `<input>` de búsqueda vivía dentro del mismo `<form>` que el botón "Confirmar" — Enter en el buscador disparaba el submit implícito del formulario en cuanto ya había 1 destinatario agregado (el botón se habilita con `attendeeIds.length > 0`), agendando la reunión (con envío real de correo/enlace de calendario) antes de terminar de buscar al siguiente colega.** Do instead: cualquier `<input type="text">` que se agregue dentro de un `<form>` que ya tiene un submit habilitable necesita `onKeyDown` con `preventDefault()` en Enter si su propósito es "buscar/filtrar", no "confirmar" — el submit implícito de HTML es fácil de olvidar al convertir una lista estática (checkboxes) en un buscador vivo.
10. **[2026-09-02] Verificado en vivo (SQL contra Supabase) antes de quitar un gate: `job_collaborators_select` (RLS) solo exige `can_access_job(job_id)`, igual que todo lo demás que la página de pipeline ya lee — el gate `ADMIN_ROLES.has(profile.role)` que existía en /vacantes/[id] para `getJobCollaborators` era solo para permitir GESTIONAR (agregar/quitar) colaboradores, no una restricción de visibilidad.** Se pudo mostrar el equipo de reclutamiento (encargado + colaboradores) de solo lectura en `JobInfoModal` sin ese gate, sin abrir ningún hueco nuevo. Do instead: un gate de rol en la UI puede existir por razones de *gestión* (quién puede editar), no de *visibilidad* (quién puede ver) — antes de copiar un gate a un contexto de solo lectura, revisar CUÁL de las dos razones lo puso ahí, no asumir que aplica igual.
---

## Fase 19 — Endurecimiento

1. **[2026-09-02] BUG REAL, cross-tenant, arrastrado desde Fase 7: `error_reports_select`/`update`/`delete` y `error_report_messages_select` solo miraban `is_super_admin()`, nunca `organization_id`.** Ya estaba documentado como límite conocido ("sin impacto real hoy, un solo tenant") — se cerró de una vez al entrar a auditar RLS para Fase 19, mismo patrón que el resto de la base evita a propósito. Verificado con simulación real: JWT de `super_admin` con un `organization_id` fabricado distinto al del reporte real → `select count(*) from error_reports` da `0`; con el `organization_id` real → da `1`. Do instead: un "sin impacto real hoy" documentado en el napkin no es lo mismo que "resuelto" — sigue siendo deuda real, se cierra en cuanto se vuelve a tocar esa zona del código, no se posterga indefinidamente solo porque hoy no hay un segundo tenant que lo explote.
2. **[2026-09-02] Casi se filtra una consulta a una base de datos de PRODUCCIÓN de OTRO proyecto — el conector genérico `mcp__supabase__*` (recién reconectado tras una caída) apunta a un Supabase completamente distinto al de este ATS (`cgudnnlcwcotovcslgzu`), con tablas reales de nómina/salarios/evaluaciones de Ferco.** Se detectó a tiempo (2 llamadas de solo lectura, `get_advisors`/`list_tables`, ningún dato sensible leído) porque el resultado no calzaba con ninguna tabla conocida del ATS — se paró, se avisó al usuario de inmediato (regla de "advertencia de seguridad", sin comprimir el mensaje), y se siguió exclusivamente con el conector correcto (`mcp__a6cac10a-2564-4d8a-a158-2878e9b36cc1__*`, ya scopeado por `project_id`). Do instead: **cuando este entorno tiene más de un conector de Supabase disponible, usar siempre el que ya viene scopeado por `project_id` de este proyecto — nunca el genérico** — un resultado que no reconoces (nombres de tabla que nunca viste en este repo) es la señal de alarma, parar ahí mismo, no seguir "a ver qué sale".
3. **[2026-09-02] CSP con nonce por request, implementado siguiendo la guía oficial de Next 16 al pie de la letra (`node_modules/next/dist/docs/.../content-security-policy.md`), no de memoria.** `script-src` queda estricto (`'nonce-{x}' 'strict-dynamic'`, sin `unsafe-inline` ni `unsafe-eval` en producción) — la directiva que de verdad frena XSS por script inyectado. `style-src` se dejó con `'unsafe-inline'` a propósito: el acento configurable por organización (regla de diseño ya fija del proyecto) se aplica en decenas de puntos con `style={{...}}` inline porque el valor es dinámico en tiempo de ejecución — nonce-ar cada uno habría sido una migración grande, y este entorno no tiene navegador con credenciales reales para verificar que no se rompió nada. Do instead: cuando una directiva estricta chocaría con un patrón ya establecido y extendido en el código (no un caso aislado), es mejor relajar ESA directiva específica con la razón documentada en el propio código, que forzar el endurecimiento completo sin poder probarlo.
4. **[2026-09-02] Detalle no obvio de la implementación de nonce: `updateSession()` no puede tomar una sola copia de `request.headers` al principio de la función.** El helper que arma cada `NextResponse.next({request: {headers}})` se volvió a llamar cada vez que hace falta una respuesta nueva (`nextResponse()`, reconstruida desde `request.headers` en cada llamada) en vez de una sola copia guardada al inicio — porque `setAll()` de Supabase muta las cookies del `request` original a mitad de la función (rotación de sesión), y una copia de headers tomada antes de esa mutación se habría quedado con el Cookie header viejo, rompiendo el refresh de sesión silenciosamente para cualquier request que necesitara rotar el token.
5. **[2026-09-02] Auditoría RLS de las 17 tablas de Fases 8-18 (`candidate_tasks`, `application_competency_scores`, `message_templates`, `interviews`, `candidate_segments`, `job_templates` + 3 satélite, `employment_reasons`, `job_questions`/`options`, `application_answers`, `job_collaborators`, `audit_log`, `profile_invites`): todas correctas.** Dos observaciones de severidad baja, aceptadas sin corregir por ahora: (a) `candidate_segments_select` es visible para cualquier miembro autenticado de la organización, incluido `colaborador` — no expone candidatos (son solo metadatos de filtro guardado), pero el rol no debería tocar esa función según la matriz de roles; (b) el `DELETE` de `candidate_tasks`/`interviews` permite a quien lo creó borrarlo aunque haya perdido el acceso a la vacante después (no revalida `can_access_job` en el DELETE, solo en INSERT/SELECT/UPDATE) — caso de borde raro, no se tocó.
6. **[2026-09-02] `/security-review` completo de `src/` (Zod en Server Actions/Route Handlers, uso de `createAdminClient()` en los 8 call sites reales, XSS, inyección SQL, open redirect, cobertura de rate limiting, autorización en Server Actions): sin hallazgos.** El punto que más esfuerzo se le dedicó fue `createAdminClient()` (bypasea RLS por diseño) — cada llamada se leyó completa, no solo se grepeó el nombre, para confirmar que el `organization_id` usado en cada escritura viene de una fuente ya validada (una fila leída antes con el cliente de sesión, o un id explícito del actor) y nunca de un valor que el cliente pueda inventar.

---


## Bolsa de empleo aspiracional

1. **[2026-09-02] BUG REAL, encontrado en review antes de commitear: héroe de portada quedaba vacío si la organización solo sube video (sin foto) y el visitante tiene `prefers-reduced-motion` activo.** `HeroBackgroundMedia` cae a `return null` en ese caso (correcto — no fuerza un video con movimiento a quien lo pidió apagado), pero la sección del héroe en `/empleos` no tenía ningún color de fondo propio detrás del componente de media — sin nada que renderizar, quedaba una franja de 72vh con solo el degradado oscuro flotando sobre el fondo claro de la página. Do instead: cuando un componente de media puede legítimamente no renderizar nada (fallback de accesibilidad, no error), el contenedor que lo envuelve necesita su propio color de fondo de respaldo — no asumir que "siempre va a haber algo debajo". Corregido con `backgroundColor: organization.accent_color` en la sección, mismo patrón que ya usaba `/login` (que si tenía el fondo de acento en su contenedor desde antes).
2. **[2026-09-02] RLS gap real, mismo patrón que Fase 18 (`job_questions_select_public`): `departments` solo tenía política `to authenticated`, invisible para el portal público (`anon`).** Un `join jobs → departments(name)` desde `/empleos` (sesión anónima) habría devuelto `null` en el nombre del departamento para TODO visitante, en silencio — sin RLS de por medio no habría error, solo un dato ausente. Verificado con una simulación real: insertar un departamento + vacante de prueba dentro de una transacción, `set role anon`, confirmar que el join sí trae el nombre, `rollback`. Do instead: **toda tabla nueva que un join desde el portal público necesite leer, aunque sea de paso (no la tabla "principal" de la página), necesita su propia política `to anon`** — la tabla puede llevar años existiendo y funcionando bien para el uso interno; el gap solo aparece cuando alguien la usa desde un contexto sin sesión por primera vez.
3. **[2026-09-02] Antes de escribir código nuevo para "video de portada", se verificó que el mecanismo YA existía (video de fondo del login, sesión anterior) y solo hacía falta generalizarlo — no reinventarlo.** `createLoginVideoUploadUrl`/`confirmLoginVideoUpload`/`removeLoginVideo` (3 funciones atadas a una sola columna) pasaron a `createBrandVideoUploadUrl`/`confirmBrandVideoUpload`/`removeBrandVideo` parametrizadas por un `BrandVideoField` (`"login_video_url" | "careers_cover_video_url"`), mismo patrón que `BrandImageField` ya usaba para 3 imágenes distintas. El nombre de archivo en Storage (`VIDEO_PATH_STEM`) se mantuvo separado del nombre de columna a propósito — `login_video_url` sigue escribiendo en el path `login_video` que ya tenían las organizaciones existentes; cambiarlo para "que combine" con el nombre de columna habría dejado huérfanos los videos ya subidos. Verificado en review que un campo no puede confirmar la ruta de otro campo (cross-field path confusion) — `brandVideoPaths(orgId, field)` está scopeada por campo, no solo por organización.
4. **[2026-09-02] El bucket `marca-publico` ya tenía `file_size_limit`/`allowed_mime_types` correctos para video (20 MB, incluye `video/mp4`/`video/webm`) desde la sesión anterior que agregó el video de login — se verificó en vivo antes de asumir que hacía falta otra migración de Storage.** Cero cambios de bucket necesarios para la portada de la bolsa de empleo, porque reusa el mismo bucket con los mismos límites. Do instead: antes de agregar un tipo de archivo nuevo a un flujo de subida, confirmar el estado REAL del bucket (`select file_size_limit, allowed_mime_types from storage.buckets`) — puede que ya esté cubierto por un cambio anterior, no asumir que hace falta una migración nueva solo porque el campo de la app es nuevo.
5. **[2026-09-02] Decisión: el filtrado de la lista de vacantes es 100% en cliente (estado de React), no por `searchParams` de URL.** El primer diseño usaba `router.replace()` en cada `onChange` del buscador de texto — funciona, pero navega/re-renderiza el árbol del servidor en cada tecla, para una lista que de todos modos ya se trajo completa (son pocas vacantes, sin paginación). Cambiado a filtrar en memoria con `useMemo` sobre datos ya cargados — instantáneo, sin round-trip. El costo real (URLs de filtro ya no son compartibles/bookmarkeables) se aceptó a propósito: nadie pidió esa capacidad, y el listado es corto.

---


## Tour contextual: wizard de plantilla de puesto + Nueva vacante

Pedido real del usuario: el tour de `driver.js` que ya existía (Fase post-7) solo señala
íconos del menú una vez en el primer login — no enseña a llenar nada. Se agregó un
botón "¿Cómo funciona esto?" (`src/components/ui/help-tour-button.tsx`, reutiliza la
misma librería) en cada uno de los 6 pasos del wizard y en "Nueva vacante" — a demanda,
sin persistencia, se puede abrir cuantas veces haga falta.

1. **[2026-09-02] Redactar contenido de ayuda es tan revisable como código — 2 de las ~20 descripciones escritas eran incorrectas, encontradas por un review dedicado, no por typecheck/build.** Una decía que publicar una plantilla exige al menos una etapa intermedia (falso: `publishTemplate` solo exige que `job_template_stages` no esté vacío, y el paso 4 siempre inserta las 3 etapas fijas al guardarse — el gate real es "haber pasado por el paso 4 una vez", no "tener una etapa intermedia"). Otra decía que una postulación precalificada se ve como insignia en el pipeline — no existe esa UI, `KanbanCard` solo expone nombre y rating. Do instead: contenido de ayuda que describe comportamiento real del sistema necesita el mismo nivel de verificación que una migración — cada afirmación se contrasta contra el código que la implementa, no se redacta de memoria/intuición aunque "suene razonable".
2. **`HelpTourButton` filtra en silencio cualquier paso cuyo `selector` no matchee nada en el DOM en el momento del clic — un `data-tour` mal escrito no rompe nada, simplemente ese paso nunca aparece.** Mismo patrón que `OnboardingTour` (Fase post-7) — deliberado, un tour no debe reventar la página por un elemento condicional que no está montado. Pero significa que un typo en el string del selector es indetectable por build/typecheck, solo por lectura cuidadosa o probando en navegador real. Este entorno no tiene salida a `*.supabase.co` (ver nota de entorno, Fase 17) — se verificó por inspección + un review dedicado a comparar cada `data-tour="X"` contra su `HELP_STEPS`, no en navegador.
3. **Decisión: este tour es a demanda (botón "?"), no forzado como el de navegación.** El de navegación se muestra una sola vez porque orienta sobre algo que se ve siempre (el menú); el de una pantalla de contenido denso (el wizard) tiene sentido reabrirlo meses después cuando ya nadie se acuerda — forzarlo una sola vez sería inútil la segunda vez que alguien vuelve a crear una plantilla.

---


## Auditoría de secretos en el repo público — MÁXIMA PRIORIDAD

1. **[2026-09-02] BUG REAL: `.env.example` nunca estuvo en el repo — `.gitignore` tenía `.env*` sin ninguna excepción, así que el archivo se ignoraba en silencio cada vez que alguien intentaba agregarlo.** El repo es **público** en GitHub. README y `docs/PENDIENTE.md` hablaban de él como si existiera (`cp .env.example .env.local`, "limpiar 2 variables muertas de `.env.example`") — nadie lo había notado porque el resto del setup igual funciona si ya tienes las variables de otra fuente. Fix: `!.env.example` agregado al `.gitignore`, archivo recreado desde cero con las 6 variables reales (grep de `process.env.` en `src/`), sin las 2 variables fantasma (`ALLOWED_EMAIL_DOMAIN`/`SUPER_ADMIN_EMAIL`) que ningún archivo leía. Do instead: un patrón `.env*` en `.gitignore` es correcto para no commitear secretos, pero SIEMPRE necesita `!.env.example` al lado — si no, el único archivo que SÍ debería versionarse (la plantilla sin valores) desaparece con el resto.
2. **[2026-09-02] Verificado, no hay secretos reales filtrados en la historia completa del repo (67 commits, `git log --all -p`).** Sin JWT (`eyJ...`), sin `SUPABASE_SERVICE_ROLE_KEY=`/`RESEND_API_KEY=re_`/`ANTHROPIC_API_KEY=sk-` con valor real, sin claves AWS (`AKIA...`), sin `client_secret` de Google (`GOCSPX-...`), sin connection strings con contraseña embebida, sin archivos `.pem`/`.key`/`credentials.json` jamás commiteados. `gh api repos/.../secret-scanning/alerts` también devuelve `[]` — confirmación independiente de GitHub. Do instead: en un repo público, repetir este chequeo (`git log --all -p` + grep de patrones de secretos + `gh api .../secret-scanning/alerts`) antes de cualquier auditoría de seguridad más profunda — es gratis y descarta la categoría de hallazgo más grave de entrada.

---


## Mejoras post-Fase 7 (invitaciones, avatar, video de login)

1. **[2026-09-02] BUG REAL, crítico: el límite real de tamaño/tipo de un bucket de Storage vive en `storage.buckets`, no en la Server Action.**
   Causa: se agregó soporte para subir un video de fondo al login reusando el bucket `marca-publico`, pero ese bucket ya tenía `file_size_limit = 5MB` y `allowed_mime_types` restringido a imágenes desde su creación en Fase 3 — cualquier validación de tamaño/tipo en la Server Action (`createLoginVideoUploadUrl`) era pura decoración: Storage habría rechazado el video de todos modos, con o sin esa validación.
   Do instead: antes de asumir que una Server Action "ya protege" un límite de subida, verificar `select file_size_limit, allowed_mime_types from storage.buckets where id = '...'` — si el límite real del bucket es más estricto (o no incluye el mime type nuevo), hay que actualizarlo con una migración, la validación de la app es solo la primera capa, no la única.

2. **[2026-09-02] BUG REAL, crítico: una policy de RLS "solo super_admin" en una tabla de invitación bloquea al propio invitado leer su fila.**
   Causa: `profile_invites_super_admin` exige `is_super_admin()` tanto en `USING` como en `WITH CHECK` — correcto para que solo un super admin cree/borre invitaciones, pero un `gestor`/`admin` recién invitado NUNCA podría ver su propia fila con el cliente de sesión. El primer intento de usar esto para eximir del filtro de dominio corporativo (`auth/callback/route.ts`) consultaba con el cliente de sesión y siempre devolvía 0 filas — el login de cualquier invitado que no fuera super_admin se rechazaba y su cuenta recién creada se borraba.
   Do instead: cuando la verificación es "¿existe una excepción para ESTA persona?" y la tabla que la guarda solo es legible por un rol superior, la lectura tiene que hacerse con `createAdminClient()`, nunca con el cliente de sesión del propio afectado — el mismo patrón ya documentado para `pipeline_templates`/`job_stages` en Fase 4, aplicado aquí a auth.

3. **[2026-09-02] BUG REAL: borrar un registro de "úsalo una vez" que también sostiene una verdad PERMANENTE rompe esa verdad en el segundo uso.**
   Causa: al arreglar el punto 2, la primera corrección borraba la fila de `profile_invites` apenas se usaba para dejar entrar al invitado. Pero el filtro de dominio corre en CADA login, no solo el primero — sin la fila, el mismo invitado quedaba expulsado (y su cuenta borrada) en su SEGUNDO login.
   Do instead: cuando un mismo registro sirve para dos cosas de vida distinta ("asignar un rol una vez" vs. "eximir del filtro de dominio para siempre"), no se borra — se marca con una columna `consumed_at` (o similar). La bandeja de "pendientes" filtra por `consumed_at is null`; la verificación de acceso ignora ese campo y solo mira si la fila existe.

4. **[2026-09-02] Volver un campo de texto libre en un `z.enum()` sobre una tabla ya viva puede corromper datos existentes en el próximo `UPDATE`, no solo rechazar los nuevos.**
   Causa: "País" pasó de `<input>` a `<select>` con 4 opciones fijas. Una vacante con un país que no esté en esas 4 opciones haría que el `<select>` cayera en la primera opción real sin que nadie lo notara, y esa vacante se guardaría con el país cambiado por accidente al editar cualquier otro campo.
   Do instead: antes de cerrar un campo existente a una lista fija, correr `select distinct <columna> from <tabla>` contra la base real — si hay valores fuera de la lista, mostrarlos como opción aparte (deshabilitada) en el `<select>` para que se note y haya que elegir uno real, en vez de dejar que el navegador la reemplace en silencio. La validación del schema (Zod) debe seguir rechazando el valor viejo — la UI solo evita que se pierda sin que nadie lo vea, no reintroduce el valor viejo como válido.

5. **`next.config.ts` → `images.remotePatterns` necesita CADA hostname externo real, no solo el de Storage.**
   Causa: `profiles.avatar_url` se llena con la foto de Google desde Fase 3 (`handle_new_user()`), pero el header nunca la mostraba — ni siquiera se había notado que `next/image` la habría bloqueado igual, porque `remotePatterns` solo tenía `*.supabase.co`. Sin `*.googleusercontent.com`, la foto de Google jamás habría cargado aunque el código la usara.
   Do instead: cada vez que se empieza a renderizar una URL externa nueva con `next/image` (no solo Storage — CDNs de terceros como Google, Gravatar, etc.), verificar `next.config.ts` antes de asumir que "ya está permitido porque otras imágenes cargan".

6. **Subir un archivo grande (video) por una Server Action choca con el límite de tamaño de body de las funciones de Vercel — subir directo del navegador a Storage con una URL firmada lo evita.**
   Do instead: `supabase.storage.from(bucket).createSignedUploadUrl(path, {upsert})` en el servidor (autoriza la ruta vía RLS de `storage.objects`, requiere permiso de INSERT) → el navegador sube con `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, {contentType})` usando el cliente browser (el token ya autoriza esa subida puntual, no necesita sesión) → una segunda Server Action confirma y guarda la URL pública. Nada del archivo en sí pasa por Next.

7. **Descartar el `error` de una consulta y tratar "no hay dato" como "la condición es falsa" es peligroso cuando la rama por defecto es destructiva.**
   Causa: la primera versión de la excepción de dominio en `auth/callback` ignoraba `error` al leer `profile_invites` — un fallo transitorio de red se habría tratado igual que "no está invitado", y la rama de rechazo BORRA la cuenta recién creada. Un error de verdad no es lo mismo que "no existe".
   Do instead: cuando la rama "no encontrado" de una consulta dispara una acción irreversible (borrar, expulsar), revisar `error` por separado y mandar a un estado reintentable (no destructivo) si la consulta en sí falló — nunca asumir "no" cuando en realidad es "no se pudo saber".

8. **Límite pendiente, documentado a propósito: invitar a alguien directamente con rol `super_admin` deja su fila de `profile_invites` como "pendiente" para siempre.**
   Causa: el chequeo de invitación solo corre dentro de `if (domainMismatch && profile.role !== "super_admin")` — cualquier super_admin ya está exento del filtro de dominio desde antes (Fase 3), así que ese bloque nunca se ejecuta para ellos y `consumed_at` nunca se marca.
   Do instead: aceptado como límite conocido, no corregido — invitar directamente como super_admin es un caso raro (alguien de máxima confianza normalmente se promueve manualmente desde Usuarios después de su primer login normal, no por invitación). Si esto molesta en la práctica, la corrección sería sacar el chequeo/marcado de `consumed_at` del `if` de dominio y hacerlo siempre que exista una fila de invitación, aceptando una consulta extra en cada login de alguien invitado.

---

---


## Lista de plantillas nunca se conectó al wizard nuevo (post-Fase 18) — MÁXIMA PRIORIDAD

Reporte real del usuario: "el configurador de plantillas no quedó como lo pedí". Causa
real: `/configuracion/plantillas-vacante` (el listado) seguía usando el modal plano de
Fase 15 (`JobTemplateDialog`) para "Nueva plantilla" y "Editar" — el wizard de 6 pasos
de Fase 18 solo era alcanzable desde "Continuar" (solo plantillas en borrador) o desde
"Crear vacante" cuando no había ninguna plantilla todavía. El spec
(`docs/superpowers/specs/2026-09-01-plantillas-vacante-wizard-design.md:3`) decía
literal "Reemplaza el flujo actual" — nunca se hizo, el modal viejo quedó viviendo en
paralelo sin que nadie lo notara porque seguía "funcionando".

1. **[2026-09-01] Lección de proceso, no bug de código: un spec que dice "reemplaza X" no confirma solo con que lo nuevo compile y funcione — hay que verificar que lo viejo de verdad se desconectó de la UI.** El modal de Fase 15 se mantuvo deliberadamente actualizado durante Fase 18 (`createJobTemplate` ya insertaba con `status: 'published'`, tenía su propio helper `syncTemplateStagesFromPipeline` para no dejar `job_template_stages` vacío) — alguien SÍ pensó en mantenerlo compatible con el nuevo esquema, pero nadie volvió a la pantalla que lo dispara para apagarlo. Do instead: al cerrar cualquier fase que dice "reemplaza" un flujo viejo, grep del componente/acción vieja para confirmar 0 referencias reales en `src/app` — no alcanza con que el flujo nuevo exista y pase build.
2. **[2026-09-01] Borrado, no bug: `JobTemplateDialog`, `createJobTemplate`/`updateJobTemplate`, `JobTemplateSchema` y `sync-stages-from-pipeline.ts` completos.** `job-template-row.tsx` ahora manda "Continuar" (borrador, a `paso-{wizard_step}`) o "Editar" (publicada, a `paso-1`) al wizard; `plantillas-vacante/page.tsx` manda "Nueva plantilla" a `/nueva`. Verificado con 2 revisores en paralelo: el paso 6 (`publishTemplate`) bloquea publicar sin etapas (mismo gate que tenía el helper borrado), ningún `update*Step` toca `status` salvo `publishTemplate` (reabrir una plantilla publicada no la revierte a borrador), pasos 3/4 son borra-e-inserta (reabrir no duplica preguntas/etapas), y `createJob` copia las filas de la plantilla a tablas propias de la vacante al crearla — nada queda con referencia viva a lo que se edite después en la plantilla.
3. **[2026-09-01] Cascada de código muerto: borrar el punto de entrada de un flujo puede dejar huérfano lo que solo ÉL consumía, no solo lo que consume directamente.** `getPipelineTemplateOptions`/`PipelineTemplateOption` (`pipeline-templates/get-pipeline-templates.ts`) solo existían para alimentar el selector de pipeline del modal viejo — al borrar el modal, quedaron sin ningún llamador. Encontrado por el review (angle "removed-behavior"), no por grep manual inicial. Do instead: tras borrar un componente/acción, grep también los HELPERS que ese componente importaba — no solo confirmar que el componente en sí ya no se usa.

---

## Auditoría de buckets de Storage (post-Fase 18) — MÁXIMA PRIORIDAD

Disparada por un reporte real del usuario: falló subir la "imagen del inicio
de sesión" desde `/configuracion/marca`. Se verificó `storage.buckets` y las
políticas de `storage.objects` en vivo (`execute_sql` contra el proyecto,
simulación de rol con `request.jwt.claims`) — RLS de `marca-publico`/`cvs-privado`
está bien, los 2 bugs reales estaban en otro lado.

1. **[2026-09-01] BUG REAL: Next.js limita a 1 MB el body de toda Server Action por defecto — `next.config.ts` nunca lo overrideaba, aunque el configurador de marca admite imágenes de hasta 5 MB.**
   `uploadBrandImage` (`src/lib/organizations/actions.ts`) valida tamaño/tipo con Zod después de recibir el `FormData`, pero Next.js corta la solicitud ANTES de que ese código corra si el body pasa de 1 MB — la "imagen del inicio de sesión" (recomendada 1200x1600 vertical) fácilmente pesa más que eso. El candidato ve un error crudo de Next, no el mensaje en español del catálogo. Do instead: `experimental.serverActions.bodySizeLimit` en `next.config.ts` SIEMPRE tiene que ser ≥ el límite más grande que valide cualquier Server Action del código (+ margen por overhead de `multipart/form-data`, la doc de Next recomienda 10-20 KB) — un límite de archivo en Zod que nunca se compara contra este config es una validación que puede no alcanzar a ejecutarse nunca.

2. **[2026-09-01] BUG REAL, silencioso: el bucket `cvs-privado` tenía `allowed_mime_types` configurado solo para CVs (PDF/DOC/DOCX) — nunca se actualizó cuando Fase 18 agregó "archivos adicionales" (PDF/JPG/PNG) a `/api/postular`.**
   El código de la app sí permite JPG/PNG (`ALLOWED_ADDITIONAL_TYPES` en `src/app/api/postular/route.ts`), pero Supabase Storage rechaza la subida a nivel de bucket antes de que la RLS o el código importen — y ese error se trata como "best-effort" (`continue`, sin avisar al candidato). Resultado: TODO archivo adicional que fuera imagen se perdía en silencio, en cada postulación, desde el primer commit de Fase 18 — la postulación seguía viéndose exitosa. Corregido con `update storage.buckets set allowed_mime_types = array[...] where id='cvs-privado'` agregando `image/jpeg`/`image/png`. Do instead: **el tipo MIME permitido vive en 2 lugares que tienen que coincidir** — el `Set` de la app y `storage.buckets.allowed_mime_types` — cambiar solo uno dos dejarlo pasar en un lado y morir en silencio en el otro. Verificar ambos con `select allowed_mime_types from storage.buckets` cada vez que se agregue un tipo de archivo nuevo a cualquier flujo de subida.

3. **[2026-09-01] Aviso, no bug: el proyecto Supabase de este ATS tiene 2 buckets que el código de este repo nunca referencia — `archivos` (público, sin límite de tipo/tamaño) y `archivos_planes`/`firmas` (política de solo-lectura para `authenticated`).** Ninguno aparece en `docs/database.md` ni en ningún `storage.from(...)` de `src/`. Probablemente resto de otro proyecto compartiendo el mismo proyecto Supabase — no se tocaron, solo se deja constancia por si el usuario no esperaba que estuvieran ahí.

---

## Pestaña Pipelines eliminada + "guardar como set reutilizable" (Fase 18)

Cierra la pieza que quedó pendiente tras portal público: con el wizard ya
pudiendo crear `pipeline_templates` nuevos desde su propio paso "Etapas"
(checkbox "Guardar estas etapas intermedias como un set reutilizable"),
se cumple la condición para quitar `/configuracion/pipelines` — pantalla,
componentes (`pipeline-stages-editor.tsx`, `pipeline-template-form.tsx`,
`pipeline-template-row.tsx`) y `pipeline-templates/actions.ts` completo,
borrados.

1. **[2026-09-01] BUG REAL: `createPipelineTemplate` (Fase 15, ya borrado) manejaba `error.code === "23505"` para un nombre repetido — pero nunca existió un índice único que hiciera posible ese código de error. Confirmado consultando `pg_indexes` directo: solo estaba el índice único parcial de `is_default`, ninguno sobre `name`.**
   El pre-check de la nueva función (`.ilike` antes de insertar) tenía la misma falsa sensación de seguridad — sin restricción real, dos guardados casi simultáneos con el mismo nombre nuevo pasaban los dos. Agregado `pipeline_templates_org_name_key` (índice único en `(organization_id, lower(name))`), mismo patrón que `employment_reasons_org_label_key` (Fase 18, 1/7). Do instead: un `catch` de `error.code === "23505"` en código viejo NO es evidencia de que la restricción real existe — confirmarlo consultando `pg_indexes`/`pg_constraint` directo antes de asumir que "ya está cubierto en otro lado".

2. **[2026-09-01] BUG REAL: crear una fila padre y luego una fila hija dependiente en dos pasos separados, sin revertir la primera si la segunda falla, deja un registro fantasma (nombre sin contenido) que la UI sigue ofreciendo como opción válida.**
   Si `pipeline_templates` se insertaba bien pero `pipeline_template_stages` fallaba, quedaba un set con nombre y 0 etapas — "Empezar desde un set guardado" lo seguía listando, y elegirlo vaciaba la plantilla de quien lo intentara, sin ningún beneficio. Corregido: si el segundo insert falla, se borra la fila padre recién creada. Do instead: cualquier "crear padre, luego hijo" en dos pasos sin transacción real necesita el rollback manual del padre si el hijo falla — no dejarlo mudo esperando a que alguien lo note en la lista.

3. **[2026-09-01] Decisión, aceptada y no corregida: ya no hay forma de RE-designar qué `pipeline_templates` es la "predeterminada" de la organización — `setDefaultPipelineTemplate` se borró junto con la pantalla, y nada la reemplaza.**
   Solo importa para el diálogo plano viejo (Fase 15) cuando no se elige ningún pipeline al crear una plantilla — cada vez más un camino secundario ahora que el wizard es el principal. Construir una UI nueva solo para esto era alcance no pedido; se documenta como límite conocido, no se inventó una pantalla nueva para un caso que hoy casi no se usa.

---

## Portal público dinámico (Fase 18)

1. **[2026-09-01] BUG REAL, encontrado ANTES de que llegara a producción (se probó con simulación de rol antes de dar la migración por buena): una tabla nueva con SELECT solo para `can_access_job()` es invisible para el portal público sin autenticar — `can_access_job()` nunca contempla el rol `anon`.**
   `job_questions`/`job_question_options` (Fase 18, esquema) se diseñaron pensando en el uso INTERNO (RH viendo las preguntas de una vacante) y se les olvidó el otro consumidor real: el visitante anónimo del portal, que necesita ver esas mismas preguntas para responderlas. Sin la política `to anon` agregada acá, el portal público habría mostrado un formulario sin preguntas para SIEMPRE, sin ningún error visible — simplemente `[]`. Do instead: toda tabla nueva que un flujo público (sin sesión) necesita leer necesita su PROPIA política con `to anon` — no alcanza con que la tabla "ya tenga RLS", cada rol que de verdad la va a consultar necesita su propia condición explícita. Mismo patrón que `jobs_select_public` (ya existía) — buscarlo como referencia antes de escribir la política nueva, no reinventar el criterio.

2. **[2026-09-01] Decisión: `parseCandidacyFields()` normaliza cualquier `jsonb` no válido a "required" (el default más estricto), no a "hidden" ni a un error 500.**
   `candidacy_fields` es `Json` sin forma garantizada por TypeScript — un `as CandidacyFields` confía ciegamente. Ante una fila malformada, la opción seguía siendo mostrar el portal público (no romperlo), pero pedir DE MÁS es más seguro que pedir de menos — un campo que aparece de más es una molestia, un campo que debería pedirse y no aparece es un hueco de datos silencioso.

---

## Tooltips del menú flotante (Fase 18)

1. **[2026-09-01] BUG REAL: un tooltip `absolute` sin `z-index` propio puede quedar tapado por un elemento hermano opaco que sí tiene su propio contexto de apilamiento — incluso sin que ninguno declare `z-index` explícito, el orden del DOM decide, y un vecino "activo" puede pintar encima.**
   El indicador del ítem activo del menú flotante (`bg-background`, opaco) y el tooltip nuevo de un ítem vecino podían superponerse visualmente (tooltips más anchos que su propio botón, gap chico entre ítems) — sin `z-index`, gana quien esté después en el DOM, no necesariamente el tooltip. Corregido con `z-10` explícito en el tooltip. Do instead: cualquier tooltip/popover `absolute` que pueda superponerse con un elemento hermano opaco necesita `z-index` explícito, no asumir que "está encima en el árbol visual" alcanza.

2. **[2026-09-01] No se pudo probar en navegador — limitación ya documentada del sandbox, no un bug de la app.** El menú flotante vive dentro del layout autenticado (requiere `requireProfile()` con datos reales de Supabase) y este entorno no tiene salida de red hacia `*.supabase.co` (ver la entrada de Fase 17/entorno de desarrollo remoto). Verificado por inspección de código + `typecheck`/`lint`/`build`, no por interacción real en un navegador — pendiente de confirmación visual del usuario o en producción (Vercel sí tiene salida a internet real).

---

## Creación de vacante basada en plantilla (Fase 18, 7/7)

1. **[2026-09-01] BUG REAL DE TYPO, encontrado por revisión propia antes de que llegara a review: una variable con caracteres corruptos (cirílico/CJK mezclados en el mismo nombre, dos variantes distintas) compiló porque JS/TS no valida que un identificador "se vea bien", solo que sea consistente.**
   `sync-stages-from-pipeline.ts` tenía `source櫲PipelineId` en la declaración y `sourceпPipelineId` en el uso — dos identificadores DISTINTOS pero visualmente casi idénticos, típico de un artefacto de generación/autocompletado. TypeScript no lo marcó como error de sintaxis inmediatamente reconocible en el diff porque cada uno de los dos nombres corruptos SÍ era válido como identificador aislado. Do instead: después de escribir cualquier archivo con contenido generado de una sola pasada larga, correr `grep -nP "[^\x00-\x7F]"` sobre el archivo y revisar cada match a mano — no asumir que un identificador "raro" se habría marcado solo.

2. **[2026-09-01] BUG REAL: un input de texto dentro de un `<form>` dispara el envío IMPLÍCITO de ese form al presionar Enter — incluso si el botón "propio" del widget es `type="button"` y nunca se toca.**
   `EmploymentReasonSelect` vive dentro del `<form>` de "Crear vacante" (no puede tener su propio `<form>`, HTML no permite anidarlos). El input de "nuevo motivo" no tenía `onKeyDown`, así que Enter usaba el ÚNICO botón `type="submit"` real del DOM — el de crear la vacante, no el de agregar el motivo. Do instead: cualquier `<input type="text">` dentro de un `<form>` ajeno (un widget que vive dentro de un form más grande, sin ser su propio form) necesita `onKeyDown` que intercepte Enter (`preventDefault()` + la acción propia del widget) — no asumir que un botón `type="button"` cercano alcanza para evitar el envío implícito.

3. **[2026-09-01] Patrón nuevo: `<ActionButton>` fuera de un `<form>` (o dentro de uno ajeno) sigue funcionando pasándole `pending` explícito — no hace falta que viva dentro de SU PROPIO `<form action={...}>` para tener el spinner/disabled consistente.**
   `pending ?? formStatus.pending` en `action-button.tsx`: si se pasa `pending={isPending}` (de un `useTransition` propio), gana sobre el `useFormStatus()` ambiente del form que lo rodee (que ni siquiera es el que le importa a este botón). Do instead: cuando un botón que muta datos no puede vivir en su propio `<form>` (widget anidado dentro de un form más grande), usar `<ActionButton type="button" pending={isPendingPropio}>` en vez de inventar un botón crudo con estado manual — sigue siendo la regla no negociable, solo cambia de dónde sale el estado de carga.

---

## Wizard de plantillas — pasos 5-6, cierre (Fase 18, 6/7)

1. **[2026-09-01] BUG REAL, el más sutil de la sesión: un UPDATE que cambia si el propio actor va a seguir cumpliendo la política de SELECT de esa misma fila no puede confiar en el RETURNING de ese UPDATE para saber si "se guardó".**
   `updateTemplateStep5` dejaba activar `is_confidential` a cualquier admin+ (la política de escritura no mira quién es `created_by`), pero la política de lectura sí — un admin que no es el creador, al activar el switch, deja de cumplir esa política desde el mismo `UPDATE`. El código pedía `.select("id")` sobre ese UPDATE para confirmar éxito: como el RETURNING se filtra por la política de SELECT DESPUÉS de escribir, volvía vacío — `data.length === 0` se leía como "no se guardó", cuando en realidad sí se había guardado. El siguiente paso (redirigir al paso 6) además le daba un 404 real, sin ninguna pista de que su cambio sí había funcionado.
   Do instead: cuando un UPDATE puede cambiar si el actor sigue teniendo SELECT sobre la fila que acaba de tocar, la confirmación de éxito no puede depender del RETURNING de ese mismo UPDATE — confirmar existencia con un SELECT aparte ANTES de escribir, y decidir el resultado del `UPDATE` solo por su `error`, no por si el actor todavía puede leer la fila después.

2. **[2026-09-01] Decisión, consecuencia del bug de arriba: si el guardado del paso 5 deja al actor sin poder ver su propia plantilla, no se lo manda al paso siguiente — se lo manda al listado con un mensaje que explica por qué.**
   Mandarlo al paso 6 de todos modos le habría dado un 404 sin contexto (ya no cumple `can_view_job_template`). En vez de "arreglar" el síntoma escondiendo el 404, se cambia el destino del redirect según si el actor va a poder seguir viendo la fila o no — la excepción a la regla "todo paso avanza al siguiente" está documentada en el propio código, no es un caso suelto.

---

## Wizard de plantillas — paso 4 "Etapas" (Fase 18, 5/7)

1. **[2026-09-01] `job_template_stages` nació en la 1/7 con un enum propio (`kind`) que resultó redundante en cuanto se llegó a construir el paso que la usa — reemplazado por el `job_stage_type` que ya usan `pipeline_template_stages`/`job_stages` antes de que nadie hubiera guardado una fila.**
   Se diseñó pensando solo en la UX del wizard (qué posiciones quedan fijas), sin considerar que esta tabla eventualmente se materializa en `job_stages` — que sí necesita el tipo semántico real (`postulado`/`preseleccion`/`entrevista`/`oferta`/`contratado`/`descartado`) para que el resto de la app (filtros de candidatos, kanban) la entienda. Corregido a tiempo porque la tabla seguía vacía (nadie había usado el paso 4 todavía) — sin backfill necesario.
   Do instead: antes de diseñar el esquema de una tabla nueva "solo para la UI de este paso", preguntar si esos datos eventualmente alimentan o se materializan en OTRA tabla que ya tiene su propio tipo/enum establecido — si sí, reusar ese enum desde el principio en vez de inventar uno paralelo que después hay que reconciliar.

2. **[RESUELTO, ver la sección de arriba] Decisión original: "Guardar este set como reutilizable" se recortó de este paso mientras la pestaña Pipelines siguiera existiendo.**
   Ya no aplica — el checkbox se construyó y la pestaña Pipelines se quitó en la misma entrega que cierra esta fase. Se deja el ítem para el historial, no como pendiente real.

---

## Wizard de plantillas — paso 3 "Preguntas" (Fase 18, 4/7)

1. **[2026-09-01] BUG REAL, encontrado por 2 agentes de `/code-review` independientes con el mismo hallazgo: cambiar el `<select>` de tipo de una pregunta sin limpiar su lista de opciones asociada deja filas huérfanas permanentes.**
   Al pasar una pregunta de "Opción múltiple" a "Abierta" en `QuestionListEditor`, el `onChange` solo parcheaba `type`, no `options` — el bloque de opciones deja de RENDERIZARSE (gateado a `type === "multiple_choice"`) pero sigue vivo en el estado de React, y el input oculto las sigue serializando en cada submit. El servidor las insertaba igual (sin filtro por tipo) — el usuario nunca puede volver a verlas ni borrarlas desde la UI una vez ocurre.
   Do instead: en cualquier editor de lista anidada donde un campo "tipo" decide si un sub-campo aplica o no (acá: `type` decide si `options` tiene sentido), el `onChange` de ese campo tipo tiene que limpiar el sub-campo explícitamente, Y la Server Action tiene que filtrar por ese mismo tipo antes de escribir — las dos capas, no solo una (el cliente puede tener el mismo bug de nuevo mañana).

2. **[2026-09-01] Decisión de arquitectura: los `id` de un INSERT en lote que necesita después un segundo INSERT dependiente (preguntas → opciones) se generan en el cliente/servidor de la app con `crypto.randomUUID()` antes de insertar, nunca se leen del `RETURNING`.**
   Postgres no garantiza que las filas de un `RETURNING` de un `INSERT` multi-fila vuelvan en el mismo orden que los valores insertados — emparejar `insertedRows[i].id` con el índice `i` del array original es una apuesta, no una garantía. Generar los `id` de antemano (`crypto.randomUUID()`, disponible como global en el runtime de Node de este proyecto sin import) elimina el problema por completo. Do instead: cualquier INSERT en lote cuyo resultado alimenta un segundo INSERT relacionado (padre-hijo) genera los ids de antemano, no confía en el orden de vuelta del primero.

---

## Wizard de plantillas — pasos 1-2 (Fase 18, 2/7 y 3/7)

3. **[2026-09-01] Toda Server Action nueva que muta y redirige necesita `revalidatePath` del listado y de cualquier página propia a la que se pueda volver — se me olvidó en las 3 acciones del wizard, encontrado en `/code-review` antes de commitear.**
   `createTemplateDraftStep1`/`updateTemplateStep1`/`updateTemplateStep2` redirigían sin revalidar nada, rompiendo la convención que sigue cada Server Action de este proyecto (`job-templates/actions.ts`, `departments/actions.ts`, `jobs/actions.ts`, todas la llaman). Do instead: al escribir una Server Action nueva que hace `redirect()` tras mutar, copiar el bloque `revalidatePath(...)` de la acción hermana más parecida ANTES de considerarla terminada — no es opcional solo porque el destino "parece" dinámico.

## Wizard de plantillas — paso 1 "Detalles" (Fase 18, 2/7)

1. **[2026-09-01] BUG REAL DE REGRESIÓN: agregar una columna `status` con `DEFAULT 'draft'` a una tabla que ya tenía un flujo de creación existente puede volver invisibles filas que antes eran normales, sin tocar ese flujo para nada.**
   `job_templates.status` se agregó en la 1/7 pensando en el wizard nuevo (progresivo). `createJobTemplate()` (Fase 15, diálogo de un solo paso, nunca supo de `status`) seguía insertando bien — pero cada plantilla nueva nacía en `'draft'` por el default, y el nuevo `getPublishedJobTemplates()` (filtra `published`) las excluía todas del selector de "Solicitar vacante". Se encontró en `/code-review` antes de commitear, no en producción.
   Do instead: cuando una migración agrega una columna con estado (`status`, `draft/published`, `activo/inactivo`) a una tabla con un flujo de creación YA EXISTENTE, revisar ese flujo explícitamente — ¿debería seguir produciendo el equivalente de "listo para usar" de siempre, o heredar el nuevo estado por defecto? No asumir que un default de columna es inocuo solo porque no rompe el `INSERT` en sí.

2. **[2026-09-01] Entorno: un archivo que Bash puede leer bajo `~/.claude/projects/.../tool-results/` puede ser invisible para el tool de PowerShell en la misma sesión (`Test-Path` da `False`), sin patrón claro de cuándo pasa.**
   Encontrado al intentar extraer el resultado de `generate_typescript_types` (guardado como archivo grande fuera del contexto) — Bash lo leía sin problema (`head -c` funcionaba), PowerShell no lo encontraba ni con la ruta exacta copiada de `Get-ChildItem`. Do instead: si PowerShell no encuentra un archivo bajo `tool-results` que Bash sí ve, copiarlo primero al working directory del proyecto con Bash (`cp`) y operar sobre la copia — no perder tiempo reintentando la ruta original.

---

## Esquema del wizard de plantillas de vacante (Fase 18, 1/7)

Origen: rediseño grande pedido por el usuario (wizard de plantillas de vacante paso a paso, candidatura dinámica, preguntas con precalificación, confidencialidad). Esta entrega es solo esquema y RLS — las fases 2-7 construyen la UI encima, cada una con su propio plan.

1. **[2026-09-01] BUG DE SEGURIDAD REAL: una política `FOR ALL` también gobierna `SELECT`, y se combina en OR con la política de lectura — puede dejar ver una fila que la política de SELECT explícitamente esconde.**
   `job_templates_write_admin` (Fase 15, ya existía) es `FOR ALL`. Al agregar `is_confidential` y una `job_templates_select` más estricta (`can_view_job_template`, esconde una plantilla confidencial de quien no es su creador), la plantilla confidencial SEGUÍA siendo visible para cualquier admin+ de la organización — la política de escritura, al cubrir también SELECT, la dejaba pasar sin pasar por la función nueva. Se detectó simulando el rol real (insertar una confidencial de otro creador, `select count(*)` como un admin distinto) — leer el SQL de la política no lo hubiera mostrado, hacía falta correrlo. Corregido partiendo `job_templates_write_admin` (y las 3 políticas de escritura de sus hijas nuevas) en `INSERT`/`UPDATE`/`DELETE` por separado, ninguna declarada `FOR ALL`.
   Do instead: en cuanto una tabla tenga una política de SELECT con una condición más estricta que "cualquiera del rol X" (confidencialidad, visibilidad parcial), auditar TODAS las demás políticas de esa tabla — si alguna es `FOR ALL`, hay que partirla o la condición estricta queda de adorno. No alcanza con revisar la política que se acaba de escribir.

2. **[2026-09-01] `auth.uid()` como `DEFAULT` de columna no sirve en el momento de una migración (sin contexto de request, evalúa `null`), pero SÍ sirve para cada INSERT real de la app de ahí en adelante.**
   `job_templates.created_by` se agregó `NOT NULL` sin default, con un backfill (`UPDATE ... SET created_by = <super_admin de la org>`) para las filas ya existentes, y RECIÉN DESPUÉS `ALTER COLUMN created_by SET DEFAULT auth.uid()`. Sin ese paso separado, `createJobTemplate()` (Fase 15, nunca mandó `created_by`) hubiera roto en el primer POST real después de esta migración — confirmado porque `typecheck` lo señaló de inmediato (el tipo `Insert` generado exige la columna cuando no ve un default en `information_schema`).
   Do instead: cuando una columna `NOT NULL` nueva necesita quedar poblada por el actor real (no un valor fijo), backfill con un `UPDATE` explícito primero, `SET NOT NULL` después, y recién ahí agregar `DEFAULT auth.uid()` — hacerlo en un solo paso (columna con default volátil desde el `ADD COLUMN`) rompe el backfill de las filas existentes.

3. **[2026-09-01] Decisión: `job_questions`/`job_question_options` (copia por vacante) sí quedaron con política de escritura `FOR ALL`, a diferencia de sus pares de plantilla — verificado que es seguro, no un descuido.**
   `private.can_access_job()` empieza con `is_admin_or_above() OR ...` — un admin+ ya tiene acceso incondicional a toda vacante de su organización, así que una política `FOR ALL` no le regala ningún `SELECT` que `can_access_job` no le diera igual (a diferencia de `job_templates`, que sí tiene una condición de confidencialidad que un admin+ no cumple automáticamente). Confirmado leyendo `prosrc` de `can_access_job` antes de decidir, no asumido por analogía.

4. **[2026-09-01] El JWT de prueba en simulación de rol necesita `app_metadata.app_role`, no `app_metadata.role` — mismo error de sintaxis ya anotado en Fase 13, repetido de nuevo antes de recordarlo.**
   Costó dos intentos fallidos (parecían RLS negando de más) antes de volver a `select prosrc from pg_proc where proname = 'auth_role'` y confirmar el nombre exacto. Do instead: la próxima vez, empezar por ahí, no por adivinar.

---

## Fusión de plantilla de vacante + conexión a pipeline/competencias (Fase 17)

Origen: comparación contra un documento de referencia del sistema real (RH-Suite) que el usuario pidió revisar. El documento mostró que "elegir plantilla" en el sistema real FUSIONA campos (no pisa lo ya escrito) y que la plantilla trae su propio pipeline + rúbrica de evaluación — ninguna de las dos cosas existía en la Fase 15 original.

1. **[2026-09-01] BUG DE SEGURIDAD REAL, el más serio de la sesión: el primer diseño de "aplicar plantilla" mandaba el CONTENIDO de la rúbrica (nombre/peso de cada competencia) del cliente al servidor, y `createJob` lo insertaba tal cual usando el cliente admin (que bypasea RLS).**
   `job_competencies` exige `admin+` para escribir (`job_competencies_write_admin`) — pero `createJob` deja crear vacantes a cualquier `gestor`. La primera versión de este fix insertaba las competencias que llegaban en un campo oculto del formulario usando `createAdminClient()` (mismo motivo que `materializeJobStages`: un gestor no tiene SELECT sobre las tablas admin-only que arman el pipeline). El problema: a diferencia de `materializeJobStages` (que solo recibe un ID de plantilla del cliente y vuelve a consultar el CONTENIDO real en el servidor), esta primera versión insertaba el contenido que el cliente mandó, sin volver a verificarlo contra nada. Un gestor podía fabricar un POST directo a `createJob` con nombres/pesos de competencia inventados y se insertaban igual, evitando por completo el gate admin+ que protege esa tabla en cualquier otro flujo. Corregido: el cliente solo manda `template_id` (una referencia); `createJob` vuelve a leer `job_templates.competencies` desde la base con el cliente de SESIÓN (no el admin — `job_templates_select` ya permite leer a cualquier miembro de la organización) antes de decidir qué insertar. Do instead: cuando el cliente admin (`createAdminClient()`) bypasea RLS para que un rol sin acceso directo pueda completar una acción legítima, **el cliente nunca debe mandar el contenido que se va a escribir — solo un id que el servidor vuelve a resolver.** Si el servidor confía en el contenido en vez de en el id, el bypass de RLS se convierte en un bypass de la regla de negocio completa (aquí, "solo admin+ decide la rúbrica de evaluación").

2. **[2026-09-01] Un formulario no controlado (`defaultValue`) no puede "fusionar" datos nuevos vía props — la fusión real necesita manipular el DOM a mano.**
   El primer intento de "fusionar en vez de reemplazar" seguía usando el mecanismo de `key`+remount de Fase 15 (que por diseño REEMPLAZA todo el formulario). Eso no es fusión, es "reemplazar con un candado si ya hay algo" — no cumple lo que pedía el documento de referencia (RH-Suite solo llena los campos VACÍOS). La solución real: `JobForm` expone su `<form>` vía `ref` (con `forwardRef`), y quien elige la plantilla (`NuevaVacanteForm`) recorre `form.elements.namedItem(nombre)` campo por campo, escribiendo el valor SOLO si el campo actual está vacío (`fillIfEmpty`). Nada de `key`, nada de remount — el mismo `<form>` sigue vivo, solo se le tocan los campos que el usuario no había tocado.

3. **[2026-09-01] Reabrir "Nueva plantilla" tras crear una mostraba la rúbrica de la plantilla recién creada — `formRef.current.reset()` (nativo) no toca estado de React.**
   `CompetencyListEditor` guarda sus filas en `useState`, no en `defaultValue` de inputs — un `reset()` nativo del formulario no lo alcanza. Se corrigió exponiendo un `ref` imperativo (`useImperativeHandle`) con un método `clear()`, llamado junto al `reset()` nativo. Do instead: cualquier editor de lista tipo `PipelineStagesEditor`/`CompetencyListEditor` (estado de React serializado a un input oculto) necesita su PROPIO mecanismo de limpieza — el `reset()` de un `<form>` nativo solo alcanza inputs/textareas/selects no controlados.

4. **[2026-09-01] `react-hooks/set-state-in-effect` bloquea `setState` dentro de un `useEffect` incluso llamado a través de un ref imperativo indirecto si el linter lo puede rastrear — pero SÍ permite llamar un método imperativo expuesto por OTRO componente (`ref.current?.clear()`), porque no puede ver dentro de él.**
   Confirma el mismo patrón ya documentado en Fase 12 (`message-form.tsx`): cuando ESLint bloquea un `setState` directo dentro de un efecto, la salida no es "sacar la lógica del efecto" — es mover el `setState` a un componente hijo y exponerlo como un método imperativo (`useImperativeHandle`) en vez de una prop de estado (`key`).

---

## Configurador de bolsa pública (Fase 16)

1. **[2026-09-01] Alcance recortado a propósito: 2 columnas nuevas en `organizations` (`careers_headline`, `careers_intro`) reusando el formulario de Marca ya existente, no una página ni tabla nueva.**
   El ítem del roadmap decía "configurador de bolsa pública (editor de contenido multi-página)" — sonaba a mucho más de lo que en realidad hace falta para una demo. Lo real: el portal público (`/empleos`) solo necesitaba un título y un texto de bienvenida configurables; no hace falta una tabla nueva, RLS nueva, ni una página de configuración nueva — son 2 campos más en la fila de `organizations` que ya existe, guardados por la misma acción que ya guarda logo/color/nombre. Do instead: antes de diseñar una tabla/página nueva para un ítem de roadmap que "suena grande", preguntar qué tan grande es el contenido real — a veces son 2 columnas en una tabla que ya existe.

2. **[2026-09-01] Decisión de permiso: el contenido de la bolsa pública quedó gateado a `super_admin` (mismo nivel que logo/color), no a `admin` como el resto de la configuración de reclutamiento — decisión deliberada, no un descuido.**
   `admin` (RH) sería el dueño natural de este copy, pero la política RLS de `UPDATE` en `organizations` (`organizations_update_super_admin`) es a nivel de FILA, no de columna — Postgres RLS no puede decir "admin puede tocar `careers_headline` pero no `accent_color`" sobre la misma fila sin un trigger o una tabla aparte. Bajar el gate a `admin+` en la acción compartida (`updateBranding`) le daría a cualquier `admin` la capacidad de cambiar también el logo, el color de acento y el nombre de la plataforma — una escalación de permiso real. Se dejó en `super_admin` (más estricto, consistente con Marca) en vez de resolver esto ahora. Si se necesita de verdad que `admin` edite el copy de la bolsa sin tocar la identidad visual, la solución correcta es sacar `careers_headline`/`careers_intro` a una tabla aparte con su propia política — no relajar la política de `organizations`.

3. **[2026-09-01] BUG REAL: `?? null` no captura un valor de solo espacios porque `optionalText()` solo convierte a `undefined` el valor CRUDO antes de recortar, no el resultado ya recortado.**
   `optionalText("   ").safeParse(...)` → el preprocess ve `"   "` (no es `""` ni `null`), lo deja pasar; luego el `.trim()` interno del schema lo reduce a `""` — el resultado final en `parsed.data` es `""`, no `undefined`. `"" ?? null` da `""`, no `null`. Corregido con `|| null` en vez de `?? null` (trata `""` igual que `null`/`undefined`). Do instead: cuando se necesite "vacío o solo espacios → null" después de un `optionalText()`, usar `|| null`, no `?? null` — el operador `??` solo mira nullish, no falsy, y un string recortado a `""` no es nullish.

---

## Motor de plantillas de vacante (Fase 15)

1. **[2026-09-01] BUG REAL (recurrente, 3ª vez que aparece en la sesión): un diálogo de editar con inputs no controlados (`defaultValue`) no se entera cuando sus props cambian — solo aplica el valor al montar.**
   `JobTemplateDialog` no se remontaba entre aperturas: tras guardar una edición y reabrir "Editar" sobre la MISMA fila sin recargar la página, los campos mostraban el valor de ANTES de guardar, no el recién guardado. Mismo patrón ya sospechado en `DepartmentDialog`/`MessageTemplateDialog` (no confirmado ahí, pero comparten la exacta misma estructura — probablemente el mismo bug). Corregido acá con `key={template.updated_at}` en el uso del diálogo — cambia cada vez que la fila realmente cambió, forzando un remount con datos frescos. Do instead: cualquier diálogo de "editar" con inputs `defaultValue` necesita una `key` atada a algo que cambie cuando el dato subyacente cambia (`updated_at` es ideal, ya viene gratis en casi toda tabla) — no asumir que basta con que el diálogo cierre y vuelva a abrir.

2. **[2026-09-01] Bug del mismo síntoma, causa distinta: el formulario de CREAR (sin `template`, sin id que cambie entre aperturas) no se limpiaba solo — necesitó `formRef.current?.reset()`, no una `key`.**
   Una `key` no ayuda acá porque no hay ningún valor que cambie entre "crear la primera plantilla" y "crear la segunda" — el fix es imperativo (`reset()` del form nativo), no declarativo. Do instead: distinguir el síntoma "reabrir muestra datos viejos" en dos causas — edición (usar `key` atada a un campo que cambia) vs. creación (usar `formRef.reset()`), no aplicar la misma solución a ambas.

3. **[2026-09-01] Reuso: `JobTemplateSchema` se derivó de `JobFormSchema` con `.pick()` en vez de retipar los mismos 5 campos — requirió separar `JobBaseSchema` (sin `.refine()`) de `JobFormSchema` (con `.refine()`) en `src/lib/jobs/schema.ts`, porque Zod v4 no permite `.pick()` sobre un schema que ya tiene un refinamiento encima.**
   `z.object({...}).refine(...).pick({...})` lanza `.pick() cannot be used on object schemas containing refinements` en tiempo de ejecución, no es un error de tipos — se descubre corriendo el código, no compilando. Do instead: si un schema necesita `.refine()` Y otro schema necesita reusar un subconjunto de sus campos con `.pick()`, separar el objeto base (sin refine) del schema final (`base.refine(...)`) desde el principio — no agregar el refine directo al `z.object()` inicial si ya se sabe que otro lugar va a necesitar sus campos sueltos.

4. **[2026-09-01] Reuso: `LabelSelect` extraído a `src/components/ui/` tras la 2ª aparición del mismo `Object.entries(WORK_MODE_LABEL).map(...)` (job-form.tsx ya lo tenía, job-template-dialog.tsx lo iba a repetir).**
   Distinto del criterio "esperar a la 3ª copia" de Fases 12/14 — acá se extrajo en la 2ª porque dos revisores independientes convergieron en el mismo hallazgo con el mismo fix sugerido, señal más fuerte que "se parece a algo" a secas.

---

## Segmentos y filtros de candidatos (Fase 14)

1. **[2026-09-01] BUG REAL, el más serio de esta fase: forzar `!inner` sobre un embed de Supabase para poder filtrar por su columna reintrodujo un bug ya documentado y corregido en Fase 5 — pero esta vez borraba la fila COMPLETA en silencio, no solo lanzaba un error de acceso nulo.**
   `job_stages`/`jobs` tienen RLS más estricta que `applications` (un colaborador sigue viendo la postulación de su referido aunque la vacante ya no le sea visible). `job_stages!inner(name, type)` sin condición — puesto ahí solo para poder hacer `.eq("job_stages.type", ...)` — hace que PostgREST exija una fila de `job_stages` unible para devolver la fila padre, así que cualquier candidato cuya etapa dejó de ser visible desaparecía por completo de `/candidatos`, sin filtro de etapa activo siquiera. Corregido quitando el `!inner` (vuelve a ser `job_stages(name, type)`, nullable) y filtrando por tipo de etapa en JS después de traer las filas. Do instead: cuando se necesite filtrar por una columna de un embed, preguntar primero si la tabla embebida tiene RLS más estricta que la tabla principal — si sí, **nunca** usar `!inner` sin condición; o se filtra en JS después de un left join normal, o se hace `!inner` solo cuando ese filtro específico está realmente activo.

2. **[2026-09-01] BUG REAL: validar un valor de la URL con `valor in objetoDeEtiquetas` es vulnerable a la cadena de prototipos de JavaScript.**
   `"constructor" in STAGE_TYPE_LABEL` da `true` (existe en `Object.prototype`), aunque `STAGE_TYPE_LABEL` nunca declaró esa clave — `/candidatos?stage_type=constructor` pasaba la validación y el string `"constructor"` llegaba como literal de enum a Postgres. Corregido reemplazando el chequeo `in` por un parseo real con Zod (`CandidateFiltersSchema.safeParse`), que ya existía para el formulario de guardar segmento — una sola fuente de verdad para ambos casos. Do instead: nunca validar un valor externo contra las claves de un objeto plano con el operador `in` — usar `Object.prototype.hasOwnProperty.call(obj, key)`, un `Set`, o (mejor, si ya existe) el schema de Zod correspondiente.

3. **[2026-09-01] Reuso perdido: `STAGE_TYPE_LABEL` y la lista de 6 valores de `job_stage_type` ya existían en `src/lib/pipeline-templates/schema.ts` (Fase 9) — se reescribieron desde cero sin buscar primero si ya existían.**
   Corregido reexportando `STAGE_TYPE_LABEL` desde `pipeline-templates/schema.ts` en `src/lib/candidates/labels.ts`, y reusando `StageSchema.shape.type` (el enum de Zod ya construido) en vez de una lista literal nueva. Do instead: antes de escribir un mapa de etiquetas o un enum de Zod para un valor de la base de datos, grep del nombre del enum (`job_stage_type`, `application_status`, etc.) en todo `src/lib/` — es muy probable que una fase anterior ya lo haya necesitado.

4. **[2026-09-01] Decisión: sin paginación real todavía — `.limit(100)` con un aviso honesto ("mostrando los N más recientes") en vez de fingir que la lista está completa.**
   Un segmento guardado ahora persiste un filtro como vista reusable — antes el límite era un detalle menor de una búsqueda de texto efímera, ahora puede esconder resultados de forma indefinida cada vez que alguien abre ese segmento. Paginación completa es un desarrollo aparte (mismo tipo de decisión que "no bulk actions esta fase", ver abajo); el mínimo honesto es no fingir que 100 es "todos".

5. **[2026-09-01] Alcance recortado a propósito: sin acciones masivas (bulk reject/mover etapa) esta fase.**
   El ítem del roadmap "Segmentos/columnas de Candidatos" incluía acciones masivas como sub-ítem. Se construyó la tabla densa + filtros + segmentos guardados (el núcleo del ítem); acciones masivas queda pendiente, documentado aquí para no perderlo, no implementado.

---

## Entrevistas + Google Calendar (Fase 13)

1. **[2026-09-01] Decisión: integración con Google Calendar sin OAuth ni API — solo enlaces "TEMPLATE" (`calendar.google.com/calendar/render?...`).**
   Requiere pedir el scope `calendar.events` en el login de Google (hoy solo se pide perfil/email), guardar refresh token, y renovar credenciales — todo eso es configuración manual en Google Cloud Console (mismo tipo de paso que el hook de custom access token o el proveedor de Google en Supabase, ningún agente puede hacerlo por API). Se optó por el enlace "agregar a mi calendario" de un clic: cero credenciales nuevas, funciona igual de bien para una demo, y cada quien agrega el evento a SU PROPIO calendario. Si se necesita sincronización real (auto-invitar, detectar cambios, cancelar desde Calendar), ahí sí hace falta OAuth completo — anotado como alcance futuro, no implementado.

2. **[2026-09-01] BUG REAL: la hora del correo al candidato se formateaba con la zona horaria del SERVIDOR, no la de la organización ni la del candidato — podía contradecir el enlace de Google Calendar del mismo correo.**
   `toLocaleString()` sin `timeZone` explícito, evaluado en un React Email renderizado server-side (dentro de `after()`), usa la zona del proceso Node (típicamente UTC en producción), no la del navegador de quien lo lee. El enlace "TEMPLATE" de Google Calendar sí es correcto siempre (manda el instante en UTC, Google lo convierte en el navegador de quien lo abre) — el texto y el enlace del mismo correo podían decir horas distintas. No existe una columna de zona horaria en `organizations`, así que la corrección no fue "adivinar la zona correcta" sino ser honesto: mostrar la hora en UTC explícito y remitir al enlace para la hora local real. Do instead: cualquier fecha/hora renderizada en un correo (server-side, sin `after()` corriendo en el navegador de nadie) necesita `timeZone` explícito en `toLocaleString`/`Intl.DateTimeFormat` — nunca asumir que el servidor y el destinatario comparten zona horaria.

3. **[2026-09-01] Decisión de nivel de permiso: agendar/cancelar/eliminar una entrevista exige `canDecideApplication` (mismo nivel que rechazar/contratar/mandar mensaje), NO el nivel más permisivo de Tareas — con una excepción de auto-servicio.**
   El primer diseño copió el nivel de autorización de `candidate_tasks` (cualquier colaborador con acceso a la vacante) porque la tabla es RLS-gemela de `candidate_tasks`. Un review encontró el error: agendar dispara un correo al candidato a nombre de la plataforma — mismo tipo de efecto hacia afuera que `sendCandidateMessage`, no el efecto puramente interno de una tarea. Se corrigió para exigir `canDecideApplication` en `scheduleInterview`/`deleteInterview`, con una excepción: `updateInterviewStatus` deja que la persona asignada como `interviewer_id` marque su propia entrevista sin ser approver/owner (mismo auto-servicio que ya permite la política RLS `interviews_update` vía `interviewer_id = auth.uid()`). Do instead: la forma de la tabla (mismo shape RLS que otra tabla) NO determina el nivel de permiso de la Server Action — eso lo decide si la acción tiene un efecto visible hacia el candidato o hacia afuera de la organización, sin importar qué tan parecida sea la tabla a una ya construida.

4. **[2026-09-01] El JWT de prueba en simulación de rol necesita `app_metadata.app_role`, no `app_metadata.role` — error de sintaxis repetido al armar el primer test de esta fase, ya cometido antes en Fase 8-11 pero no anotado hasta ahora.**
   `private.auth_role()` lee `auth.jwt() -> 'app_metadata' ->> 'app_role'` (ver `private.is_admin_or_above()`); un test con `app_metadata: { role: 'admin' }` (sin el prefijo `app_`) falla la política silenciosamente — el INSERT de prueba se rechaza y parece un bug de RLS cuando en realidad es un JWT de prueba mal armado. Do instead: antes de escribir un test de simulación de rol nuevo, confirmar el nombre exacto de la claim corriendo `select pg_get_functiondef(oid) from pg_proc where proname = 'auth_role'` — no asumir el nombre por analogía con `organization_id`.

5. **[2026-09-01] Tercera vez que el mismo preprocesador zod ("cadena vacía → undefined") se copia a mano en un archivo nuevo — recién extraído a `src/lib/zod-helpers.ts` en esta fase.**
   Ya estaba duplicado en `departments/schema.ts` y `api/postular/route.ts` desde antes; esta fase iba a agregar una cuarta copia. Mismo patrón que `ConfigListSkeleton` en Fase 12: la señal real de extraer no es "esto se parece a algo", es "esto YA se duplicó una vez antes de que yo llegara".

---

## Plantillas de mensaje + correo directo al candidato (Fase 12)

1. **[2026-09-01] `application_event_type` ya tenía el valor `correo_enviado` desde el diseño original del esquema, sin ningún código que lo insertara — confirmado por grep antes de escribir la Server Action.**
   El schema fue diseñado anticipando esta feature (Fase 6 dejó el enum listo) pero nunca se cableó hasta ahora. Do instead: antes de decidir que un enum "no se usa" o está muerto, comprobar con grep si de verdad no hay ningún productor — puede ser una feature futura ya prevista, no basura.

2. **[2026-09-01] El destinatario del correo sale SIEMPRE de la fila (`applications.candidates.email`), nunca de un campo del formulario — variante nueva del patrón IDOR de esta sesión.**
   A diferencia de los 5 casos anteriores (un id de OTRA fila que no se revalida), acá el riesgo es distinto: si el "to" viniera del cliente, cualquiera con acceso de escritura a la acción podría mandar un correo con remitente de esta plataforma a una dirección arbitraria (vector de phishing), no solo leer/escribir datos ajenos. Do instead: en cualquier acción que envía correo a un tercero (no un perfil interno), el destinatario se resuelve siempre server-side desde la fila que la acción ya tiene permiso de leer — jamás se acepta como parámetro, ni siquiera oculto en un campo hidden.

3. **[2026-09-01] Un `<textarea>` manda saltos de línea como `\r\n` en el FormData — `body.split("\n")` sin normalizar deja un `\r` colgando en cada línea salvo la última.**
   Encontrado por revisión línea-por-línea antes de llegar a producción. Do instead: cualquier código que haga `split("\n")` sobre texto que vino de un `<textarea>` (o cualquier input HTML multilínea) debe normalizar con `.replace(/\r\n/g, "\n")` primero — no asumir que el navegador manda `\n` puro.

4. **[2026-09-01] Precedente confirmado (no bug): reusar un permiso "de decisión" (`canDecideApplication`) para una acción nueva (enviar mensaje) puede dar a un `colaborador` con tier `approver`/`owner` una capacidad que la UI no expone a su rol — pero esto ya era así para Contratar/Rechazar/Tareas, no es una regresión nueva.**
   El gate de UI (`profile.role !== "colaborador"`) y el permiso real de servidor (`canDecideApplication`, que sí deja pasar a un colaborador con tier alto en `job_collaborators`) llevan divergiendo desde Fase 5 — es el modelo de acceso fino documentado en AGENTS.md ("el acceso fino se resuelve con `job_collaborators`, no subiendo el rol global"), no un hueco. Do instead: antes de "corregir" una discrepancia UI-vs-servidor en este proyecto, comprobar si YA es el patrón aceptado en pantallas hermanas (Contratar/Rechazar) antes de tratarla como bug nuevo.

5. **[2026-09-01] Tres páginas de configuración con lista simple (`motivos-rechazo`, `pipelines`, ahora `plantillas-mensaje`) habían llegado a tener el mismo `loading.tsx` copiado a mano — extraído a `<ConfigListSkeleton />` recién en la 3ª repetición.**
   Do instead: la regla "tres líneas similares > abstracción prematura" aplica a *código nuevo* que se parece a algo existente — pero si el código NUEVO sería la 3ª copia casi idéntica de algo que YA se duplicó una vez antes, esa es la señal real de extraer, no de aceptar una 3ª duplicación.

---

## Evaluación por competencias (Fase 11)

1. **[2026-09-01] BUG REAL, encontrado por un agente con acceso directo a Supabase (no solo lectura de código): `UPDATE`/`DELETE` de `application_competency_scores` no revalidaban acceso a la vacante, solo `evaluator_id = auth.uid()`.**
   A diferencia de `SELECT`/`INSERT` (que sí exigen `can_access_job`), un evaluador al que se le quita el acceso (deja de ser `job_collaborator`) podía seguir tocando su calificación vieja. Corregido con una migración que agrega el mismo `EXISTS(...can_access_job...)` a ambas políticas. Verificado con simulación de rol real: se quita el `job_collaborator`, se intenta `UPDATE`, 0 filas afectadas.
   Do instead: cuando una tabla nueva tiene SELECT/INSERT con un chequeo (ej. `can_access_job`) y UPDATE/DELETE con otro más simple (ej. solo "soy el dueño de la fila"), preguntarse explícitamente si ese chequeo más simple debería incluir también el primero — no asumir que "ya es mi fila" es suficiente si el permiso subyacente (acceso a la vacante) pudo cambiar después de crearla.

2. **[2026-09-01] BUG REAL (4ª vez esta sesión, variante nueva): `submitScore` nunca validaba que `competencyId` perteneciera a la MISMA vacante que `applicationId`.**
   A diferencia de las 3 veces anteriores (un id de OTRA fila del mismo tipo, ej. otro perfil), acá son dos ids de tablas DISTINTAS que deben coincidir en un campo compartido (`job_id`) sin que ninguna FK lo obligue — ninguna restricción de base de datos liga `application_competency_scores.application_id` con `.competency_id` a través de un `job_id` común. Do instead: cuando dos columnas de una misma fila referencian tablas distintas que a su vez comparten un campo "padre" (aquí, `job_id`), y no hay una FK compuesta que lo fuerce, la Server Action tiene que leer y comparar ese campo compartido a mano antes de escribir — mismo principio que "un id hijo no prueba pertenencia al padre correcto" (Fase 5), pero entre dos hijos del mismo padre, no un hijo y su padre.

3. **[2026-09-01] BUG REAL, encontrado por línea-por-línea: una `key` de React compartida entre postulaciones distintas puede filtrar estado de un candidato a otro.**
   `CompetencyRow` se keyeaba solo por `competencyId` (pertenece a la VACANTE, no a la postulación) — dos candidatos de la misma vacante comparten esa key. Al navegar de un candidato a otro (misma vacante), React podía reciclar la instancia del componente y su estado local (la calificación en progreso), dejando que se guardara la nota de un candidato sobre otro.
   Do instead: cuando un componente de cliente muestra datos de una entidad (aquí, competencia) que en realidad pertenece a un padre compartido (la vacante) pero se renderiza en el contexto de un hijo específico (la postulación/candidato), la `key` de React tiene que incluir el id del hijo, no solo el de la entidad compartida — aunque la entidad compartida ya tenga su propio id único.

4. **[2026-09-01] Decisión: `position` de `job_competencies` se simplificó a un valor fijo (0), ordenando por `created_at`.**
   El primer intento calculaba `position` con un `COUNT` antes de cada insert — sin constraint de unicidad, esto colisiona de forma determinística después de un borrar+agregar (no hace falta concurrencia para reproducirlo). Como no existe todavía un reordenamiento manual de competencias, no hay ninguna razón para mantener un valor calculado que nadie lee de forma ordenada — se resuelve solo con orden de creación. Si se agrega reordenamiento después, ahí sí vale la pena un `position` real mantenido (con el mismo patrón "reemplazar todo" que `pipeline_templates`).

5. **[2026-09-01] Pendiente, documentado a propósito: el peso (`weight`) de cada competencia se captura y se muestra, pero no se usa todavía para calcular un puntaje global ponderado de la postulación.**
   Hoy cada competencia solo muestra su propio promedio simple entre evaluadores; no existe un "puntaje total" que combine las competencias usando su peso. Es una limitación conocida, no un bug — construirlo bien necesita decidir dónde mostrarlo y qué hacer cuando faltan calificaciones en algunas competencias, y no se improvisó en esta fase.

---

## Tareas del candidato (Fase 10)

1. **[2026-09-01] Primera tabla nueva desde Fase 2 — `candidate_tasks`, migrada con `apply_migration` sin bloqueo del clasificador de auto-modo.**
   A diferencia del `ALTER TYPE ADD VALUE` bloqueado en Fase 7, un `CREATE TABLE` + RLS completo pasó sin pedir aprobación extra. No hay un patrón claro de qué bloquea el clasificador — no asumir que DDL "grande" se bloquea más que DDL "chico"; cada intento es su propio caso.

2. **[2026-09-01] Verificación de RLS con simulación de rol encontró un falso positivo por mal diseño de la prueba, no un bug real — anotar el error para no repetirlo.**
   Primera prueba: reutilicé el mismo perfil real (el único que existe en esta demo) como `requested_by` de la vacante Y como el "colaborador ajeno" que se probaba — `can_access_job` daba `true` correctamente (sí era el requester), pero yo esperaba `false`. Parecía un hueco de seguridad grave ("cualquiera puede insertar tareas").
   Do instead: para probar "colaborador sin ninguna relación", la vacante de prueba necesita `owner_id`/`requested_by` en `null` explícito (bypasear RLS con el rol default de la conexión SQL para el setup, no con `set role authenticated`) — nunca reusar el único perfil real disponible como "el ajeno" a la vez que como dueño de los datos de prueba.

3. **[2026-09-01] BUG REAL (mismo patrón, 3ª vez esta sesión): `assigned_to` de una tarea no se validaba contra la gente con acceso real a la vacante antes de insertar.**
   El `<select>` del formulario (`task-form.tsx`) ya solo ofrece gente con `can_access_job` (admin+ o colaborador de esa vacante) — la Server Action `addTask` confiaba en eso sin revalidar. Mismo hueco que `job_collaborators` (Fase 8) y `head_profile_id` de departamentos (Fase 9).
   Do instead: **cualquier id que salga de un `<select>` filtrado en el cliente se re-valida server-side, siempre, sin excepción** — a estas alturas esto debería ser un reflejo antes de escribir la Server Action, no un hallazgo de `/code-review`. Ver `isProfileAssignable()` en `src/lib/applications/get-applications.ts`.

4. **[2026-09-01] Las secciones nuevas de una página deben heredar el mismo gate de rol que las secciones vecinas, no asumir "RLS ya lo esconde".**
   La sección de Tareas se agregó sin la misma condición `profile.role !== "colaborador"` que ya protege Contratar/Rechazar en la misma página — un colaborador que ve la postulación solo por haber referido al candidato (no por `can_access_job`) habría visto un formulario que RLS le bloquea en silencio, sin explicación. Do instead: cuando una pantalla ya tiene un gate de visibilidad para un rol, cualquier sección nueva en esa misma pantalla hereda el mismo gate por defecto, salvo razón explícita para no hacerlo.

5. **[2026-09-01] Una consulta nueva y menos probada nunca debe compartir `Promise.all` con datos ya estables de los que depende el resto de la página.**
   `getAssignableProfiles` (recién escrita) se metió en el mismo `Promise.all` que la consulta de `rejection_reasons` (ya estable) — si la nueva fallaba, tumbaba toda la página (CV, notas, calificación, todo). Do instead: envolver la consulta nueva en `.catch(() => valorDeRespaldo)` cuando su fallo no debería impedir que el resto de la página cargue.

---

## Configurador simple: Departamentos, Pipelines, Motivos de rechazo (Fase 9)

1. **[2026-09-01] `email_templates` quedó fuera de Fase 9 a propósito — no se construyó su CRUD.**
   Motivo: nada en el código lee esa tabla todavía (los correos siguen hardcodeados en React Email desde Fase 6). Un CRUD para una tabla que nadie consume es peor que no construirlo — miente sobre tener efecto. Do instead: cuando se aborde, hacerlo junto con wirear `notify()`/`sendEmail()` para leer de ahí, no antes.

2. **[2026-09-01] El patrón "diálogo repetido" cruzó el umbral de 3 a 4 copias — esta vez sí se extrajo `<DialogShell>` (`src/components/ui/dialog-shell.tsx`).**
   Antes: `report-error-dialog.tsx` (Fase 7) y `reject-dialog.tsx` (Fase 5) ya lo tenían flagueado en reviews previos como "no urgente, 2-3 copias". Al aparecer una 4ª (`department-dialog.tsx`), el propio agente de reuso lo marcó como punto de quiebre. Do instead: 2-3 copias del mismo chrome se documentan y se dejan; a la 4ª, extraer — no hay una regla numérica mágica, pero repetirlo un review tras otro sin actuar es la señal real.

3. **[2026-09-01] BUG REAL (mismo patrón de Fase 8): `head_profile_id` de un departamento no se validaba contra la organización del actor antes de escribir.**
   El `<select>` del formulario ya solo lista gente de la org, pero la Server Action confiaba en el valor del cliente. Ver `assertProfileInOrg()` en `src/lib/departments/actions.ts` — mismo helper conceptual que Fase 8 para `job_collaborators`. Do instead: cualquier id que el cliente eligió de un `<select>` filtrado por organización se revalida server-side igual, sin excepción — ya es la segunda vez que aparece este mismo hueco en fases consecutivas.

4. **[2026-09-01] Aceptado, no corregido: `updatePipelineTemplate`/`createPipelineTemplate` borran+reinsertan las etapas sin transacción — ventana real de "plantilla con 0 etapas" si el insert falla justo después del delete.**
   Mismo patrón ya usado en el proyecto para listas anidadas (preguntas/etapas de vacante) — se acepta el mismo trade-off aquí. Corregirlo de verdad requiere una función RPC en Postgres que envuelva ambas operaciones en una transacción real (el cliente de Supabase JS no hace transacciones multi-statement). No se atacó esta sesión — bajo tráfico de escritura en esta pantalla, y cualquier fallo deja un estado detectable (plantilla con 0 etapas, mensaje de error visible), no uno silencioso.

5. **[2026-09-01] Aceptado, no corregido: `setDefaultPipelineTemplate` hace 2 UPDATEs secuenciales (quitar default viejo, poner default nuevo) sin transacción — ventana de "cero plantillas default" si el proceso se interrumpe entre los dos.**
   Mismo motivo que el punto anterior (necesita RPC/transacción real). Si `materializeJobStages()` corre justo en esa ventana, el `.single()` no encuentra fila y el gestor ve "No hay una plantilla de pipeline configurada" — mensaje amigable ya existente, no un crash. Riesgo real bajísimo: un solo admin activo hoy, acción rara.

6. **[2026-09-01] `deletePipelineTemplate` sí se corrigió con compare-and-swap: el chequeo `is_default=false` va en el propio `.eq()` del DELETE, no en un SELECT previo.**
   Mismo patrón que las transiciones de estado de vacantes/postulaciones — evita la carrera "SELECT ve false, otro admin lo marca default, DELETE de todos modos" sin necesitar ninguna migración nueva.

---

## Colaboradores por vacante + Bitácora (Fase 8)

1. **[2026-09-01] Todo el mecanismo RLS de `job_collaborators` ya existía completo desde Fase 2 — `can_access_job()` ya lo usa en `jobs`/`job_stages`/`applications`. Fase 8 fue 100% UI + capa de app, cero migración.**
   `private.can_access_job(job_id)` = admin+ OR owner/requested_by OR fila en `job_collaborators`. Ya estaba wireado en `jobs_select_internal`, `job_stages_select`, `applications_select/insert/update`. Lo único que faltaba: pantalla para agregar/quitar colaboradores (gateada a admin+ por `job_collaborators_write_admin`).

2. **[2026-09-01] BUG REAL encontrado en `/code-review`: un atajo "sin cambios" antes del chequeo de permiso deja pasar sin autorizar.**
   `moveApplicationStage` tenía `if (fromStageId === toStageId) return {success}` ANTES de validar `canDecideApplication`. No mutaba nada, pero el invariante "toda la función valida permiso" se rompía por ese único camino.
   Do instead: el chequeo de permiso/autorización va SIEMPRE antes de cualquier atajo de "no-op", nunca después — un atajo de conveniencia es fácil de escribir arriba del todo sin pensar que también hay que autorizarlo.

3. **[2026-09-01] BUG REAL (IDOR), encontrado en `/code-review`: agregar un colaborador no validaba que la persona elegida fuera de la misma organización.**
   El `<select>` del panel ya solo lista gente de la org, pero la Server Action confiaba en el `profile_id` que llegara en el FormData sin comparar organización — el cliente nunca es fuente de verdad, ni siquiera cuando la UI ya filtra.
   Do instead: antes de cualquier INSERT con un id que el cliente eligió de un `<select>`, revalidar server-side que esa fila (aquí, el perfil) pertenece a la misma organización que el actor — el mismo patrón que "un id hijo no prueba pertenencia al padre" de Fase 5.

4. **[2026-09-01] RESUELTO (con permiso explícito del usuario): los niveles de `job_collaborators.permission` ahora se hacen cumplir también en Postgres, no solo en la Server Action.**
   RLS (`can_access_job`) sigue sin distinguir nivel — a propósito, sigue gobernando visibilidad. Lo nuevo es un **trigger** `enforce_application_permission_tiers` (`BEFORE UPDATE` en `applications`) que llama a `private.can_decide_application(job_id)`/`private.can_rate_application(job_id)` — espejo exacto (mismo `auth_role() <> 'colaborador' OR EXISTS(...)`) de `canDecideApplication`/`canRateApplication` en `src/lib/applications/permissions.ts`. Si cambian los umbrales en TypeScript, hay que replicar el cambio en las dos funciones SQL o quedan desincronizadas — no hay una sola fuente de verdad todavía (aceptado por ahora, es demo).
   Verificado con simulación real de rol (`set_config('request.jwt.claims',...)` + `set role authenticated`, transacción con rollback, patrón ya documentado arriba): viewer bloqueado en decidir Y calificar, interviewer puede calificar pero no decidir, approver puede ambas — los 3 casos junto con el trigger disparando de verdad (no solo la función aislada).
   Do instead (si se toca de nuevo): correr la misma simulación de rol antes de dar por buena cualquier política/trigger nuevo — no alcanza con leer el SQL.

5. **[2026-09-01] `audit_log` tiene el mismo hueco de organización que `error_reports` (Fase 7) — mismo mitigante.**
   `audit_log_select_super_admin` es solo `is_super_admin()`, sin `organization_id`. `getAuditLog()` filtra en la app. Ver el ítem de Fase 7/Supabase-RLS arriba — es el mismo patrón repetido, no una fuga nueva.

---

## Demo genérica — sin marca real (2026-09-01)

Por indicación del usuario, el repo y los datos de demo NO deben identificar a
ninguna empresa real.

- **Nombre de producto**: `organizations.platform_name = 'Atrio'` (ya usado en
  los mockups de `design/*.dc.html` — solo faltaba escribirlo en la fila real).
  `organizations.name = 'Mi Empresa'` (genérico, sin cambios). `accent_color`
  y `allowed_email_domain` ya eran genéricos/`null`.
- **Logo**: no se sube ningún archivo. El fallback ya existente (cuadro con
  borde + primera letra de `platform_name`, en `login/page.tsx`,
  `app-header.tsx`) hace de "logo genérico" con cero assets nuevos — no
  inventar un logo de imagen, ese fallback YA es el logo.
- Se borraron `public/logo-blanca.png`/`logo-negro.png` — eran el logo real de
  un cliente (Ferco Cerámica), commiteados sin uso en el código (`grep` no
  encontró ningún import). **Siguen en el historial de git** de commits
  anteriores a esta limpieza — borrar eso de verdad requiere reescribir
  historia (`git filter-repo`/BFG + force-push), una operación destructiva que
  no se hizo sin pedirla explícita.
- Se cambió `es-GT`/"Guatemala"/"Centroamérica" por `es`/genérico en 4 sitios
  de formateo de fecha y 2 comentarios (`today-label.tsx`, `greeting.tsx`,
  `application-timeline.tsx`, `note-list.tsx`, `configuracion/errores/page.tsx`)
  — no había ninguna dependencia real de esa configuración regional, solo texto
  de ejemplo/locale hardcodeado.
- `docs/database.md`/napkin mencionan `V1-motoslam` como nombre del proyecto de
  Supabase — es un codename interno de OTRO proyecto reutilizado, no tiene
  relación con ninguna empresa real; no hace falta cambiarlo.
- El repositorio de GitHub ya se renombró a `demo-ats` (antes `Ferco-compen`) —
  hecho fuera de esta sesión, confirmado al hacer push.
- No tocado sin permiso explícito: `context-ats-reclutamiento.md` (fuera de
  este repo, en el directorio padre, describe un sistema legado distinto).

---

## Reglas de Curación
- Re-priorizar en cada lectura. Máximo 10 ítems por categoría.
- Es bitácora de registro: no solo trampas de sintaxis, también decisiones no obvias y errores reales con su corrección. Incluir fecha + "Do instead".
- **Leer ANTES de tocar código.**

---

## Límite del entorno de desarrollo remoto (no es un bug)

1. **[2026-08-31] `npm run dev` en este sandbox NO puede llamar a `*.supabase.co` directo — solo el MCP de Supabase tiene canal permitido.**
   Síntoma: cualquier página que dependa de datos de Supabase (branding, sesión) los recibe como `null` al probar con curl/Playwright contra el dev server local, aunque el código y la política RLS estén correctos (verificado por separado con SQL directo vía MCP). El error real es `"Host not in allowlist: <ref>.supabase.co"`.
   Do instead: verificar la lógica por inspección + typecheck/build + SQL directo contra la base (vía MCP), no por curl/Playwright al dev server para nada que dependa de red hacia Supabase. En producción (Vercel) esto no aplica — tiene salida a internet real. No perder tiempo intentando arreglarlo como si fuera un bug de la app.

2. **[2026-09-01] Puede haber DOS conectores MCP de Supabase a la vez, uno de ellos apuntando a un proyecto que NO es este.**
   Síntoma real: el conector `mcp__supabase__*` (sin `project_id` como parámetro, pinneado a un solo proyecto) resolvió a `cihcimdzwlmhedpprmhf` — un proyecto legado ajeno (nombres de política en español, `is_administrador()`) — mientras el proyecto real de este repo es `cgudnnlcwcotovcslgzu` ("V1-motoslam", ver `docs/database.md`). El conector correcto para este repo es el que SÍ acepta `project_id` en cada tool (`list_projects`/`execute_sql`/`apply_migration` con ese parámetro) — permite elegir el proyecto explícito por `list_projects()` en vez de confiar en cuál quedó pineado por la cuenta.
   Do instead: antes de la PRIMERA query o migración de una sesión nueva, correr `get_project_url()` (o `list_projects()` + comparar el `ref`) y confirmarlo contra `cgudnnlcwcotovcslgzu` — nunca asumir que "el MCP de supabase" conectado es el de este repo solo porque el nombre de la tool coincide.

3. **[2026-09-01] `apply_migration` (DDL) contra este proyecto es bloqueado por el clasificador de auto-modo, incluso para un cambio aditivo y trivial (`ALTER TYPE ... ADD VALUE`).**
   Do instead: no asumir que cualquier feature nueva necesita su propia migración — reutilizar un enum/columna ya existente si el caso de uso lo permite (ver Fase 7 abajo). Si de verdad hace falta DDL, ese paso queda pendiente de aprobación explícita del usuario en el chat, no se reintenta con otra forma de saltarlo.

4. **[2026-09-01] Este worktree no trae su propio `node_modules` — un git worktree nuevo necesita `npm install` propio antes de poder correr `next build`.**
   Síntoma engañoso: `npm run typecheck`/`npm run lint` corren bien SIN `node_modules` local porque Node resuelve `tsc`/`eslint` subiendo a un `node_modules` ancestro (otro worktree/repo principal) — pero `next build` (Turbopack) restringe la resolución de paquetes a la raíz del workspace detectado y falla con "Could not find the Next.js package" aunque el resto compile.
   Do instead: si typecheck/lint pasan "sospechosamente rápido" en un worktree recién creado, no dar por bueno el build sin correrlo — `npm install` primero si no hay `node_modules` local.

---

## ✅ Pasos manuales fuera de este entorno — ya resueltos (2026-09-02)

Ambos confirmados por captura del Dashboard de Supabase: "Customize Access Token (JWT) Claims hook" en **ENABLED** con `public.custom_access_token_hook`, y el proveedor **Google** en **Enabled** bajo Authentication → Sign In / Providers. El login ya funciona de punta a punta. Ver `docs/PENDIENTE.md` para lo que sigue pendiente de verdad (dominio corporativo, Fase 19).

---

## Supabase / RLS — decisiones y errores reales (MÁXIMA PRIORIDAD)

1. **[2026-08-31] Proyecto reutilizado: `V1-motoslam` (ref `cgudnnlcwcotovcslgzu`), no uno nuevo.**
   Do instead: era un sistema de vacaciones "PCG" sin uso, confirmado por el usuario y borrado por completo (tablas, tipos, función `rol_actual()`, políticas de storage) antes de crear el esquema del ATS. Queda un bucket `archivos` con 1 objeto huérfano que no se pudo borrar por SQL (`Direct deletion from storage tables is not allowed`) — pendiente de borrado manual por el usuario, no interfiere con el ATS.

2. **[2026-08-31] BUG REAL: recursión infinita (42P17) entre las políticas de `candidates` y `applications`.**
   Causa: `candidates_select` hacía `EXISTS` sobre `applications`, y `applications_select` hacía `EXISTS` sobre `candidates` — cada tabla dispara la política RLS de la otra en un ciclo.
   Do instead: cuando dos tablas se referencian mutuamente dentro de sus políticas, envolver una de las dos consultas en una función `SECURITY DEFINER` en `private` (aquí: `candidate_has_accessible_application`, `candidate_referred_by_me`). Al ser las tablas propiedad de `postgres` sin `FORCE ROW LEVEL SECURITY`, la función ejecuta como su dueño y no re-dispara RLS. Se encontró simulando JWTs reales por rol, no leyendo el SQL — **toda política nueva se prueba así antes de darla por buena**.

3. **[2026-08-31] Rol y organización viajan en el JWT vía custom access token hook — requiere un paso manual fuera del MCP.**
   Do instead: la función `public.custom_access_token_hook` ya existe en la base, pero Supabase Auth no la invoca hasta que alguien la selecciona en Dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims hook". Sin ese clic, `private.auth_role()`/`auth_org_id()` devuelven `null` para todos y **todas las políticas RLS deniegan todo**. Verificar esto primero si algo "no debería estar vacío pero lo está" en la Fase 3.

4. **[2026-08-31] `private.*()` sin argumentos siempre envueltas en `(select ...)` dentro de USING/WITH CHECK.**
   Do instead: `(select private.auth_org_id())`, `(select auth.uid())`, etc. — si no, Postgres las re-evalúa fila por fila (advisor `auth_rls_initplan`). Las que sí toman una columna de la fila como argumento (`can_access_job(id)`) se dejan tal cual, no hay nada que precalcular.

5. **[2026-08-31] Storage: DELETE directo sobre `storage.objects`/`storage.buckets` está bloqueado por Postgres (`storage.protect_delete()`).**
   Do instead: para borrar buckets u objetos hace falta la Storage API con `service_role_key`, no SQL. INSERT sí funciona directo (así se crearon `marca-publico` y `cvs-privado`).

6. **[2026-08-31] Extensión `pg_net` no soporta `ALTER EXTENSION ... SET SCHEMA`.**
   Do instead: si el advisor de seguridad marca "Extension in Public" para `pg_net`, no intentar moverla — falla con `0A000`. Dejarla y documentar como aceptada si no la instalamos nosotros.

7. **[2026-08-31] `profiles` necesita una política de "ver mi propia fila" independiente del JWT hook.**
   Do instead: `profiles_select_own using (id = (select auth.uid()))`, separada de `profiles_select_org` (que depende de `auth_org_id()`). Si no existe, nadie puede leer ni su propio perfil mientras el hook del paso manual #1 no esté activado — se rompe el callback de login completo.

8. **[2026-08-31] "No dejar la organización sin super admin" necesita defensa en dos capas, no una.**
   Causa: un chequeo optimista en el Server Action (`wouldRemoveLastSuperAdmin`, lee el conteo antes del UPDATE) tiene una carrera real entre dos requests concurrentes que pasan el conteo antes de que cualquiera confirme.
   Do instead: la capa que de verdad protege es un trigger `BEFORE UPDATE` en `profiles` (`private.guard_last_super_admin`) con `pg_advisory_xact_lock(hashtext(organization_id::text))` antes de contar — serializa las transacciones concurrentes sobre la misma organización. El chequeo en el Server Action solo existe para dar un mensaje de error específico en el caso normal (no concurrente); si el trigger es quien bloquea, el usuario ve el mensaje genérico "No se pudo actualizar" — aceptable, la integridad de datos no depende del mensaje.

9. **[2026-08-31] BUG REAL: un login rechazado (perfil faltante o dominio no permitido) deja un `auth.users` huérfano que bloquea reintentos para siempre.**
   Causa: `handle_new_user` es un trigger `AFTER INSERT` en `auth.users` — solo se dispara una vez, al crear la cuenta. Si el callback rechaza esa sesión sin borrar la cuenta, un reintento de login reutiliza la misma fila de `auth.users` (no hay INSERT nuevo) y el trigger nunca vuelve a correr.
   Do instead: en **todo** camino de rechazo post-login (perfil faltante, dominio no permitido, inactivo no cuenta porque ahí sí hay perfil válido) llamar `createAdminClient().auth.admin.deleteUser(user.id)` antes de redirigir a la página de error — no solo en el caso que se te ocurrió primero. Se encontró porque un review notó que solo la rama de dominio-rechazado borraba la cuenta.

10. **[2026-09-09] Una función que el CÓDIGO llama con `admin.rpc(...)` tiene que vivir en `public`, nunca en `private` — aunque sea `SECURITY DEFINER` y el resto de `private.*` sea la convención del proyecto.**
    Causa: PostgREST solo expone RPC del esquema `public` (por eso todo `private.*` existente —`auth_org_id()`, `can_access_job()`, etc.— se usa SOLO dentro de políticas RLS/SQL, nunca desde `admin.rpc()`). Se creó `private.check_rate_limit` para el rate limit compartido en Postgres, pasó el `execute_sql` de prueba, y habría fallado en runtime real con "function not found" apenas la app la llamara vía REST — la diferencia entre "funciona en SQL directo" y "lo puede llamar la app" no se ve hasta probarlo por el canal real.
    Do instead: cualquier función pensada para `admin.rpc()`/`supabase.rpc()` va en `public`, y si no debe ser invocable por `anon`/`authenticated` (como este rate limit, donde dejar que cualquiera mande su propio `p_max` anula el límite), se cierra con `revoke all ... from public/anon/authenticated` + `grant execute ... to service_role` explícito — no confiar en que "vive en un esquema con nombre serio" alcanza como control de acceso. Verificado con `has_function_privilege('anon', ..., 'execute')` = false antes de dar el fix por bueno. (Reemplaza la lección de `error_reports_select`, ya resuelto en la política real: `organization_id = auth_org_id()` agregado.)

---

## Vacantes y postulación (Fase 4)

1. **[2026-08-31] BUG REAL, crítico: la ruta de Storage del CV no coincidía con lo que la política RLS de `storage.objects` espera — encontrado al empezar Fase 5, no en Fase 4.**
   Causa: `cvs_privado_select`/`cvs_privado_delete` (creadas en Fase 2) exigen que el **segundo** segmento de la ruta sea el `candidate_id` (`private.can_access_candidate((storage.foldername(name))[2]::uuid)`). El Route Handler de Fase 4 subía el CV a `{organization_id}/{email}/{timestamp}.pdf` — el segundo segmento era un correo, no un UUID. Cualquier intento real de leer o firmar esa URL habría fallado (el cast `::uuid` de un email lanza una excepción de Postgres), dejando el control de acceso a CVs completamente roto desde el primer commit de Fase 4, sin que nada en el flujo de postulación lo hiciera evidente (subir y crear seguían funcionando).
   Do instead: **antes de subir cualquier archivo a un bucket privado, leer la política RLS de `storage.objects` para ese bucket y confirmar el formato de ruta exacto que espera** (`storage.foldername(name)` da un array; su índice depende de qué escribió la política, no de lo que parezca lógico). Aquí significó resolver/crear el candidato ANTES de subir el CV (no después), para poder construir la ruta con su id real — ver `findOrCreateCandidate`/`createApplicationForCandidate` en `src/lib/jobs/create-application.ts`.

2. **[2026-08-31] BUG REAL, crítico: usar el cliente de sesión para leer tablas admin-only rompe el flujo principal del producto.**
   Causa: `materializeJobStages()` (copia la plantilla de pipeline al crear una vacante) usaba el cliente de sesión del actor. `pipeline_templates` y `job_stages` solo tienen políticas de escritura/lectura para `admin+` (`pipeline_templates_admin`, `job_stages_write_admin`) — un `gestor` puede crear su propia vacante (RLS de `jobs_insert` sí lo permite), pero su `SELECT` a `pipeline_templates` siempre vuelve vacío. Resultado: **todo gestor que solicitaba una vacante recibía "No hay una plantilla de pipeline configurada"**, aunque sí existiera — el caso de uso principal del producto ("gestor solicita plazas") estaba roto en Fase 4 desde el primer commit.
   Do instead: cualquier operación que necesite una verdad de la organización que no dependa de lo que el actor de turno puede ver por RLS (copiar una plantilla, deduplicar un candidato por correo) usa `createAdminClient()` internamente, sin importar qué cliente pasó el llamador — nunca asumir que "ya está autenticado" es suficiente para leer una tabla que RLS reserva a otro rol. Antes de dar una función por buena, simular con el rol de menor privilegio que la va a usar de verdad (aquí: `gestor`, no `admin`).

3. **[2026-08-31] Deduplicar por email con `.ilike()` es un bug, no una mejora — `%` y `_` son comodines de SQL.**
   Do instead: usar siempre `.eq("email", email)` (con el email ya en minúsculas) para un lookup de igualdad exacta. `ilike` solo tiene sentido para búsquedas de texto libre, nunca para una clave de deduplicación — un correo con `_` (frecuentísimo en direcciones corporativas) puede matchear una fila completamente distinta.

4. **[2026-08-31] Un `.update(objeto)` de Supabase nunca puede *borrar* un campo si ese campo llega como `undefined`.**
   Causa: `JSON.stringify` omite las claves `undefined` antes de mandar el PATCH — Supabase nunca se entera de que existían. Con los preprocesadores de Zod que convierten `""` a `undefined` (patrón ya usado en Fase 2/3), un formulario de edición que "vacía" un campo opcional en realidad deja el valor viejo intacto en la base, con un toast de éxito engañoso.
   Do instead: normalizar explícitamente los campos opcionales a `null` (nunca dejarlos en `undefined`) justo antes de armar el objeto que se pasa a `.update()`/`.insert()`.

5. **[2026-08-31] Toda transición de estado compartido (aprobar/cancelar/publicar) necesita compare-and-swap, no solo "leer, validar, escribir".**
   Causa: dos clics casi simultáneos (dos pestañas, o un doble clic entre dos botones distintos que comparten el mismo `useTransition`) pueden ejecutar dos `UPDATE` sobre la misma fila después de que ambos leyeron el mismo estado "viejo" — el segundo pisa al primero en silencio, cada uno con su propio toast de éxito.
   Do instead: agregar `.eq("status", estadoQueSeLeyó)` al `UPDATE` (no solo `.eq("id", ...)`). Si la fila ya cambió, el `UPDATE` afecta 0 filas y el código ya trata eso como error — mismo patrón (más liviano) que el advisory lock de Fase 3 para el caso del último super admin.

6. **[2026-08-31] Un `UNIQUE` a nivel de aplicación (check-then-insert) siempre tiene una ventana de carrera — maneja el código `23505`, no solo el camino feliz.**
   Do instead: si el `INSERT` falla con `error.code === "23505"` justo después de que el `SELECT` de deduplicación no encontró nada, es casi seguro una carrera (doble clic, dos requests casi simultáneas) — volver a hacer el `SELECT` y usar esa fila en vez de fallar con un mensaje genérico. Aplica a cualquier dedup por email/slug construido como "buscar, si no existe crear".

7. **[2026-08-31] `published_at` solo se marca la primera vez que se publica, nunca en cada transición hacia "abierta".**
   Do instead: `if (!current.published_at)`, no `if (current.status !== "abierta")` — lo segundo reinicia la fecha cada vez que se reabre tras una pausa, y el portal público (ordenado por `published_at`) muestra una vacante de semanas como si fuera nueva.

8. **[2026-08-31] Todo validador de Zod en un formulario en español necesita su propio `{ error: "..." }` — incluso los que "seguro nunca van a fallar".**
   Causa: `.int()` sin mensaje propio, cuando `.positive()` sí lo tiene, deja pasar el texto default de Zod en inglés apenas alguien manda un valor no entero (posible con una llamada directa al endpoint, sin pasar por el `<input type="number">` del navegador).
   Do instead: revisar cada eslabón de una cadena Zod (`.int()`, `.min()`, `.max()`, `.positive()`, no solo el último), sobre todo en preprocesadores compartidos por varios campos (`optionalNumber` en `schema.ts`).

---

## Centro de errores (Fase 7)

1. **[2026-09-01] Ya existía infraestructura de bitácora genérica antes de Fase 7 — buscarla antes de inventar una nueva.**
   `private.audit_row_change(org_id, action, entity_type, entity_id, diff jsonb)` (SECURITY DEFINER) ya estaba escrita y ya hay un trigger real usándola (`audit_error_report_status` en `error_reports`, dispara en cada cambio de `status`). Fase 8 (bitácora) probablemente es solo la pantalla de lectura sobre `audit_log`, no construir el mecanismo de escritura desde cero.
   Do instead: antes de agregar logging/auditoría nueva a cualquier tabla, `select proname from pg_proc where prosrc ilike '%audit_log%'` primero.

2. **[2026-09-01] Contexto auto-capturado del navegador (mensaje de excepción, URL, user agent) se trunca ANTES de pasar por Zod, nunca después.**
   Causa: el límite de `ReportErrorSchema` está pensado para lo que escribe una persona (2000 caracteres es generoso para texto humano, corto para un `error.message` con causas anidadas o un stack serializado). Si se valida primero, el reporte del error real que se quiere reportar es exactamente el que falla el schema.
   Do instead: `truncate()` en `src/lib/errors/actions.ts` antes del `safeParse` — cualquier campo que venga de `window`/`navigator`/una excepción real, no de un `<input>` del usuario, se recorta antes de validar.

3. **[2026-09-01] Decisión consciente: un solo valor de enum `notification_type` (`respuesta_reporte_error`) cubre 3 direcciones distintas (reporte nuevo, respuesta de soporte, respuesta del reportante).**
   Motivo: agregar un segundo valor de enum es DDL, y el clasificador de auto-modo bloqueó incluso un `ALTER TYPE ... ADD VALUE` aditivo (ver categoría de arriba). Costo real: la preferencia de notificación es todo-o-nada para las 3 direcciones — un super admin no puede separar "avísame de reportes nuevos" de "avísame de respuestas en hilos que ya sigo".
   Do instead (si se aprueba una migración más adelante): dividir en 2-3 valores de enum reales y migrar `PREFERENCE_TYPES`/`NOTIFICATION_TYPE_LABEL` — no urgente mientras la organización tenga pocos super admin.

4. **[2026-09-01] Fase 7 no manda correo — solo notificación in-app.** Los `notify()` de `src/lib/errors/actions.ts` no pasan el campo `email`, a propósito: escribir las plantillas de React Email para "nuevo reporte"/"te respondieron" queda pendiente. El toggle de correo en Mis Preferencias para este tipo no hace nada todavía — no es un bug, pero si un review lo marca, la respuesta es "diseño, no falta terminar el campo".
   Do instead: si se pide correo real para esto, seguir el patrón de Fase 6 (`emails/`, `getEmailContext()`), no inventar uno nuevo.

---

## Notificaciones in-app y correo (Fase 6)

1. **[2026-09-01] BUG REAL, rompe el build: instanciar el SDK de un servicio externo a nivel de módulo revienta CUALQUIER página que lo importe, aunque sea indirecto.**
   Causa: `new Resend(process.env.RESEND_API_KEY)` a nivel de módulo en `send-email.ts` — si la key llega vacía (entorno sin Resend configurado todavía), el constructor lanza de inmediato. Como `notify.ts` importa `send-email.ts` y varias Server Actions (`jobs/actions.ts`, `applications/actions.ts`) importan `notify.ts`, **cualquier página que renderice esas Server Actions** (ni siquiera hace falta llamarlas) falla en `next build` con "Missing API key" al recolectar datos de la página.
   Do instead: nunca instanciar el cliente de un servicio externo (Resend, Stripe, etc.) a nivel de módulo si la app puede desplegarse sin esa key configurada — envolver la construcción en una función y crearlo perezosamente (memoizado con `??=`, no uno nuevo por llamada) solo cuando de verdad se va a usar. Se encontró al correr `npm run build` después de cablear los primeros disparadores reales de Fase 6, no en el commit que creó `send-email.ts` — probar el build completo, no solo `typecheck`, apenas un archivo nuevo entra en el grafo de imports de una página.

2. **`notifications` NO tiene política de INSERT para `authenticated` — a propósito, no es un descuido.**
   Do instead: `notify()` SIEMPRE usa `createAdminClient()`, nunca el cliente de sesión del actor que disparó el evento — casi nunca se notifica a uno mismo, y hay que leer la preferencia del DESTINATARIO, no la del actor.

3. **Un fallo al notificar/enviar correo nunca debe convertir una mutación ya exitosa en un error de cara al usuario — usar `after()` de Next, no solo un `try/catch` inline.**
   Causa real encontrada en `/code-review`: los primeros cuatro sitios que dispararon `notify()`/`sendEmail()` lo hacían con `await` normal justo antes del `return`/`NextResponse.json` — si `notify()` lanzaba (red, un render de React Email que falla), la Server Action/Route Handler entera fallaba pese a que el job/postulación/etapa ya había quedado guardado en la base.
   Do instead: envolver todo trabajo de notificación best-effort en un helper (`notifyBestEffort()` en `notify.ts`) que use `after()` (`next/server`, estable desde Next 15.1) para correr DESPUÉS de responder, con su propio `try/catch` + `console.error` (no silencioso del todo — hasta que exista Centro de errores en Fase 7). `after()` sí puede leer `headers()`/`cookies()` dentro de Server Actions y Route Handlers (no en Server Components).

4. **Habilitar Realtime en una tabla nueva requiere agregarla explícito a la publicación — no es automático.**
   Do instead: `alter publication supabase_realtime add table notifications;` (migración aparte). Sin esto, `.channel(...).on("postgres_changes", ...)` se suscribe sin error pero nunca recibe nada — no hay mensaje de fallo visible, solo silencio.

5. **Un listener de Realtime en UPDATE debe ser idempotente usando solo `payload.new` — `payload.old` no trae columnas completas salvo `REPLICA IDENTITY FULL`.**
   Do instead: si el propio código ya filtra las escrituras que disparan el evento (aquí: `markAsRead`/`markAllAsRead` solo tocan filas con `read_at is null`), cada UPDATE recibido ya implica una transición real — no hace falta diffear contra el valor viejo. Cuidado con doble-contar: si el mismo cliente ya actualizó su estado local de forma optimista (clic propio), el eco de Realtime que vuelve debe detectar que ya estaba contado (comparar contra el estado local) y no restar dos veces.

6. **Toda tabla con `organization_id` necesita que la política RLS lo valide contra el JWT, no solo el resto de columnas — aunque esas otras columnas ya sean suficientes para bloquear acceso cruzado.**
   Causa: `notification_preferences` se creó con `organization_id` pero la policy solo comprobaba `profile_id = auth.uid()` — sin exposición real (un `profile_id` ya pertenece a un solo org), pero viola la letra de la regla de AGENTS.md y deja una columna que un cliente arbitrario podría poblar con cualquier UUID.
   Do instead: `using (profile_id = (select auth.uid()) and organization_id = private.auth_org_id())`, igual en `with check` — mismo patrón que cualquier otra tabla org-scoped, sin excepción "porque total ya está protegida por otro lado".

7. **Gotcha ya documentado (Fase 3), reapareció igual: objeto con clave computada rompe el excess-property check de `.upsert()` tipado.**
   Do instead: `const channelUpdate: Partial<Record<"in_app" | "email", boolean>> = { [canal]: enabled }`, spread aparte — ver `preferences-actions.ts`. Sigue siendo la trampa más recurrente del proyecto con Supabase tipado.

8. **`mencion_nota` y `respuesta_reporte_error` existen en el enum `notification_type` pero no se disparan todavía.**
   Do instead: no armar un selector de preferencias para un tipo que nunca ocurre — `PREFERENCE_TYPES` los excluye a propósito. `mencion_nota` depende de un selector de @mención en `NoteForm` (no construido en Fase 5); `respuesta_reporte_error` es de Fase 7.

9. **[2026-09-09] Sigue pendiente — confirmado como H2/M7 en `CLAUDE-SECURITY-20260902-095525/REPORT.md`: `getSiteUrl()` cae al header `Host` del request si falta `NEXT_PUBLIC_SITE_URL`, y Fase 6 empezó a usarlo desde `/api/postular` (ruta pública, sin sesión) para armar el link de "Ver la postulación" en el correo que le llega a RH.**
   Riesgo: si en producción se olvida configurar `NEXT_PUBLIC_SITE_URL`, un solicitante malicioso podría mandar un `Host` falso y que el correo interno de "nueva postulación" incluya un link de phishing. `getSiteUrl()` documenta que su único uso sensible conocido era `signInWithGoogle()` (protegido por la lista de Redirect URLs de Supabase) — ya no es cierto, revisar ese comentario al tocar esto.
   Do instead: verificar que `NEXT_PUBLIC_SITE_URL` esté seteado en Vercel antes de desplegar, y considerar que `getSiteUrl()` rechace el fallback a `Host` para cualquier link que salga en un correo (no solo para el OAuth redirect). Decisión explícita del usuario 2026-09-09: queda documentado, no corregido — H1, M1, M3, M4 del mismo reporte sí se corrigieron ese día (ver sección de arriba), M2/M5 ya estaban corregidos desde el 2026-09-08 (`b8ee7da`/`895622c`).

---

## Pipeline y candidatos (Fase 5)

1. **[2026-08-31] BUG REAL: usar `!` sobre un join embebido de Supabase asume que RLS siempre lo deja pasar — a veces no.**
   Causa: `applications_select` deja ver una postulación a un colaborador que refirió al candidato (`candidate_referred_by_me`), sin exigir nada sobre el estado de la vacante. Pero `jobs_select`/`job_stages_select` sí exigen que la vacante siga pública+abierta o que el actor tenga acceso interno. Si la vacante se pausa o cierra después, ese mismo colaborador sigue viendo la postulación pero el `jobs(title)`/`job_stages(name)` embebido en el mismo `select()` vuelve `null` — `app.jobs!.title` truena con un `TypeError` en producción, justo el "stack crudo frente al usuario" que AGENTS.md prohíbe.
   Do instead: cuando dos tablas relacionadas en un mismo `.select()` tienen políticas RLS **distintas** (una más permisiva que la otra), el campo embebido de la tabla más restrictiva es opcional de verdad — tipar como `T | null`, usar `?.` y mostrar un texto de reemplazo ("Vacante no disponible"), nunca `!`. Antes de asumir que un join embebido siempre viene, comparar las políticas RLS de ambas tablas, no solo la de la tabla principal del `select()`.

2. **[2026-08-31] BUG REAL (forma de IDOR): un id que es clave primaria global (no particionada por padre) no prueba que la fila pertenezca al padre correcto.**
   Causa: `moveApplicationStage(applicationId, fromStageId, toStageId)` actualizaba `applications.stage_id` sin verificar que `fromStageId`/`toStageId` fueran etapas de la MISMA vacante que la postulación — `job_stages.id` es un UUID global, cualquier etapa de cualquier vacante de la organización es "válida" para el `UPDATE` mientras no se compare contra `job_id`. Una Server Action es un endpoint invocable por red, no solo lo que la UI de arrastre manda.
   Do instead: cuando un id de un recurso "hijo" (etapa, columna, ítem de catálogo) llega desde el cliente para actualizar un recurso "padre" (postulación, vacante), verificar explícitamente `SELECT ... WHERE id IN (...) AND parent_id = ?` antes del `UPDATE` — el tipo de la columna (UUID) no garantiza pertenencia al padre correcto, eso es una regla de negocio que hay que comprobar aparte.

3. **[2026-08-31] PostgREST convierte `*` en `%` para `ilike`/`like` ANTES de que Postgres vea el patrón — no se puede escapar con `\`.**
   Causa: es un alias documentado (evita tener que codificar `%` en la URL), pero significa que un término de búsqueda con un `*` literal se vuelve un comodín real sin que el backslash-escape de siempre (`\%`, `\_`, `\\`) lo evite — el alias ocurre en una capa anterior a donde el escape de SQL aplicaría.
   Do instead: para búsquedas de texto libre construidas con `.or("campo.ilike.%...%")`, quitar `*` del término del usuario (no intentar escaparlo) además de escapar `%`/`_`/`\` de la forma normal, y de quitar `,`/`(`/`)` (sintaxis de filtros de PostgREST). Tres capas de caracteres especiales distintas en una sola búsqueda — fácil olvidar una.

4. **[2026-08-31] El compare-and-swap de Fase 4 (`.eq("status", estadoViejo")`) se reusa tal cual para el drag-and-drop del kanban.**
   Do instead: `moveApplicationStage` agrega `.eq("stage_id", fromStageId)` al `UPDATE`, igual que las transiciones de vacante — dos arrastres simultáneos sobre la misma tarjeta (dos pestañas, o un evento de red que tarda) no se pisan en silencio, el segundo simplemente no afecta filas y se reporta como conflicto.

---

## Auth con Supabase + Next.js 16 (Fase 3)

1. **[2026-08-31] Tres clientes de Supabase, cada uno para su contexto — nunca mezclar.**
   Do instead: `src/lib/supabase/client.ts` (browser, `createBrowserClient`) para client components; `src/lib/supabase/server.ts` (`createServerClient` + `next/headers` cookies) para Server Components/Actions — respeta RLS; `src/lib/supabase/admin.ts` (service role) solo para el portal público y tareas de servidor sin sesión de usuario — nunca importarlo desde un client component.

2. **`proxy.ts` es un chequeo optimista; la autorización real vive en `src/lib/auth/dal.ts`.**
   Do instead: `getProfile()` memoizado con `cache()` de React + `import "server-only"`, y `requireProfile()`/`requireAdminOrAbove()`/`requireSuperAdmin()` que redirigen a `/login` o a `/auth/auth-error?motivo=sin_permiso` — nunca un 403 crudo. El proxy solo redirige rápido leyendo la cookie, sin tocar la base.

3. **`Server Action` con dos parámetros (`updateUserRole(userId, role)`) no sirve para `useActionState`.**
   Do instead: si el formulario necesita `useActionState`, la action recibe `(prevState, formData)` y el campo variable va como input oculto en el propio `formData` (así se hizo con `uploadBrandImage`). Para acciones disparadas por `onClick`/`onChange` fuera de un `<form>`, usar `useTransition` + una función normal (así se hizo con `updateUserRole`/`toggleUserActive`).

4. **`.update({ [campoVariable]: valor })` con Supabase tipado rompe TypeScript (excess property check).**
   Do instead: tipar el objeto explícito antes, `const update: Partial<Record<Campo, Tipo>> = { [campo]: valor }`, y pasar `update` al `.update()`.

5. **[2026-08-31] `react-hooks/set-state-in-effect` es un ERROR duro en este proyecto (rompe el build), no un warning — y no siempre se resuelve igual.**
   Do instead: si el estado que quieres resetear viene de una prop que cambió (ej. el formulario de marca cuando otra pestaña guarda), usa `key={prop}` en el padre para forzar un remount — el patrón oficial de React, sin `useEffect`. Si el estado es un valor genuinamente solo-de-cliente sin prop de la que depender (ej. `new Date()` para el saludo o la fecha de `/inicio` — el reloj del servidor en Vercel es UTC, no el de Centroamérica), no hay prop que "keyear": ahí sí toca `useEffect` + `// eslint-disable-next-line react-hooks/set-state-in-effect` con un comentario que justifique por qué. **Bug real encontrado con el primer patrón**: el `key` del formulario de marca solo incluía `accent_color`, así que un cambio de solo `platform_name` no remontaba el formulario y una pestaña vieja podía pisar el nombre nuevo al guardar — el `key` debe incluir TODAS las props de las que depende el estado interno, no solo la que se probó primero.

---

## Vercel — límites de la plataforma y estado del repo (MÁXIMA PRIORIDAD)

1. **[2026-09-09] `main` local puede estar viendo un repo distinto al que Vercel despliega — verificar ANTES de auditar o arreglar código, no asumir por el nombre del branch.**
   Causa: una auditoría completa se hizo leyendo `main` local, que estaba 23 commits atrás de `origin/main` (nunca se hizo `git fetch`). El deploy de producción activo (`list_deployments`, `target: "production"`) correspondía al último commit de un branch con nombre de sesión (`claude/context-ats-reclutamiento-review-a2c621`) que en GitHub YA era `origin/main` — la desactualización era solo del checkout local. Si no se hubiera cruzado el `githubCommitMessage` del deployment más reciente contra `git log`, varios hallazgos (falta de checkbox de consentimiento, error sin diagnóstico) se habrían reportado y "arreglado" sobre código que producción ya no tenía, mientras el bug real que SÍ seguía vivo (`/api/postular` con una key rota) no se habría tocado.
   Do instead: antes de auditar o tocar código pensando en "lo que está en producción", correr `git fetch` y comparar `list_deployments`/`get_git_deployment_context` (Vercel MCP) contra `git log --oneline` — el mensaje de commit del deployment activo identifica el commit exacto, y `git merge-base`/`git log branchA..branchB` confirma si es el mismo repo o uno divergente.

2. **[2026-09-09] `export const revalidate` en una página no sirve de nada si el nonce de CSP por request (`src/proxy.ts`) sigue aplicando sobre esa ruta — y el build NO avisa, solo sigue marcando la ruta `ƒ (Dynamic)`.**
   Se intentó cachear `/empleos` y `/empleos/[slug]` (portal público, solo lectura) cambiando a un cliente de Supabase sin cookies + `revalidate = 60`. El build siguió mostrando ambas como dinámicas — la causa no era el cliente de datos sino que el nonce de CSP (decisión ya tomada en Fase 19, ver arriba en Next.js 16) exige renderizado 100% dinámico en TODO el sitio vía el matcher del proxy, sin excepción por ruta.
   Do instead: después de agregar `revalidate` a cualquier página, confirmar en la salida de `next build` (columna de símbolos, leyenda al final) que de verdad cambió de `ƒ` a estático/ISR — no asumir que compiló bien porque compiló. Si el proyecto ya tiene un nonce de CSP por request cubriendo esa ruta, `revalidate` es ruido: hay que sacar la ruta del alcance del nonce (compromiso de seguridad real) o aceptar que esa página no cachea.

3. **[2026-09-09] Vercel Functions rechaza cualquier body de más de 4.5 MB a nivel de plataforma — fijo, no configurable, no cambia con Fluid Compute.**
   No es lo mismo que `experimental.serverActions.bodySizeLimit` de Next.js (ese es solo para Server Actions, no para Route Handlers como `/api/postular`). Un límite de archivo más generoso en el código (ej. "CV hasta 10 MB") nunca se alcanza a evaluar si el conjunto del multipart pasa los 4.5 MB — Vercel corta antes con un 413 crudo, que además no es JSON (un `res.json()` sin manejo de error en el cliente lo traduce como "se perdió la conexión").
   Do instead: cualquier techo de subida en un Route Handler público tiene que quedar cómodamente por debajo de 4.5 MB, contando TODOS los archivos del mismo envío combinados, no cada uno por separado. Para archivos de verdad pesados, subir directo del navegador a Storage con URL firmada (patrón ya usado por la subida de video de marca) — el archivo nunca pasa por el cuerpo de la función.

---

## Next.js 16 — Cambios de ruptura (MÁXIMA PRIORIDAD)

1. **[2026-08-31] `middleware.ts` NO EXISTE. Ahora se llama `proxy.ts`.**
   Do instead: archivo `proxy.ts` en la raíz del proyecto o dentro de `src/`, al mismo nivel que `app/`. Exporta `export function proxy(request: NextRequest)` o un default export. `export const config = { matcher: [...] }` sigue igual. **Toda la documentación de `@supabase/ssr` en internet dice `middleware.ts` — está desactualizada para Next 16.** Verificado en `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

2. **[2026-08-31] Proxy corre en runtime de Node.js, no en Edge.**
   Do instead: se puede usar el SDK completo de Supabase dentro de `proxy.ts` sin preocuparse por compatibilidad con Edge. Solo leer la sesión de la cookie — **nunca consultar la base** desde el proxy, porque corre en cada ruta incluidas las prefetch.

3. **[2026-08-31] El proxy es un chequeo optimista, NO la capa de seguridad.**
   Do instead: la autorización real vive lo más cerca posible del dato: políticas RLS en Postgres + un Data Access Layer con `verifySession()` memoizado con `cache()` de React y `import 'server-only'` al inicio del archivo. El proxy solo redirige rápido.

3b. **[2026-08-31] `import "server-only"` no funciona si el paquete `server-only` no está instalado — Next NO lo trae solo.**
   Do instead: `npm install server-only` explícitamente. El build de Turbopack puede compilar igual sin él en algunos casos (alias interno), pero no depender de eso: instalarlo es el patrón documentado por Next.

3c. **[2026-08-31] `createServerClient` de `@supabase/ssr` en `proxy.ts`: toda redirección debe copiar las cookies de la respuesta que refrescó la sesión.**
   Do instead: `setAll()` reasigna `response` a un `NextResponse.next()` nuevo con las cookies puestas; si después decides redirigir, NO uses `NextResponse.redirect(url)` a secas — copia `response.cookies.getAll()` sobre la respuesta de redirect primero, o el refresh token recién rotado se pierde y el usuario entra en un loop de logout intermitente.

3d. **[2026-08-31] CVE de alta severidad: bypass de proxy/middleware en Turbopack (GHSA-6gpp-xcg3-4w24), corregido en Next 16.3.3.**
   Do instead: mantener Next en `^16.3.3` o superior. Se detectó vía `npm audit` mientras se construía `proxy.ts` — justo el mecanismo que el CVE afecta. Revisar `npm audit` en cada fase, no solo al final.

3e. **[2026-08-31] `organizations_select_public` es `using (true)` para `anon` Y `authenticated` — no depende del JWT hook.**
   Do instead: antes de asumir que un fallo de lectura en `/login` o en el callback de auth es "por el hook no activado todavía", verificar la policy real con `pg_policies`. Un review pasado marcó como bug que el login no podría leer `organizations` sin el hook — falso positivo, verificado contra la base real: esa tabla es pública por diseño para poder mostrar marca antes de iniciar sesión.

4. **[2026-08-31] `useActionState` devuelve `pending` — es la base de `<ActionButton>`.**
   Do instead: `const [state, action, pending] = useActionState(fn, initialState)`. No inventar estado de carga a mano con `useState`. Desde un event handler hay que envolver la llamada en `startTransition`.

5. **[2026-08-31] `global-error.tsx` debe declarar sus propios `<html>` y `<body>`.**
   Do instead: reemplaza al root layout cuando se activa, así que sin esas etiquetas la página queda rota. Los `error.tsx` anidados sí heredan el layout y burbujean al más cercano.

---

## Zod v4

1. **[2026-08-31] Los mensajes de error usan `{ error: "..." }`, no `{ message: "..." }`.**
   Do instead: `z.string().min(2, { error: "Muy corto." })`. La forma `message` es de Zod 3.

2. **[2026-08-31] `z.email()` es de primer nivel, no `z.string().email()`.**
   Do instead: `z.email({ error: "Correo inválido." })`.

3. **[2026-08-31] `z.coerce.number().optional()` devuelve `unknown` en el resolver de react-hook-form.**
   Do instead: `z.preprocess((v) => v === "" || v == null ? undefined : Number(v), z.number().optional())` para todo input numérico de HTML. (Trampa heredada del proyecto anterior, sigue vigente.)

---

## Supabase — RLS y Auth

1. **[2026-08-31] Nunca consultar `profiles` dentro de una política RLS de `profiles`.**
   Do instead: recursión infinita garantizada. El rol y el `organization_id` van en el JWT mediante un custom access token hook, y las políticas leen `auth.jwt()`. Las funciones auxiliares van en el esquema `private` como `SECURITY DEFINER STABLE`.

2. **[2026-08-31] Una tabla nueva sin política RLS es un bug bloqueante.**
   Do instead: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` en la misma migración que crea la tabla, siempre, incluso en tablas de configuración. Deny-by-default.

3. **[2026-08-31] El portal público NO escribe con el rol `anon`.**
   Do instead: las postulaciones entran por un Route Handler del servidor con service role, con validación Zod y rate limit. La `SUPABASE_SERVICE_ROLE_KEY` jamás lleva prefijo `NEXT_PUBLIC_` ni se importa en un client component.

4. **[2026-08-31] CVs en bucket privado con URL firmada, nunca pública.**
   Do instead: `createSignedUrl(path, 60)`. Una URL pública de Storage es permanente y adivinable.

---

## Tailwind v4

1. **[2026-08-31] La configuración vive en `src/app/globals.css` con `@theme inline`. NO existe `tailwind.config.ts`.**
   Do instead: tokens CSS en `:root {}` y `.dark {}`, mapeados en el bloque `@theme inline`. Nunca crear el archivo de config JS. (Trampa heredada, sigue vigente.)

---

## shadcn/ui v4

1. **[2026-08-31] `DropdownMenu`, `Select`, `Button`, `Dialog` usan `@base-ui/react` — NO aceptan `asChild`.**
   Do instead: pasar estilos por `className`. `Select.onValueChange` es `(v: string | null) => void` — usar `v ?? ""`.

2. **[2026-08-31] `Popover` usa `@radix-ui` y SÍ acepta `asChild`.**
   Do instead: no confundirlo con `DropdownMenu`. `<PopoverTrigger asChild>` funciona.

---

## Reglas del producto que se olvidan

1. **[2026-08-31] Todo botón de mutación usa `<ActionButton>`; toda eliminación usa `<DeleteButton>`.**
   Do instead: no escribir `<Button type="submit">` crudo para mutar. Eliminar siempre es rojo + ícono `X` + `<ConfirmDialog>`.

2. **[2026-08-31] Todo mensaje al usuario en español y concreto.**
   Do instead: `notifySuccess("Vacante publicada")`, nunca `"Éxito"`. Cero texto en inglés en la interfaz.

3. **[2026-08-31] El contenido lleva `pb-28` por el menú flotante inferior.**
   Do instead: sin ese padding la barra tapa el último elemento de toda lista.

4. **[2026-08-31] El color de acento es configurable por organización y alimenta `--ring` (el foco de teclado) — validar contraste, no solo formato hex.**
   Do instead: `src/lib/color-contrast.ts` calcula el contraste WCAG; `BrandingSchema` en `organizations/actions.ts` rechaza cualquier `accent_color` con menos de 3:1 contra el fondo `#faf9f7`, con un mensaje que explica por qué ("el foco de teclado no se vería"). Sin esto, un super admin podía elegir un acento claro y volver invisible el indicador de foco para cualquiera que navegue con teclado — viola "foco visible siempre".
