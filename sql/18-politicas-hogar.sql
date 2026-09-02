-- ───────────────────────────────────────────────────────────
--  FASE 1b · QUE LA BASE DE DATOS SEPARE LOS HOGARES
--
--  Aquí es donde el hogar deja de ser una columna y pasa a ser una
--  frontera. A partir de este archivo, una consulta que se olvide de
--  filtrar por hogar NO devuelve las filas de otra familia: devuelve
--  cero. La seguridad deja de depender de que el código se acuerde.
--
--  ══════════════════════════════════════════════════════════
--  POR QUÉ ESTO NO OBLIGA A REESCRIBIR LA APLICACIÓN
--  ══════════════════════════════════════════════════════════
--
--  Las políticas se escriben como `hogar_id = mi_hogar()`, y las
--  columnas llevan `default mi_hogar()` desde la 1a. Eso significa
--  que una consulta que hoy pide "los documentos" sigue pidiendo lo
--  mismo, y la base de datos le da los suyos. Ni un `where` nuevo en
--  toda la aplicación.
--
--  ══════════════════════════════════════════════════════════
--  QUÉ TABLAS ENTRAN, Y POR QUÉ NO TODAS
--  ══════════════════════════════════════════════════════════
--
--  ENTRAN LAS CINCO que el navegador toca con la sesión de la
--  persona: categorías, documentos, movimientos, recordatorios y la
--  compra. En todas se comprobó antes de escribir esto que NINGUNA
--  inserción usa la clave de servidor — si alguna lo hiciera, entraría
--  sin `auth.uid()`, `mi_hogar()` daría vacío y la fila nacería
--  huérfana e invisible.
--
--  NO ENTRAN `carpetas_drive` ni `conexion_drive`. No tienen ninguna
--  política a propósito desde el primer día: sin políticas, ningún
--  navegador las lee: solo el servidor. Su separación por hogar va con
--  la fase 2, que es cuando existe un segundo Drive que conectar. No
--  tiene sentido preparar antes algo que no se puede probar.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

-- ── 1 · Que no pueda volver a nacer una fila huérfana ──────
/*
  Sin esto, un fallo futuro que inserte sin hogar crea una fila que no
  ve NADIE, ni siquiera su dueño. Un documento que desaparece en
  silencio es lo peor que puede pasar aquí — y no daría ningún error.
*/
do $$
declare t text;
begin
  foreach t in array array['categorias','documentos','movimientos','recordatorios','compra']
  loop
    execute format('alter table %I alter column hogar_id set not null', t);
  end loop;
end $$;

-- ── 2 · La primera bomba: dos familias, una "Casa" ─────────
/*
  `categoria_unica` era (padre, nombre). Con eso, la segunda familia
  no puede crear su carpeta raíz "Casa" porque ya existe la de la
  primera. Ahora la unicidad es por hogar, que es lo que siempre quiso
  decir.
*/
alter table categorias drop constraint if exists categoria_unica;
alter table categorias
  add constraint categoria_unica
  unique nulls not distinct (hogar_id, padre_id, nombre);

-- ── 3 · Las fronteras ──────────────────────────────────────

-- CATEGORÍAS
drop policy if exists categorias_leer on categorias;
create policy categorias_leer on categorias
  for select to authenticated using (hogar_id = mi_hogar());

drop policy if exists categorias_crear on categorias;
create policy categorias_crear on categorias
  for insert to authenticated with check (hogar_id = mi_hogar());

drop policy if exists categorias_editar on categorias;
create policy categorias_editar on categorias
  for update to authenticated using (hogar_id = mi_hogar());

drop policy if exists categorias_borrar on categorias;
create policy categorias_borrar on categorias
  for delete to authenticated using (hogar_id = mi_hogar());

/*
  DOCUMENTOS — dos condiciones, no una.

  El hogar dice de qué familia es. La visibilidad dice, dentro de esa
  familia, si es de los dos o solo de quien lo subió. Las dos tienen
  que cumplirse: un documento privado de Conchita no lo ve ni Juan
  Miguel ni, por supuesto, nadie de otra casa.
*/
drop policy if exists documentos_leer on documentos;
create policy documentos_leer on documentos
  for select to authenticated using (
    hogar_id = mi_hogar()
    and eliminado_en is null
    and (visibilidad = 'compartido' or subido_por = auth.uid())
  );

drop policy if exists documentos_crear on documentos;
create policy documentos_crear on documentos
  for insert to authenticated with check (
    hogar_id = mi_hogar() and subido_por = auth.uid()
  );

drop policy if exists documentos_editar on documentos;
create policy documentos_editar on documentos
  for update to authenticated using (
    hogar_id = mi_hogar()
    and (visibilidad = 'compartido' or subido_por = auth.uid())
  );

drop policy if exists documentos_borrar on documentos;
create policy documentos_borrar on documentos
  for delete to authenticated using (
    hogar_id = mi_hogar()
    and (visibilidad = 'compartido' or subido_por = auth.uid())
  );

-- MOVIMIENTOS · RECORDATORIOS · COMPRA
/*
  Las tres son de la casa entera: cualquiera de los suyos las ve, las
  crea, las cambia y las quita. Esa decisión ya estaba tomada —"si
  Conchita recoge lo que le tocaba a Juan Miguel, lo marca ella"— y no
  cambia. Lo único que cambia es que ahora "los suyos" significa algo.
*/
do $$
declare t text;
begin
  foreach t in array array['movimientos','recordatorios','compra']
  loop
    execute format('drop policy if exists %s_leer on %I', t, t);
    execute format(
      'create policy %s_leer on %I for select to authenticated using (hogar_id = mi_hogar())', t, t
    );

    execute format('drop policy if exists %s_crear on %I', t, t);
    execute format(
      'create policy %s_crear on %I for insert to authenticated with check (hogar_id = mi_hogar())', t, t
    );

    execute format('drop policy if exists %s_editar on %I', t, t);
    execute format(
      'create policy %s_editar on %I for update to authenticated using (hogar_id = mi_hogar())', t, t
    );

    execute format('drop policy if exists %s_borrar on %I', t, t);
    execute format(
      'create policy %s_borrar on %I for delete to authenticated using (hogar_id = mi_hogar())', t, t
    );
  end loop;
end $$;

-- ── 4 · Perfiles: solo los de tu casa ──────────────────────
/*
  Estaba en `using (true)`: todo el mundo veía a todo el mundo. Con dos
  usuarios daba igual. Con cuarenta familias, es la lista de nombres y
  correos de todas ellas.
*/
drop policy if exists perfiles_leer on perfiles;
create policy perfiles_leer on perfiles
  for select to authenticated using (
    exists (
      select 1 from miembros m
      where m.perfil_id = perfiles.id and m.hogar_id = mi_hogar()
    )
  );

-- ── 5 · Comprobación ───────────────────────────────────────
/*
  Que se vea que están puestas, en vez de suponerlo. Deben salir
  cuatro políticas por tabla (documentos, cinco no: las cuatro más
  nada). Si alguna tabla sale con menos de cuatro, falta una — y una
  tabla sin política de borrado borra CERO FILAS SIN DAR ERROR, que es
  el fallo que ya nos costó una tarde entera.
*/
select tablename as tabla, count(*) as politicas
from pg_policies
where schemaname = 'public'
  and tablename in ('categorias','documentos','movimientos','recordatorios','compra')
group by tablename
order by tablename;
