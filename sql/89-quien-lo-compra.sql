-- ═══════════════════════════════════════════════════════════════
-- 89 · QUIÉN LO COMPRA
-- ═══════════════════════════════════════════════════════════════
--
-- Haris: *«desde la cocina, la tablet, sería bueno poder asignar las
-- compras también si fuera necesario»*. Y de las tres maneras de
-- asignar que hay, dos ya se pueden guardar y una no:
--
--     en qué lista va   →  `compra.lista_id`      (paso 77)  ✓
--     para qué menú es  →  `compra.para_menu_id`  (paso 87)  ✓
--     quién lo compra   →  no existe                         ✗
--
-- Esto añade la que falta. Una columna, y nada más.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  `para` NO ES `comprado_por`
--
-- Conviene dejarlo escrito porque se parecen y no tienen nada que ver:
--
--     comprado_por  ·  quién lo compró.   Se escribe SOLO, al tachar.
--                      Es historia: pasado, y nadie lo elige.
--
--     para          ·  a quién le toca.   Se elige a mano, antes.
--                      Es un encargo: futuro, y puede no cumplirse.
--
-- Vacío quiere decir «cualquiera», que es lo normal en una casa: la
-- leche la compra quien pase por el súper. Poner un nombre es la
-- excepción —«el aceite lo traes tú, que pasas por la cooperativa»— y
-- por eso vacío es lo de por defecto y no hay que quitarlo nunca.
--
-- ─────────────────────────────────────────────────────────────
-- `on delete set null`, Y NO `cascade`
--
-- La misma decisión que en el paso 87 y por la misma razón. Si alguien
-- deja la casa, **el aceite sigue haciendo falta**: ya no le toca a
-- nadie, pero no desaparece de la lista. Con `cascade`, quitar a una
-- persona vaciaría media compra sin avisar — de las sorpresas que se
-- descubren en el súper.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ NO CAMBIA
--
-- Nada. La columna nace vacía, todo lo apuntado se queda igual, y
-- ninguna pantalla deja de funcionar si esto no se ejecuta: el código
-- pide la columna y, si la base no la tiene, vuelve a pedir sin ella.
--
-- **Una columna nueva nunca puede ser obligatoria para lo que ya
-- funcionaba.** Es la sexta vez que se escribe en este proyecto.
--
-- Las políticas tampoco se tocan, y esto sí hay que entenderlo antes de
-- seguir. `compra` no tiene permisos por columna —se ha comprobado: no
-- hay un solo `grant insert (…) on compra`—, así que quien puede
-- escribir en la tabla puede escribir en la columna nueva. Y quien
-- puede es esto, desde el paso 71:
--
--     compra_editar  →  soy_de(hogar_id) and puedo_escribir(hogar_id)
--     puedo_escribir →  papel <> 'lector'
--
-- O sea que la pantalla de la cocina ya podía cambiar filas de la
-- compra —de hecho es como tacha la leche—, y por eso asignar desde la
-- tableta no necesita ni un permiso nuevo. No es un descuido de este
-- paso: es que la compra es, a propósito, lo único que un aparato sabe
-- escribir.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop index if exists idx_compra_para;
--     alter table compra drop column if exists para;
--
-- Se pierde a quién le tocaba cada cosa, nada más.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $p89$
begin
  if to_regclass('public.compra') is null then
    raise exception 'ABORTADO: no existe `compra`. Falta el paso 16.';
  end if;

  if to_regclass('public.perfiles') is null then
    raise exception 'ABORTADO: no existe `perfiles`.';
  end if;

  raise notice 'Puerta pasada. Cosas apuntadas ahora mismo: %.',
    (select count(*) from compra where archivado_en is null);
end $p89$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA COLUMNA
-- ═══════════════════════════════════════════════════════════════
alter table compra
  add column if not exists para uuid
    references perfiles(id) on delete set null;

comment on column compra.para is
  'A quien le toca comprarlo. Nulo = cualquiera, que es lo normal. NO confundir con comprado_por, que es quien lo compro de verdad y se escribe solo al tachar. Paso 89.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · Y EL ÍNDICE
-- ═══════════════════════════════════════════════════════════════
/*
  La pregunta que se hace desde el móvil es «¿qué me toca comprar a
  mí?». Parcial —solo lo que tiene a alguien— porque la mayoría de una
  compra no le toca a nadie en concreto, y un índice sobre una columna
  casi toda vacía es un índice que ocupa y no sirve.
*/
create index if not exists idx_compra_para
  on compra (hogar_id, para)
  where para is not null and archivado_en is null;

commit;


-- ═══════════════════════════════════════════════════════════════
-- 3 · COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta esto después, una consulta cada vez, y mira que sale lo que
-- pone. Si algo no cuadra, NO sigas: dímelo y lo miramos.

-- 3.1 · La columna está, y admite vacíos.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'compra' and column_name = 'para';
-- ESPERADO: una fila. `uuid`, `YES`.

-- 3.2 · Y se borra en blando: al quitar a una persona, la cosa se queda.
select rc.delete_rule
from information_schema.referential_constraints rc
join information_schema.key_column_usage k
  on k.constraint_name = rc.constraint_name
where k.table_name = 'compra' and k.column_name = 'para';
-- ESPERADO: `SET NULL`. Si pusiera `CASCADE`, AVISA: quitar a alguien
-- de la casa vaciaria parte de la compra.

-- 3.3 · No hay permisos por columna que dejen fuera a la nueva.
select count(*) as permisos_por_columna
from information_schema.column_privileges
where table_name = 'compra' and grantee = 'authenticated';
-- ESPERADO: 0. Si sale otra cosa, AVISA: entonces habria que dar el
-- permiso tambien sobre `para` y sobre `para_menu_id`, o la tableta
-- podria asignar y no guardarse nada.

-- 3.4 · No se ha perdido nada de lo apuntado.
select count(*) as apuntadas from compra where archivado_en is null;
-- ESPERADO: las mismas que decia el aviso de la puerta, arriba.

-- 3.5 · Y todavia no le toca a nadie, claro.
select count(*) as con_duenyo from compra where para is not null;
-- ESPERADO: 0. Se llena a mano, desde la pared o desde el movil.
