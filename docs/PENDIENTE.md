# Pendiente — ATS Ferco

_Última actualización: 2026-09-09, al cerrar los dos bloqueantes de producción (key corrupta y protección de Vercel). **Ya no queda ningún bloqueante técnico**: lo que sigue abierto depende del cliente, del abogado o de una decisión suya._

## Estado general

Todo lo del plan maestro original (Fases 0-7) y todo lo construido en paralelo por otra sesión (Fases 8-18: colaboradores por vacante, bitácora, tareas del candidato, competencias, plantillas de mensaje, entrevistas con Calendar, segmentos de candidatos, motor de plantillas de vacante) más el paquete de mejoras posterior (invitaciones por dominio, avatar dinámico, video de login, tour guiado, validación en rojo, país/área como listas desplegables) **ya está en `main` y desplegado en producción**. Ver `README.md` → "Estado del proyecto" para la tabla fase por fase.

Los dos pasos manuales de Supabase que bloqueaban el login (activar el custom access token hook, configurar el proveedor de Google) **ya están hechos** — confirmado en el Dashboard.

Después de Fase 19 se construyó, se verificó y está en `main`: el flujo de
solicitud de vacante rediseñado (plantilla de puesto general, estado `aceptada`,
visibilidad de 3 niveles, admin puede crear la solicitud), el Inicio real (agenda
protagonista, buzón de solicitudes, embudo, informe por reclutador), y los
permisos de 2 niveles por vacante con notificaciones en cada cambio de estado.
Competencias se eliminó del proyecto por decisión del usuario. Detalle en
`docs/database.md` (bloques del inicio) y `.claude/napkin.md`.

## Pendiente real

### 0. ~~El portal no podía recibir postulaciones en producción~~ — Resuelto 2026-09-09

Eran dos cosas encadenadas, las dos ya cerradas:

1. **Enrutamiento**: `/api/postular` no estaba en `PUBLIC_PATHS`
   (`src/lib/supabase/proxy.ts`), así que el proxy mandaba la postulación a
   `/login`. Corregido y desplegado (`039dda4`).
2. **`SUPABASE_SERVICE_ROLE_KEY` corrupta en Vercel**: la key pegada tenía un
   carácter no-ASCII (`•`, U+2022). El síntoma era un `TypeError` de
   `ByteString` en el primer uso real del cliente admin — "character at index 8
   has a value of 8226" — porque la key viaja como header HTTP. El usuario la
   volvió a pegar desde el campo "reveal" de Supabase y se resolvió.

**Verificado el 2026-09-09** con un POST que lleva solo el `job_id` (no muta
nada: la única razón de la prueba es que el cliente admin lee la vacante
*antes* de validar el cuerpo, así que el error de validación ya demuestra que
la lectura funcionó):

```
POST https://demo-atrio.vercel.app/api/postular  -F job_id=<uuid de vacante abierta>
-> 400 {"error":"Correo inválido.","field":"email"}
```

Un `400` de campo prueba que pasó la lectura de la vacante con el cliente admin
(línea 80 de `src/app/api/postular/route.ts`, antes del `safeParse` de la
línea 112). Si la key siguiera rota devolvería `503`.

**Lección, también en `.claude/napkin.md`:** una key con un carácter invisible
no falla como credencial inválida (401/403) — falla como `TypeError` de
`ByteString` en el fetch, que no se parece en nada a un problema de auth. Si un
cliente de Supabase tira `Cannot convert argument to a ByteString`, el
sospechoso es la variable de entorno, no el dato.

### 0b. ~~Vercel Authentication bloqueaba todo el portal público~~ — Resuelto 2026-09-09

`ssoProtection` en modo `all_except_custom_domains` dejaba los 4 dominios
`*.vercel.app` detrás del login de Vercel: un candidato externo chocaba con una
pantalla que no es suya antes de ver `/empleos`.

**Verificado el 2026-09-09:**

```
GET https://demo-atrio.vercel.app/empleos              -> 200
GET https://demo-ats-giancarlo-lam.vercel.app/empleos  -> 200
```

Los dos responden `200` sin sesión. El dominio propio sigue siendo deseable por
marca, pero ya no bloquea el acceso — lo que sí sigue abierto del lado de
Vercel es el punto 0c.

### 0c. Plan Hobby de Vercel, no apto para lanzamiento comercial real

Confirmado vía API de Vercel: team `Lam's Projects`, plan `hobby`. El techo de
concurrencia de funciones (30 000, auto-scaling) es igual en Hobby y Pro — no
es el cuello de botella real. El riesgo real: Hobby es para uso personal
según los términos de Vercel (no uso comercial), logs de runtime de solo 1
hora (justo cuando más hacen falta si algo se cae durante el pico de 1000+
postulantes) y sin soporte prioritario. Subir a Pro antes de lanzar — tiene
costo, decisión del usuario.

### 1. Dominio corporativo aún sin definir

`organizations.allowed_email_domain` sigue vacío. **Ya no es un problema de acceso** (corregido 2026-09-09, hallazgo H1 de `CLAUDE-SECURITY-20260902-095525/REPORT.md` — la lógica era fail-open: sin dominio configurado, el chequeo de invitación se saltaba entero y cualquier cuenta de Google entraba). Ahora es fail-closed: sin dominio, solo entra quien tenga invitación explícita en `profile_invites` (o sea `super_admin`). Falta solo:
- Que el usuario confirme el dominio real de la empresa.
- Cargarlo en `organizations.allowed_email_domain` (hoy solo se puede por SQL/MCP de Supabase — no hay campo en `/configuracion` para editarlo) — mientras tanto, cada persona nueva necesita una invitación manual desde `/configuracion/usuarios`.
- (Opcional, mejora futura) Agregar ese campo a `/configuracion/marca` o una sección nueva, para que el super admin lo edite sin depender de un agente.

### 2. ~~Fase 19 — Endurecimiento y despliegue~~ — Resuelto 2026-09-02

- **Content-Security-Policy**: hecho. Nonce por request vía `src/proxy.ts` (`script-src` estricto, sin `unsafe-inline`/`unsafe-eval` en producción). `style-src` se dejó con `unsafe-inline` a propósito — el acento configurable por organización se aplica hoy con `style={{...}}` inline en muchos puntos (valor dinámico en tiempo real, no se puede resolver con una clase Tailwind fija); nonce-ar cada uno habría sido una migración grande sin forma de verificarla en este entorno (sin navegador con credenciales reales). Detalle en `.claude/napkin.md`.
- **Auditoría completa de políticas RLS**: hecho. Las 17 tablas de Fases 8-18 (candidate_tasks, application_competency_scores, message_templates, interviews, candidate_segments, job_templates y sus 3 tablas satélite, employment_reasons, job_questions/options, application_answers, job_collaborators, audit_log, profile_invites) leídas y contrastadas contra la matriz de roles — todas correctas, deny-by-default, org-scoped. De paso se encontró y se cerró un gap real que quedaba abierto de Fase 7 (no era parte de Fases 8-18, pero es la misma clase de bug): `error_reports_select`/`update`/`delete` y `error_report_messages_select` solo miraban `is_super_admin()`, nunca `organization_id` — verificado el fix con simulación de rol (super_admin de otra organización ahora ve 0 filas).
- **`/security-review` completo**: hecho — sweep de todo `src/` (Zod en Server Actions/Route Handlers, uso de `createAdminClient()`, XSS, inyección SQL, open redirect, rate limiting, autorización en Server Actions). Sin hallazgos.
- Rate limiting y cabeceras básicas: ya estaban hechos.
- **Corrección 2026-09-09**: este sweep no atrapó todo. `CLAUDE-SECURITY-20260902-095525/REPORT.md` (pipeline `claude-security:scan`, panel adversarial de 3 votos, alcance repo completo) encontró 9 hallazgos reales el mismo 2026-09-02, con solapamiento de alcance pero método distinto (IDOR/SSRF vía simulación adversarial, no un sweep de patrones). Estado real hoy: **H1** (login fail-open, arriba) y **M1/M3/M4** (wildcard SSRF en `next.config.ts`, `addJobCollaborator`/`rejectApplication` sin chequeo de organización) corregidos 2026-09-09. **M2/M5** (enumeración de candidatos, sobrescritura de CV) ya estaban corregidos desde el 2026-09-08 (commits `b8ee7da`/`895622c`). **H2/M7** (link de correo a RH con `Host` falsificable si falta `NEXT_PUBLIC_SITE_URL`) sigue abierto, decisión explícita de no bloquear por esto — ver `.claude/napkin.md`.

### 3. Correo real y parseo de CV

- `RESEND_API_KEY` está vacío en este entorno de desarrollo — sin él, ningún correo sale de verdad (el diseño ya contempla esto: `notifyBestEffort()` falla en silencio, nunca rompe una mutación). **Falta confirmar si ya está cargado en las variables de entorno de Vercel** — no es algo que se pueda verificar por MCP.
- `ANTHROPIC_API_KEY` también vacío. El parseo de CV con IA nunca se construyó — quedó fuera de alcance desde la Fase 4 (el reclutador siempre revisa los datos a mano). Sigue siendo v2, no bloquea nada del uso actual.

### 4. ~~Limpieza menor: variables de entorno muertas~~ — Resuelto 2026-09-02

`.env.example` en realidad **nunca llegó al repo** — `.gitignore` tenía `.env*` sin excepción, así que cualquier intento de commitearlo se ignoraba en silencio. En un repo público, eso significa que nadie que clone el proyecto tiene plantilla de qué variables llenar (el `cp .env.example .env.local` del README fallaba). Se agregó `!.env.example` al `.gitignore` y se creó el archivo desde cero, solo con las 6 variables que el código de verdad lee (`process.env.*` grepeado en `src/`) — sin `ALLOWED_EMAIL_DOMAIN` ni `SUPER_ADMIN_EMAIL`, que nunca existieron como variables reales.

### 5. ~~Sacar el rol `colaborador`~~ — Resuelto 2026-09-03

La causa no era `invite-form.tsx` (como decía este documento tres versiones
seguidas) sino los defaults de la base: `profiles.role` y
`profile_invites.role` con DEFAULT `'colaborador'`, y `handle_new_user()`
cayendo a ese rol para todo login sin invitación — o sea, **todo usuario nuevo
nacía con un rol que ya no existía en el producto**. Los tres pasan a `gestor`
(migración `quitar_colaborador_de_los_defaults`).

De paso se cerraron dos huecos que una limpieza de interfaz sola habría dejado:
`updateUserRole` y `createInvite` validaban contra el enum COMPLETO de
Postgres, así que un POST fabricado a mano podía asignar el rol aunque el
desplegable ya no lo ofreciera. Ahora ambos usan `z.enum(ASSIGNABLE_ROLES)`, la
lista blanca de `src/lib/auth/role-labels.ts`.

Verificado en la base: 0 perfiles, 0 invitaciones pendientes, los 2 defaults en
`gestor`, 0 políticas RLS y 0 funciones que lo nombren. Detalle en
`docs/database.md` y `.claude/napkin.md`.

**Ojo con el efecto secundario:** el piso subió. Quien entra sin invitación
queda `gestor` (puede solicitar vacantes), no `colaborador` (solo veía vacantes
públicas y sus referidos). Con el punto 1 de este documento todavía abierto,
cualquier cuenta de Google recibe ese nivel — eso sube la prioridad del dominio
corporativo, no la baja.

### 6. Filtro de plantillas por área — bloqueado en datos del cliente

Un gestor debería ver solo las plantillas de puesto de SU área al solicitar una
vacante. `profiles.department_id` y `job_templates.department_id` existen pero
están sin poblar, así que el filtro no se puede construir ni probar.

Hace falta que el cliente entregue: el listado de áreas, la asignación de cada
persona a su área, la asignación de cada puesto a su área, y la respuesta a
**¿alguien pertenece a más de un área?** (eso decide si la relación es una
columna o una tabla puente).

### 7. Fecha exacta de contratación

`applications` no guarda cuándo pasó a `contratada` — ni columna ni evento en
`application_events`. "Días a contratación" y "contrataciones del mes" en el
Inicio usan `updated_at` como aproximación, documentado en el código como no
garantizado. El arreglo es una columna `hired_at` o loguear el evento en
`hireApplication`; no bloquea nada hoy.

### 8. Política de privacidad — falta el texto aprobado y 4 datos del cliente

La MECÁNICA completa ya está construida y verificada: página pública
`/privacidad`, casilla obligatoria validada con Zod en el servidor, prueba del
consentimiento en `applications.privacy_consent_version` + `privacy_consent_at`,
pie legal en los 3 correos que llegan al candidato, enlace en el pie del portal,
y declaración de autorización en el referido interno.

Lo que falta **no es código**. La página muestra un aviso de "borrador, no
publicado" y `robots: noindex` mientras `src/lib/legal/policy.ts` tenga
marcadores `[PENDIENTE: ...]`. El aviso desaparece solo al llenarlos.

**Cuatro datos que tiene que entregar el cliente:**
1. **Razón social exacta, NIT y domicilio fiscal** del responsable del
   tratamiento. Y si es una entidad para los 4 países o una por país — eso
   cambia el documento.
2. **Correo de contacto para ejercer derechos.** Un candidato externo no tiene
   cuenta; el centro de errores no le sirve. Tiene que ser un buzón atendido:
   el pie de los correos ya no promete "responde a este correo" justamente
   porque ese canal no existe.
3. **Plazo de conservación** de una candidatura no contratada. Sugerencia: 12
   meses desde la última actividad. Sin plazo no se puede escribir la sección 6.
4. **Confirmación de los encargados declarados** (Supabase, Resend, Vercel,
   Google — todos en EE. UU., ya listados en `ENCARGADOS`).

**Y revisión de un abogado antes de publicar.** El texto cubre el denominador
común más estricto de los 4 países, pero los marcos difieren: Nicaragua tiene
Ley 787 de Protección de Datos Personales (2012), la más concreta; Guatemala y
Honduras no tienen ley integral del sector privado; **de El Salvador no se pudo
confirmar el estado vigente** y no se inventó. Eso lo confirma un abogado, no
esta sesión.

**Consentimientos ya registrados bajo el borrador:** cualquier postulación que
entre antes de la aprobación queda con `privacy_consent_version = "0.1-borrador"`.
Al publicar la 1.0 hay que decidir si esas candidaturas necesitan
reconsentimiento — el índice parcial de la migración existe para poder
encontrarlas.

### 9. Retención automática de datos de candidatos

No existe ningún mecanismo de borrado ni expiración. Depende del plazo del punto
8. Una vez definido: un job que elimine candidaturas y sus archivos de Storage
pasado el plazo desde la última actividad. Sin esto, la sección 6 de la política
promete algo que el sistema no cumple.

### 10. ~~Rate limit del endpoint público, a almacenamiento compartido~~ — Resuelto 2026-09-09

Movido a Postgres: tabla `public.api_rate_limits` + función `public.check_rate_limit`
(SECURITY DEFINER, `EXECUTE` revocado a `anon`/`authenticated`/`PUBLIC`, solo
`service_role` puede llamarla — verificado con `has_function_privilege`). El
UPSERT (`INSERT ... ON CONFLICT DO UPDATE`) es atómico entre instancias y
regiones, a diferencia del `Map` anterior. `src/lib/rate-limit.ts` ahora es
`async` y llama `admin.rpc("check_rate_limit", ...)`.

**Gotcha real encontrado al construirlo:** la primera versión puso la función
en `private` (la convención del resto del proyecto para helpers de RLS) y
habría fallado en producción — PostgREST no expone RPC de `private`, así que
`admin.rpc()` nunca la habría encontrado, aunque `execute_sql` la probara bien
en SQL directo. Detalle en `.claude/napkin.md`.

### 11. ~~Bucket `archivos`~~ — Resuelto 2026-09-08

Borrado, objeto y bucket, por decisión del usuario. Antes de borrar se guardó una
copia del único archivo que tenía (`Presentacipon_RH.html`, "Resumen Mensual Mayo
2026 - RH") en `Downloads\Resumen-Mensual-Mayo-2026-RH.html` — el borrado en
Storage no se deshace.

Quedan 3 buckets, los 3 usados por el ATS: `cvs-privado` (privado),
`marca-publico` y `avatares`.

### 12. ~~El 409 de duplicado era un oráculo de enumeración~~ — Resuelto 2026-09-08

Opción B, elegida por el usuario. `POST /api/postular` responde ahora
**exactamente igual** ante una postulación nueva y ante una duplicada (mismo
cuerpo `{"success":true}`, mismo 201), y el aviso "ya habías postulado" va por
correo (`emails/postulacion-duplicada.tsx`), que solo lee quien tiene ese buzón.

**El primer arreglo no alcanzó, y conviene saber por qué.** Igualar la respuesta
dejó el oráculo abierto **por tiempo**: el chequeo temprano de duplicado se
saltaba las subidas de archivos, así que un correo ya postulado respondía en
0,51 s y uno nuevo en 2,69 s. Medido, no teórico. Se cerró **borrando** ese
chequeo temprano: ahora todo envío recorre el mismo camino (buscar candidato →
subir archivos → intentar el insert) y el duplicado lo detecta el
`UNIQUE(job_id, candidate_id)`. La limpieza de los archivos recién subidos va con
`after()` y sin `await`, porque esperarla habría abierto el canal por el otro
lado (el duplicado tardaría dos borrados más que el caso nuevo).

Verificado: 3 duplicados en 2,10 / 1,36 / 1,23 s contra 3 nuevos en 1,90 / 1,69 s
— rangos solapados, sin señal separable. Se paga una subida inútil por cada
duplicado; es el precio de que los dos casos sean indistinguibles.

### 13. Verificar el logo de Google contra sus guidelines

`src/app/login/page.tsx:9` dibuja el "G" oficial en SVG inline. Es **marca
registrada, no copyright**, y usar el logo oficial es lo correcto para "Iniciar
sesión con Google" — pero tiene reglas propias (tamaño mínimo, espacio libre, no
alterar colores, texto aprobado del botón). El uso actual (18×18, colores
oficiales, "Continuar con Google") se ve conforme. Falta contrastarlo contra las
Google Sign-In Branding Guidelines vigentes. Riesgo bajo.

### 14. ~~Nota de licencia en el configurador de marca~~ — Resuelto 2026-09-08

`src/components/configuracion/license-note.tsx`, montado en `BrandImageField` y
`BrandVideoField` — cubre los 6 puntos de subida de `/configuracion/marca` desde
un solo componente. Es lo único que el software puede hacer: verificar la
procedencia de un archivo subido no lo puede comprobar el código.

### 15. ~~Servidor MCP apuntando a la producción de Ferco~~ — Resuelto 2026-09-08

El servidor MCP llamado `supabase` —el de nombre corto, el que cualquier sesión
agarra primero— estaba fijado con `--project-ref=cihcimdzwlmhedpprmhf`, que es la
**plataforma de RH de Ferco en producción**: 170 tablas, 887 usuarios en auth, y
una migración aplicada el mismo 2026-09-08. Tenía `apply_migration` y
`execute_sql` habilitados.

Renombrado a `ferco-produccion` en `~/.claude.json` (backup en
`.claude.json.backup-20260908`). No se borró: si algún día hace falta ese
proyecto sigue disponible, pero ya es imposible confundirlo con el del ATS. Toma
efecto en sesiones NUEVAS — los servidores MCP se cargan al arrancar.

El ATS se opera por el servidor que exige `project_id` en cada llamada, con
`cgudnnlcwcotovcslgzu`.

### 16. Avisos que no llegan: entrevistas y tareas

Pedido del usuario, dejado aparte a propósito el 2026-09-09 para no mezclarlo
con el lote de menciones/kanban/vacantes. Son dos huecos reales:

**Agendar reunión — los internos no se enteran.** `scheduleInterview` guarda
`interview_attendees` y después solo le manda correo **al candidato**. Los
colegas que se agregan como destinatarios no reciben ni campana ni correo.
Hace falta un valor nuevo en `notification_type` (no existe ninguno de
entrevista), una plantilla de correo, y la llamada a `notify()`.

Y tres cosas más del mismo flujo, menores pero reales:
- No hay evento de calendario real ni sala de videollamada: es un enlace
  "agregar a Google Calendar" que cada uno pulsa. El link de Meet/Zoom se pega
  a mano en "Lugar o enlace". (OAuth de Calendar está fuera de alcance por
  decisión del usuario.)
- La hora del correo va en **UTC explícito**, porque no hay columna de zona
  horaria por organización. Para Centroamérica se lee 6 horas corrido si el
  lector no ve el "hora UTC". En una invitación a reunión, confunde.
- No hay recordatorio antes de la reunión.

**Asignar tarea — el asignado no se entera.** `addTask` no llama a `notify()`
en absoluto. Mismo requisito: `notification_type` nuevo (`tarea_asignada`),
plantilla, y la llamada. Es la misma forma que ya quedó construida para
menciones, así que es rápido.

### 17. El kanban recorta el DOM, no la red

`KanbanColumn` topa a 50 tarjetas por columna, pero `getKanbanData` sigue sin
`limit`: el payload RSC de `/vacantes/[id]/pipeline` continúa llevando TODAS las
postulaciones activas. Con el pico de 1000+ postulantes que apunta la auditoría
de lanzamiento, eso son 1000 tarjetas viajando en cada carga para pintar 50.

El tope resolvió lo que estaba a punto de romperse (el DOM y los `<Draggable>`
de dnd, que se arrastran mucho antes). Lo de la red necesita paginación real por
etapa —cursor por `applied_at` y un endpoint para "ver más"— y eso cambia la
forma de `KanbanData`, así que no entraba en este lote.

Nota de orden: `getKanbanData` ahora ordena `applied_at` ASCENDENTE (más
antiguas primero), porque con un tope hace falta un orden determinista y en un
pipeline quien lleva más esperando es por quien hay que actuar. El
`code-reviewer` sugirió descendente (las 50 más recientes); es defendible para
triaje de postulaciones frescas. Si se cambia, cambiar también el comentario de
`kanban-column.tsx`.

### 18. El proyecto no tiene runner de tests

Lo destapó el lote de menciones. `parseMentions` / `activeMentionQuery` son
regex con offsets y posición de cursor — la clase de código que se rompe en
silencio. Se verificaron con 20 comprobaciones (`node --experimental-strip-types`
sobre un script suelto: XSS, correo que no debe abrir el autocompletado,
uuid en mayúsculas, token malformado, nombre con corchetes, cursor antes del
`@`), todas verdes, **pero ese script no quedó en el repo**: `node` exige la
extensión `.ts` en el import y `tsc` la prohíbe (`allowImportingTsExtensions`),
así que dejarlo habría roto el `typecheck` del CI.

El CI que agregó la otra sesión corre lint + typecheck + build. Falta un runner
(vitest es el que menos fricción tiene con este stack) y, con él, mover esas 20
comprobaciones al repo. Mientras no exista, la lógica pura del proyecto no
tiene red.

### 19. ~~Techo de Vercel de 4.5 MB vs. el límite de 10 MB del código~~ — Resuelto 2026-09-09

Vercel corta cualquier request de función en 4.5 MB a nivel de plataforma —
fijo, no configurable, no cambia con Fluid Compute. `MAX_CV_BYTES` (10 MB) y
`MAX_ADDITIONAL_FILES` (5, sin techo individual real) permitían armar un
envío que la plataforma rechaza con un 413 crudo ANTES de que el código
corriera — el candidato veía "se perdió la conexión", atribuyendo a su red un
problema que era del tamaño del archivo.

Bajado a techos reales: CV 4 MB, cada archivo adicional 1 MB, más un tope
combinado de 4.3 MB (CV + adicionales juntos) chequeado en el cliente ANTES
de subir y de nuevo en el servidor. `application-form.tsx` ya no asume que la
respuesta es JSON (un 413 de la plataforma no lo es) — cae a un mensaje según
el código de estado en vez de un catch genérico.

**Arreglo real, no hecho todavía:** subir CV directo del navegador a Storage
con URL firmada (mismo patrón que ya usa la subida de video de marca) —
saca el archivo del cuerpo de la función y permite CVs más pesados de
verdad. Quedó fuera de esta pasada por ser un cambio de arquitectura del
flujo público de postulación, no un ajuste de límites.

### 20. ~~Validación de archivo solo por Content-Type declarado~~ — Resuelto 2026-09-09

`cvFile.type !== "application/pdf"` (y el equivalente para adicionales) solo
mira la etiqueta que manda el navegador — el endpoint es público, nada obliga
a pasar por el `<input type="file">` real. `src/lib/jobs/validate-file-signature.ts`
agrega un chequeo de los primeros bytes reales del archivo (`%PDF` para PDF,
cabeceras JPEG/PNG) antes de aceptarlo, sin depender de ninguna librería nueva.

### 21. CI/CD — agregado 2026-09-09

No existía `.github/workflows` — nada corría lint/typecheck/build automático
en un PR. Agregado `.github/workflows/ci.yml`: lint + typecheck + build en
cada PR contra `main`, con variables `NEXT_PUBLIC_*` de relleno (no secretas)
solo para que el build no falle si algo las lee en build time.

### 22. Región de la función vs. región de la base — agregado 2026-09-09

Sin `vercel.json`, la función corría en la región default de Vercel
(`iad1`, Virginia) mientras Supabase está en `us-west-2`. Agregado
`vercel.json` con `"regions": ["pdx1"]` (Portland, la más cercana a
`us-west-2` entre las disponibles en el plan actual) — reduce la latencia
cruzada en cada una de las ~6 consultas seguidas que hace `/api/postular`.

### 23. `/empleos` y `/empleos/[slug]` sin caché — investigado 2026-09-09, NO se pudo resolver sin tocar CSP

Intento: cambiar el cliente de sesión (`createClient()`, atado a `cookies()`)
por uno sin cookies (`src/lib/supabase/public.ts`, `createPublicClient()` +
`getPublicOrganization()`) y agregar `export const revalidate = 60`, para que
estas dos páginas de solo lectura pública no le pegaran a Postgres en cada
visita.

**No funcionó, y quedó documentado por qué en vez de reportarlo como
resuelto sin verificar:** el build sigue marcando ambas rutas `ƒ (Dynamic)`.
Causa real: el nonce de CSP por request (`src/proxy.ts`, Fase 19) fuerza
renderizado 100% dinámico en TODO el sitio vía el matcher del proxy — un
`revalidate` ahí no tiene efecto (o serviría un nonce viejo, peor). Se dejó
el cliente sin cookies (mejora real y sin riesgo: la página ya no depende de
sesión para datos públicos) pero se sacó el `revalidate`, que era ruido
engañoso.

**Para lograr caché real haría falta** sacar `/empleos*` del alcance del
nonce de CSP en el matcher de `proxy.ts` — eso debilita CSP justo en la
superficie pública que va a recibir el tráfico de candidatos, así que es una
decisión de seguridad, no un ajuste de cache. No se hizo sin que el usuario
la pida explícitamente.

### 24. Índices en llaves foráneas sin cubrir — Resuelto 2026-09-09

27 llaves foráneas marcadas por el advisor de performance de Supabase sin
índice (`application_answers`, `job_templates` y sus tablas satélite,
`interviews`, `candidate_tasks`, `profile_invites`, etc. — tablas
administrativas, ninguna en el camino caliente de `/api/postular`). Agregados
vía migración `indices_fk_faltantes` — puramente aditivo, no toca RLS.

### 25. Pendiente, requiere el dashboard — no lo puede hacer el agente

- **Leaked password protection** (Supabase Auth → Policies) sigue
  desactivado — HaveIBeenPwned check. Un toggle, sin código de por medio.
- **Extensión `pg_net` en el esquema `public`**: aceptado, Postgres no
  permite moverla (`ALTER EXTENSION ... SET SCHEMA` falla con `0A000`).
- **RLS con políticas permisivas repetidas** (`jobs` tiene 3 políticas de
  SELECT que se evalúan todas para `authenticated`, patrón similar en
  `profiles`/`departments`/etc.) — real pero de bajo impacto con el volumen
  de hoy, y tocar la lógica de una política sin poder simular cada rol a
  fondo en esta pasada es más riesgo del que vale la pena correr sin pedirlo
  explícitamente. Documentado, no corregido.

## Cómo verificar que sigue al día

1. `select allowed_email_domain from organizations;` — si ya no es `null`, el punto 1 de arriba (dominio corporativo) está resuelto.
2. Punto 5 resuelto. Para confirmar que no volvió: `grep -rn "colaborador" src/`
   solo debe dar `ROLE_LABEL` (exhaustivo a propósito), `database.types.ts`
   (generado) y comentarios; ningún `z.enum` ni `Object.keys(ROLE_LABEL)`.
3. `select count(*) from profiles where department_id is not null;` — si es > 0,
   el punto 6 se puede desbloquear.
4. `curl -s -o /dev/null -D - <sitio>/empleos | grep -ic set-cookie` — si deja
   de ser 0, alguien agregó analítica o un tercero y hace falta banner de
   consentimiento (ver la regla de cookies en `AGENTS.md`).
5. Abrir `/privacidad`: si NO muestra el aviso rojo de "borrador, no publicado",
   el punto 8 está resuelto.
6. `.claude/napkin.md` tiene el detalle técnico de cada hallazgo real detrás de estos pendientes.


### 26. Explícitamente fuera de alcance (no son pendientes)

- **Agente de match/precalificación con IA** — excluido de forma permanente por
  decisión del usuario. No volver a proponerlo.
- **OAuth real de Google Calendar** — se revisó a fondo si ya existía: no, nunca
  se construyó. Las entrevistas generan un enlace "agregar a calendario", no un
  evento real ni una sala de reunión. El usuario decidió dejarlo fuera.
- **Módulo de bajas/terminaciones** — planteado y descartado en la misma sesión.
- **Refresco visual del panel interno de administración** — pausado por el
  usuario ("pausemos"), no cancelado.
- **Assets de portada reales de la marca** — el demo usa imágenes genéricas a
  propósito hasta que el cliente entregue las suyas.

### 27. V2 del plan maestro (no urgente, no empezado)

- Scorecards de entrevista estructurada con rúbrica fija.
- Dashboard de métricas (time-to-hire, conversión por etapa, fuente de contratación).
- Firma de ofertas.
