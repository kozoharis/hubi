-- ═══════════════════════════════════════════════════════════════
-- 29 · UNA CONEXIÓN CON GOOGLE POR CADA CASA  (bomba nº 2)
-- ═══════════════════════════════════════════════════════════════
--
-- QUÉ ESTÁ MAL HOY
--
--     create table conexion_drive (
--       id  smallint primary key default 1 check (id = 1),   -- ← aquí
--       refresh_token_cifrado  text,
--       carpeta_raiz_id        text,
--       calendario_id          text,
--       ...
--     );
--
-- `check (id = 1)` significa: **esta tabla no puede tener más de una
-- fila**. Nunca. Está escrito en la base de datos.
--
-- Y en esa única fila vive TODO lo que conecta HUBI con Google:
--
--   · el permiso cifrado de la cuenta,
--   · la carpeta raíz del Drive,
--   · el identificador del calendario HUBI.
--
-- Así que hoy la segunda familia **no puede conectar su Drive**. No es
-- que salga mal: es que no hay dónde guardarlo. Y su calendario
-- tampoco, porque el `calendario_id` está en esa misma fila.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ HACE ESTE ARCHIVO
--
-- Que la clave sea el HOGAR. Una fila por casa: su permiso, su Drive,
-- su calendario. La casa de al lado no existe para ella.
--
-- La columna `id` desaparece: ya no significa nada. Un `smallint` que
-- solo puede valer 1 es un resto del primer día.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠ EL ORDEN IMPORTA — PRIMERO EL DESPLIEGUE, DESPUÉS ESTE SQL
--
-- El código nuevo busca la fila por hogar, y eso ya funciona con la
-- base de datos tal como está hoy (la columna `hogar_id` existe desde
-- el archivo 17 y está rellena). El código VIEJO, en cambio, busca por
-- `id = 1`, que es la columna que este archivo retira.
--
--     Desplegar → ejecutar esto   →  Juan Miguel no nota nada.
--     Ejecutar esto → desplegar   →  Drive deja de funcionar
--                                    hasta que termine el despliegue.
--
-- Se puede ejecutar dos veces seguidas sin romper nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · Que la fila que hay tenga casa ─────────────────────
update conexion_drive
set hogar_id = (select id from hogares order by creado_en limit 1)
where hogar_id is null;


-- ── 2 · Fuera el candado de «solo una fila» ────────────────
/*
  El nombre de la restricción lo pone Postgres, y no siempre es el que
  uno esperaría. Se busca la que comprueba algo sobre `id` en vez de
  suponer cómo se llama.
*/
do $$
declare
  c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class      rel on rel.oid = con.conrelid
    join pg_namespace  nsp on nsp.oid = rel.relnamespace
    where rel.relname = 'conexion_drive'
      and nsp.nspname = 'public'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%id%=%1%'
  loop
    execute format('alter table conexion_drive drop constraint %I', c);
  end loop;
end $$;


-- ── 3 · Una sola fila por casa, y ninguna huérfana ─────────
/*
  Antes de poner la clave hay que estar seguro de que no hay dos filas
  del mismo hogar. Con el `check (id = 1)` era imposible, pero esto
  también se ejecuta en bases de datos que ya vengan tocadas.
*/
do $$
declare
  repetidas int;
begin
  select count(*) into repetidas
  from (
    select hogar_id from conexion_drive group by hogar_id having count(*) > 1
  ) x;

  if repetidas > 0 then
    raise exception
      'Hay % hogares con más de una conexión. Hay que mirarlo a mano antes de seguir.',
      repetidas;
  end if;
end $$;

alter table conexion_drive
  alter column hogar_id set not null;


-- ── 4 · La clave nueva: el hogar ───────────────────────────
do $$
declare
  clave text;
begin
  select con.conname into clave
  from pg_constraint con
  join pg_class      rel on rel.oid = con.conrelid
  join pg_namespace  nsp on nsp.oid = rel.relnamespace
  where rel.relname = 'conexion_drive'
    and nsp.nspname = 'public'
    and con.contype = 'p';

  /* Si la clave que hay ya es la del hogar, no se toca: esto se puede
     ejecutar dos veces sin que la segunda deshaga la primera. */
  if clave is not null and not exists (
    select 1
    from pg_constraint con
    join pg_class     rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any (con.conkey)
    where rel.relname = 'conexion_drive'
      and con.contype = 'p'
      and att.attname = 'hogar_id'
  ) then
    execute format('alter table conexion_drive drop constraint %I', clave);
    clave := null;
  end if;

  if clave is null then
    alter table conexion_drive
      add constraint conexion_drive_pkey primary key (hogar_id);
  end if;
end $$;


-- ── 5 · Y fuera la columna que ya no dice nada ─────────────
/*
  Va la última a propósito. Mientras `id` exista, el código viejo sigue
  funcionando; en cuanto desaparece, deja de hacerlo. Por eso el orden
  de arriba: despliegue primero.
*/
alter table conexion_drive drop column if exists id;


-- ── 6 · Comprobación ───────────────────────────────────────
/*
  Tiene que salir UNA fila, así:

      clave                   columnas   filas   con_permiso
      ─────────────────────   ────────   ─────   ───────────
      conexion_drive_pkey     hogar_id       1             1

  · «columnas» debe decir hogar_id. Si dice `id`, la 4 no se ha
    ejecutado y NO se sigue.
  · «filas» y «con_permiso» deben valer 1: la casa de Juan Miguel,
    con su permiso de Google intacto. Si «con_permiso» sale 0, algo se
    ha perdido por el camino y hay que parar.
*/
select
  con.conname as clave,
  string_agg(att.attname, ', ' order by att.attnum)          as columnas,
  (select count(*) from conexion_drive)                       as filas,
  (select count(*) from conexion_drive
    where refresh_token_cifrado is not null and estado = 'activa') as con_permiso
from pg_constraint con
join pg_class      rel on rel.oid = con.conrelid
join pg_attribute  att on att.attrelid = rel.oid and att.attnum = any (con.conkey)
where rel.relname = 'conexion_drive'
  and con.contype = 'p'
group by con.conname;
