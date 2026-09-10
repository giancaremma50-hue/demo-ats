# AJE Conectados — Backend + Selector de Módulos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar el módulo "AJE Conectados" (muro social interno, adaptado de `FERCONECTADOS_ARQUITECTURA.md`) al esquema real de este ATS — tablas, RLS, RPCs, Realtime, bucket de Storage, capa de datos TS — más el selector de módulos en el menú flotante que le da entrada. Todo se aplica directo contra el único proyecto Supabase conectado (`cgudnnlcwcotovcslgzu`, decisión explícita del usuario tras conocer el costo/riesgo de un branch aislado). Nada se hace push a `main` — todo vive en la rama local `feature/aje-conectados`.

**Architecture:** 3 tablas nuevas (`posts`, `post_comments`, `post_permissions`) con `organization_id` obligatorio y RLS vía los helpers de `private.*` que YA existen en este proyecto (lectura de `auth.jwt()`, nunca de `profiles` — regla dura del proyecto). El módulo reusa `public.notifications`/`notification_preferences` (ya existen) a través de la función `notify()` que YA existe en `src/lib/notifications/notify.ts` — nada de RPCs que inserten notificaciones "bypaseando un portero" como en el doc original: acá no hay portero, `notify()` es el único punto de entrada. Las mutaciones son Server Actions (`"use server"`, cliente con sesión vía `@/lib/supabase/server`), siguiendo el mismo patrón que `src/lib/departments/actions.ts`. El selector de módulos vive en `src/lib/modules.ts` + un `Popover` (Radix, ya instalado) en `floating-nav.tsx`.

**Tech Stack:** Next.js 16 (App Router) + TypeScript + Supabase (Postgres 17, `@supabase/ssr`) + Zod + `@radix-ui/react-popover` + `lucide-react`. Migraciones: no hay `supabase/migrations/` local — se aplican con la tool MCP `apply_migration` contra `project_id = cgudnnlcwcotovcslgzu` (no hay commit de git para estas; el "commit" de cada tarea de base de datos es una verificación con SQL/`get_advisors`, no un `git commit`).

**Convención de nombres verificada en vivo (no derivar de `FERCONECTADOS_ARQUITECTURA.md`, ese doc es de OTRO proyecto):** tablas/columnas en inglés, valores de enum en español (`notification_type` ya tiene `nueva_postulacion`, `cambio_etapa`, etc.), nombres de migración en `snake_case` sin prefijo numérico (estilo reciente: `add_message_templates`, `create_candidate_tasks`).

---

### Task 1: JWT — agregar `department_id` al custom access token hook

**Por qué esta tarea existe:** las políticas RLS de `posts` necesitan saber el departamento del que consulta, sin tocar `profiles` (regla dura del proyecto, `AGENTS.md`: "las políticas leen `auth.jwt()`, nunca consultan `profiles` — eso causa recursión infinita", ya se rompió antes en este proyecto: migraciones `24_fix_candidates_applications_rls_recursion`, `26_harden_profiles_super_admin_race`). `organization_id` y `app_role` ya viajan en el JWT con este mecanismo — `department_id` se agrega igual.

**RIESGO ALTO — esta función corre en CADA login/refresh de token de TODA la app, no solo Conectados.** Si se rompe, se rompe la autenticación de todos. Verificar con cuidado antes de seguir.

**Files:**
- DB (vía MCP `apply_migration`, sin archivo local)

- [x] **Paso 1: Confirmar la definición actual del hook (ya verificada en esta sesión)**

Definición actual, para referencia — NO ejecutar esto, solo confirmar que sigue igual antes de reemplazarla:

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  claims jsonb;
  v_role public.app_role;
  v_org_id uuid;
begin
  select p.role, p.organization_id into v_role, v_org_id
  from public.profiles p
  where p.id = (event->>'user_id')::uuid;

  claims := coalesce(event->'claims', '{}'::jsonb);

  if v_role is not null then
    claims := jsonb_set(claims, '{app_metadata,app_role}', to_jsonb(v_role::text), true);
    claims := jsonb_set(claims, '{app_metadata,organization_id}', to_jsonb(v_org_id::text), true);
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$function$
```

Ejecutar (solo lectura, para confirmar):
```sql
select pg_get_functiondef(oid) from pg_proc where proname = 'custom_access_token_hook';
```
Expected: coincide exactamente con lo de arriba. Si no coincide, DETENERSE y avisar — alguien cambió el hook desde que se auditó en esta sesión.

- [x] **Paso 2: Aplicar la migración `add_department_id_to_access_token_hook`**

Vía `apply_migration` (project_id `cgudnnlcwcotovcslgzu`, name `add_department_id_to_access_token_hook`):

```sql
create or replace function public.custom_access_token_hook(event jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  claims jsonb;
  v_role public.app_role;
  v_org_id uuid;
  v_department_id uuid;
begin
  select p.role, p.organization_id, p.department_id
    into v_role, v_org_id, v_department_id
  from public.profiles p
  where p.id = (event->>'user_id')::uuid;

  claims := coalesce(event->'claims', '{}'::jsonb);

  if v_role is not null then
    claims := jsonb_set(claims, '{app_metadata,app_role}', to_jsonb(v_role::text), true);
    claims := jsonb_set(claims, '{app_metadata,organization_id}', to_jsonb(v_org_id::text), true);
    -- v_department_id puede ser NULL (nadie asignado) — to_jsonb(NULL) es SQL NULL,
    -- y jsonb_set con un valor NULL destruye TODO el jsonb de claims (es STRICT).
    -- Por eso el `case`: si es null, se guarda el literal JSON null, nunca SQL NULL.
    claims := jsonb_set(
      claims, '{app_metadata,department_id}',
      case when v_department_id is null then 'null'::jsonb else to_jsonb(v_department_id::text) end,
      true
    );
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$function$;
```

- [x] **Paso 3: Verificar con un perfil real que tenga `department_id`**

```sql
select id, department_id from public.profiles where department_id is not null limit 1;
```

Tomar ese `id`, simular el hook a mano. **El `claims` de prueba tiene que traer `app_metadata` ya presente (aunque vacío) — GoTrue siempre lo manda así antes de invocar el hook.** Con `claims: {}` a secas (sin `app_metadata`), `jsonb_set(claims, '{app_metadata,app_role}', ..., true)` hace *no-op* y devuelve `{}`: `create_missing` en `jsonb_set` solo crea el ÚLTIMO nivel del path, nunca los intermedios — si `app_metadata` no existe como objeto, jamás se crea. Se confirmó a mano en esta sesión (probando primero con `claims: {}` se veía `claims` vacío pese a que `v_role` sí se leía bien de `profiles`; con `app_metadata: {}` semilla, funcionó):

```sql
select public.custom_access_token_hook(
  jsonb_build_object(
    'user_id', '<id-de-arriba>',
    'claims', jsonb_build_object('app_metadata', '{}'::jsonb, 'user_metadata', '{}'::jsonb, 'aud', 'authenticated')
  )
);
```
Expected: el jsonb resultante trae `claims.app_metadata.department_id` con el UUID correcto (como string), y `app_role`/`organization_id` siguen presentes como antes.

- [x] **Paso 4: Verificar el caso NULL (perfil sin departamento)**

```sql
select id from public.profiles where department_id is null limit 1;
select public.custom_access_token_hook(
  jsonb_build_object(
    'user_id', '<id-sin-depto>',
    'claims', jsonb_build_object('app_metadata', '{}'::jsonb, 'user_metadata', '{}'::jsonb, 'aud', 'authenticated')
  )
);
```
Expected: `claims.app_metadata.department_id` es JSON `null` (no ausente, no rompe el resto de `claims` — `app_role`/`organization_id` siguen ahí).

**Nota operativa:** las sesiones YA ABIERTAS no ven el claim nuevo hasta que su token refresque (o vuelvan a loguearse). Para probar en el navegador local, cerrar sesión y volver a entrar.

---

### Task 2: Helper `private.auth_department_id()` + enum de notificaciones

**Files:**
- DB (vía MCP `apply_migration`)

- [x] **Paso 1: Aplicar migración `add_auth_department_id_helper`**

```sql
create or replace function private.auth_department_id()
returns uuid
language sql
stable security definer
set search_path to ''
as $function$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'department_id', '')::uuid;
$function$;

revoke all on function private.auth_department_id() from public, anon;
grant execute on function private.auth_department_id() to authenticated;
```

- [x] **Paso 2: Verificar que compila y no rompe el schema `private`**

```sql
select private.auth_department_id();
```
Expected: corre sin error (devuelve `null` al ejecutarse fuera de un request autenticado real, eso es correcto — no hay JWT en este contexto de consola SQL).

- [x] **Paso 3: Aplicar migración `add_notification_types_conectados`**

`ALTER TYPE ... ADD VALUE` no puede usarse en la misma transacción en la que luego se referencia el valor — esta migración SOLO agrega valores, no los usa, así que es segura sola:

```sql
alter type public.notification_type add value if not exists 'post_nuevo';
alter type public.notification_type add value if not exists 'post_mencion';
alter type public.notification_type add value if not exists 'post_reaccion';
alter type public.notification_type add value if not exists 'post_comentario';
```

- [x] **Paso 4: Verificar los valores nuevos**

```sql
select enumlabel from pg_enum where enumtypid = 'public.notification_type'::regtype order by enumsortorder;
```
Expected: incluye `post_nuevo`, `post_mencion`, `post_reaccion`, `post_comentario` además de los 7 que ya existían.

---

### Task 3: Tablas `posts`, `post_comments`, `post_permissions`

**Files:**
- DB (vía MCP `apply_migration`)

- [x] **Paso 1: Aplicar migración `create_conectados_tables`**

```sql
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  author_title text not null default '',
  author_avatar_url text,
  department_id uuid references public.departments(id) on delete set null,
  roles public.app_role[],
  publish_at timestamptz,
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  poll jsonb,
  reactions jsonb not null default '{}'::jsonb,
  mentions uuid[] not null default '{}',
  edited boolean not null default false,
  created_at timestamptz not null default now()
);

comment on column public.posts.department_id is
  'NULL = público, visible para toda la organización. Con valor = solo ese departamento.';
comment on column public.posts.roles is
  'Roles destinatarios DENTRO del departamento ya elegido. NULL = todos. Solo restringe, nunca amplía.';
comment on column public.posts.publish_at is
  'NULL = ya publicado. Con valor futuro = programado: solo lo ve su autor hasta que el cron lo libera.';

alter table public.posts add constraint posts_roles_check
  check (
    roles is null
    or (cardinality(roles) > 0 and roles <@ array['gestor','admin','super_admin']::public.app_role[])
  );

create index posts_org_created_idx on public.posts (organization_id, created_at desc);
create index posts_department_idx on public.posts (department_id) where department_id is not null;

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  author_title text,
  author_avatar_url text,
  body text not null,
  mentions uuid[] not null default '{}',
  reactions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index post_comments_post_idx on public.post_comments (post_id, created_at asc);

create table public.post_permissions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  can_post boolean not null default false,
  can_comment boolean not null default true,
  can_react boolean not null default true
);

comment on table public.post_permissions is
  'Permiso por persona, no por rol. Fila ausente = comportamiento por defecto (no puede publicar, sí comentar/reaccionar).';
```

- [x] **Paso 2: Verificar**

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('posts','post_comments','post_permissions');
```
Expected: las 3 filas.

---

### Task 4: Private helpers de permisos/visibilidad de Conectados

**Files:**
- DB (vía MCP `apply_migration`)

- [x] **Paso 1: Aplicar migración `conectados_private_helpers`**

```sql
create or replace function private.can_post_to_communications()
returns boolean
language sql stable security definer
set search_path to ''
as $function$
  select
    (select private.is_admin_or_above())
    or coalesce((select can_post from public.post_permissions where profile_id = (select auth.uid())), false);
$function$;

create or replace function private.can_comment_on_posts()
returns boolean
language sql stable security definer
set search_path to ''
as $function$
  select
    (select private.is_admin_or_above())
    or coalesce((select can_comment from public.post_permissions where profile_id = (select auth.uid())), true);
$function$;

create or replace function private.can_react_to_posts()
returns boolean
language sql stable security definer
set search_path to ''
as $function$
  select
    (select private.is_admin_or_above())
    or coalesce((select can_react from public.post_permissions where profile_id = (select auth.uid())), true);
$function$;

-- Reusado por la RLS de post_comments y por las RPCs de reacciones/encuesta:
-- misma regla que posts_select, para que un comentario nunca sea legible si
-- su post padre no lo es.
create or replace function private.can_view_post(p_post_id uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and p.organization_id = (select private.auth_org_id())
      and (
        p.author_id = (select auth.uid())
        or (
          (p.publish_at is null or p.publish_at <= now())
          and (
            (select private.is_admin_or_above())
            or (
              (p.department_id is null or p.department_id = (select private.auth_department_id()))
              and (p.roles is null or (select private.auth_role()) = any(p.roles))
            )
          )
        )
      )
  );
$function$;

revoke all on function private.can_post_to_communications() from public, anon;
revoke all on function private.can_comment_on_posts() from public, anon;
revoke all on function private.can_react_to_posts() from public, anon;
revoke all on function private.can_view_post(uuid) from public, anon;
grant execute on function private.can_post_to_communications() to authenticated;
grant execute on function private.can_comment_on_posts() to authenticated;
grant execute on function private.can_react_to_posts() to authenticated;
grant execute on function private.can_view_post(uuid) to authenticated;
```

- [x] **Paso 2: Verificar que las 4 funciones existen**

```sql
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and proname like '%post%';
```
Expected: `can_post_to_communications`, `can_comment_on_posts`, `can_react_to_posts`, `can_view_post`.

---

### Task 5: RLS — `posts`

**Files:**
- DB (vía MCP `apply_migration`)

- [x] **Paso 1: Aplicar migración `conectados_rls_posts`**

```sql
alter table public.posts enable row level security;

create policy posts_select on public.posts for select
using (
  organization_id = (select private.auth_org_id())
  and (
    author_id = (select auth.uid())
    or (
      (publish_at is null or publish_at <= now())
      and (
        (select private.is_admin_or_above())
        or (
          (department_id is null or department_id = (select private.auth_department_id()))
          and (roles is null or (select private.auth_role()) = any(roles))
        )
      )
    )
  )
);

create policy posts_insert on public.posts for insert
with check (
  organization_id = (select private.auth_org_id())
  and (select private.can_post_to_communications())
  and (publish_at is null or (select private.is_admin_or_above()))
  and (
    department_id is null
    or (select private.is_admin_or_above())
    or department_id = (select private.auth_department_id())
  )
);

create policy posts_update_own on public.posts for update
using (author_id = (select auth.uid()) or (select private.is_admin_or_above()))
with check (
  (author_id = (select auth.uid()) or (select private.is_admin_or_above()))
  and (publish_at is null or (select private.is_admin_or_above()))
);

create policy posts_delete_own on public.posts for delete
using (author_id = (select auth.uid()) or (select private.is_admin_or_above()));
```

Nota: `publish_at is null or is_admin_or_above()` en `insert`/`update` es el candado de "programar" — por ahora solo admin/super_admin programan (checklist §9 del doc portado: sin sub-permisos jsonb en este proyecto, se simplifica a un rol fijo en vez de un permiso granular nuevo).

- [x] **Paso 2: Verificar con `get_advisors`**

Ejecutar `get_advisors(type: "security")` sobre `cgudnnlcwcotovcslgzu`.
Expected: sin advertencia nueva de "RLS enabled, no policy" para `posts`.

---

### Task 6: RLS — `post_comments`

**Files:**
- DB (vía MCP `apply_migration`)

- [x] **Paso 1: Aplicar migración `conectados_rls_post_comments`**

```sql
alter table public.post_comments enable row level security;

create policy post_comments_select on public.post_comments for select
using (
  organization_id = (select private.auth_org_id())
  and (select private.can_view_post(post_id))
);

create policy post_comments_insert on public.post_comments for insert
with check (
  organization_id = (select private.auth_org_id())
  and (select private.can_comment_on_posts())
  and (select private.can_view_post(post_id))
);

create policy post_comments_update_own on public.post_comments for update
using (author_id = (select auth.uid()) or (select private.is_admin_or_above()))
with check (author_id = (select auth.uid()) or (select private.is_admin_or_above()));

-- Autor del comentario, o dueño del post (moderación), o admin+.
create policy post_comments_delete on public.post_comments for delete
using (
  author_id = (select auth.uid())
  or (select private.is_admin_or_above())
  or exists (
    select 1 from public.posts p
    where p.id = post_comments.post_id and p.author_id = (select auth.uid())
  )
);
```

- [x] **Paso 2: Verificar**

```sql
select policyname, cmd from pg_policies where tablename = 'post_comments' order by policyname;
```
Expected: 4 filas (`post_comments_select`, `post_comments_insert`, `post_comments_update_own`, `post_comments_delete`).

---

### Task 7: RLS — `post_permissions`

**Files:**
- DB (vía MCP `apply_migration`)

- [x] **Paso 1: Aplicar migración `conectados_rls_post_permissions`**

```sql
alter table public.post_permissions enable row level security;

create policy post_permissions_select on public.post_permissions for select
using (
  organization_id = (select private.auth_org_id())
  and (profile_id = (select auth.uid()) or (select private.is_admin_or_above()))
);

create policy post_permissions_write_admin on public.post_permissions for all
using (organization_id = (select private.auth_org_id()) and (select private.is_admin_or_above()))
with check (organization_id = (select private.auth_org_id()) and (select private.is_admin_or_above()));
```

- [x] **Paso 2: Verificar con `get_advisors(type: "security")`**

Expected: ninguna tabla de Conectados aparece con "RLS enabled, no policy".

---

### Task 8: RPCs de reacciones (post y comentario)

**Files:**
- DB (vía MCP `apply_migration`)

- [x] **Paso 1: Aplicar migración `conectados_rpc_reactions`** (+ migración de corrección `conectados_rpc_reactions_fix_notify_flag`, ver nota en el SQL de arriba)

```sql
create or replace function public.toggle_post_reaction(p_post_id uuid, p_type text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_uid_txt text := v_uid::text;
  v_org_id uuid;
  v_author_id uuid;
  v_already boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_type not in ('like', 'corazon', 'aplauso', 'fuego') then
    raise exception 'Tipo de reacción inválido: %', p_type;
  end if;
  if not (select private.can_view_post(p_post_id)) then
    raise exception 'No tienes acceso a esta publicación';
  end if;
  if not (select private.can_react_to_posts()) then
    raise exception 'No tienes permiso para reaccionar';
  end if;

  -- coalesce obligatorio: si v_uid_txt todavía no es clave del jsonb (primera
  -- reacción de esta persona), `reactions ->> v_uid_txt` es SQL NULL, y
  -- `NULL = p_type` también es NULL (no false) — sin el coalesce, v_already
  -- queda NULL y `not v_already` NUNCA es true, así que el aviso al autor
  -- jamás se dispara en el único caso que debería (bug real, encontrado y
  -- corregido en esta sesión, ver .claude/napkin.md).
  select organization_id, author_id, coalesce((reactions ->> v_uid_txt) = p_type, false)
    into v_org_id, v_author_id, v_already
  from public.posts where id = p_post_id;

  update public.posts
  set reactions = case
    when (reactions ->> v_uid_txt) = p_type then reactions - v_uid_txt
    else reactions || jsonb_build_object(v_uid_txt, p_type)
  end
  where id = p_post_id;

  -- Solo se notifica al AGREGAR una reacción nueva, nunca al quitarla ni a uno mismo.
  -- La notificación real (in-app + correo) la manda notify() desde el Server Action
  -- que llama esta RPC — acá solo se devuelve a quién avisar.
  if not v_already and v_author_id is not null and v_author_id <> v_uid then
    return jsonb_build_object('organization_id', v_org_id, 'recipient_id', v_author_id);
  end if;
  return null;
end;
$function$;

create or replace function public.toggle_post_comment_reaction(p_comment_id uuid, p_type text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_uid_txt text := v_uid::text;
  v_org_id uuid;
  v_author_id uuid;
  v_post_id uuid;
  v_already boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_type not in ('like', 'corazon', 'aplauso', 'fuego') then
    raise exception 'Tipo de reacción inválido: %', p_type;
  end if;

  -- Mismo coalesce que en toggle_post_reaction, misma razón.
  select organization_id, author_id, post_id, coalesce((reactions ->> v_uid_txt) = p_type, false)
    into v_org_id, v_author_id, v_post_id, v_already
  from public.post_comments where id = p_comment_id;

  if v_org_id is null then
    raise exception 'Comentario no encontrado';
  end if;
  if not (select private.can_view_post(v_post_id)) then
    raise exception 'No tienes acceso a este comentario';
  end if;
  if not (select private.can_react_to_posts()) then
    raise exception 'No tienes permiso para reaccionar';
  end if;

  update public.post_comments
  set reactions = case
    when (reactions ->> v_uid_txt) = p_type then reactions - v_uid_txt
    else reactions || jsonb_build_object(v_uid_txt, p_type)
  end
  where id = p_comment_id;

  if not v_already and v_author_id is not null and v_author_id <> v_uid then
    return jsonb_build_object('organization_id', v_org_id, 'recipient_id', v_author_id);
  end if;
  return null;
end;
$function$;

revoke all on function public.toggle_post_reaction(uuid, text) from public, anon;
revoke all on function public.toggle_post_comment_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_post_reaction(uuid, text) to authenticated;
grant execute on function public.toggle_post_comment_reaction(uuid, text) to authenticated;
```

- [x] **Paso 2: Verificar con una llamada real**

Con un `post_id` real (crear uno de prueba primero vía `insert into public.posts (organization_id, author_id, author_name, content) values (...)` con el `service_role`, o esperar a Task 14 para hacerlo por Server Action):
```sql
select public.toggle_post_reaction('<post_id>', 'like');
```
Expected: corre sin error (el `raise exception 'No autenticado'` es esperado si se corre desde la consola SQL sin JWT — confirma que el guard existe; la prueba real de extremo a extremo queda para Task 20).

---

### Task 9: RPC de encuesta y RPC de liberación programada (cron)

**Files:**
- DB (vía MCP `apply_migration`)

- [x] **Paso 1: Aplicar migración `conectados_rpc_poll_and_release`**

```sql
create or replace function public.vote_post_poll(p_post_id uuid, p_option_index int)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid text := (select auth.uid())::text;
  v_poll jsonb;
  v_options jsonb;
  v_votes jsonb;
  v_filtered jsonb;
  v_i int;
  v_j int;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if not (select private.can_view_post(p_post_id)) then
    raise exception 'No tienes acceso a esta publicación';
  end if;

  select poll into v_poll from public.posts where id = p_post_id for update;
  if v_poll is null then
    return;
  end if;

  v_options := v_poll -> 'options';
  if v_options is null then
    return;
  end if;

  for v_i in 0 .. jsonb_array_length(v_options) - 1 loop
    v_votes := v_options -> v_i -> 'votes';
    v_filtered := '[]'::jsonb;
    for v_j in 0 .. jsonb_array_length(v_votes) - 1 loop
      if (v_votes ->> v_j) != v_uid then
        v_filtered := v_filtered || jsonb_build_array(v_votes -> v_j);
      end if;
    end loop;
    if v_i = p_option_index then
      v_filtered := v_filtered || jsonb_build_array(to_jsonb(v_uid));
    end if;
    v_options := jsonb_set(v_options, array[v_i::text, 'votes'], v_filtered);
  end loop;

  update public.posts set poll = jsonb_set(v_poll, '{options}', v_options) where id = p_post_id;
end;
$function$;

revoke all on function public.vote_post_poll(uuid, int) from public, anon;
grant execute on function public.vote_post_poll(uuid, int) to authenticated;

-- Cron: recorre TODAS las organizaciones (multi-tenant, a diferencia del doc
-- original de un solo cliente). GOTCHA preservado tal cual del doc portado:
-- el acumulador v_avisos se llena por-post en v_avisos_post y solo se vuelca a
-- v_avisos como ÚLTIMO paso del bloque — si algo falla a mitad de un post, la
-- excepción revierte la fila pero NO las variables plpgsql, así que volcar
-- antes de tiempo mandaría avisos de un post que quedó sin liberar.
create or replace function public.release_scheduled_posts(p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_avisos jsonb := '[]'::jsonb;
  v_avisos_post jsonb;
  v_n int := 0;
  v_post record;
  v_dest record;
  v_preview text;
begin
  for v_post in
    select id, organization_id, author_id, author_name, department_id, roles, content, mentions
    from public.posts
    where publish_at is not null and publish_at <= now()
    order by publish_at
  loop
    begin
      if p_dry_run then
        v_n := v_n + 1;
        continue;
      end if;

      v_avisos_post := '[]'::jsonb;

      update public.posts
      set created_at = (select publish_at from public.posts where id = v_post.id),
          publish_at = null
      where id = v_post.id;

      v_preview := case
        when coalesce(btrim(v_post.content), '') = '' then 'Nueva publicación con contenido adjunto'
        when length(btrim(v_post.content)) > 120 then left(btrim(v_post.content), 120) || '…'
        else btrim(v_post.content)
      end;

      -- Audiencia: MISMA lógica que posts_select (departamento + roles).
      for v_dest in
        select p.id
        from public.profiles p
        where p.organization_id = v_post.organization_id
          and p.is_active
          and p.id is distinct from v_post.author_id
          and (v_post.department_id is null or p.role in ('admin','super_admin') or p.department_id = v_post.department_id)
          and (v_post.roles is null or p.role = any(v_post.roles))
      loop
        v_avisos_post := v_avisos_post || jsonb_build_array(
          jsonb_build_object('organization_id', v_post.organization_id, 'recipient_id', v_dest.id, 'preview', v_preview, 'kind', 'post_nuevo')
        );
      end loop;

      -- @menciones: quien crea un post programado las salta (Task 14), las manda este cron al liberar.
      for v_dest in
        select p.id
        from public.profiles p
        where p.id = any(coalesce(v_post.mentions, '{}'::uuid[]))
          and p.id is distinct from v_post.author_id
      loop
        v_avisos_post := v_avisos_post || jsonb_build_array(
          jsonb_build_object('organization_id', v_post.organization_id, 'recipient_id', v_dest.id, 'preview', v_preview, 'kind', 'post_mencion')
        );
      end loop;

      v_avisos := v_avisos || v_avisos_post;
      v_n := v_n + 1;
    exception when others then
      raise warning 'release_scheduled_posts: falló el post %: %', v_post.id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('liberados', v_n, 'avisos', v_avisos);
end;
$function$;

revoke all on function public.release_scheduled_posts(boolean) from public, anon, authenticated;
```

Nota: a diferencia de la RPC de reacción (que devuelve a quién avisar y deja que el Server Action llame `notify()`), esta RPC la llama el cron directo con `service_role` — el Route Handler (Task 19) recorre `avisos` y llama `notify()` por cada uno, igual patrón.

- [x] **Paso 2: Verificar en modo simulación**

```sql
select public.release_scheduled_posts(true);
```
Expected: `{"liberados": 0, "avisos": []}` (no hay posts programados todavía).

---

### Task 10: Realtime

**Files:**
- DB (vía MCP `apply_migration`)

- [x] **Paso 1: Aplicar migración `conectados_realtime`**

```sql
alter table public.posts replica identity full;
alter table public.post_comments replica identity full;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_comments;
```

- [x] **Paso 2: Verificar**

```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;
```
Expected: incluye `notifications` (ya estaba), `posts`, `post_comments`.

---

### Task 11: Storage — bucket `conectados-adjuntos`

**Files:**
- DB (vía MCP `apply_migration`)

**Convención de carpeta:** `{organization_id}/{post_id}/{filename}` — el primer segmento del path es el UUID de la organización, igual que `cvs-privado` usa el segundo segmento para el UUID del candidato.

- [x] **Paso 1: Aplicar migración `conectados_storage_bucket`**

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'conectados-adjuntos', 'conectados-adjuntos', false, 10485760,
  array['image/jpeg','image/png','image/webp','video/mp4','application/pdf']
);

create policy conectados_adjuntos_select on storage.objects for select
using (
  bucket_id = 'conectados-adjuntos'
  and ((storage.foldername(name))[1])::uuid = (select private.auth_org_id())
);

create policy conectados_adjuntos_insert on storage.objects for insert
with check (
  bucket_id = 'conectados-adjuntos'
  and ((storage.foldername(name))[1])::uuid = (select private.auth_org_id())
  and (select private.can_post_to_communications())
);

create policy conectados_adjuntos_delete on storage.objects for delete
using (
  bucket_id = 'conectados-adjuntos'
  and ((storage.foldername(name))[1])::uuid = (select private.auth_org_id())
  and (select private.is_admin_or_above())
);
```

- [x] **Paso 2: Verificar**

```sql
select id, public, file_size_limit from storage.buckets where id = 'conectados-adjuntos';
```
Expected: 1 fila, `public = false`.

---

### Task 12: Advisors + tipos TypeScript

**Files:**
- Modify: `src/lib/supabase/database.types.ts`

- [x] **Paso 1: Correr `get_advisors(type: "security")`** sobre `cgudnnlcwcotovcslgzu`.

Expected: sin hallazgos nuevos de "RLS enabled, no policy" ni "function search_path mutable" para nada de Conectados. Si aparece algo, corregirlo con una migración adicional antes de seguir (no dejarlo para después).

- [x] **Paso 2: Correr `get_advisors(type: "performance")`**.

Expected: revisar que las políticas nuevas usen `(select ...)` (ya lo hacen, ver Tasks 5-7) — no debería salir "Auth RLS Initplan" para `posts`/`post_comments`/`post_permissions`.

- [x] **Paso 3: Regenerar tipos con `generate_typescript_types`** sobre `cgudnnlcwcotovcslgzu` y reemplazar el contenido completo de `src/lib/supabase/database.types.ts` con el resultado.

- [x] **Paso 4: Verificar que compila**

Run: `npm run typecheck`
Expected: sin errores nuevos relacionados a `database.types.ts`.

**Hallazgos reales de los advisors, corregidos en esta sesión (no estaban en el plan original):**
- `post_permissions_write_admin` era `FOR ALL` y se solapaba con `post_permissions_select` en SELECT (políticas permisivas duplicadas, advisor de performance). Se separó en `post_permissions_write_admin` (solo INSERT), `post_permissions_update_admin`, `post_permissions_delete_admin` — migración `conectados_advisor_fixes`.
- Índices de FK faltantes en `posts.author_id`, `post_comments.author_id`, `post_comments.organization_id`, `post_permissions.organization_id` — mismo patrón que la migración previa del proyecto `indices_fk_faltantes`. Misma migración `conectados_advisor_fixes`.
- `database.types.ts` regenerado hizo aparecer un error de typecheck real en `src/lib/notifications/preferences-schema.ts` (`NOTIFICATION_TYPE_LABEL` es `Record<NotificationType, string>`, exhaustivo sobre el enum) — se agregaron las 4 etiquetas nuevas (`post_nuevo`, `post_mencion`, `post_reaccion`, `post_comentario`), sin sumarlas todavía a `PREFERENCE_TYPES` (mismo criterio que `mencion_nota` antes de tener UI real: no ofrecer un interruptor para un aviso que el módulo aún no dispara).
- El warning de advisors "SECURITY DEFINER callable by authenticated" en `toggle_post_reaction`/`toggle_post_comment_reaction`/`vote_post_poll` es esperado por diseño (son RPCs pensadas para eso, con sus propios guards internos) — no se tocó.

---

### Task 13: Capa de datos — schema y queries

**Files:**
- Create: `src/lib/conectados/schema.ts`
- Create: `src/lib/conectados/queries.ts`

- [x] **Paso 1: Crear `src/lib/conectados/schema.ts`**

```typescript
import { z } from "zod";

export const REACTION_TYPES = ["like", "corazon", "aplauso", "fuego"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const CreatePostSchema = z.object({
  content: z.string().trim().max(4000, "El contenido es demasiado largo."),
  departmentId: z.string().uuid().nullable(),
  roles: z.array(z.enum(["gestor", "admin", "super_admin"])).nullable(),
  publishAt: z.string().datetime().nullable(),
  mentions: z.array(z.string().uuid()).default([]),
});
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const CreateCommentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1, "Escribe algo antes de comentar.").max(2000, "El comentario es demasiado largo."),
  mentions: z.array(z.string().uuid()).default([]),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
```

- [x] **Paso 2: Crear `src/lib/conectados/queries.ts`**

```typescript
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Post = Tables<"posts">;
export type PostComment = Tables<"post_comments">;
export type PostPermission = Tables<"post_permissions">;

const FEED_LIMIT = 50;

export async function getPosts(): Promise<Post[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (error) throw error;
  return data ?? [];
}

export async function getPostComments(postId: string): Promise<PostComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getOwnPostPermissions(profileId: string): Promise<PostPermission | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("post_permissions")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

- [x] **Paso 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores (asume que Task 12 ya regeneró `database.types.ts` con las tablas nuevas).

- [x] **Paso 4: Commit** — `e6bc85a`

---

### Task 14: Server Actions — crear post, comentar, reaccionar, votar

**Files:**
- Create: `src/lib/conectados/actions.ts`

- [x] **Paso 1: Crear `src/lib/conectados/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { notify, notifyBestEffort } from "@/lib/notifications/notify";
import { CreatePostSchema, CreateCommentSchema, REACTION_TYPES, type ReactionType } from "./schema";

export type ConectadosActionResult = { error?: string; success?: string };

function previewContent(content: string): string {
  const text = content.trim();
  if (!text) return "Nueva publicación con contenido adjunto";
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export async function createPost(input: unknown): Promise<ConectadosActionResult> {
  const profile = await requireProfile();
  const parsed = CreatePostSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { content, departmentId, roles, publishAt, mentions } = parsed.data;

  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      organization_id: profile.organization_id,
      author_id: profile.id,
      author_name: profile.display_name,
      author_avatar_url: profile.avatar_url,
      department_id: departmentId,
      roles,
      publish_at: publishAt,
      content,
      mentions,
    })
    .select("id")
    .single();

  if (error) return { error: "No se pudo publicar." };

  // Programado: los avisos salen cuando el cron lo libera (Task 9), no ahora.
  if (!publishAt) {
    notifyBestEffort(async () => {
      const { data: recipients } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .neq("id", profile.id);
      for (const recipient of recipients ?? []) {
        await notify({
          organizationId: profile.organization_id,
          recipientId: recipient.id,
          type: "post_nuevo",
          title: "Nueva publicación",
          body: `${profile.display_name} publicó: "${previewContent(content)}"`,
          url: "/conectados",
          entityType: "post",
          entityId: post.id,
        });
      }
      for (const recipientId of mentions.filter((id) => id !== profile.id)) {
        await notify({
          organizationId: profile.organization_id,
          recipientId,
          type: "post_mencion",
          title: `${profile.display_name} te mencionó`,
          body: previewContent(content),
          url: "/conectados",
          entityType: "post",
          entityId: post.id,
        });
      }
    });
  }

  revalidatePath("/conectados");
  return { success: "Publicación creada" };
}

export async function addComment(input: unknown): Promise<ConectadosActionResult> {
  const profile = await requireProfile();
  const parsed = CreateCommentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { postId, body, mentions } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("post_comments").insert({
    organization_id: profile.organization_id,
    post_id: postId,
    author_id: profile.id,
    author_name: profile.display_name,
    author_avatar_url: profile.avatar_url,
    body,
    mentions,
  });
  if (error) return { error: "No se pudo comentar." };

  notifyBestEffort(async () => {
    for (const recipientId of mentions.filter((id) => id !== profile.id)) {
      await notify({
        organizationId: profile.organization_id,
        recipientId,
        type: "post_mencion",
        title: `${profile.display_name} te mencionó`,
        body: previewContent(body),
        url: "/conectados",
        entityType: "post",
        entityId: postId,
      });
    }
  });

  revalidatePath("/conectados");
  return { success: "Comentario publicado" };
}

export async function toggleReaction(postId: string, type: ReactionType): Promise<ConectadosActionResult> {
  await requireProfile();
  if (!REACTION_TYPES.includes(type)) return { error: "Tipo de reacción inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_post_reaction", { p_post_id: postId, p_type: type });
  if (error) return { error: "No se pudo reaccionar." };

  const aviso = data as { organization_id: string; recipient_id: string } | null;
  if (aviso) {
    notifyBestEffort(() =>
      notify({
        organizationId: aviso.organization_id,
        recipientId: aviso.recipient_id,
        type: "post_reaccion",
        title: "Reaccionaron a tu publicación",
        body: "Alguien reaccionó a tu publicación.",
        url: "/conectados",
        entityType: "post",
        entityId: postId,
      }),
    );
  }

  revalidatePath("/conectados");
  return {};
}

export async function votePoll(postId: string, optionIndex: number): Promise<ConectadosActionResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("vote_post_poll", { p_post_id: postId, p_option_index: optionIndex });
  if (error) return { error: "No se pudo votar." };
  revalidatePath("/conectados");
  return {};
}
```

- [x] **Paso 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [x] **Paso 3: Commit** — `35c9380`

---

### Task 15: Registro de módulos

**Files:**
- Create: `src/lib/modules.ts`
- Modify: `src/components/layout/floating-nav.tsx:1-30`

- [ ] **Paso 1: Crear `src/lib/modules.ts`** (mueve `itemsForRole` tal cual desde `floating-nav.tsx`)

```typescript
import { Briefcase, Home, MessageCircle, Settings, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["app_role"];
export type NavItem = { href: string; label: string; icon: LucideIcon };

export type ModuleConfig = {
  id: string;
  label: string;
  icon: LucideIcon;
  accentColor: string;
  basePath: string;
  itemsForRole: (role: Role) => NavItem[];
};

function reclutamientoItemsForRole(role: Role): NavItem[] {
  const base: NavItem[] = [
    { href: "/inicio", label: "Inicio", icon: Home },
    { href: "/vacantes", label: "Vacantes", icon: Briefcase },
  ];
  if (role === "gestor" || ADMIN_ROLES.has(role)) {
    base.push({ href: "/candidatos", label: "Candidatos", icon: Users });
  }
  if (ADMIN_ROLES.has(role)) {
    base.push({ href: "/configuracion", label: "Ajustes", icon: Settings });
  }
  return base;
}

function conectadosItemsForRole(): NavItem[] {
  return [{ href: "/conectados", label: "Inicio", icon: Home }];
}

export const MODULES: ModuleConfig[] = [
  {
    id: "reclutamiento",
    label: "Reclutamiento AJE",
    icon: Briefcase,
    accentColor: "#00B348",
    basePath: "/inicio",
    itemsForRole: reclutamientoItemsForRole,
  },
  {
    id: "conectados",
    label: "AJE Conectados",
    icon: MessageCircle,
    accentColor: "#EF7834",
    basePath: "/conectados",
    itemsForRole: conectadosItemsForRole,
  },
];

export function activeModuleFor(pathname: string): ModuleConfig {
  const match = MODULES.find((m) => m.id !== "reclutamiento" && pathname.startsWith(m.basePath));
  return match ?? MODULES[0];
}
```

- [ ] **Paso 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add src/lib/modules.ts
git commit -m "feat(nav): registro de módulos (Reclutamiento AJE + AJE Conectados)"
```

---

### Task 16: Componente `Popover`

**Files:**
- Create: `src/components/ui/popover.tsx`

- [ ] **Paso 1: Crear el wrapper shadcn estándar**

```typescript
"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

function PopoverContent({
  className,
  align = "center",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-md outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
```

- [ ] **Paso 2: Verificar que `@/lib/utils` (helper `cn`) existe**

Run: `grep -n "export function cn" src/lib/utils.ts`
Expected: una coincidencia (es el helper `clsx`+`tailwind-merge` estándar de shadcn). Si no existe, buscar el nombre real del helper de clases del proyecto con `grep -rn "clsx\|tailwind-merge" src/lib` y usar ese en vez de inventar uno nuevo.

- [ ] **Paso 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Paso 4: Commit**

```bash
git add src/components/ui/popover.tsx
git commit -m "feat(ui): agrega wrapper de Popover (radix ya instalado)"
```

---

### Task 17: Selector de módulos en `floating-nav.tsx`

**Files:**
- Modify: `src/components/layout/floating-nav.tsx` (reemplaza todo el archivo)

- [ ] **Paso 1: Reemplazar `floating-nav.tsx`**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MODULES, activeModuleFor } from "@/lib/modules";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["app_role"];

/**
 * Menú principal flotante: acompaña la pantalla sin invadirla. Se oculta al
 * bajar y reaparece al subir. Nunca una sidebar.
 */
export function FloatingNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const activeModule = activeModuleFor(pathname);
  const items = activeModule.itemsForRole(role);
  const [visible, setVisible] = useState(true);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingDown = y > lastY.current && y > 80;
        setVisible(!goingDown);
        lastY.current = y;
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          className="fixed inset-x-0 bottom-6 z-40 flex justify-center"
        >
          <div className="flex items-center gap-0.5 rounded-full bg-primary p-1.5 shadow-nav">
            <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Cambiar de módulo"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-primary-foreground/70 hover:bg-white/10"
                >
                  <LayoutGrid className="size-[18px]" strokeWidth={2.5} aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-64">
                <div className="flex flex-col gap-1">
                  {MODULES.map((mod) => {
                    const Icon = mod.icon;
                    const isActive = mod.id === activeModule.id;
                    return (
                      <Link
                        key={mod.id}
                        href={mod.basePath}
                        onClick={() => setSwitcherOpen(false)}
                        className="flex items-center gap-3 rounded-xl p-2 text-sm font-medium hover:bg-muted"
                      >
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: mod.accentColor }}
                        >
                          <Icon className="size-4" strokeWidth={2.5} aria-hidden />
                        </span>
                        {mod.label}
                        {isActive && <span className="ml-auto size-1.5 rounded-full bg-foreground" aria-hidden />}
                      </Link>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <div className="mx-0.5 h-5 w-px bg-white/25" aria-hidden />

            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={`nav-${item.href.slice(1)}`}
                  aria-label={item.label}
                  className="group relative flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium"
                >
                  {active && (
                    <motion.span
                      layoutId="floating-nav-indicator"
                      className="absolute inset-0 rounded-full bg-background"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span
                    className={`relative flex items-center gap-2 ${active ? "text-foreground" : "text-primary-foreground/60"}`}
                  >
                    <Icon className="size-[18px]" strokeWidth={2.5} aria-hidden />
                    {active && <span>{item.label}</span>}
                  </span>
                  {!active && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
```

Cambios respecto al original: `itemsForRole` se fue a `src/lib/modules.ts` (Task 15); se agrega el trigger circular + `Popover` con la lista de módulos; el resto (scroll hide/show, tooltip, indicador activo) queda idéntico.

- [ ] **Paso 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add src/components/layout/floating-nav.tsx
git commit -m "feat(nav): selector de módulos integrado en la píldora"
```

---

### Task 18: Placeholder real de `/conectados`

**Files:**
- Create: `src/app/(app)/conectados/page.tsx`

- [ ] **Paso 1: Revisar cómo una página existente de `(app)` obtiene el perfil, para no reinventar el patrón**

Run: `grep -n "requireProfile\|export default async function" src/app/(app)/inicio/page.tsx`
Usar el mismo patrón de import/uso de `requireProfile()` que aparezca ahí.

- [ ] **Paso 2: Crear `src/app/(app)/conectados/page.tsx`**

```typescript
import { requireProfile } from "@/lib/auth/dal";

export default async function ConectadosPage() {
  await requireProfile();

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 pb-28 pt-24 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-[#FAECE7] text-[#4A1B0C]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className="size-8"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
          />
        </svg>
      </span>
      <h1 className="text-xl font-extrabold">AJE Conectados</h1>
      <p className="text-sm text-muted-foreground">
        El muro social interno está en construcción. Pronto vas a poder publicar, comentar y reaccionar acá mismo.
      </p>
    </div>
  );
}
```

- [ ] **Paso 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Paso 4: Commit**

```bash
git add "src/app/(app)/conectados/page.tsx"
git commit -m "feat(conectados): placeholder real de /conectados"
```

---

### Task 19: Cron de liberación (Route Handler)

**Files:**
- Create: `src/app/api/cron/release-scheduled-posts/route.ts`
- Modify: `vercel.json`
- Modify: `.env.local` (agregar `CRON_SECRET`, no se commitea)

- [ ] **Paso 1: Crear `src/app/api/cron/release-scheduled-posts/route.ts`**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/notify";

interface AvisoPost {
  organization_id: string;
  recipient_id: string;
  preview: string;
  kind: "post_nuevo" | "post_mencion";
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return new NextResponse("CRON_SECRET not configured", { status: 500 });
  if (authHeader !== `Bearer ${cronSecret}`) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: resumenRaw, error } = await admin.rpc("release_scheduled_posts", { p_dry_run: false });
  if (error) {
    console.error("[release-scheduled-posts] falló:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resumen = (resumenRaw ?? {}) as Record<string, unknown>;
  const avisos = (Array.isArray(resumen.avisos) ? resumen.avisos : []) as AvisoPost[];

  for (const aviso of avisos) {
    await notify({
      organizationId: aviso.organization_id,
      recipientId: aviso.recipient_id,
      type: aviso.kind,
      title: aviso.kind === "post_mencion" ? "Te mencionaron en una publicación" : "Nueva publicación",
      body: aviso.preview,
      url: "/conectados",
    });
  }

  return NextResponse.json({ ok: true, liberados: resumen.liberados ?? 0, avisos: avisos.length });
}
```

- [ ] **Paso 2: Agregar el cron a `vercel.json`**

Reemplazar el contenido de `vercel.json` (leer el actual primero — solo tiene `$schema` y `regions`, agregar `crons` sin tocar el resto):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["pdx1"],
  "crons": [{ "path": "/api/cron/release-scheduled-posts", "schedule": "0 * * * *" }]
}
```

- [ ] **Paso 3: Agregar `CRON_SECRET` a `.env.local`**

Run (genera un valor random, no lo repitas en el chat ni lo commitees):
```bash
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env.local
```
Verificar que `.env.local` está en `.gitignore` antes de este paso: `grep -n "^\.env" .gitignore`. Expected: `.env.local` u `.env*.local` listado.

- [ ] **Paso 4: Probar localmente**

Con `next dev` corriendo:
```bash
curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" http://localhost:3000/api/cron/release-scheduled-posts
```
Expected: `{"ok":true,"liberados":0,"avisos":0}` (no hay posts programados todavía — es correcto).

- [ ] **Paso 5: Commit**

```bash
git add "src/app/api/cron/release-scheduled-posts/route.ts" vercel.json
git commit -m "feat(conectados): cron de liberación de publicaciones programadas"
```

(`.env.local` no se agrega — ya está en `.gitignore`.)

---

### Task 20: Verificación local de extremo a extremo

**Files:** ninguno (solo verificación manual)

- [ ] **Paso 1: Levantar el servidor**

Run: `npm run dev`
Expected: arranca sin errores en `http://localhost:3000`.

- [ ] **Paso 2: Login y ver el selector**

Loguearse (cerrar sesión primero si ya había una, por el cambio del JWT en Task 1). En cualquier pantalla interna, click en el ícono de grilla al inicio de la píldora.
Expected: se abre el popover con "Reclutamiento AJE" (verde, punto activo) y "AJE Conectados" (naranja).

- [ ] **Paso 3: Navegar a Conectados**

Click en "AJE Conectados".
Expected: navega a `/conectados`, la píldora ahora muestra solo el tab "Inicio" de ese módulo, el ícono de grilla sigue disponible para volver.

- [ ] **Paso 4: Verificar la placeholder**

Expected: se ve "AJE Conectados" + el texto "en construcción", sin errores en la consola del navegador.

- [ ] **Paso 5: Probar RLS de `posts` de extremo a extremo por SQL (no hay UI de compositor todavía, eso es la próxima iteración)**

Sembrar un post de prueba con el cliente admin (bypassea RLS a propósito, es solo para tener datos):
```sql
insert into public.posts (organization_id, author_id, author_name, content)
select organization_id, id, display_name, 'Post de prueba'
from public.profiles
order by created_at asc
limit 1
returning id, organization_id, author_id;
```
Anotar los 3 valores devueltos (`id`, `organization_id`, `author_id`).

Simular la sesión de ESE usuario y confirmar que `posts_select` lo deja ver su propio post (regla: el autor siempre ve lo suyo, sin importar `publish_at`/rol/departamento):
```sql
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "<author_id>", "app_metadata": {"organization_id": "<organization_id>", "app_role": "gestor"}}';
select id, content from public.posts where id = '<id-del-post-de-prueba>';
```
Expected: devuelve 1 fila (el post recién creado).

Ahora simular OTRO usuario de una organización distinta (o `app_metadata.organization_id` con un UUID cualquiera que no coincida):
```sql
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-000000000000", "app_metadata": {"organization_id": "00000000-0000-0000-0000-000000000000", "app_role": "gestor"}}';
select id, content from public.posts where id = '<id-del-post-de-prueba>';
```
Expected: 0 filas — confirma que `organization_id = (select private.auth_org_id())` sí aísla por organización.

Borrar el post de prueba al terminar:
```sql
reset role;
delete from public.posts where content = 'Post de prueba';
```

- [ ] **Paso 6: Correr lint y typecheck completos**

Run: `npm run lint && npm run typecheck`
Expected: 0 errores.

- [ ] **Paso 7: `/code-review` antes de dar por cerrada la fase**

Invocar la skill `/code-review` sobre todo el diff de la rama `feature/aje-conectados` contra `main` (regla no negociable de `AGENTS.md`: ningún commit se da por bueno sin pasar por ahí). Corregir lo que salga antes de considerar esta fase terminada.

---

## Cobertura del spec (auto-revisión)

- Selector de módulos en la píldora: Tasks 15-17. ✓
- Placeholder real y clickeable de AJE Conectados (regla de "nada clickeable sin destino real"): Task 18. ✓
- Migraciones + RLS adaptadas al esquema real (`profiles`, JWT, `private.*`, no `usuarios`): Tasks 1-11. ✓
- Reuso de `notifications`/`notification_preferences` vía `notify()` en vez de una tabla paralela: Task 14 y 19. ✓
- Buckets configurados sin pisar `cvs-privado`/`avatares`/`marca-publico`: Task 11. ✓
- Gotcha del acumulador plpgsql preservado: Task 9. ✓
- Realtime habilitado por SQL (no un paso manual de dashboard, a diferencia del doc original): Task 10. ✓
- Nada de esto toca `main` ni se pushea: se trabaja íntegro en `feature/aje-conectados` (ya creada), Task 20 termina en `/code-review`, no en push.
- Fuera de alcance explícito (otra iteración): UI completa del feed (compositor, tarjetas de post, comentarios visibles, encuestas, adjuntos reales, @menciones con autocompletado). Lo de esta fase deja el backend probado y una entrada real pero mínima.
