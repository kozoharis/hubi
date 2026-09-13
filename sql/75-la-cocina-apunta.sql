-- ═══════════════════════════════════════════════════════════════
-- 75 · LA COCINA APUNTA
-- ═══════════════════════════════════════════════════════════════
--
-- La pantalla de la cocina puede apuntar algo en un día. «El jueves
-- viene el fontanero.» Se escribe en la pared, de pie, donde se está
-- teniendo la conversación.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  ESTO CONTRADICE UNA DECISIÓN MÍA, Y ESTÁ BIEN QUE LA CONTRADIGA
--
-- En el paso 74 escribí, para justificar por qué la pared solo podía
-- tachar: «una pared que se saca recados de la manga no la quiere
-- nadie». Haris ha dicho lo contrario — *«es importante que se pueda
-- apuntar algo desde aquí»*— y tiene razón.
--
-- Mi argumento tenía un agujero: **el mismo razonamiento prohibiría la
-- lista de la compra**, que la pared escribe desde el paso 61 y es
-- justamente para lo que sirve tener una tableta en una cocina. Si
-- apuntar «se ha acabado la leche» está bien, apuntar «el jueves viene
-- el fontanero» también.
--
-- Lo que sí hay que hacer es que nazca ACOTADO, y de eso va este paso.
--
-- ─────────────────────────────────────────────────────────────
-- LAS CUATRO ATADURAS
--
-- Una pantalla no escribe un recordatorio cualquiera: escribe uno con
-- la forma exacta de una nota de pared.
--
--     visible_en_casa = true   ·  se apunta EN la pared, así que sale
--                                 en la pared. Apuntar algo que luego
--                                 no se ve sería un agujero negro.
--
--     asignado_a is null       ·  es de la casa, de nadie en concreto.
--                                 Decir «esto es de Conchita» es un
--                                 juicio que hace una persona, no un
--                                 aparato al que cualquiera que entre
--                                 tiene acceso.
--
--     estado = 'pendiente'     ·  nace sin hacer. Nadie apunta algo ya
--                                 hecho.
--
--     creado_por = auth.uid()  ·  a su nombre, y no al de nadie más.
--
-- Las cuatro las comprueba la política, no el código. Si mañana la
-- aplicación manda otra cosa, la base la rechaza.
--
-- ─────────────────────────────────────────────────────────────
-- Y LO QUE SIGUE SIN PODER
--
-- Borrar, no. Cambiar el título o la fecha de algo ya apuntado,
-- tampoco: eso lo sigue impidiendo el disparador del paso 74, que no se
-- toca aquí. Una pantalla añade y tacha. Lo demás se hace desde el
-- móvil, sentado.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop policy "recordatorios_la_cocina_apunta" on recordatorios;
--     drop function la_cocina_apunta(uuid);

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'recordatorios_la_cocina_solo_tacha' and not tgisinternal
  ) then
    raise exception
      'ABORTADO: falta el disparador del paso 74. Sin el, una pantalla que puede '
      'INSERTAR podria ademas cambiar lo ya escrito. El 74 va antes.';
  end if;

  raise notice 'Puerta pasada. El paso 74 esta dado.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA POLÍTICA
-- ═══════════════════════════════════════════════════════════════
/*
  Permisiva: se SUMA a `recordatorios_crear`, que sigue siendo el camino
  de las personas. Esto abre uno nuevo y estrecho, solo para pantallas.

  Las cuatro ataduras van en el `with check`, que es donde Postgres mira
  la fila que se está metiendo. No hay manera de saltárselas desde la
  aplicación.
*/
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


-- ═══════════════════════════════════════════════════════════════
-- 2 · Y UNA MANERA DE PREGUNTARLO DESDE LA APLICACIÓN
-- ═══════════════════════════════════════════════════════════════
/*
  La pared necesita saber si puede enseñar el botón de «Apuntar algo»
  ANTES de que alguien lo pulse. Un botón que falla es peor que ningún
  botón — es la regla que se aplicó con lo de tachar, cuando todavía no
  se podía.

  Podría deducirlo del código («si soy un dispositivo, entonces sí»),
  y sería exactamente el error de siempre: dos reglas para lo mismo, y
  el día que se cambie la política, el botón seguiría ahí mintiendo.

  Así que se pregunta a la base. Y existe además para otra cosa: la
  aplicación puede llamarla y, si la función no existe todavía —el paso
  75 sin dar—, el botón no sale. Ni error ni botón roto.
*/
create or replace function la_cocina_apunta(casa uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select soy_pantalla_de_casa(casa)
$$;

revoke all on function la_cocina_apunta(uuid) from public, anon;
grant execute on function la_cocina_apunta(uuid) to authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════
-- 3 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  casa uuid; laPantalla uuid; alguien uuid; cuantas int;
begin
  select m.hogar_id, m.perfil_id into casa, laPantalla
    from miembros m where m.clase = 'dispositivo' and m.aceptado_en is not null limit 1;

  if laPantalla is null then
    raise notice 'No hay ninguna pantalla con la que probar. Se aplica igual.';
    return;
  end if;

  select m.perfil_id into alguien from miembros m
   where m.hogar_id = casa and m.clase = 'persona' and m.papel = 'propietario' limit 1;

  perform set_config('request.jwt.claim.sub', laPantalla::text, true);

  -- 1 · apunta, con la forma correcta
  set local role authenticated;
  insert into recordatorios
    (hogar_id, titulo, tipo, fecha, creado_por, estado, visible_en_casa, asignado_a)
  values (casa, 'Ensayo del paso 75', 'tarea', current_date, auth.uid(), 'pendiente', true, null);
  get diagnostics cuantas = row_count;
  reset role;

  if cuantas <> 1 then
    raise exception 'ABORTADO: la pantalla no ha podido apuntar nada.';
  end if;
  raise notice '1 · La pantalla apunta. Bien.';

  -- 2 · pero no puede esconderlo de la pared
  begin
    set local role authenticated;
    insert into recordatorios
      (hogar_id, titulo, tipo, fecha, creado_por, estado, visible_en_casa)
    values (casa, 'No deberia entrar', 'tarea', current_date, auth.uid(), 'pendiente', false);
    reset role;
    raise exception 'ABORTADO: la pantalla ha apuntado algo que no sale en la pared.';
  exception when insufficient_privilege then
    reset role;
    raise notice '2 · La pantalla no apunta a escondidas. Bien.';
  end;

  -- 3 · ni se lo puede asignar a una persona
  if alguien is not null then
    begin
      set local role authenticated;
      insert into recordatorios
        (hogar_id, titulo, tipo, fecha, creado_por, estado, visible_en_casa, asignado_a)
      values (casa, 'No deberia entrar', 'tarea', current_date, auth.uid(), 'pendiente', true, alguien);
      reset role;
      raise exception 'ABORTADO: la pantalla ha puesto una tarea a nombre de una persona.';
    exception when insufficient_privilege then
      reset role;
      raise notice '3 · La pantalla no se lo asigna a nadie. Bien.';
    end;
  end if;

  -- 4 · y lo apuntado sigue sin poder cambiarse desde la pared (paso 74)
  begin
    set local role authenticated;
    update recordatorios set titulo = 'Cambiado' where titulo = 'Ensayo del paso 75';
    reset role;
    raise exception 'ABORTADO: la pantalla ha cambiado el titulo de lo que apunto.';
  exception when check_violation then
    reset role;
    raise notice '4 · Lo apuntado no se puede cambiar desde la pared. Bien.';
  end;

  /* Y se deja limpio: esto era una prueba. */
  delete from recordatorios where titulo = 'Ensayo del paso 75';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- Lo que puede hacer una pantalla con la agenda, al completo.
select 'apuntar algo en un dia'          as que_puede_una_pantalla,
       case when exists (select 1 from pg_policies where schemaname='public'
              and tablename='recordatorios' and policyname='recordatorios_la_cocina_apunta')
            then 'SI' else 'NO  ← MAL' end as y_puede
union all
select 'tacharlo',
       case when exists (select 1 from pg_policies where schemaname='public'
              and tablename='recordatorios' and policyname='recordatorios_la_cocina_tacha')
            then 'SI' else 'NO  ← MAL' end
union all
select 'cambiar el titulo o la fecha',
       case when exists (select 1 from pg_trigger
              where tgname='recordatorios_la_cocina_solo_tacha' and not tgisinternal)
            then 'NO' else 'SI  ← MAL' end
union all
select 'ponersela a una persona',   'NO'
union all
select 'apuntar algo que no se vea', 'NO'
union all
select 'borrarlo',
       case when (select nivel_por_rol('casa','agenda')) = 'anadir' then 'SI  ← MAL' else 'NO' end;

commit;
