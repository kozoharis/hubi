-- ═══════════════════════════════════════════════════════════════
-- 69 · LO QUE SE VE EN LA COCINA
-- ═══════════════════════════════════════════════════════════════
--
-- El paso 63 creó `recordatorios.visible_en_casa` y
-- `notas.visible_en_casa`, y las dejó **a nulo a propósito**: nulo se
-- lee como «no se enseña», y lo desconocido se queda en casa.
--
-- La consecuencia es que hoy, si se colgara una pantalla en la cocina,
-- se vería **vacía**. Alguien tiene que decidir qué sale. Y este paso
-- es esa decisión.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ ESTO NO ES UN `UPDATE` DENTRO DE UN SCRIPT
--
-- Lo era en la primera versión del modelo: «lo que nace de Salud va a
-- false, el resto a true». Y se descartó por escrito
-- (`modelo-63-visible-en-casa.md`, §6) por dos motivos que siguen
-- valiendo:
--
--   · **`recordatorios` no tiene `categoria_id`.** No hay forma de
--     saber, mirando la fila, si aquello salió de Salud. Lo único que
--     hay es `tipo`, y en cinco de los seis caminos que crean estas
--     filas el `tipo` lo adivina una expresión regular sobre el
--     título (`deducirTipo`, `lib/tablon.ts:20`).
--
--   · Y sobre todo: **decidir qué cuelga de la pared de una cocina no
--     es una migración.** Es una decisión de la familia, y tiene que
--     verse la lista entera antes de aceptarla.
--
-- Así que esto NO decide nada. Crea el sitio donde se guarda la
-- decisión y la función que la aplica. Quien decide es la pantalla de
-- Ajustes, con los números delante.
--
-- ─────────────────────────────────────────────────────────────
-- LA REGLA QUE PROTEGE LO YA DECIDIDO
--
-- Desde el 63, una tarea concreta se puede marcar a mano («esto sí sale
-- en la cocina») desde su propia ficha. Si aplicar la decisión general
-- pisara esas marcas, el interruptor de la ficha sería mentira: lo que
-- alguien decidió el martes se borraría el miércoles sin avisar.
--
-- Por eso `poner_al_dia_la_cocina` **solo toca lo que está a nulo**, o
-- sea lo que nadie ha decidido nunca.
--
-- Y existe la forma fuerte —`tambien_lo_ya_decidido`— para cuando de
-- verdad se quiere volver a empezar. Es un argumento aparte, con su
-- nombre largo, porque tiene que costar escribirlo y la pantalla tiene
-- que preguntarlo aparte.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop function poner_al_dia_la_cocina(uuid, text[], boolean, boolean);
--     alter table hogares drop column tipos_en_casa, drop column notas_en_casa;

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if not exists (
    select 1 from pg_attribute
     where attrelid = 'recordatorios'::regclass and attname = 'visible_en_casa'
       and attnum > 0 and not attisdropped
  ) then
    raise exception 'ABORTADO: falta `recordatorios.visible_en_casa`. El paso 63 no esta dado.';
  end if;

  if exists (
    select 1 from pg_attribute
     where attrelid = 'hogares'::regclass and attname = 'tipos_en_casa'
       and attnum > 0 and not attisdropped
  ) then
    raise exception 'ABORTADO: `hogares.tipos_en_casa` ya existe. Este paso ya se dio.';
  end if;

  raise notice 'Puerta pasada: el 63 esta dado y este paso no.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · DÓNDE SE GUARDA LA DECISIÓN
-- ═══════════════════════════════════════════════════════════════
/*
  Anulables y sin valor por defecto, igual que `visible_en_casa` en el
  63 y `categorias.ambito` en el 60: **nulo significa «todavía nadie lo
  ha decidido»**, que es distinto de «se ha decidido que no». La
  pantalla necesita poder distinguir las dos cosas para saber si
  enseñar «vamos a decidirlo» o «esto es lo que hay puesto».

  `tipos_en_casa` guarda los tipos de recordatorio que SÍ salen. Hoy
  son siete y los pone `deducirTipo` (`lib/tablon.ts`):

      tarea · recado · vencimiento · coche · papeles · cita · farmacia

  No lleva `check` con esa lista a propósito. El día que HUBI reconozca
  un tipo nuevo, un `check` haría fallar el guardado con un error que
  no diría esto; sin él, un tipo desconocido en la lista simplemente no
  encuentra filas y no hace nada.

  `notas_en_casa` es un sí o un no: el tablón no tiene tipos.
*/
alter table hogares
  add column tipos_en_casa text[],
  add column notas_en_casa boolean;

comment on column hogares.tipos_en_casa is
  'Que tipos de recordatorio salen en la pantalla de la cocina. Nulo = sin decidir. '
  'Lo escribe `poner_al_dia_la_cocina`, nunca la app directamente.';

comment on column hogares.notas_en_casa is
  'Si los recados del tablon salen en la pantalla de la cocina. Nulo = sin decidir.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · Y QUE NO SE ESCRIBAN A MANO
-- ═══════════════════════════════════════════════════════════════
/*
  La lección del 66 y del 67, aplicada a `hogares`, que se quedó fuera
  de aquella tanda. Hoy `authenticated` puede escribir esto:

      id, nombre, creado_en, usa_compra, impuesto

  `id` es la clave que referencian catorce tablas, y `creado_en` no lo
  cambia nadie nunca. Ninguna de las dos la escribe HUBI.

  Y las dos nuevas tampoco: las escribe `poner_al_dia_la_cocina`, que
  es `security definer` y por tanto no pasa por estos permisos. Si la
  app pudiera escribirlas sueltas, se podría dejar la casa diciendo que
  en la cocina se ven las citas médicas sin que las filas cambiaran, o
  al revés — dos verdades distintas para lo mismo.
*/
revoke update on table hogares from authenticated;
grant  update (nombre, usa_compra, impuesto) on table hogares to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 3 · APLICAR LA DECISIÓN
-- ═══════════════════════════════════════════════════════════════
/*
  Guarda la decisión Y la aplica a lo que ya hay, en la misma llamada:
  si fueran dos, cabría quedarse a medias y tener la casa diciendo una
  cosa y las filas otra.

  Devuelve cuántas cosas ha tocado, para que la pantalla pueda decir
  «he marcado 7 cosas» en vez de «hecho». Con personas mayores delante,
  una confirmación que no dice qué ha pasado obliga a ir a comprobarlo.
*/
create or replace function poner_al_dia_la_cocina(
  casa uuid,
  los_tipos text[],
  con_las_notas boolean,
  /* La forma fuerte: vuelve a decidir TAMBIÉN lo que alguien marcó a
     mano. Nombre largo y valor por defecto seguro, a propósito. */
  tambien_lo_ya_decidido boolean default false
)
returns table (cosas_tocadas int, recados_tocados int)
language plpgsql security definer set search_path = public as $$
declare
  n_cosas int := 0;
  n_recados int := 0;
begin
  if not soy_de(casa) then
    raise exception 'No eres de esa casa.';
  end if;
  if soy_pantalla_de_casa(casa) then
    raise exception 'Una pantalla de casa no decide lo que se ve en ella.';
  end if;

  /* Quién decide lo que cuelga de la pared: la familia. No quien tenga
     permiso de escritura en algún sitio —eso incluye a quien ayuda en
     casa y al asesor, y ni uno ni otro deciden esto—. */
  if not (es_propietario(casa) or mi_rol(casa) = 'familia') then
    raise exception 'Esto lo decide la familia.';
  end if;

  update hogares
     set tipos_en_casa = coalesce(los_tipos, array[]::text[]),
         notas_en_casa = coalesce(con_las_notas, false)
   where id = casa;

  update recordatorios r
     set visible_en_casa = (r.tipo = any(coalesce(los_tipos, array[]::text[])))
   where r.hogar_id = casa
     and (tambien_lo_ya_decidido or r.visible_en_casa is null);
  get diagnostics n_cosas = row_count;

  update notas n
     set visible_en_casa = coalesce(con_las_notas, false)
   where n.hogar_id = casa
     and (tambien_lo_ya_decidido or n.visible_en_casa is null);
  get diagnostics n_recados = row_count;

  return query select n_cosas, n_recados;
end $$;

comment on function poner_al_dia_la_cocina(uuid, text[], boolean, boolean) is
  'Guarda que se ve en la pantalla de la cocina y lo aplica a lo que ya hay. Solo '
  'toca lo que esta a nulo —lo que nadie ha decidido— salvo que se pida la forma '
  'fuerte con `tambien_lo_ya_decidido`. La decide la familia.';

/* Como manda el 68b: ni `public` ni `anon`. */
revoke execute on function poner_al_dia_la_cocina(uuid, text[], boolean, boolean)
  from public, anon;
grant  execute on function poner_al_dia_la_cocina(uuid, text[], boolean, boolean)
  to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 4 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  casa uuid; dueno uuid; otro uuid;
  unaCita uuid; unaTarea uuid;
  tocadas int; recados int; ok boolean;
begin
  select m.hogar_id, m.perfil_id into casa, dueno
    from miembros m
   where m.papel = 'propietario' and m.clase = 'persona' and m.aceptado_en is not null
   limit 1;

  if casa is null then
    raise notice 'Sin datos con los que probar. Se aplica igual.';
    return;
  end if;

  /* Dos cosas en la agenda: una cita (que NO debe salir) y una tarea
     (que sí). Y la tarea se marca a mano como que NO sale, para
     comprobar que la forma suave respeta lo ya decidido. */
  insert into recordatorios (hogar_id, titulo, tipo, creado_por, fecha)
    values (casa, 'Medico', 'cita', dueno, current_date) returning id into unaCita;
  insert into recordatorios (hogar_id, titulo, tipo, creado_por, fecha, visible_en_casa)
    values (casa, 'Sacar la basura', 'tarea', dueno, current_date, false) returning id into unaTarea;

  perform set_config('request.jwt.claim.sub', dueno::text, true);

  -- ── 1 · la forma suave ──
  set local role authenticated;
  select p.cosas_tocadas, p.recados_tocados into tocadas, recados
    from poner_al_dia_la_cocina(casa, array['tarea','recado','vencimiento','coche'], false) p;
  reset role;

  if (select visible_en_casa from recordatorios where id = unaCita) is not false then
    raise exception 'ABORTADO: una cita medica ha quedado visible en la cocina.';
  end if;
  raise notice 'La cita medica NO sale en la cocina: correcto.';

  if (select visible_en_casa from recordatorios where id = unaTarea) is not false then
    raise exception 'ABORTADO: se ha pisado una marca puesta a mano.';
  end if;
  raise notice 'Lo marcado a mano: RESPETADO.';

  if (select tipos_en_casa from hogares where id = casa) is null then
    raise exception 'ABORTADO: la decision no se ha guardado en la casa.';
  end if;
  raise notice 'La decision queda guardada en la casa. Cosas tocadas: %.', tocadas;

  -- ── 2 · la forma fuerte SÍ la pisa ──
  set local role authenticated;
  perform poner_al_dia_la_cocina(casa, array['tarea','recado','vencimiento','coche'], false, true);
  reset role;
  if (select visible_en_casa from recordatorios where id = unaTarea) is not true then
    raise exception 'ABORTADO: la forma fuerte no ha vuelto a decidir lo ya decidido.';
  end if;
  raise notice 'La forma fuerte SI vuelve a decidirlo todo: correcto.';

  -- ── 3 · quien no es de la familia, no decide ──
  select m.perfil_id into otro
    from miembros m
   where m.hogar_id = casa and m.clase = 'persona'
     and m.papel <> 'propietario' and m.rol is distinct from 'familia'
     and m.aceptado_en is not null
   limit 1;

  if otro is not null then
    perform set_config('request.jwt.claim.sub', otro::text, true);
    begin
      set local role authenticated;
      perform poner_al_dia_la_cocina(casa, array['tarea'], true);
      reset role; ok := true;
    exception when others then reset role; ok := false; end;
    if ok then
      raise exception 'ABORTADO: alguien que no es de la familia ha podido decidir la cocina.';
    end if;
    raise notice 'Quien no es de la familia: BLOQUEADO.';
  end if;

  -- ── 4 · y que la app no lo pueda escribir a pelo ──
  perform set_config('request.jwt.claim.sub', dueno::text, true);
  begin
    set local role authenticated;
    update hogares set tipos_en_casa = array['cita','farmacia'] where id = casa;
    reset role; ok := true;
  exception when others then reset role; ok := false; end;
  if ok then
    raise exception 'ABORTADO: todavia se puede escribir `tipos_en_casa` a mano.';
  end if;
  raise notice 'Escribir la decision a mano: BLOQUEADO.';

  /* Las de prueba no se quedan. */
  delete from recordatorios where id in (unaCita, unaTarea);
  update hogares set tipos_en_casa = null, notas_en_casa = null where id = casa;
  update recordatorios set visible_en_casa = null where hogar_id = casa;
  update notas set visible_en_casa = null where hogar_id = casa;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Las dos columnas nuevas, y a nulo en todas las casas.
--     «sin_decidir» tiene que ser igual que «casas».
select
  count(*)                                       as casas,
  count(*) filter (where tipos_en_casa is null)  as sin_decidir,
  count(*) filter (where notas_en_casa is null)  as sin_decidir_los_recados
from hogares;

-- 2 · Qué columnas de `hogares` puede escribir la app.
--     TIENEN que ser tres: nombre, usa_compra, impuesto.
select string_agg(a.attname, ', ' order by a.attnum) as columnas_que_escribe_la_app
from pg_attribute a
where a.attrelid = 'hogares'::regclass
  and a.attnum > 0 and not a.attisdropped
  and has_column_privilege('authenticated', a.attrelid, a.attnum, 'update');

-- 3 · La función, cerrada como manda el 68b.
select
  has_function_privilege('anon',
    'poner_al_dia_la_cocina(uuid, text[], boolean, boolean)', 'execute')
      as la_llama_anon_DEBE_SER_false,
  has_function_privilege('authenticated',
    'poner_al_dia_la_cocina(uuid, text[], boolean, boolean)', 'execute')
      as la_llama_quien_ha_entrado_DEBE_SER_true;

-- 4 · Y que no queda nada marcado de las pruebas.
--     Las dos en cero.
select
  count(*) filter (where visible_en_casa is not null) as recordatorios_marcados_DEBE_SER_0,
  (select count(*) from notas where visible_en_casa is not null) as notas_marcadas_DEBE_SER_0
from recordatorios;

commit;
