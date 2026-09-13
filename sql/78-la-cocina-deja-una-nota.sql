-- ═══════════════════════════════════════════════════════════════
-- 78 · LA COCINA DEJA UNA NOTA
-- ═══════════════════════════════════════════════════════════════
--
-- Haris: *«lo de las notas y el calendario sería bueno que pueda
-- apuntarse… y también por voz»*.
--
-- El calendario ya lo hace desde el paso 75. Las notas no: la pestaña
-- Notas de la pared solo LEE, y una pared que enseña el corcho de la
-- casa pero no deja clavar nada en él es media pared.
--
-- ─────────────────────────────────────────────────────────────
-- ESTO NO ABRE `notas_crear`. AÑADE UNA POLÍTICA APARTE
--
-- Y es importante. `notas_crear` es la de las personas y pide
-- `puedo_en_agenda()`, que para una pantalla da `false` desde el paso
-- 71 y tiene que seguir dándolo: una pantalla NO tiene permiso de
-- agenda, y tocar esa función para que lo tuviera le abriría de paso
-- los recordatorios, los avisos y todo lo demás.
--
-- Las políticas permisivas se SUMAN. Así que aquí va otra, propia de
-- la pared, con sus propias condiciones. Quien no sea una pantalla ni
-- la nota, y `notas_crear` sigue diciendo exactamente lo que decía.
--
-- ─────────────────────────────────────────────────────────────
-- LAS TRES CONDICIONES, Y POR QUÉ CADA UNA
--
-- **1 · `visible_en_casa` tiene que ser `true`.**
-- No es un capricho: la restrictiva del paso 63 dice que una pantalla
-- solo LEE lo que está marcado para la casa. Sin esta condición, la
-- pared podría escribir una nota y no volver a verla nunca — se
-- guardaría bien y desaparecería. Es el peor fallo posible, porque
-- parece que funciona.
--
-- **2 · `escrita_por` tiene que ser ella misma.**
-- Lo de siempre: nadie escribe en nombre de otro.
--
-- **3 · `para` tiene que ir vacío.**
-- Ésta es la única que parece una restricción y hay que justificarla,
-- porque en el paso 76 me equivoqué justo por el otro lado.
--
-- No es que una pantalla no pueda decidir de quién es algo — ya
-- decidimos que sí, porque quien está delante es una persona. Es que
-- una nota **dirigida** y a la vez **colgada en la cocina** es una
-- contradicción: dirigirla sirve para que la vea quien tiene que
-- verla, y colgarla en la pared hace que la vea cualquiera que entre
-- en la casa. Las dos cosas a la vez no significan nada.
--
-- Las notas de la pared son del corcho: para la casa. Una nota para
-- una persona se deja desde el móvil.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop policy if exists notas_la_cocina_apunta on notas;
--     drop function if exists la_cocina_deja_notas(uuid);

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.notas') is null then
    raise exception 'ABORTADO: no existe `notas`. Falta el paso 35.';
  end if;

  if to_regprocedure('soy_pantalla_de_casa(uuid)') is null then
    raise exception 'ABORTADO: no existe `soy_pantalla_de_casa`. Falta el paso 63.';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_name = 'notas' and column_name = 'visible_en_casa'
  ) then
    raise exception 'ABORTADO: `notas` no tiene `visible_en_casa`. Falta el paso 63.';
  end if;

  if to_regprocedure('la_cocina_apunta(uuid)') is null then
    raise exception 'ABORTADO: falta el paso 75. Se dan en orden: 74, 75, 76, 77, 78.';
  end if;

  raise notice 'Puerta pasada.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA POLÍTICA
-- ═══════════════════════════════════════════════════════════════
drop policy if exists notas_la_cocina_apunta on notas;

create policy notas_la_cocina_apunta on notas
  for insert to authenticated
  with check (
    soy_pantalla_de_casa(hogar_id)
    and escrita_por = auth.uid()
    and para is null
    and coalesce(visible_en_casa, false) = true
  );

comment on policy notas_la_cocina_apunta on notas is
  'Una pantalla de cocina puede clavar una nota en el corcho de la casa: para la casa y visible en la pared. Paso 78.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · Y LA PREGUNTA, PARA QUE LA PANTALLA NO ENSEÑE UN BOTÓN ROTO
-- ═══════════════════════════════════════════════════════════════
/*
  La misma idea que `la_cocina_apunta` del paso 75: la aplicación no
  deduce si puede, lo PREGUNTA. Así, el día que esta política se quite,
  el botón desaparece solo en vez de empezar a dar errores.
*/
create or replace function la_cocina_deja_notas(casa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select soy_pantalla_de_casa(casa)
     and exists (select 1 from pg_policies
                  where tablename = 'notas'
                    and policyname = 'notas_la_cocina_apunta')
$$;

revoke all on function la_cocina_deja_notas(uuid) from public, anon;
grant execute on function la_cocina_deja_notas(uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 3 · LAS COMPROBACIONES, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  casa uuid; pantalla uuid; persona uuid; laNota uuid; cuantas int; salio boolean;
begin
  select m.hogar_id, m.perfil_id into casa, pantalla
    from miembros m
   where m.clase = 'dispositivo' and m.aceptado_en is not null limit 1;

  if casa is null then
    raise notice 'No hay ninguna pantalla con la que probar. Se aplica igual.';
    return;
  end if;

  select m.perfil_id into persona
    from miembros m
   where m.hogar_id = casa and m.clase = 'persona' and m.aceptado_en is not null limit 1;

  -- ── 1 · La pantalla deja una nota para la casa ──
  perform set_config('request.jwt.claim.sub', pantalla::text, true);
  set local role authenticated;

  insert into notas (hogar_id, texto, escrita_por, visible_en_casa)
       values (casa, 'Prueba del paso 78', pantalla, true)
    returning id into laNota;

  reset role;

  if laNota is null then
    raise exception 'ABORTADO: la pantalla no ha podido dejar una nota.';
  end if;
  raise notice '1/4 · La pantalla deja una nota para la casa. Bien.';

  -- ── 2 · Y la vuelve a ver ──
  perform set_config('request.jwt.claim.sub', pantalla::text, true);
  set local role authenticated;
  select exists (select 1 from notas where id = laNota) into salio;
  reset role;

  if not salio then
    raise exception 'ABORTADO: la pantalla escribe una nota y no la ve. Es el fallo que esto venia a evitar.';
  end if;
  raise notice '2/4 · Y la vuelve a ver en la pared. Bien.';

  -- ── 3 · Pero NO puede dejar una escondida ──
  perform set_config('request.jwt.claim.sub', pantalla::text, true);
  set local role authenticated;
  begin
    insert into notas (hogar_id, texto, escrita_por, visible_en_casa)
         values (casa, 'Esta no deberia entrar', pantalla, false);
    reset role;
    raise exception 'ABORTADO: la pantalla ha dejado una nota que luego no podria leer.';
  exception when insufficient_privilege then
    reset role;
    raise notice '3/4 · No puede dejar una nota escondida. Bien.';
  end;

  -- ── 4 · Ni una dirigida a una persona ──
  if persona is not null then
    perform set_config('request.jwt.claim.sub', pantalla::text, true);
    set local role authenticated;
    begin
      insert into notas (hogar_id, texto, escrita_por, para, visible_en_casa)
           values (casa, 'Para ti', pantalla, persona, true);
      reset role;
      raise exception 'ABORTADO: la pantalla ha dirigido una nota a una persona.';
    exception when insufficient_privilege then
      reset role;
      raise notice '4/4 · No puede dirigir una nota a nadie. Bien.';
    end;
  end if;

  /* Y se deja como estaba: esto era una prueba. */
  delete from notas where id = laNota;
  get diagnostics cuantas = row_count;
  raise notice 'Recogido: % nota de prueba borrada.', cuantas;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Las políticas de `notas`, con la nueva dentro.
select
  policyname     as la_politica,
  cmd            as para,
  permissive     as suma_o_resta
from pg_policies
where tablename = 'notas'
order by cmd, policyname;

-- 2 · Y la pregunta que hace la pantalla antes de enseñar el botón.
select
  h.nombre                                as la_casa,
  p.nombre                                as la_pantalla,
  'si'                                    as puede_dejar_notas_DEBE_SER_si
from miembros m
join hogares h on h.id = m.hogar_id
join perfiles p on p.id = m.perfil_id
where m.clase = 'dispositivo' and m.aceptado_en is not null
order by 1, 2;

commit;
