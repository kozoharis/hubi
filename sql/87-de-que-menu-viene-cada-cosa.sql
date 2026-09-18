-- ═══════════════════════════════════════════════════════════════
-- 87 · DE QUÉ MENÚ VIENE CADA COSA DE LA COMPRA
-- ═══════════════════════════════════════════════════════════════
--
-- Haris: *«si has seleccionado algún ingrediente desde el menú que te
-- haga falta, yo lo pondría: esto es para esto. Sobre todo si es para
-- el menú, colocar una nota, porque sin ello no se puede cocinar y nos
-- quedamos sin menú y luego a improvisar»*.
--
-- Y ahí hay un agujero de verdad, no una cuestión de diseño.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE PASABA
--
-- Desde el paso 81, cuando alguien contesta «no tengo esto» en la
-- comprobación de un menú, lo que falta se apunta en la compra. Pero se
-- apunta **como una cosa más**:
--
--     insert into compra (hogar_id, que, lista_id, anadido_por)
--
-- O sea que «cilantro» acaba en la lista de la compra, entre el papel
-- de cocina y las bolsas de basura, **sin que quede escrito para qué
-- es**. Y las tres cosas que Haris pide —decir para qué es, decir para
-- cuándo, y avisar de que sin eso no hay cena— se apoyan todas en el
-- mismo dato, que no existía.
--
-- La regla, otra vez: *lo que no se guarda no se puede enseñar.*
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE SE AÑADE
--
-- Una columna: `compra.para_menu_id`. Nada más.
--
-- Con ella, la pantalla de la cocina puede decir:
--
--     CILANTRO          Para la cena del jueves · Lentejas
--
-- y ordenar por el día del menú, que es el único orden que importa en
-- una compra: lo de mañana antes que lo del sábado.
--
-- ─────────────────────────────────────────────────────────────
-- `on delete set null`, Y NO `cascade`
--
-- Importa. Si alguien quita el menú del jueves, **el cilantro sigue
-- apuntado**: ya no se sabe para qué era, pero la casa sigue sin
-- cilantro. Con `cascade` se borraría de la compra, y entonces quitar
-- un plato vaciaría media lista sin avisar — la clase de sorpresa que
-- se descubre en el súper.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ NO CAMBIA
--
-- Nada. La columna nace vacía y todo lo que hay apuntado ahora se queda
-- exactamente igual: sin menú, o sea «de casa». Las políticas no se
-- tocan —una columna nueva no cambia quién ve qué— y ninguna pantalla
-- deja de funcionar si esto no se ejecuta: el código pide la columna y,
-- si la base no la tiene, vuelve a pedir sin ella.
--
-- **Una columna nueva nunca puede ser obligatoria para lo que ya
-- funcionaba.** Es la quinta vez que se escribe en este proyecto.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop index if exists idx_compra_para_menu;
--     alter table compra drop column if exists para_menu_id;
--
-- Se pierde el «para qué es» de lo que haya apuntado, nada más.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $p87$
begin
  if to_regclass('public.compra') is null then
    raise exception 'ABORTADO: no existe `compra`. Falta el paso 15.';
  end if;

  if to_regclass('public.menus') is null then
    raise exception 'ABORTADO: no existe `menus`. Falta el paso 48.';
  end if;

  raise notice 'Puerta pasada. Cosas apuntadas ahora mismo: %.',
    (select count(*) from compra where archivado_en is null);
end $p87$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA COLUMNA
-- ═══════════════════════════════════════════════════════════════
alter table compra
  add column if not exists para_menu_id uuid
    references menus(id) on delete set null;

comment on column compra.para_menu_id is
  'El menu para el que hace falta esto. Nulo = es de la casa. Al quitar el menu se queda en nulo, no se borra de la compra. Paso 87.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · Y EL ÍNDICE
-- ═══════════════════════════════════════════════════════════════
/*
  La pantalla de la cocina pregunta «de esta casa, lo que no está
  comprado, ¿qué viene de un menú?». Sin índice, eso recorre la tabla
  entera; con él, va directo. Parcial —solo las que tienen menú— porque
  la mayoría de la compra de una casa no viene de ninguno.
*/
create index if not exists idx_compra_para_menu
  on compra (para_menu_id)
  where para_menu_id is not null;

commit;


-- ═══════════════════════════════════════════════════════════════
-- 3 · COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta esto después, una consulta cada vez, y mira que sale lo que
-- pone. Si algo no cuadra, NO sigas: dímelo y lo miramos.

-- 3.1 · La columna está, y admite vacíos.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'compra' and column_name = 'para_menu_id';
-- ESPERADO: una fila. `uuid`, `YES`.

-- 3.2 · Y se borra en blando: al quitar un menú, la cosa se queda.
select rc.delete_rule
from information_schema.referential_constraints rc
join information_schema.key_column_usage k
  on k.constraint_name = rc.constraint_name
where k.table_name = 'compra' and k.column_name = 'para_menu_id';
-- ESPERADO: `SET NULL`. Si pusiera `CASCADE`, AVISA: quitar un plato
-- borraria cosas de la compra.

-- 3.3 · No se ha perdido nada de lo apuntado.
select count(*) as apuntadas from compra where archivado_en is null;
-- ESPERADO: las mismas que decia el aviso de la puerta, arriba.

-- 3.4 · Y todavia ninguna viene de un menu, claro.
select count(*) as con_menu from compra where para_menu_id is not null;
-- ESPERADO: 0. Se llenara sola a partir de la proxima vez que alguien
-- conteste «no tengo esto» en la comprobacion de un menu.
