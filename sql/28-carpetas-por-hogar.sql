-- ═══════════════════════════════════════════════════════════════
-- 28 · LA CLAVE DE `carpetas_drive`  (bomba nº 1)
-- ═══════════════════════════════════════════════════════════════
--
-- QUÉ ESTÁ MAL HOY
--
-- La tabla se creó así, el primer día, cuando solo había una casa:
--
--     create table carpetas_drive (
--       ruta text primary key,   -- ←  aquí está la bomba
--       ...
--     );
--
-- `ruta` es el texto "FINCA/GASTOS/2026/T3/LUZ". Como es la clave
-- ENTERA, esa ruta es UNA SOLA FILA en toda la base de datos.
--
-- Con una familia da igual. Con dos, pasa esto:
--
--   1 · La familia de Juan Miguel guarda una factura de la luz.
--       Se apunta:  "FINCA/GASTOS/2026/T3/LUZ" → carpeta 1a2b3c
--       (1a2b3c es una carpeta del Drive DE JUAN MIGUEL).
--
--   2 · Otra familia guarda su factura de la luz. Su ruta se llama
--       igual, porque las rutas las escribe HUBI y son las mismas
--       palabras.
--
--   3 · HUBI mira su memoria de carpetas, encuentra la fila, y sube
--       el documento a 1a2b3c.
--
--       → La factura de una familia acaba dentro del Drive de otra.
--
-- No falla nada. No sale ningún error. Simplemente ocurre.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ HACE ESTE ARCHIVO
--
-- Que la clave sea (hogar, ruta) en vez de (ruta). A partir de ahí
-- cada casa tiene su propia memoria de carpetas y la de al lado no
-- existe para ella.
--
-- Es invisible: nadie va a notar nada. Ni el nombre de una carpeta
-- cambia, ni se mueve un documento, ni hay que volver a conectar
-- Drive. Es exactamente el tipo de arreglo que hay que hacer ANTES
-- de que entre la segunda familia, porque después ya no se puede
-- hacer sin mirar fila por fila de quién era cada cosa.
--
-- Se puede ejecutar dos veces seguidas sin romper nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · Que ninguna fila se quede sin casa ─────────────────
/*
  Una fila con `hogar_id` a nulo no puede entrar en la clave nueva, y
  además hoy ya es una fila fantasma: no la ve nadie.

  Todo lo que hay ahora mismo es de la casa de Juan Miguel y Conchita
  —la primera— porque hasta hoy no ha habido otra.
*/
update carpetas_drive
set hogar_id = (select id from hogares order by creado_en limit 1)
where hogar_id is null;


-- ── 2 · Y que no pueda volver a pasar ──────────────────────
alter table carpetas_drive
  alter column hogar_id set not null;


-- ── 3 · Fuera la clave vieja ───────────────────────────────
/*
  El nombre de la restricción lo pone Postgres solo, y no siempre se
  llama `carpetas_drive_pkey`. Se busca en vez de suponerlo.
*/
do $$
declare
  clave text;
begin
  select con.conname into clave
  from pg_constraint con
  join pg_class    rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where rel.relname = 'carpetas_drive'
    and nsp.nspname = 'public'
    and con.contype = 'p';

  if clave is not null then
    /* Si ya es la compuesta, no se toca: esto se puede ejecutar
       dos veces sin que la segunda deshaga la primera. */
    if (
      select count(*) from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      where rel.relname = 'carpetas_drive' and con.contype = 'p'
        and array_length(con.conkey, 1) = 1
    ) = 1 then
      execute format('alter table carpetas_drive drop constraint %I', clave);
    end if;
  end if;
end $$;


-- ── 4 · La clave nueva ─────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'carpetas_drive' and con.contype = 'p'
  ) then
    alter table carpetas_drive
      add constraint carpetas_drive_pkey primary key (hogar_id, ruta);
  end if;
end $$;


-- ── 5 · Comprobación ───────────────────────────────────────
/*
  Tiene que salir UNA fila, así:

      clave                   columnas
      ─────────────────────   ──────────────────
      carpetas_drive_pkey     hogar_id, ruta

  Si sale «ruta» a secas, la 3 no se ha ejecutado y NO se sigue.
*/
select
  con.conname as clave,
  string_agg(att.attname, ', ' order by att.attnum) as columnas
from pg_constraint con
join pg_class      rel on rel.oid = con.conrelid
join pg_attribute  att on att.attrelid = rel.oid and att.attnum = any (con.conkey)
where rel.relname = 'carpetas_drive'
  and con.contype = 'p'
group by con.conname;
