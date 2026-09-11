# Ingreso por documento de identidad y alta del colaborador

**Fecha:** 2026-09-11
**Estado:** diseño aprobado, sin implementar. Nada de esto toca producción todavía.
**Rama de trabajo:** `claude/login-tab-design-flow-csa6ye`

## El problema

Hoy la única puerta de entrada es Google (`signInWithGoogle`, `/auth/callback`).
Eso sirve para RH y jefes de área, que tienen correo corporativo. No sirve para
el personal de operaciones: una persona que la empresa acaba de contratar, que
no tiene ni va a tener correo de la compañía, y que sin embargo es a quien
AJE Conectados está dirigido.

Falta entonces una segunda puerta y, detrás de ella, una figura que el producto
no tiene: el colaborador. Alguien que existe en la plataforma solo para la red
interna, sin ninguna relación con el reclutamiento.

## Decisiones tomadas (y por quién)

Todas del usuario, en la sesión del 2026-09-11:

1. **Alcance:** el ingreso por documento es solo para el candidato ya contratado
   que no usará correo corporativo (perfiles de operaciones). RH, gestores y
   admins siguen entrando únicamente con Google.
2. **Credencial:** documento de identidad + fecha de nacimiento. Se advirtió por
   escrito que ambos datos están impresos en el mismo documento físico y que la
   credencial es, por eso, débil; el usuario la confirmó. El diseño la compensa
   con alta manual, bloqueo por intentos y alcance mínimo del rol.
3. **Activación:** manual, por RH, desde la ficha de la postulación. Nunca
   automática al mover de etapa, nunca autoservicio.
4. **Alcance del rol:** AJE Conectados, su propio perfil y sus notificaciones.
   Cero acceso al reclutamiento.
5. **Rol:** se revive el valor `colaborador` del enum `app_role`, en vez de
   crear uno nuevo.
6. **Pantalla:** una sola pantalla de login con dos botones — el de Google y
   uno de ingreso por documento.
7. **Correo:** sintético interno. El colaborador no tiene ni usa correo.
8. **Área:** obligatoria en el alta.
9. **Privacidad:** no se toca la política ni se sube `POLITICA_VERSION` — a
   criterio del usuario, una vez contratada la persona la información ya es
   compartida con la empresa. Queda anotado como punto legal abierto
   (ver "Riesgos aceptados").

## Los países

Los cuatro de `src/lib/geo/countries.ts`, sin agregar ninguno:

| País | Documento | Forma en pantalla |
|---|---|---|
| Guatemala | DPI (CUI) | `0000 00000 0000` — 13 dígitos |
| El Salvador | DUI | `00000000-0` — 9 dígitos |
| Honduras | DNI / Tarjeta de identidad | `0000-0000-00000` — 13 dígitos |
| Nicaragua | Cédula de identidad | `000-DDMMAA-0000X` — 14 caracteres |

La validación de la **primera versión es de forma, no de dígito verificador**:
longitud y caracteres permitidos por país. Los algoritmos de verificación de
cada país se dejan para una segunda pasada, cuando haya documentos reales
contra los cuales probarlos — una fórmula mal transcrita rechazaría documentos
válidos, que es peor que aceptar uno inválido en un flujo donde de todos modos
RH teclea el dato a mano.

Recordatorio que no es parte de esta función pero sí de esta lista: el reloj de
la organización (`src/lib/org-today.ts`) asume UTC-6 fijo porque los cuatro
países están en esa franja sin horario de verano. Un quinto país fuera de ella
rompe ese cálculo.

## Arquitectura

### Pantalla de login (`src/app/login/page.tsx`)

Se conserva el split actual: credenciales a la izquierda, video o foto de marca
a la derecha (`HeroBackgroundMedia`). Cambia solo la columna izquierda, que pasa
a tener dos estados.

**Estado "puerta":** los dos botones, misma jerarquía visual, ambos
`<ActionButton>` en píldora completa. El de Google queda exactamente como está.
El segundo dice "Ingreso por documento" y lleva el ícono `IdCard` de lucide.

**Estado "formulario":** la misma columna, sin navegar a otra ruta. Un cambio de
URL perdería el `?proximo=` que arrastra el proxy. Campos:

- **País** — desplegable con los 4 de `COUNTRIES`. Sin banderas emoji: los
  emojis como íconos están prohibidos por las reglas visuales.
- **Documento** — máscara y `inputMode="numeric"` según el país elegido.
  `autoComplete="off"`.
- **Fecha de nacimiento** — tecleada como `DD/MM/AAAA`, no un date-picker
  nativo: el picker de Android obliga a navegar décadas hacia atrás para llegar
  a un año de nacimiento.
- `<ActionButton>` "Entrar" y un enlace "Volver" al estado anterior.

El estado vive en un componente cliente (`login-form.tsx`); la página sigue
siendo un Server Component que resuelve la organización y el `proximo`.

**Un solo mensaje de error, siempre el mismo:**

> No encontramos a nadie con esos datos. Revisá el documento y la fecha, o
> pedile ayuda a Recursos Humanos.

Nunca distinguir entre "ese documento no existe" y "la fecha no coincide": esa
distinción convierte la pantalla en un verificador de quién trabaja en la
empresa. Tras 5 intentos fallidos sobre el mismo documento:

> Por seguridad bloqueamos este documento por 15 minutos.

Los dos textos van al catálogo (`src/lib/errors/catalog.ts`) con la redacción de
siempre: qué pasó, qué no se perdió, qué puede hacer ahora. No son reportables
(no hay perfil al que atar el reporte cuando el login falla).

### Emisión de la sesión (`POST /api/ingreso/documento`)

Route Handler, no Server Action: necesita rate limit por IP y una respuesta
JSON que el formulario maneje sin navegar. Va en `PUBLIC_PATHS` de
`src/lib/supabase/proxy.ts` — ruta exacta, nunca `/api` completo — por la misma
razón que `/api/postular`: sin eso el proxy lo manda a `/login` con un 307 y el
formulario recibe HTML donde espera JSON.

Secuencia:

1. Zod sobre el cuerpo: país dentro del enum, documento con la forma de ese
   país, fecha válida y no futura.
2. `checkRateLimit()` por IP (`src/lib/rate-limit.ts`, el contador compartido en
   Postgres, no un Map en memoria).
3. Resuelve la organización igual que lo hace hoy la pantalla de login
   (`organizations.slug = 'principal'`, ver `getOrganization()`). El
   formulario no manda organización y no debe: es un dato del servidor.
4. Cliente **service role**: busca en `employee_identities` por
   `(organization_id, country, document_norm)`. Los tres juntos, nunca solo el
   documento — el `UNIQUE` es por organización, así que una búsqueda global
   puede traer la fila de otro inquilino.
5. Si hay fila: verifica `locked_until`, compara `birth_date`, y comprueba que
   el perfil esté `is_active` y tenga rol `colaborador`.
6. Fallo: incrementa `failed_attempts`; al llegar a 5 fija
   `locked_until = now() + 15 min`. Responde **siempre el mismo mensaje y en un
   tiempo comparable** exista o no el documento — si el camino "no existe"
   responde en 5 ms y el camino "existe, fecha mala" en 80 ms, el tiempo mismo
   delata quién trabaja acá.
7. Éxito: `admin.auth.admin.generateLink({ type: "magiclink", email })` para el
   correo sintético, y se consume el `hashed_token` en el mismo servidor con
   `supabase.auth.verifyOtp({ type: "magiclink", token_hash })` usando el
   cliente de sesión. `generateLink` **genera, no envía** — no sale ningún
   correo, y la persona nunca ve un enlace.
8. Limpia `failed_attempts`, actualiza `profiles.last_login_at`, responde
   `{ ok: true, proximo: "/conectados" }`.

Lo que compra este rodeo: la sesión resultante es una sesión de Supabase normal,
con cookies httpOnly y un JWT que trae rol y `organization_id` por el custom
access token hook de siempre. **RLS no cambia de forma y no queda una segunda
vía de autenticación que auditar aparte.** Una cookie firmada por nosotros
habría obligado a reimplementar `auth.uid()` en 40+ políticas.

### Alta del colaborador

Punto de entrada: la ficha de la postulación, cuando `status = 'contratada'`.
Una tarjeta (`<Card>`, sombra sutil, no borde) con el texto "Ya es parte del
equipo" y un `<ActionButton>` "Dar de alta".

El diálogo prellena lo que ya sabemos del candidato y pide el resto:

| Campo | Origen | Obligatorio |
|---|---|---|
| Nombre visible | `candidates.full_name` | sí |
| País | `candidates.country` si existe | sí |
| Tipo y número de documento | tecleado | sí |
| Fecha de nacimiento | tecleada | sí |
| Área | desplegable de `departments` | **sí** |
| Puede publicar en Conectados | casilla | no (default: no) |

Server Action `altaColaborador` (`src/lib/users/colaborador-actions.ts`),
autorizada a **admin o superior** — es un alta de usuario, el mismo umbral que
`/configuracion/usuarios`:

1. Zod sobre todo, incluida la forma del documento según el país y una fecha que
   implique mayoría de edad.
2. `admin.auth.admin.createUser()` con el correo sintético,
   `email_confirm: true` y una contraseña aleatoria que no se guarda en ningún
   lado. Nadie puede iniciar sesión con esa cuenta por contraseña ni por correo:
   el dominio sintético no existe.
3. El trigger `handle_new_user()` crea la fila de `profiles` con el default
   `gestor`. La acción la corrige inmediatamente a `colaborador`, con área,
   país, nombre visible e `is_active`. **No se toca `handle_new_user()`**: hacer
   que lea un rol desde `raw_user_meta_data` abriría la puerta a que el metadata
   del cliente decida el rol, que es justo la clase de agujero que este proyecto
   ya pagó una vez. La ventana entre el INSERT y el UPDATE dura milisegundos y
   durante ella nadie puede autenticarse como esa cuenta.
4. Si cualquier paso posterior falla, se borra el usuario de Auth
   (`admin.auth.admin.deleteUser`) — el mismo patrón que ya usa
   `/auth/callback` para no dejar perfiles huérfanos.
5. Inserta la fila de `employee_identities`.
6. Si se marcó la casilla, inserta en `post_permissions`.
7. Registra el evento en la bitácora de la postulación (`application_events`).
8. Devuelve el texto concreto para el toast: `"Acceso creado para Juan Pérez"`.

Errores previstos, con mensaje propio: documento ya registrado en la
organización (`UNIQUE` violado) y candidato que ya tiene perfil.

**Baja:** no necesita nada nuevo. `is_active = false` desde
`/configuracion/usuarios` y el ingreso por documento deja de funcionar en el
acto, porque el paso 5 del Route Handler lo comprueba en cada intento.

### Qué ve el colaborador

Aterriza en `/conectados`. El fallback de `sanitizeRedirectPath` es `/inicio`,
que este rol no puede ver: el destino se decide por rol, no por el default.

La barra flotante le muestra **Inicio · Notificaciones · Mi cuenta** y **sin
selector de módulos** — `MODULES` se filtra por rol en `src/lib/modules.ts`, de
modo que no se entera de que existe Reclutamiento AJE.

`/mi-cuenta` no muestra correo (el suyo es sintético): en su lugar dice
"Ingresás con tu documento", más su área, su país y su avatar.

**El espejo en SQL, que es la parte que de verdad importa.** Que el menú no
ofrezca vacantes no protege nada. Antes de escribir una línea de interfaz hay
que recorrer política por política y confirmar que un JWT con
`role = 'colaborador'` no lee `jobs`, `applications`, `candidates`, `notes`,
`candidate_tasks`, `interviews` ni `audit_log`. Este proyecto ya encontró una
vez un agujero exactamente de esta forma: `can_decide_application` comparaba
contra `auth_role() <> 'colaborador'` con el rol extinto, y la condición era
verdadera siempre.

## Datos

Tabla nueva **`employee_identities`**:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `profile_id` | uuid, único, FK a `profiles` on delete cascade | |
| `organization_id` | uuid, not null | como toda tabla del proyecto |
| `country` | text, not null | uno de los 4 |
| `document_type` | text, not null | `dpi`/`dui`/`dni`/`cedula` |
| `document_norm` | text, not null | sin guiones ni espacios |
| `birth_date` | date, not null | |
| `failed_attempts` | int, default 0 | |
| `locked_until` | timestamptz, null | |
| `created_by` | uuid, FK a `profiles` | quién dio el alta |
| `created_at` | timestamptz default now() | |

`UNIQUE (organization_id, country, document_norm)`.

RLS deny-by-default, como toda tabla nueva: `SELECT`/`INSERT`/`UPDATE`/`DELETE`
solo para admin o superior **de la misma organización** (`auth.jwt()`, nunca una
consulta a `profiles` — eso causa recursión infinita). El login no la lee con la
sesión del usuario: la lee el Route Handler con service role, antes de que
exista sesión alguna.

La fecha de nacimiento **no** se copia a `profiles` ni a `candidates`. Vive en
un solo lugar, el que está cerrado a todos menos a admin+.

## Errores y estados

- Documento o fecha que no coinciden → mensaje único, ya citado arriba.
- Documento bloqueado → mensaje de bloqueo con el plazo.
- Perfil desactivado → el motivo `inactivo` que ya existe en el catálogo.
- Falla de red al enviar el formulario → el mensaje del catálogo, con reintento.
- Skeletons mientras carga, foco visible, `prefers-reduced-motion` respetado:
  las reglas de siempre.

## Pruebas

- **Zod por país:** un caso válido y dos inválidos (largo de más, carácter no
  permitido) para cada uno de los 4 documentos.
- **Route Handler:** documento inexistente, fecha equivocada, perfil inactivo,
  quinto intento seguido (bloqueo), intento durante el bloqueo, y camino feliz
  (que devuelve cookies de sesión).
- **Alta:** documento duplicado, candidato que ya tiene perfil, fallo a mitad de
  camino (se verifica que no quede usuario de Auth huérfano).
- **RLS, con simulación de JWT dentro de una transacción con rollback**, igual
  que se hizo con los permisos de 2 niveles: un `colaborador` debe recibir 0
  filas de `jobs`, `applications`, `candidates`, `notes` y `candidate_tasks`, y
  sus filas normales de `posts`.

## Riesgos aceptados

1. **La credencial es débil por construcción.** Documento y fecha de nacimiento
   están impresos en el mismo carnet. Quien tenga el documento de un compañero
   puede entrar como él. Mitigan, sin eliminarlo: el alta manual por RH, el
   bloqueo tras 5 intentos y que el rol no vea nada fuera de Conectados.
2. **Nicaragua es el caso extremo:** la cédula lleva la fecha de nacimiento
   dentro del propio número (`000-DDMMAA-0000X`). Para ese país la credencial
   es, en la práctica, un solo dato.
3. **Punto legal abierto:** la política de privacidad vigente dice que los datos
   se usan para el proceso de selección. Usarlos como credencial de acceso es un
   fin distinto. Por decisión del usuario no se toca el texto ni se sube
   `POLITICA_VERSION` en esta fase; queda para revisar con el abogado.
4. **Revivir `colaborador` es reusar un valor con historia.** El paso 1 del plan
   es verificar contra la base —no contra este documento— que ninguna política
   ni función lo nombre hoy.

## Fuera de alcance

- Que el candidato en proceso pueda ver el estado de su postulación.
- Dígitos verificadores de los documentos.
- Recuperación de acceso por autoservicio: si a alguien no le funciona, RH
  corrige el dato desde la ficha. No hay nada que "recuperar" — no hay secreto.
- Ingreso por documento para gestores, admins o super admins.

## Orden de construcción

1. Verificar en la base el estado real del valor `colaborador` (0 políticas, 0
   funciones) y auditar las políticas `SELECT` de reclutamiento contra ese rol.
2. Migración: tabla `employee_identities` con sus políticas.
3. `src/lib/geo/documents.ts` — tipos, máscaras y validación por país.
4. Server Action del alta + diálogo en la ficha de la postulación.
5. Route Handler del ingreso + `PUBLIC_PATHS` + entradas del catálogo de errores.
6. Pantalla de login con los dos botones y el formulario.
7. Filtro de módulos y de ítems de la barra flotante por rol; `/mi-cuenta` sin
   correo.
8. `/code-review`, `/security-review` y actualización de `README.md`,
   `AGENTS.md` (vuelve a haber 4 roles) y `.claude/napkin.md`.
