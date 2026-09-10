-- ═══════════════════════════════════════════════════════════════
-- 37 · QUIÉN ES CADA UNO EN ESTA CASA
-- ═══════════════════════════════════════════════════════════════
--
-- Hoy al invitar a alguien se elige entre dos cosas: «todo, como tú» o
-- «solo mirar». Y eso deja fuera a casi todo el mundo real.
--
-- Quien ayuda en casa no necesita ver las facturas del seguro ni los
-- informes médicos: necesita saber qué toca hoy, la lista de la compra
-- y poder subir el ticket del súper. Un asesor necesita justo lo
-- contrario: las cuentas y los papeles, y no tocar nada.
--
-- Con «todo o nada» las dos cosas se resuelven mal: o le das de más, o
-- le das de menos y te lo pide por teléfono.
--
-- ─────────────────────────────────────────────────────────────
-- EL ROL ES UN ATAJO, NO UN SISTEMA NUEVO
--
-- Esto es lo importante de este archivo y conviene que no se pierda.
--
-- Los permisos que mandan siguen siendo los que ya había: `papel`,
-- `ve_todo`, `escribe_todo` y `permisos_carpeta`. El rol NO se
-- consulta en ninguna política. Lo único que hace es RELLENARLOS de
-- golpe cuando se elige, y quedar guardado para que la pantalla sepa
-- a quién le está hablando.
--
-- Si el rol decidiera permisos por su cuenta habría dos fuentes de
-- verdad —una en las políticas y otra en el rol— y ahí es donde se
-- filtran las cosas: la pantalla diciendo que no ve Salud y la base de
-- datos dejándole verlo.
--
--   familia  →  papel miembro · ve todo · escribe todo
--   ayuda    →  papel miembro · solo la carpeta Casa, con escritura
--   asesor   →  papel lector  · solo las actividades con cuentas
--   mirar    →  papel lector  · lo ve todo, no toca nada
--
-- ─────────────────────────────────────────────────────────────
-- Y EL ACCESO PUEDE CADUCAR SOLO
--
-- Una empleada que se va, un asesor que deja de llevarte las cuentas.
-- Hoy hay que ACORDARSE de quitarles el acceso, y nadie se acuerda:
-- así es como se acumula gente mirando los papeles de una casa donde
-- ya no está.
--
-- `acceso_hasta` lo resuelve sin que nadie tenga que hacer nada. Y se
-- comprueba en `mi_hogar()` y en `mis_casas()`, que es por donde pasa
-- absolutamente todo: no hay una sola pantalla que se lo pueda saltar.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · Las dos columnas ───────────────────────────────────
alter table miembros
  add column if not exists rol text
    check (rol is null or rol in ('familia', 'ayuda', 'asesor', 'mirar'));

alter table miembros
  add column if not exists acceso_hasta date;

comment on column miembros.rol is
  'Quién es esta persona en la casa. NO decide permisos por sí solo: '
  'los rellena al elegirlo. Manda papel + ve_todo + permisos_carpeta.';

comment on column miembros.acceso_hasta is
  'Último día con acceso. Nulo = sin fecha de fin.';

/*
  A quien ya estaba se le pone el rol que le corresponde por lo que
  puede hacer hoy. Nadie cambia de permisos por ejecutar esto: es
  ponerle nombre a lo que ya era.
*/
update miembros
   set rol = case when papel = 'lector' then 'mirar' else 'familia' end
 where rol is null;


-- ── 2 · Que el acceso caducado no abra ninguna puerta ──────
/*
  `mi_hogar()` otra vez, y por la misma razón de siempre: las cuarenta
  políticas preguntan por ella. Añadir aquí la fecha de fin es añadirla
  en todas partes a la vez, sin tocar ni una política.
*/
create or replace function mi_hogar() returns uuid
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (
      select p.casa_activa
      from perfiles p
      where p.id = auth.uid()
        and p.casa_activa is not null
        and exists (
          select 1 from miembros m
          where m.perfil_id = auth.uid()
            and m.hogar_id = p.casa_activa
            and m.aceptado_en is not null
            and (m.acceso_hasta is null or m.acceso_hasta >= current_date)
        )
    ),
    (
      select m.hogar_id from miembros m
      where m.perfil_id = auth.uid()
        and m.aceptado_en is not null
        and (m.acceso_hasta is null or m.acceso_hasta >= current_date)
      order by m.unido_en
      limit 1
    )
  )
$$;

create or replace function mis_casas() returns setof uuid
language sql stable security definer set search_path = public
as $$
  select hogar_id from miembros
  where perfil_id = auth.uid()
    and aceptado_en is not null
    and (acceso_hasta is null or acceso_hasta >= current_date)
$$;


-- ── 2b · La agenda y el corcho NO son de todo el mundo ─────
/*
  AQUÍ HABÍA UN AGUJERO, Y HAY QUE DECIRLO CLARO.

  `permisos_carpeta` protege documentos y movimientos: son los que
  cuelgan de una carpeta. Pero las tareas y las notas no cuelgan de
  ninguna — sus políticas dicen simplemente `hogar_id = mi_hogar()`.

  O sea: quien ayuda en casa, con el rol recién puesto y sin ver una
  sola factura, entraría en la Agenda y vería TODO lo de la familia.
  El médico del martes, el abogado del jueves. Y en las Notas, lo que
  se dejan el uno al otro.

  Eso no es lo que promete el rol, y un permiso que promete una cosa y
  hace otra es peor que no tener permisos.

  Se arregla donde tiene que arreglarse —en la base de datos, no
  escondiendo botones—: quien es 'ayuda' ve lo SUYO. Lo que le han
  asignado, lo que ha apuntado él, y las notas que le han dejado.
*/
create or replace function mi_rol() returns text
language sql stable security definer set search_path = public
as $$
  select m.rol from miembros m
  where m.perfil_id = auth.uid() and m.hogar_id = mi_hogar()
$$;

revoke all on function mi_rol() from public;
grant execute on function mi_rol() to authenticated;

drop policy if exists recordatorios_leer on recordatorios;
create policy recordatorios_leer on recordatorios
  for select to authenticated using (
    hogar_id = mi_hogar()
    and (
      coalesce(mi_rol(), 'familia') <> 'ayuda'
      or asignado_a = auth.uid()
      or creado_por = auth.uid()
      /* Sin asignar es de la casa entera: si se le escondiera, un
         recado dejado sin poner nombre no lo vería nadie. */
      or asignado_a is null
    )
  );

/* Envuelto: si el SQL 35 todavía no se ha ejecutado, la tabla `notas`
   no existe y este archivo entero se caería a la mitad — dejando los
   roles puestos y la agenda a medio proteger. */
do $$
begin
  if to_regclass('public.notas') is not null then
    drop policy if exists notas_leer on notas;
    create policy notas_leer on notas
      for select to authenticated using (
        hogar_id = mi_hogar()
        and (
          coalesce(mi_rol(), 'familia') <> 'ayuda'
          or para = auth.uid()
          or escrita_por = auth.uid()
        )
      );
  else
    raise notice 'La tabla notas no existe todavía: ejecuta antes el SQL 35.';
  end if;
end $$;


-- ── 3 · Poner un rol, con todo lo que arrastra ─────────────
/*
  `security definer` porque escribe en `permisos_carpeta`, cuya
  política dice «solo quien creó la casa». Aquí se comprueba lo mismo
  a mano, y ANTES de tocar nada: quien llama tiene que ser propietario
  de la casa de esa persona.

  Se borra lo que hubiera y se pone lo del rol. Es lo honesto: elegir
  «Asesor» tiene que dejar a esa persona como un asesor, no como un
  asesor más lo que se le quedara de antes.
*/
create or replace function poner_rol(a_quien uuid, el_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yo    uuid := auth.uid();
  casa  uuid;
begin
  if el_rol not in ('familia', 'ayuda', 'asesor', 'mirar') then
    raise exception 'Ese rol no existe.';
  end if;

  select m.hogar_id into casa
  from miembros m
  where m.perfil_id = a_quien
    and m.hogar_id = mi_hogar();

  if casa is null then
    raise exception 'Esa persona no está en tu casa.';
  end if;

  if not exists (
    select 1 from miembros m
    where m.hogar_id = casa and m.perfil_id = yo and m.papel = 'propietario'
  ) then
    raise exception 'Solo quien creó la casa reparte los accesos.';
  end if;

  /* A quien creó la casa no se le cambia el rol: se quedaría sin poder
     conectar su propio Drive ni volver a repartir accesos. */
  if exists (
    select 1 from miembros m
    where m.hogar_id = casa and m.perfil_id = a_quien and m.papel = 'propietario'
  ) then
    raise exception 'Quien creó la casa no puede cambiar de rol.';
  end if;

  update miembros m
     set rol          = el_rol,
         papel        = case when el_rol in ('asesor', 'mirar') then 'lector' else 'miembro' end,
         ve_todo      = (el_rol in ('familia', 'mirar')),
         escribe_todo = (el_rol = 'familia')
   where m.perfil_id = a_quien and m.hogar_id = casa;

  delete from permisos_carpeta p
   where p.perfil_id = a_quien and p.hogar_id = casa;

  if el_rol = 'ayuda' then
    /*
      La carpeta Casa, y solo ésa. Con escritura, porque el ticket del
      súper es justo lo que va a subir.

      Fuera quedan Salud, Seguros y Documentos importantes. Si hace
      falta que vea la medicación —y en una casa con alguien mayor hará
      falta— se le abre esa carpeta a mano, que para eso existe
      «¿Qué puede ver?». Lo que no puede es venir abierta de serie.
    */
    insert into permisos_carpeta (perfil_id, categoria_id, hogar_id, ver, escribir)
    select a_quien, c.id, casa, true, true
    from categorias c
    where c.hogar_id = casa and c.padre_id is null and c.segmento_drive = 'CASA';

  elsif el_rol = 'asesor' then
    /* Las actividades con cuentas, para mirar. Es a lo que viene: las
       cuentas de la finca, de las obras, de los pisos. */
    insert into permisos_carpeta (perfil_id, categoria_id, hogar_id, ver, escribir)
    select a_quien, c.id, casa, true, false
    from categorias c
    where c.hogar_id = casa and c.padre_id is null and c.lleva_cuentas is true;
  end if;
end;
$$;

revoke all on function poner_rol(uuid, text) from public;
grant execute on function poner_rol(uuid, text) to authenticated;


-- ── 4 · Comprobación ───────────────────────────────────────
/*
  DOS resultados.

  1 · Quién es quién, y si lo que puede cuadra con lo que dice ser.
      `coherente` tiene que salir **true en todas las filas**. Si sale
      false, alguien tiene un rol puesto y unos permisos que no le
      corresponden — que es justo el fallo del que avisa la cabecera de
      este archivo.

  2 · Las dos funciones, `definer` las dos, y `poner_rol` también.
*/
select
  p.nombre                                          as persona,
  h.nombre                                          as casa,
  m.rol,
  m.papel,
  m.acceso_hasta,
  (
    case m.rol
      when 'familia' then m.papel <> 'lector' and m.ve_todo and m.escribe_todo
      when 'ayuda'   then m.papel <> 'lector' and not m.ve_todo and not m.escribe_todo
      when 'asesor'  then m.papel  = 'lector' and not m.ve_todo
      when 'mirar'   then m.papel  = 'lector' and m.ve_todo
      else true
    end
    /* Quien creó la casa manda por encima del rol: es correcto que
       tenga permisos de sobra. */
    or m.papel = 'propietario'
  )                                                 as coherente
from miembros m
join perfiles p on p.id = m.perfil_id
join hogares  h on h.id = m.hogar_id
order by h.nombre, p.nombre;

select
  p.proname as funcion,
  case when p.prosecdef then 'definer' else '⚠ invoker' end as seguridad
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('mi_hogar', 'mis_casas', 'poner_rol')
order by p.proname;
