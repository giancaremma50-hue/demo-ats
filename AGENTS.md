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

---

## Reglas de interacción — no negociables

Están codificadas en componentes para que no dependan de la disciplina de nadie.

1. **Todo botón que muta datos usa `<ActionButton>`.**
   Estado `pending` con spinner, `disabled` mientras corre, `aria-busy`. El usuario nunca se queda sin saber si algo está pasando.
   Prohibido un `<Button type="submit">` crudo para una mutación.

2. **Toda acción exitosa confirma con un mensaje concreto.**
   `notifySuccess("Vacante publicada")`, nunca `"Éxito"` ni `"Listo"`. La mutación devuelve el texto; el toast (sonner) lo muestra.

3. **Todo botón de eliminar es rojo, con ícono `X` y confirmación.**
   Se usa `<DeleteButton>`, que abre `<ConfirmDialog>` nombrando el elemento a eliminar. Confirmar en rojo, cancelar neutro. **Nunca se elimina en un solo clic.**

4. **El menú principal es una barra flotante inferior.**
   Píldora fija en `bottom-6`, centrada, fondo sólido con sombra sutil (`0 -1px 6px rgba(0,0,0,.05)`, ver reglas de diseño visual). Acompaña la pantalla sin invadirla: se oculta al bajar, reaparece al subir, respeta `safe-area-inset-bottom`. Todo el contenido lleva `pb-28` para que nunca quede tapado. Máximo 5 ítems, según rol.

5. **Todo error se captura con un mensaje amigable y reportable.**
   Nada de stacks ni códigos crudos frente al usuario. Ver "Centro de errores" abajo.

6. Skeletons durante la carga. Estados vacíos con una acción, nunca un texto muerto. Foco visible siempre. `prefers-reduced-motion` respetado.

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

**Fondo y superficies**
- Blanco puro `#FFFFFF` de fondo (ya no blanco hueso).
- **La elevación se hace con sombra, no con borde de 1px** — pero sutil, apenas una insinuación de profundidad, nunca la mancha difusa literal de la referencia de AJE (se probó y se veía pesada en una interfaz densa de datos, corregido 2026-09-09): `box-shadow: 0 2px 8px rgba(0,0,0,.06)` en tarjetas/modales elevados, `0 -1px 6px rgba(0,0,0,.05)` en barras fijas (la píldora del menú inferior incluida — ver regla de interacción #4). Usar `<Card>` (`src/components/ui/card.tsx`) para toda superficie elevada nueva — encapsula radio + `overflow-hidden` + sombra en un solo lugar.

**Tipografía**
- Sans corporativo con peso extremo en títulos (equivalente a Gotham-Black: `font-weight: 800-900`), sans regular en cuerpo e interfaz. Sin serif.
- `font-variant-numeric: tabular-nums` en toda métrica y tabla (esto no cambia, es legibilidad, no estilo).

**Forma**
- `border-radius` variable según el elemento, no una escala única: `4px` / `6px` / `8px` / `10px` / `12px` en tarjetas y campos.
- **Píldora completa (`9999px`) en todo botón que pasa por `<ActionButton>`**, sea cual sea su variante (primario, secundario, destructivo, ghost) — en la referencia de AJE hasta el botón secundario de "Entrar con Google" es píldora, no solo el CTA principal.
- **Círculo (`50%`) en todo ícono suelto de un solo símbolo**: cerrar diálogo, campana de notificaciones, reordenar/quitar una fila, el "+" flotante sobre una foto — no hace falta que "flote sobre una imagen", basta con que sea un ícono de acción aislado (así se ve en AJE: el menú hamburguesa y el selector de idioma también son círculos sobre fondo blanco, no solo los íconos sobre foto).
- Excepción de densidad: en listas repetidas y densas (tarjetas de kanban, filas de tabla), la tarjeta en reposo usa borde de 1px, no sombra — la sombra difusa se reserva para cuando el elemento se separa de su fila (arrastrando, en hover destacado) para no repintar sombra en decenas de filas a la vez.

**Imagen**
- Fotografía real a pantalla completa (full-bleed) en héroes y portadas de sección, con overlay `--aje-dark` en degradado y texto blanco encima. Nunca ilustración genérica ni ícono como protagonista de una sección.

**Espaciado**
- Escala de espaciado de 4px se mantiene. Densidad alta en tablas de candidatos se mantiene: es requisito funcional, no estético.

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
