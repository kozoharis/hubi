-- ═══════════════════════════════════════════════════════════════
-- 88 · LO QUE YA ESTABA APUNTADO, ATADO A SU MENÚ
-- ═══════════════════════════════════════════════════════════════
--
-- Haris, después del paso 87: *«sobre la compra, no dice si es para un
-- menú específico»*.
--
-- Y tiene razón, y la explicación es aburrida pero importante: el paso
-- 87 añadió la columna **vacía**. A partir de ahí, cada vez que alguien
-- conteste «no tengo esto» en un menú, lo que falte se apunta con su
-- menú dentro. Pero **lo que ya estaba en la lista de ayer no tiene de
-- dónde sacarlo**: se apuntó cuando esa columna no existía.
--
-- O sea que la pantalla no mentía — es que no había nada que enseñar.
--
-- ─────────────────────────────────────────────────────────────
-- Y SÍ SE PUEDE AVERIGUAR, SIN INVENTAR NADA
--
-- Desde el paso 81, cada menú guarda **lo que le faltaba** en
-- `menus.faltan`. Así que la pareja existe, solo que escrita del otro
-- lado:
--
--     menus.faltan          →  ['6 dientes de ajo', 'cilantro']
--     compra.que            →  '6 dientes de ajo'
--
-- Esto ata una con otra. No adivina: solo une lo que ya está escrito en
-- los dos sitios.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  Y CON TRES CANDADOS, PORQUE UNIR POR TEXTO ES DELICADO
--
-- 1 · Solo cosas **sin menú todavía** (`para_menu_id is null`). Lo que
--     ya esté atado no se toca: el dato de verdad manda sobre esta
--     reconstrucción.
--
-- 2 · Solo lo que sigue **abierto y sin comprar**. Reescribir la
--     historia de la compra de hace tres semanas no le sirve a nadie.
--
-- 3 · Solo cuando la pareja es **única**. Si «cilantro» aparece en dos
--     menús distintos, no hay manera de saber de cuál vino y se queda
--     sin atar. Mejor sin decir nada que diciendo algo falso — es el
--     punto 8 del planteamiento: *«nunca guardar silenciosamente
--     información dudosa»*.
--
-- Se compara sin mayúsculas y sin espacios de más, que es como lo
-- escribiría una persona.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     update compra set para_menu_id = null where para_menu_id is not null;
--
-- ⚠️  Ojo: eso también borra lo que se haya atado bien DESPUÉS, no solo
-- lo de este script. No hay forma de distinguirlos, y tampoco hace
-- falta: la columna se vuelve a llenar sola en cuanto se compruebe un
-- menú.
--
-- Se puede ejecutar más de una vez sin estropear nada: lo ya atado no
-- se vuelve a tocar.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $p88$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_name = 'compra' and column_name = 'para_menu_id'
  ) then
    raise exception 'ABORTADO: falta el paso 87, que es el que crea `compra.para_menu_id`.';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_name = 'menus' and column_name = 'faltan'
  ) then
    raise exception 'ABORTADO: falta el paso 81, que es el que guarda lo que le falta a cada menu.';
  end if;

  raise notice 'Puerta pasada. Sin comprar y sin menu ahora mismo: %.',
    (select count(*) from compra
      where archivado_en is null and not comprado and para_menu_id is null);
end $p88$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · ATAR LAS QUE TENGAN UNA SOLA PAREJA POSIBLE
-- ═══════════════════════════════════════════════════════════════
with candidatas as (
  select
    c.id                          as compra_id,
    m.id                          as menu_id,
    count(*) over (partition by c.id) as cuantos
  from compra c
  join menus m
    on m.hogar_id = c.hogar_id
   and exists (
         select 1
           from unnest(coalesce(m.faltan, '{}'::text[])) as f(texto)
          where lower(btrim(f.texto)) = lower(btrim(c.que))
       )
  where c.archivado_en is null
    and not c.comprado
    and c.para_menu_id is null
)
update compra c
   set para_menu_id = x.menu_id
  from candidatas x
 where c.id = x.compra_id
   and x.cuantos = 1;

commit;


-- ═══════════════════════════════════════════════════════════════
-- 2 · COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta esto después, una consulta cada vez.

-- 2.1 · Cuántas han quedado atadas, y a qué.
select c.que, m.fecha, m.momento, m.que as plato
from compra c
join menus m on m.id = c.para_menu_id
where c.archivado_en is null and not c.comprado
order by m.fecha, m.momento, c.que;
-- ESPERADO: las cosas que venian de un menu, cada una con su dia y su
-- plato. Si ves alguna que NO era de ese menu, avisame: se deshace con
-- un `update ... set para_menu_id = null where id = '...'`.

-- 2.2 · Y las que siguen sin menu, que es lo normal.
select count(*) as de_la_casa
from compra
where archivado_en is null and not comprado and para_menu_id is null;
-- ESPERADO: la leche, el papel de cocina y todo lo que de verdad es de
-- la casa. Mas las que aparecian en dos menus a la vez, que se quedan
-- fuera a proposito.

-- 2.3 · Y no se ha perdido ni una.
select count(*) as sin_comprar
from compra where archivado_en is null and not comprado;
-- ESPERADO: 2.1 mas 2.2, y las mismas que decia el aviso de la puerta
-- mas las que ya estuvieran atadas antes.
