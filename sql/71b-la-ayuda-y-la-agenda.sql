-- ═══════════════════════════════════════════════════════════════
-- 71b · LA AYUDA Y LA AGENDA  ·  OPCIONAL, Y ES UNA DECISIÓN TUYA
-- ═══════════════════════════════════════════════════════════════
--
-- **Esto no es parte del 71.** Es una decisión de producto que el 71
-- deja encima de la mesa, y va en un fichero aparte para que se pueda
-- tomar —o no— a la vista.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ PASA SI NO SE EJECUTA
--
-- Rosana entra en la Agenda, ve el botón «Apuntar algo», lo pulsa,
-- rellena la tarea, le da a guardar y HUBI le dice que no.
--
-- Hasta hoy podía apuntar, porque la puerta era `puedo_escribir`, que
-- solo miraba si era lectora. Con el 71 la puerta es su nivel, y
-- `nivel_por_rol('ayuda','agenda')` dice `mirar`.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ CREO QUE ESE `mirar` ESTABA MAL ESCRITO
--
-- La línea lleva desde el paso 61 este comentario al lado:
--
--     when 'agenda'  then 'mirar'   -- solo lo suyo y lo de la casa sin dueño
--
-- O sea que lo que quería decir no era «que no escriba»: era «que no lo
-- VEA todo». Y esa parte **ya está hecha, y en otro sitio**, desde el
-- 62b. Está en la política de lectura, palabra por palabra:
--
--     recordatorios_leer:
--       ... and ( mi_rol(hogar_id) <> 'ayuda'
--                 or asignado_a = auth.uid()
--                 or creado_por = auth.uid()
--                 or asignado_a is null )
--
-- Lo mismo en `notas_leer`. Así que el `mirar` del nivel estaba haciendo
-- dos trabajos —limitar lo que ve y, de paso, impedir que escriba—, y el
-- primero ya lo hacía otro. Subirlo a `anadir` le devuelve lo de
-- escribir sin darle nada de lo de ver: sigue viendo solo lo suyo y lo
-- que no tiene dueño.
--
-- ─────────────────────────────────────────────────────────────
-- LAS DOS SALIDAS, Y LA QUE NO SIRVE
--
-- **A · esto.** Rosana sigue apuntando, y el modelo dice por qué.
--
-- **B · no ejecutarlo, y quitarle el botón.** Es coherente, pero hay que
--      tocar cuatro pantallas de la Agenda para esconderlo, y ella pierde
--      algo que hoy usa.
--
-- **C · no ejecutarlo y no tocar nada.** Ésta NO sirve: le deja el botón
--      puesto y roto. Un botón que falla es peor que un botón que no está.
--
-- Yo haría la A. Pero el que sabe para qué está Rosana en la casa eres tú.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
-- Se vuelve a poner `'mirar'` donde este paso pone `'anadir'`. Está al
-- final del fichero.

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
/*
  Este paso solo tiene sentido DESPUÉS del 71. Antes del 71, la agenda
  no la gobierna el nivel, así que cambiar el nivel no haría nada y
  parecería que sí.
*/
do $$
declare cuantas int; quienes int;
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'puedo_escribir'
  ) then
    raise exception
      'ABORTADO: `puedo_escribir` todavia existe, o sea que el 71 no esta dado. '
      'Este paso solo tiene efecto despues del 71.';
  end if;

  select count(*) into cuantas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'nivel_por_rol'
     and p.prosrc ~ 'ayuda';

  if cuantas <> 1 then
    raise exception 'ABORTADO: `nivel_por_rol` no tiene la forma esperada.';
  end if;

  select count(*) into quienes from miembros
   where rol = 'ayuda' and aceptado_en is not null;
  raise notice 'Puerta pasada. Personas con rol `ayuda` en HUBI: %.', quienes;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA LÍNEA
-- ═══════════════════════════════════════════════════════════════
/*
  La función entera, con un solo cambio respecto a la del paso 61:
  la línea de `ayuda` → `agenda`. Se reescribe completa y no se parchea
  el texto, porque un `replace` sobre el cuerpo de una función es la
  clase de cosa que funciona hasta el día que no.
*/
create or replace function nivel_por_rol(el_rol text, a text)
returns text language sql immutable as $$
  select case coalesce(el_rol, 'familia')

    when 'familia' then 'todo'

    when 'asesor'  then case a
      when 'agenda'  then 'nada'
      when 'salud'   then 'nada'
      when 'compra'  then 'nada'
      when 'dia'     then 'nada'
      when 'cuentas' then 'mirar'
      else 'mirar' end          -- y encima, solo las carpetas abiertas

    when 'ayuda'   then case a
      when 'compra'  then 'todo'
      when 'dia'     then 'anadir'
      /* 71b · era 'mirar'. Lo que aquel 'mirar' quería decir —«solo lo
         suyo y lo de la casa sin dueño»— lo dicen `recordatorios_leer`
         y `notas_leer` desde el 62b. Aquí solo hacía falta que pudiera
         apuntar. */
      when 'agenda'  then 'anadir'
      else 'nada' end

    when 'mirar'   then case a
      when 'salud'   then 'nada'
      else 'mirar' end

    -- La pantalla de la cocina. Y ADEMÁS el filtro de `visible_en_casa`,
    -- que llega en el 63: dentro de Agenda conviven una cena y una cita
    -- médica, así que el rol solo no basta.
    when 'casa'    then case a
      when 'compra'  then 'anadir'
      when 'dia'     then 'anadir'
      when 'agenda'  then 'mirar'
      else 'nada' end

    else 'nada' end
$$;


-- ═══════════════════════════════════════════════════════════════
-- 2 · LA COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════
/*
  Que la ayuda apunte, y que no se le haya colado nada más. Las tres
  cosas que este paso NO debe cambiar:

    · lo que la ayuda VE en la agenda;
    · lo que la ayuda puede en cuentas, en papeles y en la casa;
    · lo que puede la pantalla de la cocina.
*/
do $$
declare f record; apunta boolean; cuentas boolean; lacasa boolean; ve int;
begin
  for f in
    select mi.perfil_id pid, mi.hogar_id hid, pe.nombre nom
      from miembros mi join perfiles pe on pe.id = mi.perfil_id
     where mi.rol = 'ayuda' and mi.aceptado_en is not null
  loop
    perform set_config('request.jwt.claim.sub', f.pid::text, true);

    select puedo_en_agenda(f.hid)                  into apunta;
    select puede(f.hid, 'cuentas', null, 'anadir') into cuentas;
    select puede(f.hid, 'casa',    null, 'todo')   into lacasa;

    if not apunta then
      raise exception 'ABORTADO: % sigue sin poder apuntar. El paso no sirve.', f.nom;
    end if;
    if cuentas or lacasa then
      raise exception
        'ABORTADO: a % se le ha abierto algo que no tocaba (cuentas: %, la casa: %).',
        f.nom, cuentas, lacasa;
    end if;

    set local role authenticated;
    select count(*) into ve from recordatorios where hogar_id = f.hid;
    reset role;

    raise notice '% apunta en la agenda. Sigue viendo % cosas, las suyas.', f.nom, ve;
  end loop;

  /* Y la cocina, que comparte tabla de niveles con todos. */
  for f in
    select mi.perfil_id pid, mi.hogar_id hid, pe.nombre nom
      from miembros mi join perfiles pe on pe.id = mi.perfil_id
     where mi.clase = 'dispositivo' and mi.aceptado_en is not null
  loop
    perform set_config('request.jwt.claim.sub', f.pid::text, true);
    select puedo_en_agenda(f.hid) into apunta;
    if apunta then
      raise exception 'ABORTADO: la pantalla «%» ha empezado a poder apuntar. No.', f.nom;
    end if;
    raise notice 'La pantalla «%» sigue sin apuntar. Bien.', f.nom;
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- La tabla de niveles entera, para leerla de un vistazo. La casilla
-- que cambia es «ayuda · agenda», y tiene que decir `anadir`.
select
  el_rol,
  nivel_por_rol(el_rol, 'agenda')  as agenda,
  nivel_por_rol(el_rol, 'compra')  as compra,
  nivel_por_rol(el_rol, 'dia')     as dia,
  nivel_por_rol(el_rol, 'cuentas') as cuentas,
  nivel_por_rol(el_rol, 'salud')   as salud,
  nivel_por_rol(el_rol, 'papeles') as papeles,
  nivel_por_rol(el_rol, 'casa')    as la_casa_entera
from unnest(array['familia','asesor','ayuda','mirar','casa']) as el_rol;

commit;


-- ═══════════════════════════════════════════════════════════════
-- PARA VOLVER ATRÁS
-- ═══════════════════════════════════════════════════════════════
/*
  Basta con volver a poner la línea. No se ejecuta; está para copiar.

    when 'ayuda'   then case a
      when 'compra'  then 'todo'
      when 'dia'     then 'anadir'
      when 'agenda'  then 'mirar'
      else 'nada' end
*/
