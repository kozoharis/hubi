-- ═══════════════════════════════════════════════════════════════
-- 69b · LO QUE DECIDIÓ UNA PERSONA, Y LO QUE DECIDIÓ LA REGLA
-- ═══════════════════════════════════════════════════════════════
--
-- **Esto corrige un fallo del 69, y lo enseñó la pantalla en cuanto se
-- usó una vez.**
--
-- Después de pulsar «Así está bien», la pantalla dice:
--
--     Volver a decidirlo todo
--     Hay 12 cosas decididas una por una desde su propia ficha.
--
-- Y no es verdad. Esas doce las acaba de decidir **ese mismo botón**.
-- Nadie ha entrado en doce fichas.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ PASA, Y POR QUÉ ES PEOR DE LO QUE PARECE
--
-- El 69 dejó una sola señal para dos cosas distintas:
--
--     visible_en_casa IS NULL      →  «nadie lo ha decidido»
--     visible_en_casa NOT NULL     →  «alguien lo decidió a mano»
--
-- Eso valía mientras nada hubiera aplicado la regla general. En cuanto
-- se aplica una vez, **no queda un solo nulo**, y entonces:
--
--   · la pantalla cuenta como decisiones a mano lo que puso la regla;
--   · y la forma suave —que solo toca los nulos— **no toca nada**.
--
-- Lo segundo es la trampa de verdad: a partir de la segunda visita,
-- cambiar un interruptor y pulsar «Así está bien» **no haría nada**, y
-- la pantalla diría «Guardado» igual. Habría que marcar «volver a
-- decidirlo todo» cada vez, que es exactamente la casilla que se puso
-- para que casi nunca hiciera falta.
--
-- Un botón que dice que ha guardado y no cambia nada es peor que un
-- botón que falla.
--
-- ─────────────────────────────────────────────────────────────
-- LA CORRECCIÓN, SIN COLUMNA NUEVA
--
-- No hace falta guardar quién decidió cada fila. Se puede saber
-- comparándola con la regla que había guardada:
--
--     la regla decía TRUE  y la fila tiene TRUE   →  la puso la regla
--     la regla decía FALSE y la fila tiene FALSE  →  la puso la regla
--     la fila dice lo CONTRARIO de la regla       →  la cambió alguien
--
-- Y con eso la forma suave pasa a ser:
--
--     toca las filas que están a nulo
--     · MÁS las que iban siguiendo la regla anterior
--     · y deja en paz las que alguien apartó de ella a mano
--
-- Que es lo que se quería decir desde el principio: **una marca puesta
-- a mano sobrevive; una que solo seguía la corriente, cambia con
-- ella.**
--
-- La primera vez no hay regla guardada (`tipos_en_casa` es nulo) y
-- entonces se comporta como el 69: solo los nulos. Correcto, porque en
-- ese momento cualquier fila que NO sea nula sí la marcó una persona.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
-- Volver a crear la función con el cuerpo del `sql/69`. No hay ningún
-- cambio de tablas, así que no hay nada más que devolver.

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'poner_al_dia_la_cocina'
  ) then
    raise exception 'ABORTADO: falta `poner_al_dia_la_cocina`. El paso 69 no esta dado.';
  end if;
  raise notice 'Puerta pasada: el 69 esta dado.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA FUNCIÓN, CON LA REGLA ANTERIOR EN LA MANO
-- ═══════════════════════════════════════════════════════════════
create or replace function poner_al_dia_la_cocina(
  casa uuid,
  los_tipos text[],
  con_las_notas boolean,
  tambien_lo_ya_decidido boolean default false
)
returns table (cosas_tocadas int, recados_tocados int)
language plpgsql security definer set search_path = public as $$
declare
  n_cosas int := 0;
  n_recados int := 0;
  antes_tipos text[];
  antes_notas boolean;
  nuevos text[] := coalesce(los_tipos, array[]::text[]);
  con_recados boolean := coalesce(con_las_notas, false);
begin
  if not soy_de(casa) then
    raise exception 'No eres de esa casa.';
  end if;
  if soy_pantalla_de_casa(casa) then
    raise exception 'Una pantalla de casa no decide lo que se ve en ella.';
  end if;
  if not (es_propietario(casa) or mi_rol(casa) = 'familia') then
    raise exception 'Esto lo decide la familia.';
  end if;

  /* LA REGLA QUE HABÍA, ANTES DE PISARLA. Es lo único que distingue
     una fila que seguía la corriente de una que alguien apartó. */
  select h.tipos_en_casa, h.notas_en_casa
    into antes_tipos, antes_notas
    from hogares h where h.id = casa;

  update hogares
     set tipos_en_casa = nuevos,
         notas_en_casa = con_recados
   where id = casa;

  /*
    Las que se tocan:

      · las que nadie ha decidido nunca (nulas);
      · las que coinciden con lo que decía la regla anterior, o sea
        las que venían siguiéndola;
      · y todas, si se ha pedido la forma fuerte.

    Se quedan fuera las que dicen lo contrario de la regla anterior:
    ésas las apartó una persona desde la ficha de la cosa, y ése es
    justo el interruptor que hay que respetar.
  */
  update recordatorios r
     set visible_en_casa = (r.tipo = any(nuevos))
   where r.hogar_id = casa
     and (
          tambien_lo_ya_decidido
       or r.visible_en_casa is null
       or ( antes_tipos is not null
            and r.visible_en_casa = (r.tipo = any(antes_tipos)) )
     );
  get diagnostics n_cosas = row_count;

  update notas n
     set visible_en_casa = con_recados
   where n.hogar_id = casa
     and (
          tambien_lo_ya_decidido
       or n.visible_en_casa is null
       or ( antes_notas is not null and n.visible_en_casa = antes_notas )
     );
  get diagnostics n_recados = row_count;

  return query select n_cosas, n_recados;
end $$;

comment on function poner_al_dia_la_cocina(uuid, text[], boolean, boolean) is
  'Guarda que se ve en la pantalla de la cocina y lo aplica. Toca lo que esta sin '
  'decidir y lo que venia siguiendo la regla anterior; deja en paz lo que alguien '
  'aparto de ella a mano desde la ficha de la cosa. `tambien_lo_ya_decidido` lo '
  'vuelve a decidir todo. La decide la familia.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
/*
  La prueba que importa es la que el 69 no tenía: aplicar DOS VECES y
  comprobar que la segunda hace algo.
*/
do $$
declare
  casa uuid; dueno uuid;
  laCita uuid; laTarea uuid; elCoche uuid;
  tocadas int; recados int;
  guardadoTipos text[]; guardadoNotas boolean;
begin
  select m.hogar_id, m.perfil_id into casa, dueno
    from miembros m
   where m.papel = 'propietario' and m.clase = 'persona' and m.aceptado_en is not null
   limit 1;

  if casa is null then
    raise notice 'Sin datos con los que probar. Se aplica igual.';
    return;
  end if;

  /* Se guarda lo que la casa tuviera puesto, para devolverlo al final:
     esto corre en producción y no puede cambiar la decisión de nadie. */
  select h.tipos_en_casa, h.notas_en_casa into guardadoTipos, guardadoNotas
    from hogares h where h.id = casa;

  insert into recordatorios (hogar_id, titulo, tipo, creado_por, fecha)
    values (casa, 'ZZ prueba medico', 'cita', dueno, current_date) returning id into laCita;
  insert into recordatorios (hogar_id, titulo, tipo, creado_por, fecha)
    values (casa, 'ZZ prueba basura', 'tarea', dueno, current_date) returning id into laTarea;
  insert into recordatorios (hogar_id, titulo, tipo, creado_por, fecha)
    values (casa, 'ZZ prueba taller', 'coche', dueno, current_date) returning id into elCoche;

  perform set_config('request.jwt.claim.sub', dueno::text, true);

  -- ── 1 · primera vez: tareas y coche sí, citas no ──
  set local role authenticated;
  perform poner_al_dia_la_cocina(casa, array['tarea','coche'], false);
  reset role;

  if (select visible_en_casa from recordatorios where id = laTarea) is not true then
    raise exception 'ABORTADO: la tarea no ha quedado visible.';
  end if;
  if (select visible_en_casa from recordatorios where id = laCita) is not false then
    raise exception 'ABORTADO: la cita ha quedado visible.';
  end if;
  raise notice 'Primera vez: correcto.';

  -- ── 2 · alguien aparta el coche a mano desde su ficha ──
  update recordatorios set visible_en_casa = false where id = elCoche;

  -- ── 3 · SEGUNDA VEZ, sin forma fuerte: se quitan las tareas ──
  --       Esto es lo que el 69 no hacia: no tocaba NADA.
  set local role authenticated;
  select p.cosas_tocadas, p.recados_tocados into tocadas, recados
    from poner_al_dia_la_cocina(casa, array['coche'], false) p;
  reset role;

  if tocadas = 0 then
    raise exception 'ABORTADO: la segunda pasada no ha tocado nada. Es el fallo del 69.';
  end if;
  raise notice 'Segunda vez: SI hace algo (% cosas).', tocadas;

  if (select visible_en_casa from recordatorios where id = laTarea) is not false then
    raise exception 'ABORTADO: la tarea sigue visible despues de quitarla de la lista.';
  end if;
  raise notice 'Quitar un tipo de la lista: se aplica de verdad.';

  -- ── 4 · y lo que se aparto a mano SIGUE apartado ──
  --       'coche' esta en la lista nueva, asi que la regla diria TRUE.
  if (select visible_en_casa from recordatorios where id = elCoche) is not false then
    raise exception 'ABORTADO: se ha pisado lo que una persona aparto desde su ficha.';
  end if;
  raise notice 'Lo apartado a mano: RESPETADO aunque la regla diga lo contrario.';

  -- ── 5 · la forma fuerte si lo devuelve a la regla ──
  set local role authenticated;
  perform poner_al_dia_la_cocina(casa, array['coche'], false, true);
  reset role;
  if (select visible_en_casa from recordatorios where id = elCoche) is not true then
    raise exception 'ABORTADO: la forma fuerte no ha devuelto el coche a la regla.';
  end if;
  raise notice 'La forma fuerte: vuelve a decidirlo todo.';

  /* Fuera las de prueba, y la casa como estaba. */
  delete from recordatorios where id in (laCita, laTarea, elCoche);
  update hogares set tipos_en_casa = guardadoTipos, notas_en_casa = guardadoNotas
   where id = casa;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Qué hay decidido en cada casa, y cuánto de eso lo apartó una
--     persona de la regla. La columna de la derecha es la que la
--     pantalla tiene que enseñar en «volver a decidirlo todo».
select
  h.nombre                                                 as la_casa,
  coalesce(array_length(h.tipos_en_casa, 1), 0)            as clases_de_cosa_que_salen,
  count(r.id) filter (where r.visible_en_casa is not null) as cosas_con_decision,
  count(r.id) filter (
    where r.visible_en_casa is not null
      and h.tipos_en_casa is not null
      and r.visible_en_casa <> (r.tipo = any(h.tipos_en_casa))
  )                                                        as apartadas_a_mano
from hogares h
left join recordatorios r on r.hogar_id = h.id and r.eliminado_en is null
group by h.id, h.nombre, h.tipos_en_casa
order by 1;

-- 2 · Y que no queda ni una fila de las pruebas.
select count(*) as filas_de_prueba_DEBE_SER_0
from recordatorios where titulo like 'ZZ prueba %';

commit;
