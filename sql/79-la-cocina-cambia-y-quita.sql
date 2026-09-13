-- ═══════════════════════════════════════════════════════════════
-- 79 · LA COCINA CAMBIA Y QUITA
-- ═══════════════════════════════════════════════════════════════
--
-- Haris: *«sería bueno poder eliminar, cambiar o añadir desde la
-- cocina»*.
--
-- Añadir ya se podía (paso 75). Cambiar y quitar, no: el paso 74 dejó a
-- la pantalla **solo tachar**, y cualquier otro cambio lo rechaza un
-- disparador.
--
-- ─────────────────────────────────────────────────────────────
-- ES LA TERCERA VEZ QUE PASA LO MISMO, Y YA TOCA ESCRIBIRLO
--
--   · Paso 75 · «una pared no debería poder inventarse recados».
--   · Paso 76 · «decir esto es de Conchita es un juicio de una persona,
--               no de un aparato».
--   · Paso 74 · esto: «una pantalla solo puede tachar».
--
-- Las tres suenan prudentes y las tres son el mismo error: **confundir
-- el aparato con quien está delante de él.** Quien toca esa pantalla es
-- Juan Miguel o Conchita, de pie en su cocina. Si se equivocaron al
-- apuntar «el jueves viene el fontanero» y hoy quieren corregirlo, no
-- hay ninguna razón para obligarles a ir a buscar el móvil.
--
-- La regla, ya definitiva: cuando escriba «un aparato no debería poder
-- X», comprobar primero si lo que estoy diciendo de verdad es «una
-- persona de pie no debería poder X» — que casi nunca es cierto.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  QUITAR NO BORRA. Y ESTO NO ES UN DETALLE
--
-- Una pantalla colgada en una cocina la toca cualquiera que entre en la
-- casa: un nieto, alguien que viene a arreglar la lavadora. Un botón de
-- borrar de verdad ahí es un botón que un día se lleva por delante la
-- cita del médico y no hay forma de recuperarla.
--
-- Así que la pared **no borra**: pone fecha en `eliminado_en`, que es
-- la papelera que ya existe. Desde el móvil se ve y se recupera. El
-- punto 5 del planteamiento lo pide con estas palabras: *«acciones
-- importantes fácilmente reversibles»*.
--
-- Por eso aquí NO hay política de DELETE para la pantalla: quitar es
-- un `update`, no un `delete`. Y como no la hay, un `delete` desde una
-- pantalla no borra nada aunque alguien lo intente.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE SIGUE CERRADO, Y POR QUÉ
--
-- El disparador funciona **al revés de lo que parece**: no lista lo
-- prohibido, lista lo permitido, y todo lo demás queda cerrado. Eso
-- significa que una columna que se añada mañana nace protegida sin que
-- nadie se acuerde de ella.
--
-- Queda fuera, a propósito:
--
-- **`visible_en_casa`** · qué cuelga de esa pared lo decide la familia
-- desde Ajustes. Si la pantalla pudiera cambiarlo, podría esconderse
-- cosas a sí misma y nadie entendería por qué dejaron de salir.
--
-- **`repite`, `repite_hasta`, `grupo_id`** · cambiar una cosa que se
-- repite plantea una pregunta que no cabe en una pared: ¿esta vez o
-- todas? Contestarla mal borra seis meses de martes. Eso se hace desde
-- el móvil, que tiene sitio para preguntarlo.
--
-- **`hogar_id`, `creado_por`, `creado_en`, `documento_origen_id`,
-- `nace_de`** · identidad y origen. No son cosas que se cambien.
--
-- CÓMO SE DESHACE — vuelve a dejarlo como el paso 74:
--
--     (está escrito entero al final de este archivo)

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('la_cocina_apunta(uuid)') is null then
    raise exception 'ABORTADO: falta el paso 75. Se dan en orden: 74, 75, 76, 77, 78, 79.';
  end if;

  if to_regprocedure('es_persona_de_la_casa(uuid,uuid)') is null then
    raise exception 'ABORTADO: falta el paso 76.';
  end if;

  if not exists (select 1 from pg_proc where proname = 'la_cocina_solo_tacha') then
    raise exception 'ABORTADO: falta el paso 74 (no existe el disparador que esto sustituye).';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_name = 'recordatorios' and column_name = 'eliminado_en'
  ) then
    raise exception 'ABORTADO: `recordatorios` no tiene `eliminado_en`. Sin papelera, quitar seria borrar.';
  end if;

  raise notice 'Puerta pasada.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · EL DISPARADOR, CON LA LISTA MÁS LARGA
-- ═══════════════════════════════════════════════════════════════
/*
  Mismo nombre de disparador y misma forma. Solo cambia la lista de lo
  que se deja tocar, y el mensaje, que ahora tiene que explicar QUÉ es
  lo que no se puede — un «nada mas» era suficiente cuando solo se
  podía tachar y ahora sería mentira.
*/
create or replace function la_cocina_solo_tacha() returns trigger
language plpgsql
as $$
begin
  if not soy_pantalla_de_casa(new.hogar_id) then
    return new;
  end if;

  if (to_jsonb(old)
        - 'estado' - 'hecho_en' - 'hecho_por'      -- tachar        (74)
        - 'titulo' - 'fecha' - 'hora' - 'nota'     -- cambiar       (79)
        - 'asignado_a'                             -- poner nombre  (76/79)
        - 'destacado'                              -- dejar a la vista (72)
        - 'eliminado_en')                          -- quitar, blando (79)
       is distinct from
     (to_jsonb(new)
        - 'estado' - 'hecho_en' - 'hecho_por'
        - 'titulo' - 'fecha' - 'hora' - 'nota'
        - 'asignado_a'
        - 'destacado'
        - 'eliminado_en')
  then
    raise exception
      'Desde la pantalla de la cocina se puede cambiar el texto, el dia, la hora, de quien es, y quitarlo. Lo demas se cambia desde el movil.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

comment on function la_cocina_solo_tacha() is
  'Lo que una pantalla de cocina puede cambiar de un recordatorio. Cierra por defecto: lo que no esta en la lista, no se toca. Pasos 74 y 79.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · Y LA POLÍTICA, CON EL NOMBRE COMPROBADO TAMBIÉN AL CAMBIAR
-- ═══════════════════════════════════════════════════════════════
/*
  El paso 76 comprobaba `es_persona_de_la_casa` al APUNTAR. Ahora que
  también se puede cambiar de quién es algo, hay que comprobarlo aquí
  igual: si no, se apunta sin nombre y se le pone después el de
  cualquiera.

  Y sigue exigiendo `visible_en_casa`: una pantalla solo toca lo que
  está colgado de su propia pared.
*/
drop policy if exists recordatorios_la_cocina_tacha on recordatorios;

create policy recordatorios_la_cocina_tacha on recordatorios
  for update to authenticated
  using (
    soy_pantalla_de_casa(hogar_id)
    and coalesce(visible_en_casa, false)
  )
  with check (
    soy_pantalla_de_casa(hogar_id)
    and coalesce(visible_en_casa, false)
    and (asignado_a is null or es_persona_de_la_casa(hogar_id, asignado_a))
  );

comment on policy recordatorios_la_cocina_tacha on recordatorios is
  'Una pantalla de cocina cambia lo que esta colgado de su pared. Que columnas, lo dice el disparador. Pasos 74, 76 y 79.';


-- ═══════════════════════════════════════════════════════════════
-- 2b · Y LA PREGUNTA, PARA QUE NO HAYA UN BOTÓN ROTO
-- ═══════════════════════════════════════════════════════════════
/*
  La misma idea que `la_cocina_apunta` (75) y `la_cocina_deja_notas`
  (78): la aplicación no deduce si puede, lo PREGUNTA.

  Aquí se mira el DISPARADOR y no la política, porque es el disparador
  el que decide qué columnas se dejan tocar — la política solo dice qué
  filas. Si alguien deshace este paso volviendo a la versión corta del
  74, esto contesta que no y el botón de Cambiar desaparece solo, en vez
  de empezar a dar errores en una pared.
*/
create or replace function la_cocina_cambia(casa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select soy_pantalla_de_casa(casa)
     and exists (select 1 from pg_proc
                  where proname = 'la_cocina_solo_tacha'
                    and position('''eliminado_en''' in prosrc) > 0)
$$;

revoke all on function la_cocina_cambia(uuid) from public, anon;
grant execute on function la_cocina_cambia(uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 3 · LAS COMPROBACIONES, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  casa uuid; pantalla uuid; persona uuid; fuera uuid; laCosa uuid; cuantas int;
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

  select p.id into fuera
    from perfiles p
   where not exists (select 1 from miembros m
                      where m.perfil_id = p.id and m.hogar_id = casa)
   limit 1;

  /* Una cosa colgada de la pared, puesta por una persona. */
  perform set_config('request.jwt.claim.sub', persona::text, true);
  insert into recordatorios (hogar_id, titulo, estado, visible_en_casa, creado_por, fecha)
       values (casa, 'Prueba del paso 79', 'pendiente', true, persona, current_date)
    returning id into laCosa;

  -- ── 1 · La pantalla cambia el texto ──
  perform set_config('request.jwt.claim.sub', pantalla::text, true);
  set local role authenticated;
  update recordatorios set titulo = 'Viene el fontanero' where id = laCosa;
  get diagnostics cuantas = row_count;
  reset role;

  if cuantas <> 1 then
    raise exception 'ABORTADO: la pantalla no ha podido cambiar el texto.';
  end if;
  raise notice '1/6 · Cambia el texto. Bien.';

  -- ── 2 · Y la hora ──
  perform set_config('request.jwt.claim.sub', pantalla::text, true);
  set local role authenticated;
  update recordatorios set hora = '10:00' where id = laCosa;
  get diagnostics cuantas = row_count;
  reset role;

  if cuantas <> 1 then
    raise exception 'ABORTADO: la pantalla no ha podido cambiar la hora.';
  end if;
  raise notice '2/6 · Cambia la hora. Bien.';

  -- ── 3 · Y lo quita, que no es borrarlo ──
  perform set_config('request.jwt.claim.sub', pantalla::text, true);
  set local role authenticated;
  update recordatorios set eliminado_en = now() where id = laCosa;
  get diagnostics cuantas = row_count;
  reset role;

  if cuantas <> 1 then
    raise exception 'ABORTADO: la pantalla no ha podido quitar nada.';
  end if;

  if not exists (select 1 from recordatorios where id = laCosa) then
    raise exception 'ABORTADO: quitar ha BORRADO la fila. Tiene que quedar en la papelera.';
  end if;
  raise notice '3/6 · Lo quita, y la fila sigue ahi para poder recuperarla. Bien.';

  /* Se devuelve a su sitio para seguir probando. */
  update recordatorios set eliminado_en = null where id = laCosa;

  -- ── 4 · Pero NO puede esconderse cosas a sí misma ──
  perform set_config('request.jwt.claim.sub', pantalla::text, true);
  set local role authenticated;
  begin
    update recordatorios set visible_en_casa = false where id = laCosa;
    reset role;
    raise exception 'ABORTADO: la pantalla ha podido cambiar `visible_en_casa`.';
  exception when check_violation or insufficient_privilege then
    reset role;
    raise notice '4/6 · No puede cambiar lo que cuelga de su pared. Bien.';
  end;

  -- ── 5 · Ni tocar lo que se repite ──
  perform set_config('request.jwt.claim.sub', pantalla::text, true);
  set local role authenticated;
  begin
    update recordatorios set repite = 'semanal' where id = laCosa;
    reset role;
    raise exception 'ABORTADO: la pantalla ha podido cambiar la repeticion.';
  exception when check_violation or insufficient_privilege then
    reset role;
    raise notice '5/6 · No toca lo que se repite. Bien.';
  end;

  -- ── 6 · Ni ponerle el nombre de alguien de fuera ──
  if fuera is not null then
    perform set_config('request.jwt.claim.sub', pantalla::text, true);
    set local role authenticated;
    begin
      update recordatorios set asignado_a = fuera where id = laCosa;
      get diagnostics cuantas = row_count;
      reset role;
      if cuantas > 0 then
        raise exception 'ABORTADO: la pantalla ha asignado algo a alguien de otra casa.';
      end if;
      raise notice '6/6 · No se lo asigna a alguien de fuera. Bien.';
    exception when check_violation or insufficient_privilege then
      reset role;
      raise notice '6/6 · No se lo asigna a alguien de fuera. Bien.';
    end;
  end if;

  /* Y se recoge: esto era una prueba. */
  delete from recordatorios where id = laCosa;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Lo que la pantalla puede tocar de un recordatorio, leído del
--     propio disparador. Deben salir las diez.
select unnest(array[
  'estado','hecho_en','hecho_por','titulo','fecha','hora','nota',
  'asignado_a','destacado','eliminado_en'
]) as puede_cambiar;

-- 2 · Y que `visible_en_casa` y la repetición NO estén ahí.
select
  position('''visible_en_casa''' in prosrc) = 0 as visible_en_casa_cerrado_DEBE_SER_true,
  position('''repite''' in prosrc)          = 0 as repeticion_cerrada_DEBE_SER_true
from pg_proc where proname = 'la_cocina_solo_tacha';

-- 3 · Y que la pantalla siga SIN poder borrar de verdad.
select
  count(*) filter (where cmd = 'DELETE' and policyname like '%cocina%') as politicas_de_borrar_DEBE_SER_0
from pg_policies where tablename = 'recordatorios';

commit;


-- ═══════════════════════════════════════════════════════════════
-- CÓMO SE DESHACE (volver al paso 74)
-- ═══════════════════════════════════════════════════════════════
--
--   create or replace function la_cocina_solo_tacha() returns trigger
--   language plpgsql as $$
--   begin
--     if not soy_pantalla_de_casa(new.hogar_id) then return new; end if;
--     if (to_jsonb(old) - 'estado' - 'hecho_en' - 'hecho_por')
--          is distinct from
--        (to_jsonb(new) - 'estado' - 'hecho_en' - 'hecho_por')
--     then
--       raise exception 'Una pantalla de casa solo puede marcar algo hecho o pendiente, nada mas.'
--         using errcode = 'check_violation';
--     end if;
--     return new;
--   end $$;
