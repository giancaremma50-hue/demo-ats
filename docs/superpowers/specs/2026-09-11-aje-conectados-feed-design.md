# AJE Conectados — Feed real — Design

**Contexto:** Task 20 (rama `claude/aje-conectados-feed-ch7xhv`) cerró el backend completo de AJE Conectados (tablas, RLS, RPCs de reacción/encuesta, Server Actions básicas, Realtime, bucket de adjuntos, cron de liberación) y un placeholder real en `/conectados`. Quedó explícitamente fuera de esa fase, para esta iteración: el compositor, las tarjetas de post, los comentarios, las encuestas, los adjuntos y las @menciones con autocompletado.

**Decisión de alcance (usuario, 2026-09-11):** "todo de una vez" — el corte completo del feed en una sola fase: compositor completo (texto + adjuntos + encuesta + programar + audiencia), tarjetas, reacciones, comentarios con reacciones, y @menciones con autocompletado en compositor y comentarios. Autorizado a trabajar en modo automático: migraciones directas (MCP `apply_migration`) y push directo a `claude/aje-conectados-feed-ch7xhv` por fase verificada, sin esperar aprobación intermedia.

## Fuera de alcance (diferido de nuevo, con razón)

- **Editar una publicación/comentario ya creado.** La columna `posts.edited` existe pero no se pidió edición, solo creación/borrado. RLS ya permite `update` propio, así que no es un bloqueo técnico para una fase futura.
- **Cerrar una encuesta manualmente.** `vote_post_poll` permite recotar el voto siempre; no hay estado "cerrada". Encaja con un muro interno informal, no una votación formal.
- **Plantillas de correo para `post_nuevo`/`post_mencion`/`post_reaccion`/`post_comentario`.** Ya se notifican in-app (o ya lo hacían para los tres primeros); agregar HTML de correo es trabajo aparte y no se pidió. Por eso estos 4 tipos **no** entran a `PREFERENCE_TYPES` en esta fase — agregarlos ahí sin correo real dejaría un interruptor de "correo" decorativo en `/mi-cuenta` (regla ya documentada en el napkin sobre este mismo punto). Se agregan cuando exista la plantilla, no antes.
- **Rehacer todo el mecanismo de menciones desde cero.** Se reutiliza el ya construido y probado en notas de candidatos (ver abajo).

## Modelo de datos que el backend deja abierto (se fija acá)

`posts.attachments` y `posts.poll` son `jsonb` sin forma fija — Task 13-14 no las usó. Se fija:

```ts
type Attachment = { path: string; mimeType: string; name: string; size: number };
// posts.attachments: Attachment[]

type PollOption = { label: string; votes: string[] }; // votes = profile ids
type Poll = { options: PollOption[] };
// posts.poll: Poll | null
```

`Poll.options[i].votes` calza exacto con `vote_post_poll` (accede por índice, nunca por un id de opción) — no hace falta un campo `id` por opción.

`path` de un adjunto sigue la convención ya fijada en la migración de Storage (Task 11): `{organization_id}/{post_id}/{uuid}-{filename}`. Como el `post_id` solo existe después de crear la fila, subir adjuntos es un segundo paso: crear el post (sin adjuntos) → subir cada archivo → un `update` agrega la entrada a `attachments`. `posts_update_own` (RLS, Task 5) ya cubre ese `update` (autor o admin+), no hace falta ninguna migración nueva.

**Signed URLs con TTL de 1 hora, no 60 s.** La regla de 60 s en `AGENTS.md` es para CVs (descarga puntual y sensible de un candidato externo). Un adjunto de un post del muro interno se ve repetidas veces mientras alguien scrollea el feed durante su sesión de trabajo — 60 s rompe la imagen a medio scroll sin ninguna ganancia real de privacidad (el bucket sigue privado, RLS sigue decidiendo en cada `createSignedUrl` quién puede pedirla). Se generan al leer (`getPosts`/`getPostComments`), con el cliente de sesión del usuario (no admin), para que la propia política de Storage decida.

## Arquitectura del feed

`src/app/(app)/conectados/page.tsx` (Server Component) reemplaza el placeholder: carga en paralelo `getPosts()`, `getDepartmentsForAudience()`, `getProfilesForSelect()` (ya existe en `departments/get-departments-admin.ts`, se reusa tal cual para el autocompletado de menciones — mismo shape `{id, display_name}` que ya consume `NoteForm`), y el propio `profile` (`requireProfile()`, ya da `role`/`department_id`). Todo eso se pasa como props a un client component `ConectadosFeed`.

`ConectadosFeed` (client) es dueño del estado: `posts` (inicializado desde el server), abre un canal de Supabase Realtime (`postgres_changes` sobre `public.posts` y `public.post_comments`, filtrado por `organization_id`) y aplica INSERT/UPDATE/DELETE al estado local por id. Encima renderiza `<PostComposer>` (si `canPost`) y la lista de `<PostCard>`.

**Se elimina `revalidatePath("/conectados")` de las 4 Server Actions existentes.** `/conectados` tiene `loading.tsx` (Suspense boundary) — el napkin del proyecto ya documenta, con otro módulo, que revalidar la ruta que se está viendo puede remontar el árbol de cliente y borrar estado local que no vive en la URL (acá: el feed cargado, un borrador de comentario a medio escribir, el estado de qué post tiene los comentarios expandidos). Con Realtime ya cubriendo la propagación a todos los que miran el feed, `revalidatePath` es puro riesgo sin beneficio en esta ruta. En su lugar:

- `createPost`/`addComment` devuelven la fila completa creada; quien la creó la antepone/inserta de inmediato en su propio estado (optimista), sin esperar el eco de Realtime.
- `toggleReaction`/`votePoll` aplican el cambio de forma optimista en el cliente (togglear el propio voto/reacción) y la actualización autoritativa llega por Realtime (UPDATE de `posts`/`post_comments`), que siempre pisa el valor optimista.
- Deduplicación por `id` al mezclar: si el eco de Realtime llega después de la inserción optimista propia, se ignora (ya está).

## Permisos en la UI (nunca la única fuente, RLS decide igual)

- `canPost`: `post_permissions.can_post` (fila propia) **o** admin+. Sin esto, no se renderiza `<PostComposer>` — nada de un formulario deshabilitado fingiendo que existe.
- `canComment`/`canReact`: mismo patrón, default `true` si no hay fila (columna con default). Casi todos pueden comentar/reaccionar aunque no publiquen — es el patrón "comunicado desde arriba, participa todo el mundo".
- Audiencia del compositor: cualquiera con `canPost` puede dejar el post público o restringirlo a **su propio** departamento; solo admin+ puede elegir cualquier departamento u otros roles destinatarios (calca `posts_insert`). Programar (`publishAt`) solo admin+ (calca la misma política).
- Borrar: `<DeleteButton>` en un post/comentario visible solo si `author_id === profile.id` o admin+ (calca `posts_delete_own`/`post_comments_delete`); comentarios también borrables por el dueño del post (moderación), igual que RLS.

## Componentes nuevos

- `post-composer.tsx` — textarea con overlay de menciones (mismo algoritmo que `NoteForm`, ver abajo), selector de audiencia (departamento + roles, condicionado por rol), toggle "Agregar encuesta" (2-6 opciones), input de fecha/hora "Programar" (admin+), selector de archivos (preview local antes de publicar). Publica con `createPost`, luego sube adjuntos uno por uno con `uploadPostAttachment(postId, formData)` y los agrega al estado local del post recién creado (no espera Realtime para esto tampoco).
- `post-card.tsx` — autor (avatar circular, nombre, cargo, hora relativa vía `date-fns` `formatDistanceToNow` + locale `es`, mismo patrón que `notification-item.tsx`), insignia de audiencia si `department_id`/`roles` no son null ("Solo Recursos Humanos", transparencia sobre quién más lo ve), contenido con menciones resaltadas, `<AttachmentGallery>`, `<PollWidget>` si `poll` no es null, `<ReactionBar>`, botón "Comentarios (n)" que expande `<CommentThread>`, `<DeleteButton>` si aplica.
- `reaction-bar.tsx` — 4 botones círculo (like/corazon/aplauso/fuego), resalta la reacción propia, cuenta por tipo. Cada click llama `toggleReaction` (no es exactamente un ActionButton de "mutación con éxito"; es un toggle binario de baja fricción como un like de red social — se mantiene con estado de `pending` propio vía `useTransition`, sin bloquear el resto de la tarjeta, y sin `notifySuccess` — un toast por cada like sería ruido, no confirmación útil; la propia UI (ícono resaltado) ya es la confirmación).
- `poll-widget.tsx` — opciones con barra de % y conteo (`tabular-nums`), vota con `votePoll`; si el usuario ya votó, su opción se marca.
- `comment-thread.tsx` — lista de comentarios (autor, hora, contenido con menciones, `<ReactionBar>` a escala de comentario, `<DeleteButton>` si aplica) + un form de comentario nuevo (mismo textarea-con-overlay, versión más chica, sin audiencia/adjuntos/encuesta).
- `attachment-gallery.tsx` — grilla de imágenes, `<video controls>`, o tarjeta de descarga para PDF, según `mimeType`.

**Menciones — reuso, no reinvención.** El napkin del propio proyecto ya registra que el mismo hueco de seguridad (UUID de mención sin validar organización) se reintrodujo en Conectados por no mirar el precedente de `src/lib/applications/mentions.ts`. En vez de copiar funciones puras otra vez: ese archivo se **mueve** a `src/lib/mentions.ts` (es genérico, no tiene nada específico de postulaciones — usa `nombre`/`profileId`, nada de `applicationId`) y `src/lib/applications/mentions.ts` pasa a ser un re-export desde ahí para no romper los imports existentes. `post-composer.tsx` y `comment-thread.tsx` importan el algoritmo de overlay (adaptado del patrón ya probado en `NoteForm`, con sus propios bugs ya corregidos: mismo string en las dos capas, sin negrita en vivo, `coalesce`-equivalente donde aplique) desde ese único lugar. `filterMentionsInOrg` en `src/lib/conectados/actions.ts` (Task 14) ya hace la validación de pertenencia a la organización — eso no cambia, se sigue usando.

## Server Actions — cambios

- `createPost`: agrega `poll` al insert (validado por un `PollSchema` nuevo en `schema.ts`: 2-6 opciones, texto 1-120 caracteres cada una), devuelve la fila completa (`select("*")`), quita `revalidatePath`.
- `addComment`: devuelve la fila completa, quita `revalidatePath`, **agrega** una notificación `post_comentario` al autor del post (si no es quien comenta) — el tipo de enum ya existe desde Task 2 y se dejó sin usar a propósito hasta que hubiera UI real; ahora la hay.
- `toggleReaction`/`votePoll`: quitan `revalidatePath`.
- **Nuevas:** `deletePost(postId)`, `deleteComment(commentId)` (delegan al RLS de `delete`, sin lógica de permisos propia — la política ya es la fuente de verdad), `uploadPostAttachment(postId, formData)` (valida mime/tamaño igual que `uploadAvatar`, sube a `conectados-adjuntos/{org}/{postId}/{uuid}-{filename}`, hace `update` de `posts.attachments`).

## Verificación

Mismo límite que Task 20: el login sigue siendo exclusivamente Google OAuth sin bypass de desarrollo, así que un click-through real en el navegador vuelve a quedar pendiente para el usuario. Se compensa con: `npm run typecheck`/`lint` en cada tarea, `npm run dev` para confirmar que compila y sirve, y `/code-review` antes de cada commit (regla no negociable). No se inventa un bypass de auth para "probarlo" — sería un hueco de seguridad nuevo por conveniencia de verificación.
