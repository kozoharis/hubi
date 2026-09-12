-- ═══════════════════════════════════════════════════════════════
-- 70 · LA COCINA NO VE PAPELES
-- ═══════════════════════════════════════════════════════════════
--
-- **Esto cierra un agujero que está abierto ahora mismo**, y lo
-- encontró Haris colgando la primera pantalla: la tableta de la cocina
-- veía sus documentos. Todos.
--
-- Reproducido en la base de ensayo:
--
--     la pantalla tal como se daba de alta  →  1 papel
--     la misma con ve_todo = false          →  0 papeles
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ, Y SON DOS COSAS
--
-- **1 · `miembros.ve_todo` tiene `default true`.** El alta de la
-- pantalla (`/api/pantallas`) no lo ponía, así que nacía con él puesto.
--
-- **2 · Y `ve_todo` se salta el techo del aparato.** La función que
-- guarda los papeles empieza así:
--
--     when coalesce((select ve_todo from miembros
--                     where perfil_id = auth.uid() and hogar_id = casa), false)
--     then true          -- ← y se acabó
--
-- No pregunta por el nivel, ni por la clase, ni por nada. `nivel_en`
-- dice `nada` en Papeles para un dispositivo —comprobado— pero
-- `puedo_ver_carpeta` ni lo consulta.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE ESTO DESTAPA, Y ES MÁS GRANDE
--
-- Las cuatro funciones viejas de permisos **no pasan por el modelo de
-- niveles**:
--
--     puedo_ver_carpeta   ·  puedo_guardar_en
--     puedo_escribir      ·  puedo_en_agenda
--
-- Era el paso 62 del plan —«`puedo_escribir` como cáscara · CAMBIA LAS
-- 57 · va SOLO»— y nunca se ejecutó. Lo que se ejecutó fue el 62a (los
-- `coalesce`), el 62b y el 62c, que son otra cosa.
--
-- O sea que hoy el techo de `clase` solo gobierna donde hay una
-- política RESTRICTIVA que lo aplique: `movimientos` (62b, 62c),
-- `recordatorios` y `notas` (63, 64). `documentos` se quedó fuera,
-- porque el 63 solo le QUITÓ la condición de `visibilidad` y no le
-- añadió ninguna.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ HACE ESTE PASO, Y QUÉ NO
--
-- **Sí:** pone `ve_todo` y `escribe_todo` a falso en las pantallas que
-- ya existan, y añade a `documentos` la restrictiva que le faltaba.
-- Con las dos, un aparato deja de ver papeles aunque alguien vuelva a
-- ponerle `ve_todo` mañana.
--
-- **No:** no convierte las cuatro funciones en cáscaras. Eso cambia lo
-- que significan las 57 políticas permisivas de HUBI y no puede ir de
-- propina dentro de un arreglo urgente. Va solo, con su ensayo y su
-- comparación fila a fila, y es lo siguiente que hay que hacer.
--
-- Tampoco toca `categorias`: la plantilla de la aplicación lee las
-- actividades de ahí para pintarse, y cerrarla a ciegas dejaría a la
-- pantalla sin arrancar. Los NOMBRES de las carpetas siguen siendo
-- visibles para un aparato — se anota y se resuelve en el paso de las
-- cáscaras, que es donde corresponde.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop policy "documentos_la_cocina_no" on documentos;

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
declare cuantas int;
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'soy_pantalla_de_casa'
  ) then
    raise exception 'ABORTADO: falta `soy_pantalla_de_casa`. El paso 61 no esta dado.';
  end if;

  select count(*) into cuantas from miembros where clase = 'dispositivo';
  raise notice 'Puerta pasada. Pantallas dadas de alta: %.', cuantas;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LAS QUE YA EXISTEN, A CERO
-- ═══════════════════════════════════════════════════════════════
/*
  `ve_todo` y `escribe_todo` son atajos de la época anterior a los
  niveles: significan «a esta persona no se le mira el reparto por
  carpetas». Para una persona de la familia está bien. Para un aparato
  colgado en una pared no significa nada bueno.

  Va con un `update` directo y no con `poner_rol` porque `poner_rol` no
  admite un dispositivo: el disparador del 66 le impide llevar rol.
*/
update miembros
   set ve_todo = false, escribe_todo = false
 where clase = 'dispositivo'
   and (ve_todo or escribe_todo);


-- ═══════════════════════════════════════════════════════════════
-- 2 · Y LA PUERTA CERRADA, NO SOLO EL ATAJO
-- ═══════════════════════════════════════════════════════════════
/*
  Lo de arriba arregla las filas de hoy. Esto arregla el modelo: aunque
  mañana alguien le devuelva el `ve_todo` a una pantalla —a mano, o por
  un alta mal escrita—, seguirá sin ver un papel.

  Restrictiva y no permisiva: se SUMA a las que hay en vez de competir
  con ellas. Es la misma forma del 63 y del 64.

  Y sin escapatoria a propósito. En el 63 la restrictiva de
  `recordatorios` lleva un `or coalesce(visible_en_casa, false)`, porque
  ahí sí hay cosas que deben salir en la cocina. Aquí no hay ninguna:
  `nivel_por_rol('casa','papeles')` es `nada`, y `nada` es nada.
*/
create policy "documentos_la_cocina_no"
  on documentos as restrictive for select to authenticated
  using ( not soy_pantalla_de_casa(hogar_id) );


-- ═══════════════════════════════════════════════════════════════
-- 3 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  casa uuid; laPantalla uuid; alguien uuid;
  ve_la_pantalla int; ve_la_persona int;
begin
  select m.hogar_id, m.perfil_id into casa, laPantalla
    from miembros m where m.clase = 'dispositivo' limit 1;

  if laPantalla is null then
    raise notice 'No hay ninguna pantalla con la que probar. Se aplica igual.';
  else
    perform set_config('request.jwt.claim.sub', laPantalla::text, true);
    set local role authenticated;
    select count(*) into ve_la_pantalla from documentos;
    reset role;

    if ve_la_pantalla > 0 then
      raise exception
        'ABORTADO: la pantalla todavia ve % papeles. El paso no sirve.', ve_la_pantalla;
    end if;
    raise notice 'La pantalla de la cocina: 0 papeles. Cerrado.';
  end if;

  /* Y que una PERSONA sigue viendo los suyos. Sin esto, un paso que
     cierre de más pasaría por bueno. */
  select m.perfil_id, m.hogar_id into alguien, casa
    from miembros m
   where m.clase = 'persona' and m.papel = 'propietario' and m.aceptado_en is not null
   limit 1;

  if alguien is not null and exists (select 1 from documentos where hogar_id = casa) then
    perform set_config('request.jwt.claim.sub', alguien::text, true);
    set local role authenticated;
    select count(*) into ve_la_persona from documentos;
    reset role;

    if ve_la_persona = 0 then
      raise exception
        'ABORTADO: el dueno de la casa ha dejado de ver sus papeles. No se aplica nada.';
    end if;
    raise notice 'El dueno de la casa: sigue viendo sus % papeles.', ve_la_persona;
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Las pantallas de la casa, y sus dos atajos apagados.
--     Las dos columnas de la derecha, en false.
select
  p.nombre        as la_pantalla,
  h.nombre        as en_la_casa,
  m.ve_todo       as ve_todo_DEBE_SER_false,
  m.escribe_todo  as escribe_todo_DEBE_SER_false,
  m.rol           as rol_DEBE_SER_null
from miembros m
join perfiles p on p.id = m.perfil_id
join hogares h  on h.id = m.hogar_id
where m.clase = 'dispositivo'
order by 2, 1;

-- 2 · La restrictiva, puesta.
select
  count(*) filter (where permissive = 'PERMISSIVE')  as permisivas,
  count(*) filter (where permissive = 'RESTRICTIVE') as restrictivas_DEBE_SER_1
from pg_policies
where schemaname = 'public' and tablename = 'documentos' and cmd = 'SELECT';

-- 3 · Y el recordatorio de lo que queda abierto: las cuatro funciones
--     viejas que NO pasan por el modelo de niveles. Las cuatro tienen
--     que salir en «NO» — este paso no las toca, y el siguiente sí.
select
  p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as la_funcion,
  case when p.prosrc ~ 'nivel_en|puede\(' then 'SI' else 'NO' end      as pasa_por_el_modelo
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('puedo_ver_carpeta','puedo_guardar_en','puedo_escribir','puedo_en_agenda')
order by 1;

commit;
