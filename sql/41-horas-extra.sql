-- ═══════════════════════════════════════════════════════════════
-- 41 · NO SON LAS HORAS DEL DÍA. SON LAS DE MÁS.
-- ═══════════════════════════════════════════════════════════════
--
-- El SQL 40 puso `dias_en_casa.horas` para apuntar cuántas horas
-- estuvo cada día. Y eso, pensándolo con la cabeza de quien lo va a
-- usar, está mal planteado.
--
-- ─────────────────────────────────────────────────────────────
-- LO NORMAL NO HAY QUE APUNTARLO
--
-- El horario está acordado: viene lunes, miércoles y viernes de nueve
-- a una. Eso no cambia y no hace falta escribirlo cada día — pedirlo
-- es dar trabajo a cambio de un dato que ya sabían los dos.
--
-- Lo que SÍ hay que apuntar es lo que se sale de lo acordado: el día
-- que se quedó una hora más. Eso es lo que a fin de mes hay que
-- cuadrar, y es lo que se olvida.
--
-- El efecto es el que importa: el estado normal pasa a ser NO ESCRIBIR
-- NADA. Un campo que hay que rellenar todos los días se rellena mal a
-- la tercera semana; uno que solo se toca los días raros se toca los
-- días raros.
--
-- ─────────────────────────────────────────────────────────────
-- Y POR ESO SE RENOMBRA LA COLUMNA
--
-- Una columna que se llama `horas` y guarda «horas de más» es la clase
-- de mentira que cuesta una tarde dentro de seis meses, cuando alguien
-- sume la columna creyendo que son las trabajadas.
--
-- Se puede ejecutar más de una vez sin estropear nada, y también si el
-- SQL 40 todavía no se ha ejecutado.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · La tabla, por si el 40 no se ha ejecutado ──────────
create table if not exists dias_en_casa (
  hogar_id    uuid not null references hogares(id) on delete cascade,
  quien       uuid not null references perfiles(id) on delete cascade,
  fecha       date not null,
  nota        text,
  apuntado_en timestamptz not null default now(),
  cambiado_en timestamptz,
  primary key (quien, fecha)
);


-- ── 2 · `horas` pasa a ser `horas_extra` ───────────────────
/*
  Se renombra si estaba, y si no se crea. Las dos ramas, porque esto
  se puede encontrar la base de datos de tres maneras: con el 40
  ejecutado, sin él, o con el 41 ya pasado.
*/
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dias_en_casa' and column_name = 'horas'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dias_en_casa' and column_name = 'horas_extra'
  ) then
    alter table dias_en_casa rename column horas to horas_extra;
    raise notice 'Renombrada: horas → horas_extra.';
  end if;
end $$;

alter table dias_en_casa
  add column if not exists horas_extra numeric(4,2);

/*
  El tope baja de 24 a 12. No es capricho: 24 horas de más en un día
  no existe, y un tope realista es lo que convierte un dedo gordo en
  un error visible en vez de en un número que se suma al mes.
*/
alter table dias_en_casa drop constraint if exists dias_en_casa_horas_check;
alter table dias_en_casa drop constraint if exists dias_en_casa_horas_extra_check;
alter table dias_en_casa
  add constraint dias_en_casa_horas_extra_check
  check (horas_extra is null or (horas_extra > 0 and horas_extra <= 12));

comment on column dias_en_casa.horas_extra is
  'Horas de MÁS sobre el horario acordado. Nulo = un día normal. '
  'Nunca son las horas trabajadas: el horario de siempre no se apunta.';


-- ── 3 · Índice ─────────────────────────────────────────────
create index if not exists idx_dias_en_casa
  on dias_en_casa (hogar_id, fecha desc);

/*
  Y uno para lo que de verdad se consulta a fin de mes: los días que
  tuvieron horas de más. Los normales no se miran nunca.
*/
create index if not exists idx_dias_con_extra
  on dias_en_casa (quien, fecha desc) where horas_extra is not null;


-- ── 4 · Las políticas, por si falta el 40 ──────────────────
/*
  Idénticas a las del 40. Se repiten aquí porque este archivo tiene
  que dejar la tabla utilizable aunque sea el único que se ejecute —
  una tabla con RLS puesto y sin políticas no deja hacer nada, y el
  fallo se ve como «no se guarda» sin más pistas.
*/
alter table dias_en_casa enable row level security;

drop policy if exists dias_leer on dias_en_casa;
create policy dias_leer on dias_en_casa
  for select to authenticated using (
    hogar_id = mi_hogar()
    and (coalesce(mi_rol(), 'familia') <> 'ayuda' or quien = auth.uid())
  );

/* SOLO ELLA, Y SOLO LO SUYO. Ni siquiera quien creó la casa: un parte
   que el empleador puede escribir no es el parte de ella. */
drop policy if exists dias_crear on dias_en_casa;
create policy dias_crear on dias_en_casa
  for insert to authenticated with check (
    hogar_id = mi_hogar() and quien = auth.uid()
  );

drop policy if exists dias_editar on dias_en_casa;
create policy dias_editar on dias_en_casa
  for update to authenticated using (
    hogar_id = mi_hogar() and quien = auth.uid() and fecha >= current_date - 7
  );

drop policy if exists dias_borrar on dias_en_casa;
create policy dias_borrar on dias_en_casa
  for delete to authenticated using (
    hogar_id = mi_hogar() and quien = auth.uid() and fecha >= current_date - 7
  );


-- ── 5 · Comprobación ───────────────────────────────────────
/*
  TRES resultados.

  1 · La columna se llama `horas_extra` y NO queda ninguna `horas`.
      Si salieran las dos, el renombrado no se hizo y hay dos sitios
      donde mirar lo mismo.

  2 · Las cuatro políticas, con `auth.uid()` en las tres que escriben.

  3 · Cuántos partes hay y cuántos tienen horas de más. Lo normal es
      que el segundo número sea MUCHO menor: si fueran parecidos, es
      que se está apuntando la jornada entera y no lo que se sale de
      ella.
*/
select column_name as columna, data_type as tipo
from information_schema.columns
where table_schema = 'public' and table_name = 'dias_en_casa'
  and column_name in ('horas', 'horas_extra');

select policyname as politica, cmd as para_que,
       coalesce(qual, with_check) ilike '%auth.uid()%' as solo_ella
from pg_policies
where tablename = 'dias_en_casa'
order by policyname;

select
  count(*)                                          as partes,
  count(*) filter (where horas_extra is not null)    as con_horas_de_mas,
  coalesce(sum(horas_extra), 0)                      as horas_de_mas
from dias_en_casa;
