-- ═══════════════════════════════════════════════════════════════
-- 38 · LO DE CADA SEMANA
-- ═══════════════════════════════════════════════════════════════
--
-- «Los lunes se cambian las sábanas» no es una tarea.
--
-- Una tarea es «recoge la medicación el martes»: pasa una vez y se
-- acaba. Una rutina pasa todas las semanas para siempre — y esa
-- diferencia, que parece de matiz, decide cómo se comporta la pantalla
-- el segundo mes.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ NO SON RECORDATORIOS QUE SE REPITEN
--
-- HUBI ya sabe repetir: `recordatorios.repite` existe desde el SQL 11.
-- Habría salido más barato hoy. Pero una tarea repetida que no se
-- marca se queda de «sin hacer» y se arrastra en rojo para siempre.
--
-- Con seis trabajos por tres días son dieciocho al mes. Basta con que
-- alguien se olvide de marcar un par para que la agenda se llene de
-- rojo — y una lista que siempre tiene rojo deja de mirarse, con lo
-- que también se pierde el rojo que SÍ importaba: la ITV, el seguro.
--
-- Una rutina sin marcar no es una deuda. Es un lunes que pasó.
-- El lunes que viene vuelve sola.
--
-- Es el mismo razonamiento que separó las notas de los recordatorios,
-- y allí acertamos.
--
-- ─────────────────────────────────────────────────────────────
-- DOS TABLAS, Y LA SEGUNDA ES LA QUE HACE QUE ESTO FUNCIONE
--
-- `rutinas`        el plan: qué se hace, qué día, quién.
-- `rutinas_hechas` una fila por día que se hizo.
--
-- Marcar hecho NO cambia el plan: apunta una fila con la fecha. Así
-- el plan es una cosa estable que casi nunca se toca, y el historial
-- crece aparte. Si en vez de eso se guardara «hecha: sí/no» dentro de
-- la rutina, habría que borrarlo cada noche — y con quién trabaja de
-- noche, o con un móvil en otra zona horaria, eso se rompe.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · El plan ────────────────────────────────────────────
create table if not exists rutinas (
  id        uuid primary key default gen_random_uuid(),
  hogar_id  uuid not null references hogares(id) on delete cascade,

  -- Lo que hay que hacer, en sus palabras: «cambiar las sábanas»,
  -- «regar las plantas», «sacar la basura».
  que       text not null check (length(trim(que)) > 0),

  /*
    Qué día. 1 = lunes … 7 = domingo.

    En lunes y no en domingo como hace Postgres, porque en España la
    semana empieza en lunes y esta tabla la lee gente, no un informe.
  */
  dia       smallint not null check (dia between 1 and 7),

  -- A qué hora, si la tiene. La mayoría no.
  hora      time,

  -- De quién es. Nulo = de la casa, sin dueño.
  para      uuid references perfiles(id) on delete set null,

  -- Apagada sin borrarla: una semana que no viene, un trabajo que se
  -- deja de hacer una temporada.
  activa    boolean not null default true,

  orden     smallint not null default 0,
  creada_en timestamptz not null default now(),
  creada_por uuid references perfiles(id)
);

create index if not exists idx_rutinas_dia
  on rutinas (hogar_id, dia) where activa;


-- ── 2 · Y lo que se ha ido haciendo ────────────────────────
/*
  Una fila por rutina y día. La clave primaria impide marcarla dos
  veces el mismo día: sin ella, dos toques seguidos —o el mismo móvil
  reintentando con mala cobertura— dejarían dos filas y cualquier
  cuenta que hagamos luego saldría inflada.
*/
create table if not exists rutinas_hechas (
  rutina_id uuid not null references rutinas(id) on delete cascade,
  fecha     date not null,
  hogar_id  uuid not null references hogares(id) on delete cascade,
  quien     uuid references perfiles(id) on delete set null,
  cuando    timestamptz not null default now(),
  primary key (rutina_id, fecha)
);

create index if not exists idx_rutinas_hechas_fecha
  on rutinas_hechas (hogar_id, fecha);


-- ── 3 · Quién ve y quién toca ──────────────────────────────
alter table rutinas enable row level security;
alter table rutinas_hechas enable row level security;

/*
  LAS CUATRO EN CADA TABLA. Y la de borrar también.

  En este proyecto ya pasó: una tabla creada con leer, crear y editar
  y sin la de borrar. Un DELETE sin política NO da error — borra cero
  filas y contesta que todo ha ido bien. Costó una tarde entera.
*/
drop policy if exists rutinas_leer on rutinas;
create policy rutinas_leer on rutinas
  for select to authenticated using (hogar_id = mi_hogar());

/*
  EL PLAN LO MONTA QUIEN CREÓ LA CASA.

  No es jerarquía por gusto: decidir qué trabajos hace la persona que
  viene a casa, y qué días, es la relación laboral. Quien ayuda en
  casa puede MARCAR lo suyo como hecho —eso es la otra tabla— pero no
  añadirse ni quitarse trabajos.

  Y al revés también importa: sin esto, quien tiene el rol de ayuda
  podría borrarse el plan entero y no quedaría ni rastro de qué había.
*/
drop policy if exists rutinas_crear on rutinas;
create policy rutinas_crear on rutinas
  for insert to authenticated with check (
    hogar_id = mi_hogar()
    and exists (
      select 1 from miembros m
      where m.hogar_id = mi_hogar() and m.perfil_id = auth.uid()
        and m.papel = 'propietario'
    )
  );

drop policy if exists rutinas_editar on rutinas;
create policy rutinas_editar on rutinas
  for update to authenticated using (
    hogar_id = mi_hogar()
    and exists (
      select 1 from miembros m
      where m.hogar_id = mi_hogar() and m.perfil_id = auth.uid()
        and m.papel = 'propietario'
    )
  );

drop policy if exists rutinas_borrar on rutinas;
create policy rutinas_borrar on rutinas
  for delete to authenticated using (
    hogar_id = mi_hogar()
    and exists (
      select 1 from miembros m
      where m.hogar_id = mi_hogar() and m.perfil_id = auth.uid()
        and m.papel = 'propietario'
    )
  );

-- ── Y lo hecho: eso sí lo marca quien trabaja ──────────────
drop policy if exists hechas_leer on rutinas_hechas;
create policy hechas_leer on rutinas_hechas
  for select to authenticated using (hogar_id = mi_hogar());

/*
  Cualquiera de la casa que pueda escribir. Si un día lo hace Conchita
  en vez de la persona que viene, lo marca ella — igual que con las
  tareas, donde eso ya se decidió y funciona.

  `quien = auth.uid()` para que quede constancia de QUIÉN lo marcó.
  Sin eso, «hecho» no dice nada el día que haya una duda.
*/
drop policy if exists hechas_marcar on rutinas_hechas;
create policy hechas_marcar on rutinas_hechas
  for insert to authenticated with check (
    hogar_id = mi_hogar() and quien = auth.uid() and puedo_escribir()
  );

/*
  Y desmarcar. Hace falta y es de las cosas que se olvidan: marcar por
  error algo que no se ha hecho, y no poder deshacerlo, obliga a
  mentir en la pantalla o a llamar a alguien. El punto 5 pide que lo
  importante sea reversible.
*/
drop policy if exists hechas_desmarcar on rutinas_hechas;
create policy hechas_desmarcar on rutinas_hechas
  for delete to authenticated using (
    hogar_id = mi_hogar() and puedo_escribir()
  );


-- ── 4 · Comprobación ───────────────────────────────────────
/*
  DOS resultados.

  1 · Siete políticas: cuatro en `rutinas` y tres en `rutinas_hechas`
      —leer, marcar y desmarcar; ahí no hay «editar» a propósito,
      porque una fila hecha no se cambia: se quita y se vuelve a
      poner.

  2 · Las dos tablas vacías y con RLS puesto. `rls = true` no es un
      detalle: sin él, cualquiera con una sesión vería el plan de
      trabajo de todas las casas de HUBI.
*/
select tablename as tabla, policyname as politica, cmd as para_que
from pg_policies
where tablename in ('rutinas', 'rutinas_hechas')
order by tablename, policyname;

select
  (select count(*) from rutinas)        as rutinas,
  (select count(*) from rutinas_hechas) as marcadas,
  (select relrowsecurity from pg_class where relname = 'rutinas')        as rls_rutinas,
  (select relrowsecurity from pg_class where relname = 'rutinas_hechas') as rls_hechas;
