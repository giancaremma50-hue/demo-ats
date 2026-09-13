<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# ATS — Reglas del proyecto

Plataforma de reclutamiento (Applicant Tracking System). Next.js 16 + Supabase + Vercel.
**Todo el producto está en español.** Cero texto en inglés en la interfaz.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.3.x (App Router) — ver aviso de arriba |
| Lenguaje | TypeScript strict |
| Estilos | Tailwind v4 — tokens en `src/app/globals.css` con `@theme inline`. **Nunca crear `tailwind.config.ts`** |
| Componentes | shadcn/ui v4 (mezcla `@base-ui/react` y Radix) |
| Animación | framer-motion |
| Formularios | react-hook-form + Zod |
| Base de datos | Supabase Postgres con **RLS en todas las tablas** |
| Auth | Supabase Auth — Google OAuth, `@supabase/ssr`, cookies httpOnly |
| Archivos | Supabase Storage — bucket privado para CVs, público para marca |
| Correo | Resend + React Email (`emails/`) |
| Deploy | Vercel |

---

## Cierre de producción — regla obligatoria

**Toda fase o funcionalidad ya terminada y verificada se empuja directo al repositorio (push), sin esperar a agrupar varias fases.** Cada push de cierre incluye:

1. El código de la fase, ya pasado por `/code-review`.
2. Los documentos afectados actualizados en el mismo commit: `README.md` si cambió cómo se usa el proyecto, y este `AGENTS.md` si cambió una regla o el stack.
3. **`.claude/napkin.md` actualizado como bitácora de registro** — no solo trampas de sintaxis: toda decisión no obvia, todo error real encontrado y cómo se resolvió, y todo gotcha nuevo del stack. Es el historial de la construcción de la plataforma, se lee antes de tocar código y se cura en cada lectura (máx. 10 ítems por categoría, se re-prioriza).

No se deja trabajo terminado sin subir. "Terminado" significa: compila, pasa lint y typecheck, y pasó `/code-review`.

## Uso obligatorio de skills

Estas skills **no son opcionales**. Antes de empezar cualquier tarea, ubícala en esta tabla y carga la skill que corresponda.

| Cuando la tarea es… | Skill obligatoria |
|---|---|
| Diseñar pantallas o flujos nuevos | `/design` (canvas de artboards) + `ui-ux-pro-max` |
| Escribir o retocar cualquier componente de interfaz | `taste-skill` (`design-taste-frontend`) + `web-design-guidelines` |
| Escribir componentes o hooks de React | `react-best-practices` + `composition-patterns` |
| Planear una funcionalidad no trivial | `superpowers`: `brainstorming` → `writing-plans` → `executing-plans` |
| Depurar un fallo | `superpowers`: `systematic-debugging` — causa raíz, nunca parche |
| Antes de cerrar un cambio grande | `/ponytail-review` — detectar sobre-ingeniería |
| Recuperar contexto del código | `codebase-memory-mcp` |
| **Antes de TODO commit, sin excepción** | **`/code-review`** |
| Antes de cada despliegue | `/security-review` + auditoría de políticas RLS |
| Al descubrir una trampa recurrente | Anotarla en `.claude/napkin.md` |

Regla de cierre: **ningún commit entra sin haber pasado por `/code-review`.** Si el review encuentra algo, se corrige antes de commitear, no después.

### Skills de movimiento y craft (de `emilkowalski/skills`, instaladas 2026-09-12)

Diez skills de Emil Kowalski (Vercel, Linear; autor de Sonner y Vaul) que fijan el
estándar de animación y de detalle fino. Se instalaron las de web; `write-swift` y
`animate-expo` quedaron fuera a propósito — son de Swift y React Native, y este
proyecto no es ninguna de las dos cosas.

| Cuando la tarea es… | Skill |
|---|---|
| **Escribir CUALQUIER animación o transición** | `animate` — decide en orden: si debe animar, qué propiedades, qué curva, qué duración, cómo se interrumpe y cómo sale |
| Revisar movimiento ya escrito | `review-animations` |
| Auditar el movimiento de todo el repo | `improve-animations` |
| Buscar dónde FALTA movimiento (y dónde no ponerlo) | `find-animation-opportunities` |
| Detalle fino de UI, componentes, lo invisible que se nota | `emil-design-eng` |
| Gestos, springs, materiales, profundidad | `apple-design` |
| Trabajar o depurar los toast | `ask-sonner` (el proyecto usa Sonner — ver regla de interacción 2) |
| Elegir una librería de frontend | `pick-ui-library` |
| Explorar varias versiones de una pieza de UI | `prototype` |
| Ponerle nombre a un efecto que no sabés cómo se llama | `animation-vocabulary` |

Las tres reglas de ese estándar que este proyecto viola hoy y que **no se pueden
volver a introducir en código nuevo**: nunca `ease-in` en UI, nunca `transition-all`
(se nombra la propiedad), y nunca una entrada desde `scale(0)`.

---

## Reglas de interacción — no negociables

Están codificadas en componentes para que no dependan de la disciplina de nadie.

1. **Todo botón que muta datos usa `<ActionButton>`.**
   Estado `pending` con spinner, `disabled` mientras corre, `aria-busy`. El usuario nunca se queda sin saber si algo está pasando.
   Prohibido un `<Button type="submit">` crudo para una mutación.
   Única excepción, y solo porque cumple lo mismo: la subida de archivos arranca al elegir el archivo y el estado `pending` lo muestra el propio `<MediaPicker>` (spinner sobre la miniatura, `aria-busy`, input deshabilitado). Ver regla 8 — un botón "Subir" aparte es un paso que se olvida, y eso ya costó dos subidas perdidas.

2. **Toda acción exitosa confirma con un mensaje concreto.**
   `notifySuccess("Vacante publicada")`, nunca `"Éxito"` ni `"Listo"`. La mutación devuelve el texto; el toast (sonner) lo muestra.

3. **Todo botón de eliminar es rojo, con ícono `X` y confirmación.**
   Se usa `<DeleteButton>`, que abre `<ConfirmDialog>` nombrando el elemento a eliminar. Confirmar en rojo, cancelar neutro. **Nunca se elimina en un solo clic.**

4. **El menú principal es una barra flotante inferior.**
   Píldora fija en `bottom-2.5` (10 px + `safe-area-inset-bottom`), centrada, fondo sólido con sombra sutil (`0 -1px 6px rgba(0,0,0,.05)`, ver reglas de diseño visual). Todo el contenido lleva `pb-28` para que nunca quede tapado. Máximo 5 ítems, según rol.
   **Al bajar se PLIEGA, no desaparece** (mockup "Lomo", aprobado el 2026-09-11): la misma píldora se contrae a un bloque de 12 px que conserva su sombra —se lee como un objeto cerrado, no como una raya decorativa— y se despliega al subir o al tocarla. Nunca se desmonta: es el mismo elemento cambiando de tamaño. Una barra que desaparece entera no dice que va a volver, y eso se reportó como "desapareció el menú".

5. **Todo error se captura con un mensaje amigable y reportable.**
   Nada de stacks ni códigos crudos frente al usuario. Ver "Centro de errores" abajo.

6. Skeletons durante la carga. Estados vacíos con una acción, nunca un texto muerto. Foco visible siempre. `prefers-reduced-motion` respetado.

7. **Todo elemento clickeable que representa un registro concreto (una notificación, una tarea asignada, un ítem de actividad) navega a esa instancia real.** Nunca un clic que no mueve nada en pantalla — eso se lee como "no está pasando nada" y el usuario reintenta o abandona. Si todavía no hay una ruta o vista a la que mandarlo, es más honesto no hacerlo clickeable que fingir que lo es.

8. **Toda subida de archivo se hace con `<MediaPicker>`: un solo cuadro que es a la vez vista previa y selector, y sube al elegir.**
   Nada de "miniatura decorativa + `<input type=file>` nativo al lado" — son dos controles que parecen dos botones distintos, y el nativo solo muestra el NOMBRE del archivo. Quien sube tiene que **ver** lo que eligió: la miniatura muestra el archivo local (`blob:`) apenas se elige, y lo guardado en el servidor después. El `<input>` va `sr-only` dentro del `<label>` que es el cuadro, para que el clic en cualquier parte abra el diálogo y el foco de teclado se vea (`focus-within:ring`). Un PDF u otro archivo sin vista previa posible muestra su ícono y su nombre.
   **Elegir el archivo ES guardarlo** (`status="subiendo"` → `"guardado"` → `"idle"` cuando llega la URL del servidor): no hay segundo paso. Al guardar bien, el cuadro NO se remonta — la vista previa local se queda hasta que llegue la URL nueva, porque limpiarla de una deja el cuadro vacío justo después de guardar y eso se lee como que no se guardó.

   Vale para marca, foto de perfil y cualquier punto de subida nuevo de UN archivo. **Excepción declarada: los adjuntos del muro** son varios archivos que se suben recién al publicar, así que no pasan por `<MediaPicker>` — pero cumplen lo mismo por su cuenta y eso no es negociable: miniatura de cada archivo (`<MediaThumb>`, la misma que usa el picker), `<input>` `sr-only` (nunca `hidden`) dentro de su `<label>`, `value` limpiado en cada cambio, y las guardias de tipo y tamaño **antes** de que el archivo entre a la lista — nunca después de crear la publicación.

   **Ningún archivo viaja dentro del cuerpo de una Server Action.** Una Server Action es una función serverless y en Vercel el cuerpo de la petición tiene un tope de ~4.5 MB que `serverActions.bodySizeLimit` de Next **no** puede subir: es de la plataforma. Una foto de teléfono lo pasa fácil, y cuando eso ocurre la petición se rechaza antes de que corra una sola línea del proyecto — `useActionState` nunca cambia, así que no hay éxito ni error que mostrar: silencio, que es el peor final posible (regla 5). El archivo va **directo a Storage con URL firmada**: el servidor autoriza la ruta (que arma él, nunca el cliente) y confirma después. Ver `createBrandUploadUrl`/`confirmBrandUpload` y `createAttachmentUploadUrl`/`confirmPostAttachment`. La única excepción viva es la foto de perfil (tope propio de 3 MB, por debajo del límite), y aun así valida tamaño y tipo **en el cliente antes de enviar** para que un archivo grande diga por qué en vez de morir callado.

9. **Una pantalla de configuración muestra en el acto lo que se acaba de cambiar.**
   Guardar sin ver el cambio obliga a recargar para confirmar, y eso se lee como que no se guardó. Cada campo de configuración muestra su valor actual en pantalla, y donde el cambio afecta a otra superficie (el logo en el encabezado, el acento en los botones, la portada de la bolsa) hay una vista previa en la misma pantalla. Toda mutación de configuración revalida **todas** las rutas que pinta ese dato, no solo la actual: `revalidatePath("/", "layout")` no alcanza para una ruta ISR anidada como `/empleos` — ver `revalidateBrandSurfaces()` en `src/lib/organizations/actions.ts`.

10. **La barra flotante: tres anclas fijas, y en medio lo que cambia.**
   `[⊞ …] · [Home] [submenús del módulo] · [⚙]` (mockup aprobado el 2026-09-11, variante B; el texto del selector se corrigió el 2026-09-13 contra la app real). El **selector de módulos**, el **Home** y el **engranaje** están en toda pantalla y en la misma posición; nunca desaparecen — una pantalla sin la puerta de vuelta a la principal es un callejón sin salida, y eso pasó al entrar a Configuración.
   **En un teléfono, el nombre de la PANTALLA va al lado del selector** (corregido 2026-09-13, con la app a la vista: con Home seleccionado la barra decía "Reclutamiento" y nada decía "Inicio"). Ahí la etiqueta del ítem activo va oculta por espacio, así que sin eso nada nombra la pantalla. Desde `sm:` ese lugar vuelve a ser del **nombre del módulo**, porque el ítem activo ya muestra el suyo y repetirlo sobra. Si ninguna ruta coincide (`/postulaciones/<id>`), no dice nada: mejor mudo que nombrando una pantalla falsa.
   **Ese nombre va FUERA del botón del selector**, como texto plano. Adentro convertía al botón que abre el selector de módulos en algo que dice "Inicio" —nombraba a otro control— y dejaba dos elementos de la barra con el mismo nombre accesible, así que "tocá Inicio" por control de voz se volvía ambiguo. Afuera no es un control y el problema desaparece. (Esto no contradice lo de "no en una ficha aparte": una ficha es una superficie con fondo y borde; esto es texto suelto y ocupa lo mismo que ocupaba adentro.)
   **Se probó mostrar la etiqueta del ítem activo en todo ancho y se descartó**: el nombre fijo pegado al ícono se veía pesado. No fue por ancho — la cadena se pinta igual de un lado o del otro. Lo que sí hace entrar la barra en un teléfono de 320px es el `px-1` de los ítems de navegación —de todos, activo incluido—, sin el cual el engranaje se va al scroll horizontal.
   **Límite conocido**: los dos módulos llaman "Inicio" a su pantalla principal, así que en un teléfono el texto es el mismo en Reclutamiento y en Conectados. Lo que confirma el cambio de módulo ahí es el color de la barra.
   **El nombre del módulo vive dentro del selector**, no en una ficha aparte — y en un teléfono ni siquiera ahí: por debajo de `sm:` no se muestra, porque ese lugar es de la pantalla activa. **Costo aceptado**: en un teléfono el módulo queda distinguido por el color de la barra, el popover que lo nombra al abrirlo y el `aria-label` del selector. Es un cue de color para quien ve, y por eso el nombre vuelve apenas hay ancho. Y **no se muestra donde sería falso**: en `/configuracion`, `/mi-cuenta` y `/notificaciones` el selector va sin nombre (ver `isModulelessPath`).
   **El texto visible de un control nombra a ESE control.** No se le pone a un botón el nombre de la pantalla a la que lleva otro. El primer intento de este arreglo puso "Inicio" dentro del botón que abre el selector, y el segundo trató de taparlo metiendo "Inicio" también en su `aria-label` — que arreglaba WCAG 2.5.3 y creaba algo peor: dos controles de la misma barra con el mismo nombre. La salida no era el nombre accesible, era sacar el texto del control.
   **Nada de texto blanco sobre el color de la barra**: blanco sobre el verde AJE da 2.8:1 y sobre el naranja menos. El nombre y los íconos van en `--aje-dark`, que es el mismo valor en los dos temas y llega a 6.5:1 o más sobre cualquiera de los fondos de módulo.
   **Ajustes es la configuración de la plataforma** (marca, usuarios, departamentos, motivos) y aparece en TODOS los módulos para admin y super admin: tener que entrar a Reclutamiento para cambiar el logo mientras se está en AJE Conectados es el mismo callejón.
   **La bolsa de empleo NO es configuración de la plataforma**: es una pantalla del ATS (`/bolsa`, super admin). Configurar la portada y las leyendas de `/empleos` es operación de reclutamiento, y tenerlo escondido dentro de `/configuracion/marca` lo volvía invisible para quien recluta.

---

## Reglas de diseño visual — "AJE look" (ref. ajegroup.com, adoptado 2026-09-09)

Reemplaza al esquema anterior ("editorial sobrio", incluida la unificación de tarjetas a `rounded-md border` del mismo día — superada por esta regla). Aplica a **todo el producto**, paneles internos incluidos (tablas de candidatos, dashboards, configurador).

**Prohibido ahora:** ilustraciones 3D genéricas · emojis usados como íconos · texto centrado por defecto · mezclar dos familias tipográficas sans distintas en la misma pantalla.

**Color** — paleta fija, no gradientes inventados:
| Token | Hex | Uso |
|---|---|---|
| `--aje-green` | `#00B348` | Acento primario, éxito |
| `--aje-red` | `#EF4444` | Destructivo (`DeleteButton`), error |
| `--aje-yellow` | `#FFB81C` | Alertas, pendiente |
| `--aje-orange` | `#EF7834` | Acento secundario configurable por organización |
| `--aje-dark` | `#0F172A` | Overlay sobre fotografía, texto sobre imagen |

Multicolor por contexto: cada estado o marca puede tener su color (igual que AJE distingue Amayu/Cielo/Pulp), pero un mismo componente no mezcla más de dos tokens.

**El verde AJE es un color de RELLENO, no de texto** (2026-09-12, tras encontrar el fallo en vivo). `#00B348` da **2.78:1 contra blanco**: sirve de fondo, no sirve ni de texto chico ni de anillo de foco sobre el fondo claro. De ahí salen dos tokens con roles distintos, y confundirlos es el error:

| Token | Qué es | Dónde |
|---|---|---|
| `--primary` | El verde AJE **fijo**, `#00B348`. No lo configura nadie. | Relleno: botones, barra flotante, barra de acciones del candidato |
| `--accent` | El que **sí configura** cada organización (inyectado inline sobre `<html>`) | Cosas chicas sobre fondo claro: texto, bordes, resaltados, anillo de foco |

- **Todo lo que va ENCIMA del verde AJE lleva `--aje-dark`, nunca blanco.** Blanco da 2.78:1; la tinta oscura, 6.41. Esto vale para el botón primario, el avatar, la barra de acciones y la barra flotante — no solo para esta última, que fue donde se aplicó primero y donde se quedó tres días (regla de interacción 10).
- **Un acento tiene que pasar 4.5:1 contra el fondo.** Es el anillo de foco (`--ring: var(--accent)`), pero además es texto chico (`text-accent`) y es fondo con texto blanco encima (`bg-accent`): los tres piden 4.5, y como el contraste es simétrico una sola comprobación contra el blanco cubre las tres. Por eso el acento por defecto —`DEFAULT_ACCENT` en `src/lib/color-contrast.ts`, que es la fuente para todo TS/TSX; `globals.css` y las plantillas de correo llevan su propia copia porque ninguno de los dos puede importar una constante— es `#008134`: el mismo matiz del verde AJE (144°), bajado hasta 5.01:1. **El `#00B348` crudo no se ofrece como acento** — lo rechaza la propia validación del formulario de marca.
- Esta tabla describe el **tema claro**, que es el único que existe: el bloque `.dark` de `globals.css` es código muerto (nada agrega esa clase, y no hay una sola utilidad `dark:` en los componentes). Ahí `--accent` y `--primary` son el mismo valor, así que la separación de roles de arriba **no aplica** — el día que se encienda el tema oscuro, hay que rehacerla.

**Fondo y superficies**
- Blanco puro `#FFFFFF` de fondo (ya no blanco hueso).
- **El borde define, la sombra levanta** (precisado 2026-09-12 tras auditoría: la regla decía "elevación con sombra, NUNCA borde de 1px" y el código usaba borde 528 veces contra 14 de sombra. No era que el código estuviera mal — era que la regla decía "nunca" sobre dos cosas que hacen trabajos distintos).

  | Recurso | Para qué |
  |---|---|
  | Sombra `0 2px 8px rgba(0,0,0,.06)` | **Superficie de contenido** (`<Card>`) y **lo que flota**: diálogo, popover, menú |
  | Sombra `0 -1px 6px rgba(0,0,0,.05)` | Barras fijas (la píldora del menú inferior — ver regla de interacción #4) |
  | Borde de 1px | **Estructura**: campos, separadores, tablas, y la fila en reposo de una lista densa |

  Sutil a propósito, nunca la mancha difusa literal de la referencia de AJE: se probó y se veía pesada en una interfaz densa de datos (2026-09-09).
- **En listas repetidas y densas (kanban, filas de tabla) la fila en reposo va con borde, no con sombra** — repintar sombra difusa en decenas de filas a la vez es caro y se ve sucio. La sombra aparece cuando el elemento se separa de su fila: arrastrando, en hover destacado.
- Usar `<Card>` (`src/components/ui/card.tsx`) para toda superficie de contenido nueva — encapsula radio + `overflow-hidden` + sombra en un solo lugar.

**Tipografía** — una sola familia, la jerarquía la hace el PESO (implementado 2026-09-12; la regla existía desde el 9 de septiembre y el código seguía en serif)
- **Geist, y nada más. Sin serif.** Instrument Serif salió del bundle: dos familias en pantalla era el sistema anterior ("editorial sobrio"), no este.
- **Dos escalones de título, y no se inventa un tercero:**

  | Escalón | Cuándo | Clases |
  |---|---|---|
  | Display | 28px o más — título de pantalla, cifra protagonista, hero | `font-black tracking-display` (900 / −0.035em) |
  | Título | 19–27px — encabezado de sección, título de diálogo, nombre de tarjeta | `font-extrabold tracking-heading` (800 / −0.022em) |
  | Título chico | 18px o menos — nombre en una tarjeta de lista, marca en el encabezado | `font-bold tracking-heading` (700) |

  El tracking negativo no es opcional: a peso 800-900 las letras se tocan y sin apretarlo el título se lee como un bloque. Los valores viven en `--tracking-display` / `--tracking-heading` (`globals.css`), nunca a mano.
  A 15px un peso 900 se empasta y deja de leerse — por eso el escalón chico baja a 700. El peso extremo es para lo grande.
- Cuerpo e interfaz en regular/medium. `font-semibold` queda para botones y etiquetas, no para títulos.
- `font-variant-numeric: tabular-nums` en toda métrica y tabla (esto no cambia, es legibilidad, no estilo).

**Forma** — un radio por ROL, no uno por elemento (precisado 2026-09-12)
- La regla anterior pedía `4/6/8/10/12px` "variable según el elemento", que es una invitación a inventar un radio cada vez. Lo que el código hace —y hay que sostener— es una escala corta donde cada escalón significa algo, siempre por token, nunca en px a mano:

  | Radio | Para qué | Usos |
  |---|---|---|
  | `rounded-md` | **El default de toda superficie y toda caja**: `<Card>`, campo, panel interno, miniatura | 157 |
  | `rounded-lg` | Lo que flota por encima: diálogo y popover | 2 componentes |
  | `rounded-sm` | Marcador chico en línea: badge, chip, token de código | 9 |
  | `rounded-full` | Todo botón y toda píldora | 68 |
  | `50%` | Ícono suelto de un solo símbolo | — |

  Un radio nuevo fuera de esta tabla es un hallazgo de review, no una decisión de diseño: el ojo lee como error lo que no puede explicar.
  **Excepciones declaradas** (la tabla es sobre la escala; estas son sobre el mecanismo de entrega):
  - El indicador de la barra flotante lleva su radio en `style={{ borderRadius: 9999 }}` y no en clase, porque framer-motion solo corrige la deformación del radio durante un `layoutId` para los valores que llegan por `style`. Devolverlo a la clase reintroduce un indicador con forma de huevo aplastado.
  - `src/app/global-error.tsx` usa radios inline en px porque reemplaza al layout raíz y no puede contar con que la hoja de Tailwind haya cargado.
- **Píldora completa (`9999px`) en todo botón que pasa por `<ActionButton>`**, sea cual sea su variante (primario, secundario, destructivo, ghost) — en la referencia de AJE hasta el botón secundario de "Entrar con Google" es píldora, no solo el CTA principal.
- **Círculo (`50%`) en todo ícono suelto de un solo símbolo**: cerrar diálogo, campana de notificaciones, reordenar/quitar una fila, el "+" flotante sobre una foto — no hace falta que "flote sobre una imagen", basta con que sea un ícono de acción aislado (así se ve en AJE: el menú hamburguesa y el selector de idioma también son círculos sobre fondo blanco, no solo los íconos sobre foto).
- **Todo ícono sobre un fondo de color sólido (el menú flotante inferior, cualquier píldora rellena) lleva `strokeWidth={2.5}` como mínimo**, nunca el `2` por defecto de `lucide-react`. Encontrado 2026-09-09: con el verde AJE de fondo, una línea de grosor por defecto pierde contraste y el ícono se lee borroso — un fondo neutro (blanco, `bg-muted`) no tiene este problema y puede quedarse en el grosor default.

**Imagen**
- Fotografía real a pantalla completa (full-bleed) en héroes y portadas de sección, con overlay `--aje-dark` en degradado y texto blanco encima. Nunca ilustración genérica ni ícono como protagonista de una sección.

**Espaciado**
- Escala de espaciado de 4px se mantiene. Densidad alta en tablas de candidatos se mantiene: es requisito funcional, no estético.

---

## Reglas de movimiento (adoptado 2026-09-12)

Estándar de `emilkowalski/skills`, instalado en `.claude/skills/`. **Antes de escribir
cualquier transición o animación se carga la skill `animate`** — no es opcional, está
en la tabla de skills obligatorias.

La auditoría del 2026-09-12 encontró nueve transiciones en 101 componentes y cero
tokens. El problema no era animar mal: era que no había sistema, y sin sistema cada
animación nueva se inventa sus valores.

**Curvas — viven en `globals.css`, nunca se escriben a mano.** `--ease-out` y
`--ease-in-out` pisan a propósito las de Tailwind, para que todo `ease-out` del
proyecto use la curva fuerte sin tener que acordarse de un nombre nuevo.

| Token | Valor | Cuándo |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Algo entra o sale. **El default.** |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Algo se mueve o se transforma en pantalla |

Para un drawer o una hoja, cuando se anime alguno: `cubic-bezier(0.32, 0.72, 0, 1)` (la curva de Ionic, tipo iOS). **No hay token todavía** — se agrega el día que se use. Hoy ni `MeetingScheduler` ni `CandidateDrawer` animan, y un token que nadie usa hace creer que ya está resuelto.

Hover y cambios de color: `ease`. Movimiento constante (marquesina, progreso): `linear`.

**Duraciones** — no hay utilidad que generar, `duration-N` de Tailwind ya toma el
número. Esto es la escala acordada:

| Qué | Duración |
|---|---|
| Presión de un botón | 100–160 ms |
| Tooltip, popover chico | 125–200 ms |
| Menú, select | 150–250 ms |
| Diálogo, drawer | 200–300 ms |

**Ninguna animación de interfaz pasa de 300 ms**, y **la salida siempre es más rápida
que la entrada**: al abrir el usuario todavía está ubicando lo que apareció; al cerrar
ya decidió.

**Lo que nunca entra en código nuevo:**

| Nunca | En su lugar |
|---|---|
| `transition-all` | Nombrar las propiedades exactas |
| Entrada desde `scale(0)` | `scale(0.95)` + `opacity: 0` — nada en el mundo real aparece de la nada |
| `ease-in` en interfaz | `ease-out`; arranca lento justo cuando el usuario está mirando |
| Animar una acción de teclado o algo que se ve 100+ veces al día | Sin animación. Punto. |
| `transform-origin: center` en un popover anclado | `origin-[var(--radix-popover-content-transform-origin)]` (un diálogo modal sí va centrado) |
| Keyframes en algo que se dispara rápido (toasts, toggles) | Transiciones: se retoman a mitad de camino, los keyframes reinician desde cero |
| Animar `width`/`height`/`margin`/`top` | `transform` y `opacity` |
| Props `x`/`y`/`scale` de framer-motion bajo carga | El string completo: `transform: "translateX(100px)"` |

**Trampa de Tailwind v4 — `scale` NO es `transform`.** `scale-[0.97]` compila a la
propiedad independiente `scale`, así que `transition-[transform]` no la toca y el
elemento salta de golpe. Se nombra `transition-[scale]` (o `transition-transform`,
que en v4 ya expande a `transform, translate, scale, rotate`).

**Lo que NO hay que "arreglar":** Tailwind v4 ya envuelve todo `hover:` y
`group-hover:` en `@media (hover: hover)` por su cuenta. Los hover de este proyecto
están protegidos contra el toque en celular sin que nadie escriba nada. (Se reportó
como hallazgo en la auditoría y era falso: el grep buscaba `@media (hover: hover)` con
espacio y el CSS sale minificado sin él.)

**Feedback de presión — obligatorio en todo botón que dispara una acción.**
`active:scale-[0.97]` con `transition-[scale] duration-150 ease-out`, más
`motion-reduce:active:scale-100 motion-reduce:active:opacity-80` (con movimiento
reducido la duración global queda en 0.01ms, que apaga la curva pero no el `scale`:
sin esto el botón daría un salto seco). Ya está en `<ActionButton>` y
`<DeleteButton>`, que es por donde pasa toda mutación. Entre el clic y la respuesta
del servidor no puede no pasar nada en pantalla.

**Dónde NO va**, y no es pendiente sino decisión:
- **Enlaces de navegación** (la barra flotante, filas de lista que navegan): el
  feedback es el cambio de pantalla, que llega antes que cualquier animación.
- **Controles con forma de fila** que usan `<ActionButton>` a lo ancho completo
  (`notification-item`): encogerlos 3% los despega de sus vecinas y rompe la
  retícula de separadores. Se cancela con `active:scale-100`, que gana por
  `twMerge`.
- Un ícono suelto de cerrar o abrir sí puede llevarlo, pero todavía no lo lleva:
  cuando se toque uno de esos componentes, se agrega.

**`prefers-reduced-motion` viaja con la animación**, no como pendiente. Significa
menos movimiento y más suave, no cero: se conservan opacidad y color, se quita el
desplazamiento.

---

## Seguridad — RLS y TLS

- **RLS activo en todas las tablas, deny-by-default.** Sin excepción, incluidas las de configuración. Una tabla nueva sin política es un bug bloqueante.
- **El rol y el `organization_id` viajan en el JWT** (custom access token hook). Las políticas leen `auth.jwt()`, **nunca consultan `profiles`** — eso causa recursión infinita.
- Toda tabla lleva `organization_id`, incluso operando un solo tenant.
- **`SUPABASE_SERVICE_ROLE_KEY` y `RESEND_API_KEY` jamás llevan prefijo `NEXT_PUBLIC_`** ni se importan en un client component.
- El portal público **no escribe con el rol `anon`**. Las postulaciones entran por un Route Handler del servidor con service role, con validación Zod y rate limit.
- CVs en bucket privado, servidos con URL firmada de 60 s. Nunca URL pública.
- Validación Zod en cada Server Action y Route Handler. El cliente nunca es fuente de verdad.
- HSTS y cabeceras de seguridad en `next.config.ts`.

---

## Privacidad y datos de candidatos — reglas duras

El candidato externo es el único usuario de la plataforma que **no** tiene cuenta,
no acepta términos al entrar y no puede consultar nada de lo que guardamos sobre
él. Todo lo que sigue existe por eso.

- **La política de privacidad vive en código**, no en la base: `src/lib/legal/policy.ts`
  (versión + vigencia + responsable) y `src/app/(public)/privacidad/page.tsx`. Git es
  lo que da fecha, autor y diff de cada palabra — una tabla editable no prueba nada.
- **Al cambiar el texto de forma sustantiva se sube `POLITICA_VERSION`.** Las
  postulaciones viejas siguen apuntando a la versión que aceptaron. Eso es el punto,
  no un efecto secundario.
- **`/privacidad` tiene que estar en `PUBLIC_PATHS`** (`src/lib/supabase/proxy.ts`).
  Si sale de ahí, el enlace del formulario manda a `/login` y el consentimiento se
  vuelve una casilla que nadie puede leer antes de marcar.
- **Ningún dato de un candidato externo entra sin consentimiento registrado.**
  `/api/postular` exige la casilla con Zod (no basta el `required` del HTML) y guarda
  `applications.privacy_consent_version` + `privacy_consent_at`. La hora la pone el
  servidor, nunca el cliente.
- **Una casilla sin marcar NO viaja en el `FormData`.** Se valida contra el literal
  `"on"`, jamás con `z.coerce.boolean()` — cualquier string no vacío coerciona a
  `true`, así que `privacy_consent=no` pasaría.
- **Referir un candidato es la excepción, y se trata como tal.** Ahí los datos los
  carga un empleado sobre un tercero que nunca vio la política: no hay consentimiento
  del titular que registrar, las columnas quedan `NULL`, y lo que se exige es la
  declaración de quien refiere (`referral_authorized`). No inventar un consentimiento
  que esa persona no dio.
- **Los CV van al bucket privado `cvs-privado`**, servidos con URL firmada de 60 s.
  Nunca a un bucket público, nunca con URL permanente.
- **Solo los correos que llegan al candidato llevan el pie legal**
  (`EmailLayout privacyUrl=...`): `postulacion-recibida`, `entrevista-programada`,
  `mensaje-candidato`. `cambio-etapa` va al equipo interno, no lleva pie.

### Cookies — la regla que se rompe sin darse cuenta

Hoy **el portal público no pone ni una cookie** (medido el 2026-09-09:
`Set-Cookie` = 0 en `/empleos`). Las cookies de sesión de Supabase son
estrictamente necesarias y aparecen únicamente tras iniciar sesión. Las
tipografías se auto-hospedan (`font-src 'self'`).

**Hay UNA medición de terceros activa:** `@vercel/speed-insights` en el layout
raíz — o sea, también en el portal público. Es telemetría de rendimiento sin
cookies y sin identificador de visitante, así que se **declara** en la sección 9
de la política pero **no exige banner**.

Al agregar cualquier script de terceros, la pregunta que decide es:
**¿guarda algo en el navegador, o permite distinguir a un visitante de otro?**

| Caso | Qué exige |
|---|---|
| Sin cookies y sin identificador — telemetría agregada de rendimiento | Declararlo en la sección 9 y en `ENCARGADOS`. Nada más. |
| Pone cookies, usa `localStorage`, o identifica al visitante — Google Analytics, Meta Pixel, Hotjar, Sentry, Vercel Analytics (la de audiencia, distinta de Speed Insights) | **Banner de consentimiento previo real**: con opción de rechazar y sin cargar el script antes de la respuesta. Más la sección 9. |

La versión anterior de esta regla decía "cualquier script de terceros exige
banner". Era demasiado absoluta: cuando otra sesión agregó Speed Insights la
regla disparó bien, pero habría pedido un banner que no corresponde. Lo que sí
falló y no se debe repetir: **la política afirmaba "No usamos analítica" y eso
quedó falso.** Todo script nuevo obliga a releer la sección 9 antes de subir —
si el texto afirma algo que el código ya no cumple, el problema no es el script,
es el texto.

---

## Centro de errores

El error no es un callejón sin salida: es el canal de soporte entre el usuario y el super admin.

- Los mensajes viven en `src/lib/errors/catalog.ts`. Redacción: **qué pasó en humano → qué no se perdió → qué puede hacer ahora.** Nunca culpar al usuario, nunca jerga, nunca un código sin explicación.
- Toda tarjeta de error ofrece **"Contarle al soporte"**. El diálogo hace una sola pregunta: *"¿Qué estabas intentando hacer?"*. El contexto técnico (URL, acción, stack, navegador, sesión) se adjunta solo.
- Se crea un `error_reports` con código `ERR-AAAA-NNNN` y se notifica al super admin.
- El super admin responde desde `/configuracion/errores`; el usuario ve y responde el hilo en "Mis reportes". Cada respuesta notifica a la otra parte.

---

## Roles

**Tres roles.** El rol `colaborador` se eliminó (2026-09-03) — su valor sigue en el enum `app_role` porque Postgres no permite borrarlo, pero no se asigna a nadie.

| Rol | Alcance |
|---|---|
| `gestor` | Jefe de área. Solicita plazas de su área y ve el pipeline **solo de sus vacantes**. |
| `admin` | RH. Opera todo el reclutamiento y la configuración de la organización. |
| `super_admin` | Control total + centro de errores + marca. |

Quien necesita ver una vacante se suma como **miembro de esa vacante**, con uno de **dos permisos, nunca más**:

| Permiso | Puede |
|---|---|
| `lectura_escritura` | Ve todo, escribe seguimientos, sube archivos, deja tareas y califica. **No** mueve etapas ni edita la vacante. |
| `solo_lectura` | Ve todo el registro (archivos, seguimientos, tareas). No escribe nada. |

**Las 5 decisiones de una vacante** —mover etapa, contratar, descartar, agendar reunión, escribirle al candidato— son del **reclutador asignado** (`jobs.owner_id`), `admin` o `super_admin`. Ningún permiso de miembro las habilita.

**Dos fuentes de permiso, nunca tres.** Decidir = `is_admin_or_above() OR jobs.owner_id = actor`. Escribir = eso, más `jobs.requested_by`, más miembro con `lectura_escritura`. El reclutador manda porque es `owner_id`, no por su fila en `job_collaborators`.

**Regla de permisos, no negociable:** las funciones `private.can_decide_application` / `can_write_application` de Postgres son el **espejo** de `src/lib/applications/permissions.ts`. Todo cambio de umbral se aplica en **ambos lados, en la misma sesión** — el SQL es la última línea, la que ve quien se salta la interfaz. Y se escriben como **lista blanca** (`WRITE_PERMISSIONS = new Set([...])`), nunca como "todo lo que no sea solo lectura": un valor nuevo del enum no nace con permiso por accidente.
