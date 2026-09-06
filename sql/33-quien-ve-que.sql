-- ═══════════════════════════════════════════════════════════════
-- 33 · QUIÉN VE QUÉ CARPETA, Y EN CUÁL PUEDE GUARDAR
-- ═══════════════════════════════════════════════════════════════
--
-- Es el punto 21 del planteamiento, el que lleva desde el primer día
-- sin hacerse: «documentos COMPARTIDOS y PRIVADOS, especialmente para
-- Salud y documentación personal».
--
-- Hoy, quien entra en una casa lo ve TODO. Para Juan Miguel y
-- Conchita, que se lo comparten todo, no es un problema. Para un hijo,
-- un gestor o un cuidador invitado, sí — y es la razón por la que
-- HUBI no se le puede enseñar todavía a según quién.
--
-- ─────────────────────────────────────────────────────────────
-- LA IDEA, EN UNA FRASE
--
-- El permiso no es por documento: es POR CARPETA.
--
-- Nadie va a marcar cuatrocientas facturas de una en una. Se dice
-- «Marta ve Casa y Vehículos, y puede guardar en Casa», y todo lo que
-- haya dentro —y todo lo que se guarde mañana— sigue esa regla sin que
-- nadie vuelva a tocar nada.
--
-- ─────────────────────────────────────────────────────────────
-- Y SE ABRE, NO SE CIERRA
--
-- Ésta es la decisión importante y va al revés de lo cómodo.
--
-- Lo cómodo sería: «guardo las carpetas que NO puede ver». Entonces
-- una carpeta creada mañana no tendría regla y se vería — y quien la
-- creó pensaría que su carpeta nueva es privada cuando no lo es.
--
-- Aquí es al contrario. Una persona limitada (`ve_todo = false`) no ve
-- NADA salvo lo que se le haya concedido expresamente. Una carpeta
-- nueva no la ve hasta que alguien decide que sí.
--
-- Quien ya estaba dentro —Juan Miguel, Conchita— tiene `ve_todo` en
-- true y no le cambia absolutamente nada.
--
-- Un fallo aquí no da error: enseña lo que no debía. Así que cuando se
-- dude, se cierra.
--
-- Se puede ejecutar dos veces seguidas sin romper nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · ¿Esta persona lo ve todo? ──────────────────────────
/*
  Dos interruptores por persona, y son independientes: se puede ver
  todo y escribir solo en una carpeta, o ver dos carpetas y escribir
  en las dos.

  Los dos nacen en `true`: lo que hay hoy. Una actualización que
  recorta permisos a alguien que ya estaba dentro no es una mejora, es
  una avería.
*/
alter table miembros add column if not exists ve_todo      boolean not null default true;
alter table miembros add column if not exists escribe_todo boolean not null default true;


-- ── 2 · Las concesiones, carpeta a carpeta ─────────────────
/*
  Solo se guardan las carpetas RAÍZ: Casa, Salud, Vehículos, la Finca,
  las Obras. Lo de dentro hereda.

  Es a propósito. Dejar elegir «Casa → Facturas sí, Casa →
  Reparaciones no» multiplica por diez las decisiones y no resuelve
  ningún caso real: nadie separa las facturas de las reparaciones de
  su propia casa. Lo que sí separa la gente es Salud del resto.
*/
create table if not exists permisos_carpeta (
  perfil_id    uuid not null references perfiles(id)   on delete cascade,
  categoria_id uuid not null references categorias(id) on delete cascade,
  hogar_id     uuid not null references hogares(id)    on delete cascade,
  ver          boolean not null default true,
  escribir     boolean not null default false,
  primary key (perfil_id, categoria_id)
);

create index if not exists idx_permisos_perfil on permisos_carpeta(perfil_id);

alter table permisos_carpeta enable row level security;

/* Cada uno ve los suyos, y los de los de su casa: la pantalla de
   ajustes tiene que poder pintar quién ve qué. */
drop policy if exists permisos_leer on permisos_carpeta;
create policy permisos_leer on permisos_carpeta
  for select to authenticated using (hogar_id = mi_hogar());

/* Y solo los cambia quien creó la casa. Quien reparte el acceso a las
   facturas y los informes médicos de todos es quien montó la casa, no
   cualquiera que pase por ella. */
drop policy if exists permisos_mandar on permisos_carpeta;
create policy permisos_mandar on permisos_carpeta
  for all to authenticated
  using (
    hogar_id = mi_hogar()
    and exists (
      select 1 from miembros m
      where m.perfil_id = auth.uid() and m.papel = 'propietario'
    )
  )
  with check (
    hogar_id = mi_hogar()
    and exists (
      select 1 from miembros m
      where m.perfil_id = auth.uid() and m.papel = 'propietario'
    )
  );


-- ── 3 · De qué carpeta cuelga cada cosa ────────────────────
/*
  Para saber si puedo ver un documento hay que saber de qué CARPETA
  RAÍZ cuelga. Y eso, en un árbol, es subir de padre en padre.

  `security definer` por lo mismo de siempre: tiene que leer
  `categorias` por debajo de las políticas, o se muerde la cola —para
  saber si puedes ver esta categoría haría falta poder verla.

  El tope de ocho vueltas no es paranoia: un ciclo en el árbol —una
  categoría que acabe siendo su propia abuela— colgaría esta función
  para siempre, y con ella cualquier consulta que la use.
*/
create or replace function raiz_de(cat uuid) returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actual uuid := cat;
  arriba uuid;
begin
  if cat is null then return null; end if;

  for i in 1..8 loop
    select padre_id into arriba from categorias where id = actual;
    if arriba is null then return actual; end if;
    actual := arriba;
  end loop;

  return actual;
end;
$$;


-- ── 4 · ¿Puedo ver esta carpeta? ¿Puedo guardar en ella? ───
/*
  Una función y todas las políticas la usan. Si mañana cambia la
  regla, se cambia aquí y en ningún sitio más.

  Sin fila de miembro devuelven TRUE, igual que `puedo_escribir()`:
  quien no está en `miembros` no es una persona limitada, es alguien
  de quien no sabemos nada — y el hogar ya le corta por otro lado,
  porque `mi_hogar()` le da nulo. Poner FALSE aquí dejaría fuera a
  Juan Miguel y Conchita si su fila se perdiera un día.
*/
create or replace function puedo_ver_carpeta(cat uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when cat is null then true
    when coalesce(
      (select ve_todo from miembros where perfil_id = auth.uid() order by unido_en limit 1),
      true
    ) then true
    else exists (
      select 1 from permisos_carpeta p
      where p.perfil_id = auth.uid()
        and p.categoria_id = raiz_de(cat)
        and p.ver
    )
  end
$$;

create or replace function puedo_guardar_en(cat uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    /* Primero lo global: un lector no escribe en ninguna parte, tenga
       la carpeta que tenga concedida. */
    puedo_escribir()
    and puedo_ver_carpeta(cat)
    and case
      when cat is null then true
      when coalesce(
        (select escribe_todo from miembros where perfil_id = auth.uid() order by unido_en limit 1),
        true
      ) then true
      else exists (
        select 1 from permisos_carpeta p
        where p.perfil_id = auth.uid()
          and p.categoria_id = raiz_de(cat)
          and p.escribir
      )
    end
$$;

revoke all on function raiz_de(uuid)            from public;
revoke all on function puedo_ver_carpeta(uuid)  from public;
revoke all on function puedo_guardar_en(uuid)   from public;
grant execute on function raiz_de(uuid)           to authenticated;
grant execute on function puedo_ver_carpeta(uuid) to authenticated;
grant execute on function puedo_guardar_en(uuid)  to authenticated;


-- ── 5 · Las fronteras nuevas ───────────────────────────────

-- CATEGORÍAS · no se ve la carpeta que no te toca
drop policy if exists categorias_leer on categorias;
create policy categorias_leer on categorias
  for select to authenticated using (
    hogar_id = mi_hogar() and puedo_ver_carpeta(id)
  );

drop policy if exists categorias_crear on categorias;
create policy categorias_crear on categorias
  for insert to authenticated with check (
    hogar_id = mi_hogar() and puedo_escribir()
  );

drop policy if exists categorias_editar on categorias;
create policy categorias_editar on categorias
  for update to authenticated using (
    hogar_id = mi_hogar() and puedo_guardar_en(id)
  );

drop policy if exists categorias_borrar on categorias;
create policy categorias_borrar on categorias
  for delete to authenticated using (
    hogar_id = mi_hogar() and puedo_guardar_en(id)
  );

-- DOCUMENTOS · tres condiciones, no dos
/*
  El hogar dice de qué familia es. La visibilidad dice si es de los dos
  o solo de quien lo subió. Y ahora la carpeta dice si esta persona
  tiene acceso a ese rincón de la casa. Las tres tienen que cumplirse.
*/
drop policy if exists documentos_leer on documentos;
create policy documentos_leer on documentos
  for select to authenticated using (
    hogar_id = mi_hogar()
    and eliminado_en is null
    and (visibilidad = 'compartido' or subido_por = auth.uid())
    and puedo_ver_carpeta(categoria_id)
  );

drop policy if exists documentos_crear on documentos;
create policy documentos_crear on documentos
  for insert to authenticated with check (
    hogar_id = mi_hogar()
    and subido_por = auth.uid()
    and puedo_guardar_en(categoria_id)
  );

drop policy if exists documentos_editar on documentos;
create policy documentos_editar on documentos
  for update to authenticated using (
    hogar_id = mi_hogar()
    and (visibilidad = 'compartido' or subido_por = auth.uid())
    and puedo_guardar_en(categoria_id)
  );

drop policy if exists documentos_borrar on documentos;
create policy documentos_borrar on documentos
  for delete to authenticated using (
    hogar_id = mi_hogar()
    and (visibilidad = 'compartido' or subido_por = auth.uid())
    and puedo_guardar_en(categoria_id)
  );

-- MOVIMIENTOS · el dinero va con su carpeta
/*
  Un gasto sin su carpeta no es un dato neutro: «312 € · 14 de marzo»
  colgando de Salud dice bastante aunque no se vea el informe. Si no
  ves la carpeta, no ves lo que se gastó en ella.
*/
drop policy if exists movimientos_leer on movimientos;
create policy movimientos_leer on movimientos
  for select to authenticated using (
    hogar_id = mi_hogar() and puedo_ver_carpeta(categoria_id)
  );

drop policy if exists movimientos_crear on movimientos;
create policy movimientos_crear on movimientos
  for insert to authenticated with check (
    hogar_id = mi_hogar() and puedo_guardar_en(categoria_id)
  );

drop policy if exists movimientos_editar on movimientos;
create policy movimientos_editar on movimientos
  for update to authenticated using (
    hogar_id = mi_hogar() and puedo_guardar_en(categoria_id)
  );

drop policy if exists movimientos_borrar on movimientos;
create policy movimientos_borrar on movimientos
  for delete to authenticated using (
    hogar_id = mi_hogar() and puedo_guardar_en(categoria_id)
  );


-- ── 6 · Comprobación ───────────────────────────────────────
/*
  TRES resultados, y los tres tienen que salir bien.

  1 · Las tres funciones, `definer` las tres.
  2 · TRUE las dos: lo ejecutas desde el editor de SQL, sin sesión, y
      ahí `auth.uid()` es nulo — cae en el `coalesce` y contesta que
      sí. Si sale FALSE, algo está mal escrito y NO se sigue.
  3 · Todo el mundo con `ve_todo` y `escribe_todo` en true: nadie ha
      perdido nada al ejecutar esto. Si alguien sale en false, para.
*/
select
  p.proname as funcion,
  case when p.prosecdef then 'definer' else '⚠ invoker' end as seguridad
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('raiz_de', 'puedo_ver_carpeta', 'puedo_guardar_en')
order by p.proname;

select puedo_ver_carpeta(null) as ver_deberia_ser_true,
       puedo_guardar_en(null)  as guardar_deberia_ser_true;

select
  count(*)                                as personas,
  count(*) filter (where ve_todo)         as ven_todo,
  count(*) filter (where escribe_todo)    as escriben_todo,
  (select count(*) from permisos_carpeta) as concesiones
from miembros;
