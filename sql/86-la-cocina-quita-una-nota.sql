-- ═══════════════════════════════════════════════════════════════
-- 86 · LA COCINA DA UNA NOTA POR BUENA
-- ═══════════════════════════════════════════════════════════════
--
-- Haris: *«las notas desde la cocina, si están asignadas a la pared
-- deberían poder darse por buenas y eliminarlas»*.
--
-- Y tiene razón, y el corcho lo dice mejor que cualquier argumento:
-- un corcho de verdad no es un archivo. Se clava «he dejado los
-- papeles del seguro en la mesa», alguien los coge, y **se quita el
-- papel**. Un corcho del que no se puede quitar nada acaba siendo una
-- pared de papeles viejos que ya nadie lee, y entonces tampoco se lee
-- el que importa.
--
-- Desde el paso 78 la cocina puede CLAVAR una nota. Quitarla, no: hay
-- que ir a buscar el móvil para retirar un papel que se tiene delante.
--
-- ─────────────────────────────────────────────────────────────
-- ES LA CUARTA VEZ QUE PASA LO MISMO
--
--   · Paso 74 · «una pantalla solo puede tachar».
--   · Paso 75 · «una pared no debería inventarse recados».
--   · Paso 76 · «decir de quién es algo es un juicio de una persona».
--   · Paso 79 · «cambiar y quitar, no».
--
-- Y aquí otra vez, con las notas. La regla del 79, que ya estaba
-- escrita: **cuando escriba «un aparato no debería poder X»,
-- comprobar si lo que digo de verdad es «una persona de pie no
-- debería poder X»** — que casi nunca es cierto. Quien toca esa
-- pantalla es Juan Miguel o Conchita, de pie en su cocina, leyendo la
-- nota que les dejaron.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  «ELIMINAR» AQUÍ NO BORRA, Y NO ES UNA LICENCIA
--
-- Es la misma decisión del paso 79 y por el mismo motivo: una pantalla
-- colgada en una cocina la toca cualquiera que entre en la casa. Un
-- botón de borrar de verdad ahí es un botón que un día se lleva por
-- delante el único sitio donde estaba escrito dónde quedaron los
-- papeles del notario.
--
-- Así que la pared **no borra**: pone fecha en `guardada_en`, que es
-- exactamente lo que hace «Quitar» desde el móvil desde el paso 35. La
-- nota sale del corcho, sigue guardada, y desde el móvil se ve y se
-- recupera. Punto 5 del planteamiento: *«acciones importantes
-- fácilmente reversibles»*.
--
-- Por eso aquí NO hay política de DELETE. Quitar es un `update`.
--
-- ─────────────────────────────────────────────────────────────
-- Y SOLO LAS QUE ESTÁN COLGADAS DE ESA PARED
--
-- `visible_en_casa` es, con las palabras de Haris, «asignadas a la
-- pared». La política lo exige: una pantalla toca lo que cuelga de su
-- propio corcho y nada más. Una nota privada entre dos personas no la
-- ve —restrictiva del paso 63— y tampoco la puede retirar.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE SIGUE CERRADO, Y POR QUÉ
--
-- El disparador funciona **al revés de lo que parece**: no lista lo
-- prohibido, lista lo permitido, y todo lo demás queda cerrado. Una
-- columna que se añada mañana nace protegida sin que nadie se acuerde
-- de ella.
--
-- Queda fuera, a propósito:
--
-- **`texto`** · corregir la letra de una nota que escribió otro, desde
-- una pantalla que no sabe quién la está tocando, es poner palabras en
-- boca de alguien. Se corrige desde el móvil, donde hay un nombre
-- detrás.
--
-- **`visible_en_casa`** · qué cuelga de esa pared lo decide la familia
-- desde Ajustes → La cocina. Si la pantalla pudiera cambiarlo, podría
-- esconderse cosas a sí misma y nadie entendería por qué dejaron de
-- salir. Es la misma exclusión que en el paso 79.
--
-- **`vista_en`** · «visto» significa *yo lo he visto*, y una pared no
-- es nadie. Una nota dirigida a Conchita marcada como vista porque
-- alguien pasó por la cocina es peor que no marcarla: le dice a quien
-- la escribió que llegó cuando no ha llegado.
--
-- **`para`, `escrita_por`, `hogar_id`, `creada_en`** · de quién es una
-- nota y de cuándo no se cambia nunca, ni desde el móvil.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop trigger if exists notas_la_cocina_solo_quita on notas;
--     drop function if exists la_cocina_solo_quita_notas();
--     drop policy if exists notas_la_cocina_quita on notas;
--     drop function if exists la_cocina_quita_notas(uuid);
--
-- Y el botón de la pared desaparece solo, porque se lo pregunta a la
-- base. No hay que tocar nada más.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $p86$
begin
  if to_regclass('public.notas') is null then
    raise exception 'ABORTADO: no existe `notas`. Falta el paso 35.';
  end if;

  if to_regprocedure('soy_pantalla_de_casa(uuid)') is null then
    raise exception 'ABORTADO: falta `soy_pantalla_de_casa`. Se dan en orden: 63, 74, 78, 86.';
  end if;

  if to_regprocedure('la_cocina_deja_notas(uuid)') is null then
    raise exception 'ABORTADO: falta el paso 78, que es el que deja clavar notas desde la cocina.';
  end if;

  raise notice 'Puerta pasada. Notas en el corcho ahora mismo: %.',
    (select count(*) from notas where guardada_en is null);
end $p86$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · EL DISPARADOR · QUÉ COLUMNA PUEDE TOCAR LA PANTALLA
-- ═══════════════════════════════════════════════════════════════
/*
  Una sola: `guardada_en`. Y `cambiada_en`, que es la marca de «esto se
  ha tocado» y no dice nada de nadie.

  Misma forma que `la_cocina_solo_tacha()` del paso 74/79: se comparan
  la fila vieja y la nueva SIN las columnas permitidas. Si lo que queda
  no es idéntico, es que se ha tocado algo que no tocaba.
*/
create or replace function la_cocina_solo_quita_notas() returns trigger
language plpgsql
as $$
begin
  if not soy_pantalla_de_casa(new.hogar_id) then
    return new;
  end if;

  if (to_jsonb(old) - 'guardada_en' - 'cambiada_en')
       is distinct from
     (to_jsonb(new) - 'guardada_en' - 'cambiada_en')
  then
    raise exception
      'Desde la pantalla de la cocina una nota se puede quitar del corcho y volver a poner. El texto y lo demas se cambian desde el movil.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

comment on function la_cocina_solo_quita_notas() is
  'Lo que una pantalla de cocina puede cambiar de una nota. Cierra por defecto: lo que no esta en la lista, no se toca. Paso 86.';

drop trigger if exists notas_la_cocina_solo_quita on notas;
create trigger notas_la_cocina_solo_quita
  before update on notas
  for each row execute function la_cocina_solo_quita_notas();


-- ═══════════════════════════════════════════════════════════════
-- 2 · LA POLÍTICA · QUÉ FILAS
-- ═══════════════════════════════════════════════════════════════
/*
  Las que cuelgan de SU pared. Nada más.

  Y `visible_en_casa` se exige en las dos mitades —`using` y
  `with check`— aunque el disparador ya impida cambiarlo: son dos
  cierres distintos y el día que alguien toque uno conviene que el otro
  siga puesto.
*/
drop policy if exists notas_la_cocina_quita on notas;

create policy notas_la_cocina_quita on notas
  for update to authenticated
  using (
    soy_pantalla_de_casa(hogar_id)
    and coalesce(visible_en_casa, false)
  )
  with check (
    soy_pantalla_de_casa(hogar_id)
    and coalesce(visible_en_casa, false)
  );

comment on policy notas_la_cocina_quita on notas is
  'Una pantalla de cocina retira del corcho lo que cuelga de su pared. Que columnas, lo dice el disparador. Paso 86.';


-- ═══════════════════════════════════════════════════════════════
-- 3 · Y LA PREGUNTA, PARA QUE NO HAYA UN BOTÓN ROTO
-- ═══════════════════════════════════════════════════════════════
/*
  La misma idea que `la_cocina_apunta` (75), `la_cocina_deja_notas`
  (78) y `la_cocina_cambia` (79): la aplicación no deduce si puede, lo
  PREGUNTA. El día que esto se quite, el botón desaparece solo en vez
  de empezar a dar errores en una pared de una cocina.

  Se mira el disparador Y la política: hacen falta los dos, y con solo
  uno el botón parecería funcionar y no funcionaría.
*/
create or replace function la_cocina_quita_notas(casa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select soy_pantalla_de_casa(casa)
     and exists (select 1 from pg_policies
                  where tablename = 'notas'
                    and policyname = 'notas_la_cocina_quita')
     and exists (select 1 from pg_trigger
                  where tgname = 'notas_la_cocina_solo_quita'
                    and not tgisinternal)
$$;

revoke all on function la_cocina_quita_notas(uuid) from public, anon;
grant execute on function la_cocina_quita_notas(uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 4 · LAS COMPROBACIONES, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
/*
  Se prueba de verdad, con una pantalla de verdad, y si algo no sale
  como tiene que salir esto aborta y no se guarda nada.
*/
do $p86$
declare
  casa uuid; pantalla uuid; persona uuid; laNota uuid; ajena uuid;
  quitada boolean; puesta boolean; comoEsta text;
begin
  select m.hogar_id, m.perfil_id into casa, pantalla
    from miembros m
   where m.clase = 'dispositivo' and m.aceptado_en is not null
   limit 1;

  if casa is null then
    raise notice 'No hay ninguna pantalla con la que probar. Se aplica igual.';
    return;
  end if;

  select m.perfil_id into persona
    from miembros m
   where m.hogar_id = casa and m.clase = 'persona' and m.aceptado_en is not null
   limit 1;

  -- Una nota colgada del corcho.
  insert into notas (hogar_id, texto, escrita_por, para, visible_en_casa)
       values (casa, 'Prueba del paso 86', pantalla, null, true)
    returning id into laNota;

  -- ── 1 · La pantalla la retira del corcho ──
  perform set_config('request.jwt.claim.sub', pantalla::text, true);
  set local role authenticated;
  update notas set guardada_en = now() where id = laNota;
  reset role;

  select guardada_en is not null into quitada from notas where id = laNota;
  if not quitada then
    raise exception 'ABORTADO: la pantalla no ha podido retirar una nota de su propio corcho.';
  end if;
  raise notice '1/4 · La pantalla retira del corcho lo que cuelga de su pared. Bien.';

  -- ── 2 · Y la vuelve a poner ──
  perform set_config('request.jwt.claim.sub', pantalla::text, true);
  set local role authenticated;
  update notas set guardada_en = null where id = laNota;
  reset role;

  select guardada_en is null into puesta from notas where id = laNota;
  if not puesta then
    raise exception 'ABORTADO: la pantalla no ha podido volver a poner la nota. Quitar tiene que ser reversible.';
  end if;
  raise notice '2/4 · Y la vuelve a poner. Bien.';

  -- ── 3 · Lo que NO cuelga de la pared, no lo toca ──
  /*
    La escribe una PERSONA, no la pantalla: si la escribiera la
    pantalla, `notas_editar` la dejaria pasar por ser suya y esto no
    estaria probando lo que dice que prueba.

    Y no se espera un error: cuando ninguna politica deja ver la fila,
    Postgres no se queja — cambia cero filas y calla. Lo que se mira es
    el RESULTADO.
  */
  if persona is null then
    raise notice '3/4 · No hay ninguna persona en esa casa con la que probarlo. Se salta.';
  else
    insert into notas (hogar_id, texto, escrita_por, para, visible_en_casa)
         values (casa, 'Prueba del paso 86 - fuera del corcho', persona, null, null)
      returning id into ajena;

    begin
      perform set_config('request.jwt.claim.sub', pantalla::text, true);
      set local role authenticated;
      update notas set guardada_en = now() where id = ajena;
      reset role;
    exception when others then
      reset role;
    end;

    select guardada_en is not null into quitada from notas where id = ajena;
    if quitada then
      raise exception 'ABORTADO: la pantalla ha retirado una nota que no cuelga de su pared.';
    end if;
    delete from notas where id = ajena;
    raise notice '3/4 · Lo que no cuelga de esa pared, no lo toca. Bien.';
  end if;

  -- ── 4 · Y no puede cambiar el texto ──
  /*
    Igual que arriba: se mira el texto, no si hubo error. Que el
    disparador salte es una manera de impedirlo; que la politica no
    deje ver la fila es otra. Las dos valen, y las dos se ven aqui.
  */
  begin
    perform set_config('request.jwt.claim.sub', pantalla::text, true);
    set local role authenticated;
    update notas set texto = 'cambiado desde la pared' where id = laNota;
    reset role;
  exception when others then
    reset role;
  end;

  select texto into comoEsta from notas where id = laNota;
  if comoEsta is distinct from 'Prueba del paso 86' then
    raise exception 'ABORTADO: la pantalla ha cambiado el texto de una nota. El disparador no esta cerrando.';
  end if;
  raise notice '4/4 · Y no puede cambiar el texto. Bien.';

  -- Se limpia la nota de prueba.
  delete from notas where id = laNota;
end $p86$;


commit;


-- ═══════════════════════════════════════════════════════════════
-- 5 · COMPROBACIÓN A MANO
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta esto después, una consulta cada vez, y mira que sale lo que
-- pone. Si algo no cuadra, NO sigas: dímelo y lo miramos.

-- 5.1 · La política está puesta.
select policyname, cmd
from pg_policies
where tablename = 'notas' and policyname like '%cocina%'
order by policyname;
-- ESPERADO: dos filas. `notas_la_cocina_apunta` (INSERT, del paso 78)
-- y `notas_la_cocina_quita` (UPDATE, ésta).

-- 5.2 · Y el disparador también.
select tgname
from pg_trigger
where tgrelid = 'notas'::regclass and not tgisinternal
order by tgname;
-- ESPERADO: entre ellos sale `notas_la_cocina_solo_quita`.

-- 5.3 · No se ha perdido ni una nota del corcho.
select count(*) as en_el_corcho from notas where guardada_en is null;
-- ESPERADO: las mismas que decía el aviso de la puerta, arriba.
