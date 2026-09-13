-- ═══════════════════════════════════════════════════════════════
-- 74 · LA COCINA TACHA
-- ═══════════════════════════════════════════════════════════════
--
-- La pantalla de la cocina puede marcar una tarea como hecha. Y **solo
-- eso**: ni crearlas, ni cambiarlas, ni borrarlas.
--
-- Es lo primero que alguien intenta hacer en una pared, y hasta hoy no
-- se podía. Quedó apuntado en `la-pared-cinco-sitios.md` como lo único
-- que faltaba.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ NO BASTA CON SUBIRLE EL NIVEL
--
-- Lo fácil sería `nivel_por_rol('casa','agenda') = 'anadir'`. Y estaría
-- mal, porque ese mismo nivel gobierna `recordatorios_crear`: la pared
-- podría **inventar tareas**. Una pared que se saca recados de la manga
-- no la quiere nadie.
--
-- Hace falta partir en dos lo que hoy va junto:
--
--     ¿QUÉ FILAS puede tocar?     →  lo decide la RLS
--     ¿QUÉ COLUMNAS de esa fila?  →  lo decide un disparador
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  Y POR QUÉ NO SE HACE CON PERMISOS DE COLUMNA, QUE ERA EL PLAN
--
-- El paso 67 resolvió un caso parecido con `grant update (columnas)`, y
-- aquí se anotó que se haría igual. **No vale, y conviene dejar escrito
-- por qué** para no volver a intentarlo dentro de seis meses.
--
-- Un `grant` es por ROL de base de datos, y en HUBI todo el mundo —las
-- personas y las pantallas— entra como `authenticated`. No hay manera
-- de dar un permiso de columna a las pantallas y no a la familia: son
-- el mismo rol de Postgres.
--
-- Lo que sí distingue a una pantalla es `miembros.clase`, y eso es un
-- dato de una fila, no un privilegio. Se lee dentro de una política o
-- dentro de un disparador — y como una política no sabe QUÉ columna se
-- está tocando, tiene que ser un disparador.
--
-- ─────────────────────────────────────────────────────────────
-- LA COMPARACIÓN VA POR JSON, Y NO COLUMNA A COLUMNA
--
--     to_jsonb(old) - 'estado' - 'hecho_en' - 'hecho_por'
--       is distinct from
--     to_jsonb(new) - 'estado' - 'hecho_en' - 'hecho_por'
--
-- O sea: quita las tres que SÍ se pueden tocar y comprueba que todo lo
-- demás ha quedado igual.
--
-- Escrito columna a columna —`old.titulo is distinct from new.titulo or
-- old.fecha …`— habría que acordarse de añadir cada columna nueva a esa
-- lista, y el día que a alguien se le olvide, la pared podrá escribirla
-- sin que nadie se entere. Así **una columna nueva nace protegida**.
--
-- ─────────────────────────────────────────────────────────────
-- Y SOLO LO QUE YA SE VE EN ELLA
--
-- La política pide `visible_en_casa`. No es redundante con lo que ya
-- hay: la restrictiva del paso 63 filtra la LECTURA, y sin esto una
-- pantalla podría marcar hecha una tarea que ni siquiera puede ver.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop trigger recordatorios_la_cocina_solo_tacha on recordatorios;
--     drop function la_cocina_solo_tacha();
--     drop policy "recordatorios_la_cocina_tacha" on recordatorios;

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
declare falta text;
begin
  foreach falta in array array['soy_pantalla_de_casa', 'soy_de', 'puedo_en_agenda'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = falta
    ) then
      raise exception 'ABORTADO: falta la funcion `%`. Hay pasos anteriores sin dar.', falta;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
     where table_name = 'recordatorios' and column_name = 'visible_en_casa'
  ) then
    raise exception 'ABORTADO: falta `recordatorios.visible_en_casa`. El paso 63 no esta dado.';
  end if;

  raise notice 'Puerta pasada. Pantallas colgadas: %.',
    (select count(*) from miembros where clase = 'dispositivo');
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · QUÉ FILAS · la política
-- ═══════════════════════════════════════════════════════════════
/*
  Permisiva, o sea que se SUMA a `recordatorios_editar` en vez de
  competir con ella. La familia sigue editando por su camino de siempre
  y esto abre uno nuevo, estrecho, solo para las pantallas.

  Y con `with check` además del `using`: sin él, una pantalla podría
  marcar hecha una tarea visible y de paso ponerle `visible_en_casa =
  false` — o sea, hacerla desaparecer de la pared. El disparador de
  abajo también lo impediría; están los dos porque son dos cerraduras
  distintas y ninguna sobra.
*/
drop policy if exists "recordatorios_la_cocina_tacha" on recordatorios;
create policy "recordatorios_la_cocina_tacha"
  on recordatorios for update to authenticated
  using      ( soy_pantalla_de_casa(hogar_id) and coalesce(visible_en_casa, false) )
  with check ( soy_pantalla_de_casa(hogar_id) and coalesce(visible_en_casa, false) );


-- ═══════════════════════════════════════════════════════════════
-- 2 · QUÉ COLUMNAS · el disparador
-- ═══════════════════════════════════════════════════════════════
/*
  Para todo el mundo que NO sea una pantalla, esto no hace nada: se sale
  por la primera línea. Solo se mira lo que toca un aparato.

  No es `security definer` a propósito. `soy_pantalla_de_casa` ya lo es
  y es la única que necesita leer `miembros`; el disparador solo compara
  dos filas que ya tiene delante.
*/
create or replace function la_cocina_solo_tacha()
returns trigger language plpgsql as $$
begin
  if not soy_pantalla_de_casa(new.hogar_id) then
    return new;
  end if;

  if (to_jsonb(old) - 'estado' - 'hecho_en' - 'hecho_por')
       is distinct from
     (to_jsonb(new) - 'estado' - 'hecho_en' - 'hecho_por')
  then
    raise exception
      'Una pantalla de casa solo puede marcar algo hecho o pendiente, nada mas.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists recordatorios_la_cocina_solo_tacha on recordatorios;
create trigger recordatorios_la_cocina_solo_tacha
  before update on recordatorios
  for each row execute function la_cocina_solo_tacha();


-- ═══════════════════════════════════════════════════════════════
-- 3 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
/*
  Cinco cosas, y las cinco de verdad — no preguntando a funciones sino
  intentando escribir:

    1 · la pantalla TACHA lo que se ve en ella
    2 · la pantalla NO cambia el título
    3 · la pantalla NO la esconde de la pared
    4 · la pantalla NO toca lo que no se ve en ella
    5 · y una persona de la familia sigue pudiendo todo
*/
do $$
declare
  casa uuid; laPantalla uuid; alguien uuid; laTarea uuid;
  cuantas int; salio text;
begin
  select m.hogar_id, m.perfil_id into casa, laPantalla
    from miembros m
   where m.clase = 'dispositivo' and m.aceptado_en is not null limit 1;

  if laPantalla is null then
    raise notice 'No hay ninguna pantalla con la que probar. Se aplica igual.';
    return;
  end if;

  select m.perfil_id into alguien from miembros m
   where m.hogar_id = casa and m.clase = 'persona' and m.papel = 'propietario' limit 1;

  /* Una tarea de prueba, visible en la cocina. */
  insert into recordatorios (hogar_id, titulo, tipo, fecha, creado_por, estado, visible_en_casa)
  values (casa, 'Ensayo del paso 74', 'tarea', current_date, alguien, 'pendiente', true)
  returning id into laTarea;

  perform set_config('request.jwt.claim.sub', laPantalla::text, true);

  -- 1 · tacha
  set local role authenticated;
  update recordatorios set estado = 'hecho', hecho_en = now(), hecho_por = auth.uid()
   where id = laTarea;
  get diagnostics cuantas = row_count;
  reset role;

  if cuantas <> 1 then
    raise exception 'ABORTADO: la pantalla no ha podido tachar. El paso no sirve.';
  end if;
  raise notice '1 · La pantalla tacha. Bien.';

  -- 2 · pero no cambia el titulo
  begin
    set local role authenticated;
    update recordatorios set titulo = 'Cambiado por la pared' where id = laTarea;
    reset role;
    raise exception 'ABORTADO: la pantalla ha cambiado el titulo de una tarea. No debe.';
  exception when check_violation then
    reset role;
    raise notice '2 · La pantalla no cambia el titulo. Bien.';
  end;

  -- 3 · ni la esconde de la pared
  begin
    set local role authenticated;
    update recordatorios set visible_en_casa = false where id = laTarea;
    reset role;
    raise exception 'ABORTADO: la pantalla ha escondido una tarea de la pared. No debe.';
  exception when check_violation then
    reset role;
    raise notice '3 · La pantalla no la esconde. Bien.';
  end;

  -- 4 · ni toca lo que no se ve en ella
  /* Ojo: esconderla hay que hacerlo CON OTRA IDENTIDAD. El disparador
     mira quién está tocando, no con qué rol de Postgres, así que con la
     huella de la pantalla todavía puesta se rechazaría a sí mismo —
     y el ensayo fallaría por su propio acierto. */
  perform set_config('request.jwt.claim.sub', alguien::text, true);
  update recordatorios set visible_en_casa = false, estado = 'pendiente' where id = laTarea;

  perform set_config('request.jwt.claim.sub', laPantalla::text, true);
  set local role authenticated;
  update recordatorios set estado = 'hecho' where id = laTarea;
  get diagnostics cuantas = row_count;
  reset role;

  if cuantas <> 0 then
    raise exception
      'ABORTADO: la pantalla ha tachado algo que no se ve en ella. La politica no filtra.';
  end if;
  raise notice '4 · La pantalla no toca lo que no sale en ella. Bien.';

  -- 5 · y una persona sigue pudiendo todo
  if alguien is not null then
    perform set_config('request.jwt.claim.sub', alguien::text, true);
    set local role authenticated;
    update recordatorios set titulo = 'Ensayo del paso 74 (cambiado)', estado = 'hecho'
     where id = laTarea;
    get diagnostics cuantas = row_count;
    reset role;

    if cuantas <> 1 then
      raise exception 'ABORTADO: una persona de la familia ha dejado de poder editar.';
    end if;
    raise notice '5 · La familia sigue pudiendo todo. Bien.';
  end if;

  /* Y se deja limpio: esto era una prueba. */
  delete from recordatorios where id = laTarea;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Lo que puede hacer una pantalla con la agenda, ahora.
--     Tachar SI; crear, cambiar y borrar, NO.
select
  'tachar lo que sale en ella' as que_puede_hacer_una_pantalla,
  case when exists (
    select 1 from pg_policies
     where schemaname='public' and tablename='recordatorios'
       and policyname='recordatorios_la_cocina_tacha'
  ) then 'SI' else 'NO' end   as y_puede
union all
select 'cambiar el titulo o la fecha',
  case when exists (
    select 1 from pg_trigger
     where tgname = 'recordatorios_la_cocina_solo_tacha' and not tgisinternal
  ) then 'NO' else 'SI  ← MAL' end
union all
select 'crear una tarea nueva',
  case when (select nivel_por_rol('casa','agenda')) = 'anadir' then 'SI  ← MAL' else 'NO' end
union all
select 'borrar una tarea',
  case when (select nivel_por_rol('casa','agenda')) = 'anadir' then 'SI  ← MAL' else 'NO' end;

-- 2 · Las políticas de UPDATE de `recordatorios`: las dos, la de
--     siempre y la nueva.
select policyname, permissive
from pg_policies
where schemaname = 'public' and tablename = 'recordatorios' and cmd = 'UPDATE'
order by 1;

commit;
