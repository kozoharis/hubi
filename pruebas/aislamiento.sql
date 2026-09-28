-- ═══════════════════════════════════════════════════════════════
-- ENSAYO · AISLAMIENTO, SUCESOS Y CONCESIONES
-- ═══════════════════════════════════════════════════════════════
--
-- Comprueba el comportamiento REAL de `sql/95` y `sql/96` antes de que
-- nadie los ejecute en Supabase.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE EJECUTA
--
-- Contra un Postgres cualquiera, en una base de datos DE USAR Y TIRAR:
--
--     createdb ensayo
--     psql -d ensayo -v ON_ERROR_STOP=1 -f pruebas/aislamiento.sql
--     dropdb ensayo
--
-- La base se tira al terminar: eso es el «rollback» de este ensayo.
-- No se ejecuta NUNCA contra Supabase.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ NO COPIA EL SQL QUE PRUEBA
--
-- El ensayo del paso 55 copiaba el texto de la migración para poder
-- probarlo. Funcionó, pero tiene un riesgo evidente: el día que la
-- copia y el original se separen, el ensayo sigue saliendo en verde
-- mientras prueba otra cosa.
--
-- Aquí se incluyen los archivos DE VERDAD con `\i`. Si `sql/95`
-- cambia, este ensayo prueba el cambio. No hay copia que mantener.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE COMPRUEBA · 22 afirmaciones
--
--   1-6    aislamiento entre dos espacios: Ana en A, Bruno en B
--   7-11   capacidad ≠ acceso   ← la prueba técnica de «sponsor ≠ miembro»
--   12-17  sucesos: nadie desde la app, y nada que no esté en la lista
--   18-22  concesiones: vigencia, revocación y varios orígenes a la vez

\set ON_ERROR_STOP on
\pset pager off

-- ═══════════════════════════════════════════════════════════════
-- 0 · EL ANDAMIO
-- ═══════════════════════════════════════════════════════════════
--
-- Lo mínimo de Supabase y de mappel para que las dos migraciones
-- puedan correr: los papeles, `auth.uid()`, y las tres tablas de las
-- que cuelga todo.
--
-- `soy_de()` NO está inventada aquí: es copia literal de
-- `sql/56-los-espacios.sql`, incluida la comprobación de
-- `aceptado_en`, porque probar el aislamiento contra una versión
-- simplificada de la función que lo implementa no probaría nada.

\i pruebas/supabase-de-mentira.sql

create table if not exists perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    text not null,
  creado_en timestamptz not null default now()
);

create table if not exists hogares (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null default 'Mi casa',
  creado_en timestamptz not null default now()
);

create table if not exists miembros (
  hogar_id    uuid not null references hogares(id) on delete cascade,
  perfil_id   uuid not null references perfiles(id) on delete cascade,
  papel       text not null default 'miembro',
  rol         text not null default 'familia',
  aceptado_en timestamptz null,
  unido_en    timestamptz not null default now(),
  primary key (hogar_id, perfil_id)
);

-- Copia literal de sql/56.
create or replace function soy_de(casa uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from miembros m
    where m.perfil_id = auth.uid()
      and m.hogar_id = casa
      and m.aceptado_en is not null
  )
$$;

-- Una tabla de contenido cualquiera, con la política de siempre, para
-- poder demostrar el aislamiento con algo que se lee y se escribe.
create table if not exists notas (
  id       uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references hogares(id) on delete cascade,
  texto    text not null
);
alter table notas enable row level security;
drop policy if exists notas_de_mi_casa on notas;
create policy notas_de_mi_casa on notas
  for all using (soy_de(hogar_id)) with check (soy_de(hogar_id));
grant select, insert, update, delete on notas to authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select on hogares, miembros, perfiles to authenticated;
grant execute on function soy_de(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 1 · LAS MIGRACIONES DE VERDAD
-- ═══════════════════════════════════════════════════════════════

\i sql/95-que-pasa-de-verdad.sql
\i sql/96-lo-que-puede-un-espacio.sql

-- ═══════════════════════════════════════════════════════════════
-- 2 · EL ESCENARIO · Ana en A, Bruno en B
-- ═══════════════════════════════════════════════════════════════

insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222')
on conflict do nothing;

insert into perfiles (id, nombre) values
  ('11111111-1111-4111-8111-111111111111', 'Ana'),
  ('22222222-2222-4222-8222-222222222222', 'Bruno');

insert into hogares (id, nombre) values
  ('aaaa0000-0000-4000-8000-00000000000a', 'Casa de Ana'),
  ('bbbb0000-0000-4000-8000-00000000000b', 'Casa de Bruno');

insert into miembros (hogar_id, perfil_id, papel, aceptado_en) values
  ('aaaa0000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'propietario', now()),
  ('bbbb0000-0000-4000-8000-00000000000b', '22222222-2222-4222-8222-222222222222', 'propietario', now());

insert into notas (hogar_id, texto) values
  ('aaaa0000-0000-4000-8000-00000000000a', 'algo de Ana'),
  ('bbbb0000-0000-4000-8000-00000000000b', 'algo de Bruno');

-- ── El marcador ──────────────────────────────────────────────

create table resultados (n int, que text, esperado text, salio text, bien boolean);

create or replace function afirma(n int, que text, esperado text, salio text)
returns void language sql as $$
  insert into resultados values (n, que, esperado, salio, esperado is not distinct from salio)
$$;

-- Ejecuta algo como alguien y devuelve qué pasó, sin abortar el ensayo.
create or replace function como(quien uuid, sentencia text)
returns text language plpgsql as $$
declare n text;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
  set local role authenticated;
  execute sentencia into n;
  reset role;
  return n::text;
exception when others then
  reset role;
  return 'ERROR:' || sqlstate;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- 3 · AISLAMIENTO · 1 a 6
-- ═══════════════════════════════════════════════════════════════

select afirma(1, 'Ana LEE su espacio A', '1',
  como('11111111-1111-4111-8111-111111111111',
       $q$ select count(*) from notas where hogar_id = 'aaaa0000-0000-4000-8000-00000000000a' $q$));

select afirma(2, 'Ana ESCRIBE en A', '1',
  como('11111111-1111-4111-8111-111111111111',
       $q$ with x as (insert into notas (hogar_id, texto)
           values ('aaaa0000-0000-4000-8000-00000000000a','otra de Ana') returning 1)
           select count(*) from x $q$));

select afirma(3, 'Ana NO lee el espacio B', '0',
  como('11111111-1111-4111-8111-111111111111',
       $q$ select count(*) from notas where hogar_id = 'bbbb0000-0000-4000-8000-00000000000b' $q$));

select afirma(4, 'Ana NO puede escribir en B', 'ERROR:42501',
  como('11111111-1111-4111-8111-111111111111',
       $q$ with x as (insert into notas (hogar_id, texto)
           values ('bbbb0000-0000-4000-8000-00000000000b','colada') returning 1)
           select count(*) from x $q$));

select afirma(5, 'Bruno LEE su espacio B', '1',
  como('22222222-2222-4222-8222-222222222222',
       $q$ select count(*) from notas where hogar_id = 'bbbb0000-0000-4000-8000-00000000000b' $q$));

select afirma(6, 'Bruno NO lee el espacio A', '0',
  como('22222222-2222-4222-8222-222222222222',
       $q$ select count(*) from notas where hogar_id = 'aaaa0000-0000-4000-8000-00000000000a' $q$));

-- ═══════════════════════════════════════════════════════════════
-- 4 · CAPACIDAD ≠ ACCESO · 7 a 11
-- ═══════════════════════════════════════════════════════════════
--
-- La prueba técnica de «sponsor ≠ miembro». Se concede una capacidad
-- al espacio A —como haría un patrocinio— y se comprueba que eso no
-- mueve ni una fila de quién ve qué.

-- Cuántas notas ve Ana ANTES de la concesión.
create temp table antes as
  select como('11111111-1111-4111-8111-111111111111',
              $q$ select count(*) from notas $q$) as n;

insert into concesiones (hogar_id, capacidad, origen) values
  ('aaaa0000-0000-4000-8000-00000000000a', 'ai_documents', 'patrocinio');

select afirma(7, 'La concesion se ha creado', '1',
  (select count(*)::text from concesiones
   where hogar_id = 'aaaa0000-0000-4000-8000-00000000000a' and capacidad = 'ai_documents'));

select afirma(8, 'Ana: su espacio PUEDE ai_documents', 'true',
  como('11111111-1111-4111-8111-111111111111',
       $q$ select puede_el_espacio('aaaa0000-0000-4000-8000-00000000000a','ai_documents')::text $q$));

select afirma(9, 'Bruno pregunta por A: NO puede', 'false',
  como('22222222-2222-4222-8222-222222222222',
       $q$ select puede_el_espacio('aaaa0000-0000-4000-8000-00000000000a','ai_documents')::text $q$));

select afirma(10, 'Bruno no ve NINGUNA concesion del espacio A', '0',
  como('22222222-2222-4222-8222-222222222222',
       $q$ select count(*) from concesiones
           where hogar_id = 'aaaa0000-0000-4000-8000-00000000000a' $q$));

select afirma(11, 'Bruno SIGUE sin leer nada de A', '0',
  como('22222222-2222-4222-8222-222222222222',
       $q$ select count(*) from notas where hogar_id = 'aaaa0000-0000-4000-8000-00000000000a' $q$));

select afirma(12, 'Ana ve las MISMAS notas que antes de la concesion',
  (select n from antes),
  como('11111111-1111-4111-8111-111111111111', $q$ select count(*) from notas $q$));

select afirma(13, 'Conceder no ha creado ningun miembro', '2',
  (select count(*)::text from miembros));

-- ═══════════════════════════════════════════════════════════════
-- 5 · SUCESOS · 13 a 18
-- ═══════════════════════════════════════════════════════════════

select afirma(14, 'La app NO puede escribir sucesos', 'ERROR:42501',
  como('11111111-1111-4111-8111-111111111111',
       $q$ with x as (insert into sucesos (tipo, hogar_id)
           values ('nota_creada','aaaa0000-0000-4000-8000-00000000000a') returning 1)
           select count(*) from x $q$));

select afirma(15, 'La app NO puede leer sucesos', 'ERROR:42501',
  como('11111111-1111-4111-8111-111111111111', $q$ select count(*) from sucesos $q$));

do $$ begin
  begin
    insert into sucesos (tipo, hogar_id) values ('lo_que_sea','aaaa0000-0000-4000-8000-00000000000a');
    perform afirma(16, 'Un tipo fuera de la lista se rechaza', 'rechazado', 'ACEPTADO');
  exception when check_violation then
    perform afirma(16, 'Un tipo fuera de la lista se rechaza', 'rechazado', 'rechazado');
  end;

  begin
    insert into sucesos (tipo, hogar_id, detalle)
    values ('nota_creada','aaaa0000-0000-4000-8000-00000000000a','{"origen":"movil","clave_no_autorizada":"x"}');
    perform afirma(17, 'Clave no autorizada en detalle (el caso del ?|)', 'rechazado', 'ACEPTADO');
  exception when check_violation then
    perform afirma(17, 'Clave no autorizada en detalle (el caso del ?|)', 'rechazado', 'rechazado');
  end;

  begin
    insert into sucesos (tipo, hogar_id, detalle)
    values ('nota_creada','aaaa0000-0000-4000-8000-00000000000a','{"origen":"llamar al abogado el martes"}');
    perform afirma(18, 'Texto libre METIDO en una clave permitida', 'rechazado', 'ACEPTADO');
  exception when check_violation then
    perform afirma(18, 'Texto libre METIDO en una clave permitida', 'rechazado', 'rechazado');
  end;

  begin
    insert into sucesos (tipo) values ('nota_creada');
    perform afirma(19, 'Una nota SIN espacio se rechaza', 'rechazado', 'ACEPTADO');
  exception when check_violation then
    perform afirma(19, 'Una nota SIN espacio se rechaza', 'rechazado', 'rechazado');
  end;
end $$;

insert into sucesos (tipo) values ('cuenta_creada');
select afirma(20, 'cuenta_creada SI admite espacio nulo', '1',
  (select count(*)::text from sucesos where tipo = 'cuenta_creada'));

insert into sucesos (tipo, hogar_id, detalle)
values ('nota_creada','aaaa0000-0000-4000-8000-00000000000a','{"origen":"cocina","via":"voz","rol":"ayuda"}');
select afirma(21, 'Las tres claves buenas se aceptan', '1',
  (select count(*)::text from sucesos where tipo = 'nota_creada'));

-- ═══════════════════════════════════════════════════════════════
-- 6 · CONCESIONES · vigencia, revocacion y varios origenes
-- ═══════════════════════════════════════════════════════════════

-- Una prueba que empezo hace diez dias y termino ayer. El CHECK
-- concesiones_vigencia_coherente no admite que "hasta" sea anterior a
-- "desde", asi que una concesion caducada se escribe con las dos fechas
-- en el pasado, que es como ocurre de verdad.
insert into concesiones (hogar_id, capacidad, origen, desde, hasta) values
  ('aaaa0000-0000-4000-8000-00000000000a', 'ai_voice', 'prueba',
   current_date - 10, current_date - 1);

select afirma(22, 'Una concesion caducada NO cuenta', 'false',
  como('11111111-1111-4111-8111-111111111111',
       $q$ select puede_el_espacio('aaaa0000-0000-4000-8000-00000000000a','ai_voice')::text $q$));

-- La misma capacidad, un segundo origen. Se revoca el patrocinio y la
-- concesion de la casa tiene que seguir en pie. Esto es lo que la
-- clave unica (hogar, capacidad) habria hecho imposible.
insert into concesiones (hogar_id, capacidad, origen) values
  ('aaaa0000-0000-4000-8000-00000000000a', 'ai_documents', 'casa');

update concesiones set revocada_en = now()
 where hogar_id = 'aaaa0000-0000-4000-8000-00000000000a'
   and capacidad = 'ai_documents' and origen = 'patrocinio';

select afirma(23, 'Revocado el patrocinio, la concesion de la casa sigue', 'true',
  como('11111111-1111-4111-8111-111111111111',
       $q$ select puede_el_espacio('aaaa0000-0000-4000-8000-00000000000a','ai_documents')::text $q$));

update concesiones set revocada_en = now()
 where hogar_id = 'aaaa0000-0000-4000-8000-00000000000a' and capacidad = 'ai_documents';

select afirma(24, 'Revocadas las dos, se apaga', 'false',
  como('11111111-1111-4111-8111-111111111111',
       $q$ select puede_el_espacio('aaaa0000-0000-4000-8000-00000000000a','ai_documents')::text $q$));

-- Borrar el espacio se lo lleva todo.
delete from hogares where id = 'aaaa0000-0000-4000-8000-00000000000a';

select afirma(25, 'Borrar el espacio borra sus sucesos', '0',
  (select count(*)::text from sucesos where hogar_id = 'aaaa0000-0000-4000-8000-00000000000a'));

select afirma(26, 'Borrar el espacio borra sus concesiones', '0',
  (select count(*)::text from concesiones where hogar_id = 'aaaa0000-0000-4000-8000-00000000000a'));

-- ═══════════════════════════════════════════════════════════════
-- 7 · EL VEREDICTO
-- ═══════════════════════════════════════════════════════════════

\echo ''
\echo '═══ ENSAYO 95 · 96 ═══'
\echo ''

select
  lpad(n::text, 2) as "nº",
  case when bien then 'OK ' else 'MAL' end as "va",
  que as "afirmacion",
  case when bien then '' else 'esperaba ' || coalesce(esperado,'?') || ', salio ' || coalesce(salio,'?') end as "que paso"
from resultados order by n;

\echo ''

select
  count(*) filter (where bien)     as "en verde",
  count(*) filter (where not bien) as "en rojo",
  case when count(*) filter (where not bien) = 0
       then 'ENSAYO SUPERADO'
       else 'ENSAYO FALLIDO — no ejecutar en Supabase' end as "veredicto"
from resultados;
