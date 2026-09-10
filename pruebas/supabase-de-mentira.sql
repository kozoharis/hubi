-- ═══════════════════════════════════════════════════════════════
-- SUPABASE DE MENTIRA
-- ═══════════════════════════════════════════════════════════════
--
-- Lo mínimo de Supabase que HUBI necesita para arrancar en un Postgres
-- vacío: los tres papeles que reparte, el esquema `auth`, y `auth.uid()`
-- leyendo la sesión igual que allí.
--
-- Sirve para UNA cosa: poder ejecutar de verdad el esquema entero y el
-- ensayo de la migración antes de que nadie los ejecute en la base de
-- datos buena. Escribir un archivo de 52 políticas sin haberlo corrido
-- nunca es exactamente la clase de trabajo que sale mal.
--
-- Esto NO se ejecuta jamás en Supabase: allí ya existe todo.

/* Los papeles viven en el servidor, no en la base de datos, así que
   pueden existir ya de una prueba anterior. Se crean si faltan. */
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')
    then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated')
    then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')
    then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

/* La tabla de usuarios, con las columnas que HUBI toca: `perfiles.id`
   apunta aquí, y el disparador del SQL 01 lee el correo y los metadatos
   para escribir el nombre. */
create table if not exists auth.users (
  instance_id         uuid,
  id                  uuid primary key,
  aud                 varchar(255),
  role                varchar(255),
  email               varchar(255),
  encrypted_password  varchar(255),
  email_confirmed_at  timestamptz,
  raw_app_meta_data   jsonb,
  raw_user_meta_data  jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

/* Quién está entrando. Igual que en Supabase: sale del testigo de la
   sesión, no de una variable de servidor. Por eso se puede cambiar de
   persona dentro de una transacción, que es lo que hace el ensayo. */
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role'),
    'anon'
  )
$$;

create or replace function auth.email() returns text
language sql stable
as $$
  select (select email from auth.users where id = auth.uid())
$$;
