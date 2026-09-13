-- ═══════════════════════════════════════════════════════════════
-- 76 · LA COCINA PONE NOMBRE
-- ═══════════════════════════════════════════════════════════════
--
-- Lo que apunta la pared puede llevar el nombre de alguien. «Conchita:
-- llevar los papeles a Silvia.»
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  Y ES LA SEGUNDA VEZ QUE ME CORRIGE EL MISMO ARGUMENTO
--
-- En el paso 75 escribí, para justificar el `asignado_a is null`:
--
--     «decir "esto es de Conchita" es un juicio que hace una persona,
--      no un aparato al que tiene acceso cualquiera que entre»
--
-- Suena bien y está mal, por lo mismo que estaba mal en el 75: **el
-- aparato no juzga nada**. Quien está delante de la pared escribiendo
-- es una persona, y es exactamente la persona que sabe de quién es el
-- recado. Confundir «la pantalla» con «quien la toca» llevó ya a
-- prohibir apuntar; aquí llevaba a prohibir poner nombre.
--
-- Así se apunta un recado en una cocina desde que existen las cocinas.
--
-- Queda escrito porque es un error de forma, no de detalle: **cuando
-- diga «un aparato no debería poder X», comprobar primero si lo que de
-- verdad estoy diciendo es «una persona de pie no debería poder X»** —
-- que casi nunca es cierto.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE SÍ HAY QUE ATAR
--
-- El nombre que se pone tiene que ser el de **alguien de esta casa y
-- que sea una persona**. Dos cosas, y las dos importan:
--
--   · de esta casa — si no, sabiendo un identificador se le podría
--     colar un recado a alguien de otra familia;
--   · y una persona — a una pantalla de cocina no se le asignan
--     recados, y el día que una casa tenga dos pantallas, la lista de
--     «para quién» las enseñaría como si fueran gente.
--
-- Se comprueba con una función, no con un `exists` escrito dentro de la
-- política: la política se evalúa con los permisos de quien escribe, y
-- una pantalla no tiene por qué poder leer `miembros` para que esto
-- funcione. La función es `security definer` y contesta sí o no.
--
-- ─────────────────────────────────────────────────────────────
-- Y LO QUE SIGUE SIN PODER
--
-- Cambiar a quién está puesto algo ya apuntado, no: eso lo sigue
-- impidiendo el disparador del paso 74, que no se toca aquí. La pared
-- pone nombre al apuntarlo y ahí se acaba su parte.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     Volver a poner la política del 75, con `asignado_a is null`.
--     Está entera al final del fichero.

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'recordatorios'
       and policyname = 'recordatorios_la_cocina_apunta'
  ) then
    raise exception 'ABORTADO: falta la politica del paso 75. El 75 va antes.';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgname = 'recordatorios_la_cocina_solo_tacha' and not tgisinternal
  ) then
    raise exception 'ABORTADO: falta el disparador del paso 74.';
  end if;

  raise notice 'Puerta pasada. Los pasos 74 y 75 estan dados.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · ¿ES ALGUIEN DE ESTA CASA, Y ES UNA PERSONA?
-- ═══════════════════════════════════════════════════════════════
create or replace function es_persona_de_la_casa(casa uuid, quien uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from miembros m
     where m.hogar_id   = casa
       and m.perfil_id  = quien
       and m.clase      = 'persona'
       and m.aceptado_en is not null
  )
$$;

revoke all on function es_persona_de_la_casa(uuid, uuid) from public, anon;
grant execute on function es_persona_de_la_casa(uuid, uuid) to authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════
-- 2 · LA POLÍTICA, CON EL NOMBRE PERMITIDO
-- ═══════════════════════════════════════════════════════════════
/*
  Lo único que cambia respecto al 75 es la línea de `asignado_a`. Las
  otras tres ataduras se quedan como estaban:

    visible_en_casa = true   ·  se apunta EN la pared, sale en la pared
    estado = 'pendiente'     ·  nace sin hacer
    creado_por = auth.uid()  ·  a su nombre y no al de nadie más

  Y `asignado_a` puede ser nulo —de la casa, de nadie en concreto— o
  alguien de esta casa que sea una persona. Nada más.
*/
drop policy if exists "recordatorios_la_cocina_apunta" on recordatorios;
create policy "recordatorios_la_cocina_apunta"
  on recordatorios for insert to authenticated
  with check (
    soy_pantalla_de_casa(hogar_id)
    and coalesce(visible_en_casa, false)
    and estado = 'pendiente'
    and creado_por = auth.uid()
    and ( asignado_a is null or es_persona_de_la_casa(hogar_id, asignado_a) )
  );


-- ═══════════════════════════════════════════════════════════════
-- 3 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  casa uuid; laPantalla uuid; alguien uuid; deOtraCasa uuid; otraPantalla uuid;
  cuantas int;
begin
  select m.hogar_id, m.perfil_id into casa, laPantalla
    from miembros m where m.clase = 'dispositivo' and m.aceptado_en is not null limit 1;

  if laPantalla is null then
    raise notice 'No hay ninguna pantalla con la que probar. Se aplica igual.';
    return;
  end if;

  select m.perfil_id into alguien from miembros m
   where m.hogar_id = casa and m.clase = 'persona' and m.aceptado_en is not null limit 1;

  perform set_config('request.jwt.claim.sub', laPantalla::text, true);

  -- 1 · con nombre de alguien de la casa
  if alguien is not null then
    set local role authenticated;
    insert into recordatorios
      (hogar_id, titulo, tipo, fecha, creado_por, estado, visible_en_casa, asignado_a)
    values (casa, 'Ensayo 76 con nombre', 'tarea', current_date, auth.uid(), 'pendiente', true, alguien);
    get diagnostics cuantas = row_count;
    reset role;

    if cuantas <> 1 then
      raise exception 'ABORTADO: la pantalla no ha podido poner nombre. El paso no sirve.';
    end if;
    raise notice '1 · La pantalla pone el nombre de alguien de la casa. Bien.';
  end if;

  -- 2 · y sin nombre, como antes
  set local role authenticated;
  insert into recordatorios
    (hogar_id, titulo, tipo, fecha, creado_por, estado, visible_en_casa, asignado_a)
  values (casa, 'Ensayo 76 sin nombre', 'tarea', current_date, auth.uid(), 'pendiente', true, null);
  get diagnostics cuantas = row_count;
  reset role;

  if cuantas <> 1 then
    raise exception 'ABORTADO: la pantalla ha dejado de poder apuntar sin nombre.';
  end if;
  raise notice '2 · Y sigue pudiendo apuntar sin nombre, para la casa. Bien.';

  -- 3 · pero no a nombre de alguien de OTRA casa
  select m.perfil_id into deOtraCasa from miembros m
   where m.hogar_id <> casa and m.clase = 'persona' limit 1;

  if deOtraCasa is not null then
    begin
      set local role authenticated;
      insert into recordatorios
        (hogar_id, titulo, tipo, fecha, creado_por, estado, visible_en_casa, asignado_a)
      values (casa, 'No deberia entrar', 'tarea', current_date, auth.uid(), 'pendiente', true, deOtraCasa);
      reset role;
      raise exception 'ABORTADO: la pantalla ha puesto un recado a alguien de otra casa.';
    exception when insufficient_privilege then
      reset role;
      raise notice '3 · No puede ponerselo a alguien de otra casa. Bien.';
    end;
  end if;

  -- 4 · ni a nombre de otra PANTALLA
  select m.perfil_id into otraPantalla from miembros m
   where m.hogar_id = casa and m.clase = 'dispositivo' limit 1;

  begin
    set local role authenticated;
    insert into recordatorios
      (hogar_id, titulo, tipo, fecha, creado_por, estado, visible_en_casa, asignado_a)
    values (casa, 'No deberia entrar', 'tarea', current_date, auth.uid(), 'pendiente', true, otraPantalla);
    reset role;
    raise exception 'ABORTADO: la pantalla ha puesto un recado a nombre de otra pantalla.';
  exception when insufficient_privilege then
    reset role;
    raise notice '4 · No se lo pone a una pantalla. Bien.';
  end;

  -- 5 · y lo apuntado sigue sin poder cambiar de dueño desde la pared
  if alguien is not null then
    begin
      set local role authenticated;
      update recordatorios set asignado_a = null where titulo = 'Ensayo 76 con nombre';
      reset role;
      raise exception 'ABORTADO: la pantalla ha cambiado de dueno algo ya apuntado.';
    exception when check_violation then
      reset role;
      raise notice '5 · No cambia de dueno lo ya apuntado. Bien.';
    end;
  end if;

  /* Y se deja limpio: esto era una prueba. */
  delete from recordatorios where titulo like 'Ensayo 76%';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════
select 'apuntar algo en un dia'                as que_puede_una_pantalla, 'SI' as y_puede
union all select 'ponerle el nombre de alguien de la casa', 'SI'
union all select 'tacharlo',                                'SI'
union all select 'ponerselo a alguien de otra casa',        'NO'
union all select 'ponerselo a otra pantalla',               'NO'
union all select 'cambiar el titulo, la fecha o el dueno',  'NO'
union all select 'apuntar algo que no se vea',              'NO'
union all select 'borrarlo',                                'NO';

commit;


-- ═══════════════════════════════════════════════════════════════
-- PARA VOLVER ATRÁS
-- ═══════════════════════════════════════════════════════════════
/*
  No se ejecuta. Deja la política como la dejó el paso 75.

begin;
drop policy if exists "recordatorios_la_cocina_apunta" on recordatorios;
create policy "recordatorios_la_cocina_apunta"
  on recordatorios for insert to authenticated
  with check (
    soy_pantalla_de_casa(hogar_id)
    and coalesce(visible_en_casa, false)
    and asignado_a is null
    and estado = 'pendiente'
    and creado_por = auth.uid()
  );
commit;
*/
