-- ═══════════════════════════════════════════════════════════════
-- 39 · DE QUÉ COLOR ES CADA UNO, Y QUÉ PUEDE EL ASESOR
-- ═══════════════════════════════════════════════════════════════
--
-- Dos cosas que van juntas aunque parezcan distintas.
--
-- ─────────────────────────────────────────────────────────────
-- 1 · CADA PERSONA, SU COLOR
--
-- En una casa con cuatro personas dentro, todo lo que hacen se mezcla
-- en las mismas listas: la agenda, el corcho, lo de hoy. Y saber QUIÉN
-- ha dejado cada cosa obliga hoy a leerse la letra pequeña de cada
-- línea, una por una.
--
-- Con un color por persona eso se contesta sin leer. Es lo que hace
-- cualquier calendario compartido, y funciona porque el color se
-- reconoce de reojo y el nombre no.
--
-- El color sale del papel —la ayuda de un color, el asesor de otro—
-- pero se guarda POR PERSONA, no por papel: dos asesores del mismo
-- color no se distinguen entre sí, que es justo lo que veníamos a
-- resolver. Y así se puede cambiar el de uno sin tocar el de nadie.
--
-- ─────────────────────────────────────────────────────────────
-- 2 · EL ASESOR PUEDE DEJARTE COSAS
--
-- Hasta hoy el asesor era `papel = 'lector'`: entraba, miraba y ya
-- está. Y eso es la mitad de la relación. Un gestor no solo mira las
-- cuentas — te dice «te falta la factura de septiembre», «acuérdate
-- del pago del día 20», «esto que subiste no vale».
--
-- Sin sitio donde dejarlo, eso acaba en un WhatsApp que se pierde.
--
-- Así que se le abre la AGENDA y el CORCHO, y nada más:
--
--   puede   dejar notas, poner tareas, ver el calendario
--   no puede subir papeles, apuntar gastos, tocar las cuentas
--
-- Y por eso no se toca `puedo_escribir()` para dejarle pasar: eso le
-- abriría también los documentos y los movimientos. Se añade una
-- función aparte para la agenda, que es donde de verdad tiene algo
-- que decir.
--
-- ─────────────────────────────────────────────────────────────
-- Y DE PASO, UN FALLO QUE LLEVABA AHÍ DESDE EL 31
--
-- `puedo_escribir()` miraba «la primera fila de miembros por fecha»,
-- sin mirar en qué casa. Desde que una persona puede estar en varias
-- —sql/34— eso está mal: quien es asesor en la casa de sus padres y
-- dueño de la suya recibía el permiso de la que entró primero. En una
-- de las dos casas escribía de más, o de menos.
--
-- Se arregla aquí porque es la misma función que estamos tocando, y
-- porque un permiso que depende del orden de las invitaciones no es un
-- permiso.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · El color ───────────────────────────────────────────
alter table miembros
  add column if not exists color text;

comment on column miembros.color is
  'El color de esta persona EN ESTA CASA. Sale de su papel y se puede '
  'cambiar. Se usa para reconocer de un vistazo quién ha dejado qué.';

/*
  A quien ya está se le pone el que le toca por su papel, y si en una
  casa hay dos del mismo papel, el segundo coge el siguiente de la
  lista. Nadie acaba con el color de otro.

  La paleta es la de HUBI y son colores que se leen igual en claro y
  en oscuro. Nada de pasteles: a 14 píxeles un pastel es gris.
*/
with paleta as (
  select array[
    '#14B8A6',  -- turquesa   · familia
    '#0EA5E9',  -- azul cielo · ayuda en casa
    '#F59E0B',  -- ámbar      · asesor
    '#8B5CF6',  -- morado
    '#EC4899',  -- rosa
    '#3B82F6',  -- azul
    '#F97316',  -- naranja
    '#10B981',  -- verde
    '#64748B'   -- pizarra    · solo mirar
  ] as c
),
puesto as (
  select
    m.hogar_id,
    m.perfil_id,
    /* El de su papel, y el siguiente si ya lo tiene alguien de esa
       casa. `unido_en` decide quién llegó antes. */
    case coalesce(m.rol, 'familia')
      when 'familia' then 1
      when 'ayuda'   then 2
      when 'asesor'  then 3
      else 9
    end
    + (row_number() over (
         partition by m.hogar_id, coalesce(m.rol, 'familia')
         order by m.unido_en
       ) - 1) as sitio
  from miembros m
  where m.color is null
)
update miembros m
   set color = (select c[((p.sitio - 1) % 9) + 1] from paleta)
  from puesto p
 where m.hogar_id = p.hogar_id
   and m.perfil_id = p.perfil_id
   and m.color is null;


-- ── 2 · El permiso de escribir, en la casa correcta ────────
/*
  Igual que estaba, con `and hogar_id = mi_hogar()` y sin el
  `order by ... limit 1` que cogía una casa al azar.

  Sin fila de miembro sigue devolviendo TRUE, y por la misma razón que
  se escribió en el 31: quien no está en `miembros` no es un lector,
  es alguien de quien no sabemos nada — y a ése ya le corta `mi_hogar()`
  devolviendo nulo. Poner FALSE aquí dejaría fuera a quien perdiera su
  fila de miembro un día, que es romper lo que funciona por proteger
  lo que ya está protegido.
*/
create or replace function puedo_escribir() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.papel <> 'lector'
      from miembros m
      where m.perfil_id = auth.uid()
        and m.hogar_id = mi_hogar()
    ),
    true
  )
$$;

revoke all on function puedo_escribir() from public;
grant execute on function puedo_escribir() to authenticated;


-- ── 3 · Y el permiso de la agenda, que es otro ─────────────
/*
  Quien puede escribir, puede. Y además el asesor, aunque sea lector:
  a eso viene ahora.

  Quien «solo mira» sigue sin poder, que es literalmente lo que se le
  ofreció al invitarlo.
*/
create or replace function puedo_en_agenda() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select puedo_escribir() or coalesce(mi_rol(), 'familia') = 'asesor'
$$;

revoke all on function puedo_en_agenda() from public;
grant execute on function puedo_en_agenda() to authenticated;


-- ── 4 · Las políticas de la agenda y del corcho ────────────
/*
  Solo estas dos tablas. Documentos, movimientos, categorías, compra y
  unidades se quedan con `puedo_escribir()` — el asesor mira las
  cuentas, no las escribe.

  OJO SI ALGÚN DÍA SE VUELVE A EJECUTAR EL SQL 31: aquel archivo
  rehace estas políticas en bucle con `puedo_escribir()` y se llevaría
  esto por delante. Si se ejecuta, ejecutar el 39 detrás.
*/
drop policy if exists recordatorios_crear on recordatorios;
create policy recordatorios_crear on recordatorios
  for insert to authenticated with check (
    hogar_id = mi_hogar() and puedo_en_agenda()
  );

/*
  EDITAR Y BORRAR: el asesor, solo lo suyo.

  Dejarle la política de siempre —«cualquiera de la casa toca
  cualquier cosa»— le dejaría borrar el médico del martes. Entre
  familia eso está bien y es lo que hay desde el principio: se
  arreglan hablando. Con alguien de fuera, no.
*/
drop policy if exists recordatorios_editar on recordatorios;
create policy recordatorios_editar on recordatorios
  for update to authenticated using (
    hogar_id = mi_hogar()
    and puedo_en_agenda()
    and (
      coalesce(mi_rol(), 'familia') <> 'asesor'
      or creado_por = auth.uid()
    )
  );

drop policy if exists recordatorios_borrar on recordatorios;
create policy recordatorios_borrar on recordatorios
  for delete to authenticated using (
    hogar_id = mi_hogar()
    and puedo_en_agenda()
    and (
      coalesce(mi_rol(), 'familia') <> 'asesor'
      or creado_por = auth.uid()
    )
  );

/* El corcho. `notas_editar` y `notas_borrar` ya estaban limitadas a
   quien la escribió (o a quien va dirigida, para el «Visto»), así que
   ahí solo cambia la función. */
do $$
begin
  if to_regclass('public.notas') is null then
    raise notice 'La tabla notas no existe todavía: ejecuta antes el SQL 35.';
    return;
  end if;

  drop policy if exists notas_crear on notas;
  create policy notas_crear on notas
    for insert to authenticated with check (
      hogar_id = mi_hogar()
      and escrita_por = auth.uid()
      and puedo_en_agenda()
    );

  drop policy if exists notas_editar on notas;
  create policy notas_editar on notas
    for update to authenticated
    using (
      hogar_id = mi_hogar()
      and (escrita_por = auth.uid() or para = auth.uid())
      and puedo_en_agenda()
    )
    with check (
      hogar_id = mi_hogar()
      and (escrita_por = auth.uid() or para = auth.uid())
    );

  drop policy if exists notas_borrar on notas;
  create policy notas_borrar on notas
    for delete to authenticated using (
      hogar_id = mi_hogar()
      and escrita_por = auth.uid()
      and puedo_en_agenda()
    );
end $$;


-- ── 5 · Poner el color, y ponerlo al cambiar de papel ──────
/*
  `poner_rol` reparte los permisos; aquí se le añade el color, y solo
  si no tiene: cambiar a alguien de papel no puede cambiarle el color
  con el que la casa lleva meses reconociéndolo.
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
  suyo  text;
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

  if exists (
    select 1 from miembros m
    where m.hogar_id = casa and m.perfil_id = a_quien and m.papel = 'propietario'
  ) then
    raise exception 'Quien creó la casa no puede cambiar de rol.';
  end if;

  /* El primero de la paleta que no tenga nadie en esta casa,
     empezando por el que le toca a su papel. */
  select c into suyo
  from unnest(array[
    case el_rol when 'familia' then '#14B8A6'
                when 'ayuda'   then '#0EA5E9'
                when 'asesor'  then '#F59E0B'
                else '#64748B' end,
    '#8B5CF6', '#EC4899', '#3B82F6', '#F97316', '#10B981',
    '#14B8A6', '#0EA5E9', '#F59E0B', '#64748B'
  ]) as c
  where not exists (
    select 1 from miembros m
    where m.hogar_id = casa and m.color = c and m.perfil_id <> a_quien
  )
  limit 1;

  update miembros m
     set rol          = el_rol,
         papel        = case when el_rol in ('asesor', 'mirar') then 'lector' else 'miembro' end,
         ve_todo      = (el_rol in ('familia', 'mirar')),
         escribe_todo = (el_rol = 'familia'),
         color        = coalesce(m.color, suyo, '#64748B')
   where m.perfil_id = a_quien and m.hogar_id = casa;

  delete from permisos_carpeta p
   where p.perfil_id = a_quien and p.hogar_id = casa;

  if el_rol = 'ayuda' then
    insert into permisos_carpeta (perfil_id, categoria_id, hogar_id, ver, escribir)
    select a_quien, c.id, casa, true, true
    from categorias c
    where c.hogar_id = casa and c.padre_id is null and c.segmento_drive = 'CASA';

  elsif el_rol = 'asesor' then
    insert into permisos_carpeta (perfil_id, categoria_id, hogar_id, ver, escribir)
    select a_quien, c.id, casa, true, false
    from categorias c
    where c.hogar_id = casa and c.padre_id is null and c.lleva_cuentas is true;
  end if;
end;
$$;

revoke all on function poner_rol(uuid, text) from public;
grant execute on function poner_rol(uuid, text) to authenticated;


-- ── 6 · Cambiarle el color a alguien ───────────────────────
/*
  Aparte de `poner_rol` a propósito: cambiar un color no puede obligar
  a volver a repartir todos los permisos de esa persona. Son dos cosas
  distintas y la de aquí no tiene ninguna consecuencia.

  `security definer` porque `miembros` solo lo edita quien creó la
  casa, y eso se comprueba aquí a mano.
*/
create or replace function poner_color(a_quien uuid, el_color text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  casa uuid := mi_hogar();
begin
  /* Un color de verdad y nada más: esto acaba dentro de un `style` en
     la pantalla, y ahí no entra texto que venga del navegador sin
     mirar. */
  if el_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Eso no es un color.';
  end if;

  if not exists (
    select 1 from miembros m
    where m.hogar_id = casa and m.perfil_id = auth.uid() and m.papel = 'propietario'
  ) then
    raise exception 'Solo quien creó la casa reparte los colores.';
  end if;

  update miembros m
     set color = upper(el_color)
   where m.hogar_id = casa and m.perfil_id = a_quien;

  if not found then
    raise exception 'Esa persona no está en tu casa.';
  end if;
end;
$$;

revoke all on function poner_color(uuid, text) from public;
grant execute on function poner_color(uuid, text) to authenticated;


-- ── 7 · Comprobación ───────────────────────────────────────
/*
  TRES resultados.

  1 · Cada persona con su color. Ni un `color` nulo, y dentro de una
      misma casa ningún color repetido. Si se repite, dos personas se
      confunden en la agenda — que es exactamente lo que este archivo
      venía a evitar.

  2 · Las políticas de la agenda y el corcho apuntando a
      `puedo_en_agenda`. Tienen que salir SEIS: crear, editar y borrar
      de `recordatorios` y de `notas`.

  3 · Las funciones, todas `definer`.
*/
select
  h.nombre                as casa,
  p.nombre                as persona,
  m.rol,
  m.color,
  count(*) over (partition by m.hogar_id, m.color) = 1 as color_suyo
from miembros m
join perfiles p on p.id = m.perfil_id
join hogares  h on h.id = m.hogar_id
order by h.nombre, p.nombre;

select tablename as tabla, policyname as politica, cmd as para_que
from pg_policies
where tablename in ('recordatorios', 'notas')
  and (qual ilike '%puedo_en_agenda%' or with_check ilike '%puedo_en_agenda%')
order by tablename, policyname;

select
  p.proname as funcion,
  case when p.prosecdef then 'definer' else '⚠ invoker' end as seguridad
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('puedo_escribir', 'puedo_en_agenda', 'poner_rol', 'poner_color', 'mi_rol')
order by p.proname;
