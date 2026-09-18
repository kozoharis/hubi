-- ═══════════════════════════════════════════════════════════════
-- 85 · VARIOS PLATOS EN UNA COMIDA
-- ═══════════════════════════════════════════════════════════════
--
-- Haris: *«en una cena o comida pueden haber varios platos, no sólo
-- uno. Ahora sólo deja poner uno»*.
--
-- Y es verdad, y estaba escrito a fuego en la base desde el paso 48:
--
--     create unique index menus_uno_por_momento
--       on menus (hogar_id, fecha, momento);
--
-- Un índice único de «una comida y una cena por día». La razón por la
-- que se puso era buena y sigue siéndolo: sin él, dos toques seguidos
-- —o un móvil reintentando con mala cobertura— dejaban dos comidas el
-- martes y nadie sabía cuál mandaba.
--
-- Pero resolvía el duplicado accidental **prohibiendo el caso real**:
-- una comida de verdad son un primero, un segundo y a veces un postre.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE SE HACE, Y POR QUÉ NO ES QUITAR EL ÍNDICE Y YA
--
-- Se cambia el índice por otro que protege de lo mismo sin prohibir lo
-- que hace falta:
--
--     ANTES   una fila por (casa, día, momento)
--     AHORA   una fila por (casa, día, momento, EL PLATO)
--
-- O sea: en la comida del martes caben las lentejas Y la merluza, pero
-- las lentejas no caben dos veces. El duplicado que había que evitar
-- —el mismo plato repetido por un toque de más— sigue siendo
-- imposible, y ahora lo es *por lo que es*, no por dónde está.
--
-- `lower(btrim(que))` para que «Lentejas», «lentejas » y «LENTEJAS»
-- cuenten como el mismo plato. Las dos funciones son inmutables, que
-- es lo que Postgres exige para indexar por ellas.
--
-- ─────────────────────────────────────────────────────────────
-- EL ORDEN DE LOS PLATOS
--
-- No hace falta ninguna columna: `menus` ya tiene `creado_en` desde el
-- paso 48. El orden en que se escriben es el orden en que se comen, y
-- si alguien quiere cambiarlo, quita uno y lo vuelve a poner — que en
-- una casa es más rápido que cualquier cosa que se pueda arrastrar.
--
-- Una columna de orden serían dos sitios donde equivocarse a cambio de
-- nada.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ NO CAMBIA
--
-- Nada de lo que ya hay. Las filas guardadas se quedan exactamente
-- como están, y una casa que sólo ponga un plato por comida no nota
-- absolutamente nada. Esto sólo ABRE una posibilidad.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     -- ⚠️  Antes hay que dejar un solo plato por comida, o el índice
--     --     viejo no se puede crear. Para ver cuáles sobran:
--     --   select fecha, momento, count(*) from menus
--     --    group by 1,2 having count(*) > 1;
--
--     drop index if exists menus_sin_repetir_plato;
--     create unique index menus_uno_por_momento
--       on menus (hogar_id, fecha, momento);
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $p85$
begin
  if to_regclass('public.menus') is null then
    raise exception 'ABORTADO: no existe `menus`. Falta el paso 48.';
  end if;

  raise notice 'Puerta pasada. Menus guardados: %.', (select count(*) from menus);
end $p85$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · FUERA EL QUE PROHIBÍA EL SEGUNDO PLATO
-- ═══════════════════════════════════════════════════════════════
drop index if exists menus_uno_por_momento;


-- ═══════════════════════════════════════════════════════════════
-- 2 · Y EL QUE SIGUE PROHIBIENDO EL PLATO REPETIDO
-- ═══════════════════════════════════════════════════════════════
create unique index if not exists menus_sin_repetir_plato
  on menus (hogar_id, fecha, momento, lower(btrim(que)));

comment on index menus_sin_repetir_plato is
  'En una comida caben varios platos, pero no dos veces el mismo. Paso 85.';

commit;


-- ═══════════════════════════════════════════════════════════════
-- 3 · COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta esto después, una consulta cada vez, y mira que sale lo que
-- pone. Si algo no cuadra, NO sigas: dímelo y lo miramos.

-- 3.1 · El índice viejo ya no está y el nuevo sí.
select indexname
from pg_indexes
where tablename = 'menus'
order by indexname;
-- ESPERADO: sale `menus_sin_repetir_plato` y NO sale
-- `menus_uno_por_momento`.

-- 3.2 · No se ha perdido ni un menú.
select count(*) as menus_guardados from menus;
-- ESPERADO: los mismos que decía el aviso de la puerta, arriba.

-- 3.3 · Y sigue habiendo como mucho un plato de cada en cada comida.
select fecha, momento, count(*) as platos
from menus
group by 1, 2
having count(*) > 1
order by fecha;
-- ESPERADO: ninguna fila, todavía. Cuando pongas un segundo plato en
-- una comida aparecerá ahí, y ése es el día que sabrás que funciona.
