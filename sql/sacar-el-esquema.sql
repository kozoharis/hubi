-- ═══════════════════════════════════════════════════════════════
-- SACAR EL ESQUEMA
-- ═══════════════════════════════════════════════════════════════
--
-- NO CAMBIA NADA. Es una lectura: mira el catálogo de Postgres y
-- escribe, en un solo texto, cómo está hecha la base de datos hoy.
--
-- ─────────────────────────────────────────────────────────────
-- PARA QUÉ
--
-- Para poder levantar HUBI entero en un Postgres de mentira y ENSAYAR
-- allí la migración de las 52 políticas antes de que la vea la base de
-- datos buena.
--
-- Los archivos `sql/02` a `sql/07` no están en el repositorio: se
-- ejecutaron en su día y se perdieron. Sin ellos, el esquema local se
-- quedaría a medias y habría que inventar las tablas que faltan.
--
-- Y un ensayo contra un esquema inventado no prueba nada: prueba la
-- invención. Si mi copia tiene una columna de menos o una clave ajena
-- distinta, la matriz de acceso saldría en verde aquí y el fallo
-- aparecería en producción, que es justo lo que estamos evitando.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO
--
--   1. Supabase → SQL Editor → New query
--   2. Pegar esto entero y Run
--   3. Sale UNA fila con UNA columna
--   4. Descargar el CSV (botón «Export» / «Download CSV») y mandármelo
--
-- Copiar la celda a mano no sirve: el editor recorta el texto largo al
-- enseñarlo, y esto ocupa bastante. El CSV va entero.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ LLEVA, Y QUÉ NO
--
-- Lleva: tablas, columnas, valores por defecto, claves, restricciones,
-- índices, funciones, disparadores y las políticas de seguridad.
--
-- NO lleva ni una fila de datos. Ni un documento, ni un nombre, ni un
-- importe. Solo la forma. La gente del ensayo se inventa allí.

with columnas as (
  select
    c.table_name,
    string_agg(
      format(
        '  %I %s%s%s',
        c.column_name,
        case
          when c.data_type = 'USER-DEFINED' then c.udt_name
          when c.data_type = 'ARRAY' then
            replace(c.udt_name, '_', '') || '[]'
          when c.character_maximum_length is not null then
            c.data_type || '(' || c.character_maximum_length || ')'
          when c.data_type = 'numeric' and c.numeric_precision is not null then
            format('numeric(%s,%s)', c.numeric_precision, coalesce(c.numeric_scale, 0))
          else c.data_type
        end,
        case when c.is_nullable = 'NO' then ' not null' else '' end,
        case when c.column_default is not null then ' default ' || c.column_default else '' end
      ),
      E',\n' order by c.ordinal_position
    ) as cuerpo
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
  group by c.table_name
),

tablas as (
  select string_agg(
    format(E'create table if not exists %I (\n%s\n);', table_name, cuerpo),
    E'\n\n' order by table_name
  ) as t
  from columnas
),

restricciones as (
  select string_agg(
    format('alter table %I add constraint %I %s;',
           rel.relname, con.conname, pg_get_constraintdef(con.oid)),
    E'\n' order by
      /* Primero las claves primarias y únicas: las ajenas y las
         comprobaciones pueden depender de ellas. */
      case con.contype when 'p' then 1 when 'u' then 2 when 'c' then 3 else 4 end,
      rel.relname, con.conname
  ) as t
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public' and rel.relkind = 'r'
),

indices as (
  select string_agg(indexdef || ';', E'\n' order by indexname) as t
  from pg_indexes
  where schemaname = 'public'
    /* Los que respaldan una clave los crea la restricción. */
    and indexname not in (
      select con.conname from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public' and con.contype in ('p', 'u')
    )
),

funciones as (
  select string_agg(pg_get_functiondef(p.oid) || ';', E'\n\n' order by p.proname, p.oid) as t
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
),

disparadores as (
  select string_agg(pg_get_triggerdef(tg.oid) || ';', E'\n' order by tg.tgname) as t
  from pg_trigger tg
  join pg_class rel on rel.oid = tg.tgrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public' and not tg.tgisinternal
),

seguridad as (
  select string_agg(
    format('alter table %I enable row level security;', rel.relname),
    E'\n' order by rel.relname
  ) as t
  from pg_class rel
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public' and rel.relkind = 'r' and rel.relrowsecurity
),

politicas as (
  select string_agg(
    format(
      'create policy %I on %I as %s for %s to %s%s%s;',
      policyname, tablename,
      case permissive when 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      case cmd when 'ALL' then 'all' else lower(cmd) end,
      array_to_string(roles, ', '),
      case when qual is not null then ' using (' || qual || ')' else '' end,
      case when with_check is not null then ' with check (' || with_check || ')' else '' end
    ),
    E'\n' order by tablename, policyname
  ) as t
  from pg_policies
  where schemaname = 'public'
),

permisos as (
  select string_agg(
    format('grant %s on %I to %I;', privilege_type, table_name, grantee),
    E'\n' order by table_name, grantee, privilege_type
  ) as t
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated', 'service_role')
)

select
  '-- ══ TABLAS ══'        || E'\n\n' || coalesce((select t from tablas), '')        || E'\n\n' ||
  '-- ══ RESTRICCIONES ══' || E'\n\n' || coalesce((select t from restricciones), '') || E'\n\n' ||
  '-- ══ ÍNDICES ══'       || E'\n\n' || coalesce((select t from indices), '')       || E'\n\n' ||
  '-- ══ FUNCIONES ══'     || E'\n\n' || coalesce((select t from funciones), '')     || E'\n\n' ||
  '-- ══ DISPARADORES ══'  || E'\n\n' || coalesce((select t from disparadores), '')  || E'\n\n' ||
  '-- ══ PERMISOS ══'      || E'\n\n' || coalesce((select t from permisos), '')      || E'\n\n' ||
  '-- ══ SEGURIDAD ══'     || E'\n\n' || coalesce((select t from seguridad), '')     || E'\n\n' ||
  '-- ══ POLÍTICAS ══'     || E'\n\n' || coalesce((select t from politicas), '')     || E'\n'
  as esquema;
