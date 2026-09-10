-- ═══════════════════════════════════════════════════════════════
-- 34 · UNA PERSONA PUEDE ESTAR EN VARIAS CASAS
-- ═══════════════════════════════════════════════════════════════
--
-- Hasta hoy, invitar a alguien que ya usaba HUBI se rechazaba: «cada
-- persona pertenece a una sola casa». Era una limitación técnica
-- convertida en regla de producto, y estaba mal.
--
-- El caso real es este: el hijo de Juan Miguel tiene su HUBI y además
-- quiere ayudar con el de sus padres. Hoy tiene que elegir. Y HUBI le
-- castigaba por haber entrado primero.
--
-- ─────────────────────────────────────────────────────────────
-- DE DÓNDE VENÍA EL MIEDO, Y POR QUÉ SE ARREGLA EN UN SITIO
--
-- Las cuarenta políticas de la base de datos preguntan lo mismo:
-- `mi_hogar()`. Y esa función contestaba «la primera casa donde te
-- encuentre» — con dos casas habría contestado una u otra según el
-- orden en que uno se apuntó, cambiando sin avisar y sin dar ningún
-- error.
--
-- Ahora contesta **la casa que estás mirando**: una elección guardada.
-- Las políticas no se tocan. Se toca la función.
--
-- ─────────────────────────────────────────────────────────────
-- Y LA INVITACIÓN PASA A SER DE DOS
--
-- Meter sin permiso a alguien que ya usa HUBI no se sostiene. Se
-- resuelve sin tabla nueva: la fila de miembro se crea igual, pero con
-- `aceptado_en` a nulo. Mientras esté a nulo, esa casa NO existe para
-- esa persona — ni la ve, ni cuenta como suya, ni se le puede activar.
--
-- Una fila pendiente en vez de una tabla de invitaciones significa que
-- los permisos por carpeta se pueden preparar desde el primer momento
-- con lo que ya está hecho, y aceptar es cambiar una fecha.
--
-- Se puede ejecutar dos veces seguidas sin romper nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · Aceptada o pendiente ───────────────────────────────
alter table miembros
  add column if not exists aceptado_en timestamptz;

/*
  Quien ya estaba dentro entró de verdad: se le pone la fecha de
  cuando se unió. Sin esto, la primera consulta después de ejecutar
  este archivo dejaría a Juan Miguel y a Conchita fuera de su propia
  casa — que es exactamente el tipo de «mejora» que rompe lo que
  funcionaba.
*/
update miembros set aceptado_en = unido_en where aceptado_en is null;


-- ── 2 · Cuál estoy mirando ─────────────────────────────────
/*
  Va en `perfiles` y no en una cookie a propósito: la base de datos
  tiene que poder leerlo para decidir qué te enseña, y una cookie no
  llega ahí. Además así la elección viaja con la persona entre el
  móvil y el ordenador.
*/
alter table perfiles
  add column if not exists casa_activa uuid references hogares(id) on delete set null;


-- ── 3 · Todas mis casas ────────────────────────────────────
/*
  `security definer` por lo de siempre: lee `miembros` por debajo de
  las políticas. Sin eso se muerde la cola — para saber en qué casas
  estás haría falta ya poder leer en qué casas estás.
*/
create or replace function mis_casas() returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select hogar_id from miembros
  where perfil_id = auth.uid() and aceptado_en is not null
$$;

/** Las que me han ofrecido y todavía no he contestado. */
create or replace function mis_invitaciones() returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select hogar_id from miembros
  where perfil_id = auth.uid() and aceptado_en is null
$$;


-- ── 4 · LA FUNCIÓN. La que sostiene todo lo demás ──────────
/*
  Tres reglas, en este orden:

  1 · La casa que has elegido mirar — PERO solo si sigues siendo
      miembro aceptado de ella. Esa comprobación no es paranoia: sin
      ella, quedarse apuntado un identificador viejo bastaría para
      seguir viendo una casa de la que te han sacado.

  2 · Si no has elegido ninguna, la primera que aceptaste. Es lo que
      hacía antes, y es lo que hace que a quien solo tiene una casa
      —o sea, a todo el mundo hoy— no le cambie absolutamente nada.

  3 · Nulo si no estás en ninguna. Y con nulo, todas las políticas
      devuelven cero filas: no ves nada. Que es lo correcto.
*/
create or replace function mi_hogar() returns uuid
language sql
stable
security definer
set search_path = public
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
        )
    ),
    (
      select m.hogar_id from miembros m
      where m.perfil_id = auth.uid() and m.aceptado_en is not null
      order by m.unido_en
      limit 1
    )
  )
$$;


-- ── 5 · Ver las otras casas, lo justo para elegir ──────────
/*
  Para pintar el selector y la invitación hacen falta dos cosas que
  antes no: el NOMBRE de una casa que todavía no estás mirando, y tu
  propia fila de miembro pendiente.

  Y nada más. Ver el nombre de una casa a la que te han invitado no
  enseña ni un papel de dentro: todo lo demás sigue colgando de
  `mi_hogar()`, que solo devuelve la que estás mirando.
*/
drop policy if exists hogares_leer on hogares;
create policy hogares_leer on hogares
  for select to authenticated using (
    id in (select mis_casas()) or id in (select mis_invitaciones())
  );

/*
  Y las filas de miembro: las de la casa que miras, y SIEMPRE las
  tuyas. Sin ese «siempre las tuyas», una invitación pendiente sería
  invisible para quien la ha recibido.
*/
drop policy if exists miembros_leer on miembros;
create policy miembros_leer on miembros
  for select to authenticated using (
    perfil_id = auth.uid() or hogar_id = mi_hogar()
  );

/*
  Aceptar o rechazar lo hace la propia persona, y solo sobre SU fila.
  El `with check` impide lo único que podría intentarse por aquí:
  cambiarse el papel a propietario al aceptar.
*/
drop policy if exists miembros_contesto on miembros;
create policy miembros_contesto on miembros
  for update to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());


-- ── 6 · Comprobación ───────────────────────────────────────
/*
  TRES resultados:

  1 · Las tres funciones, `definer` las tres.
  2 · Nadie con `aceptado_en` a nulo entre los que ya estaban. Si sale
      alguno, ese se ha quedado fuera de su casa y hay que mirarlo.
  3 · Una fila por persona: en cuántas casas está y cuál mira. Hoy
      todos deberían salir con 1 casa y `mira` a nulo — nadie ha
      elegido nada todavía, así que cae en la segunda regla.
*/
select
  p.proname as funcion,
  case when p.prosecdef then 'definer' else '⚠ invoker' end as seguridad
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('mi_hogar', 'mis_casas', 'mis_invitaciones')
order by p.proname;

select
  count(*)                                        as filas_de_miembro,
  count(*) filter (where aceptado_en is not null) as aceptadas,
  count(*) filter (where aceptado_en is null)     as pendientes
from miembros;

select
  pe.nombre                                                     as persona,
  (select count(*) from miembros m
    where m.perfil_id = pe.id and m.aceptado_en is not null)     as casas,
  (select h.nombre from hogares h where h.id = pe.casa_activa)   as mira
from perfiles pe
order by pe.nombre;
