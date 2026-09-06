-- ═══════════════════════════════════════════════════════════════
-- 31 · «SOLO PUEDE MIRAR»
-- ═══════════════════════════════════════════════════════════════
--
-- Al invitar a alguien se elige una de dos cosas:
--
--   · Puede apuntar y guardar, como tú.
--   · Solo puede mirar.
--
-- La segunda es la que necesita este archivo, y necesita ESTE archivo
-- concretamente — no basta con esconder botones en las pantallas.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ NO VALE CON ESCONDER BOTONES
--
-- Un botón escondido se salta en treinta segundos con las
-- herramientas que trae cualquier navegador: la aplicación habla con
-- la base de datos por unas direcciones que están a la vista, y quien
-- quiera puede llamarlas a mano.
--
-- Si el permiso viviera solo en la pantalla, le habríamos dicho a
-- alguien «tu gestor solo puede mirar» sabiendo que no es cierto. Eso
-- es peor que no ofrecer el permiso: es una promesa falsa sobre las
-- facturas y los informes médicos de una familia.
--
-- Aquí la regla vive en la base de datos. Un lector que intente
-- escribir por donde sea —la aplicación, una dirección a mano, lo que
-- se le ocurra— no escribe. No es que se le esconda: es que no puede.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ NO CAMBIA
--
-- Leer. Un lector ve exactamente lo mismo que cualquiera de la casa:
-- los papeles, las cuentas, la agenda. Este archivo no toca ni una
-- sola política de lectura. Lo de «ver unas cosas sí y otras no» —el
-- punto 21, con la Salud como caso que manda— es harina de otro
-- costal y está sin hacer.
--
-- Se puede ejecutar dos veces seguidas sin romper nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · El papel nuevo ─────────────────────────────────────
/*
  `miembros.papel` solo aceptaba 'propietario' y 'miembro'. Se añade
  'lector'. Se busca la restricción en vez de suponer su nombre.
*/
do $$
declare
  c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class      rel on rel.oid = con.conrelid
    join pg_namespace  nsp on nsp.oid = rel.relnamespace
    where rel.relname = 'miembros'
      and nsp.nspname = 'public'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%papel%'
  loop
    execute format('alter table miembros drop constraint %I', c);
  end loop;
end $$;

alter table miembros
  add constraint miembros_papel_valido
  check (papel in ('propietario', 'miembro', 'lector'));


-- ── 2 · ¿Puede escribir quien está preguntando? ────────────
/*
  Una sola función, y todas las políticas de escritura la usan. Si
  mañana aparece otro papel, se cambia aquí y en ningún sitio más.

  `security definer` por lo mismo que `mi_hogar()`: tiene que leer
  `miembros` por debajo de las políticas o se muerde la cola.

  Y devuelve TRUE cuando no encuentra fila. Eso es a propósito y hay
  que entenderlo: quien no está en `miembros` no es un lector, es
  alguien de quien no sabemos nada — y el hogar ya le corta por otro
  lado, porque `mi_hogar()` le devuelve nulo y ninguna política de
  hogar le deja pasar. Poner FALSE aquí bloquearía además a Juan
  Miguel y Conchita si su fila de miembro se perdiera un día, y eso
  sería romper lo que ya funciona por proteger algo que ya está
  protegido.
*/
create or replace function puedo_escribir() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select papel <> 'lector' from miembros where perfil_id = auth.uid() order by unido_en limit 1),
    true
  )
$$;

revoke all on function puedo_escribir() from public;
grant execute on function puedo_escribir() to authenticated;


-- ── 3 · Las políticas de escritura, con la condición nueva ─
/*
  Se rehacen las de crear, editar y borrar de todas las tablas donde
  se apunta algo. Las de LEER no se tocan: un lector lee igual.

  Va en bucle y no tabla por tabla a mano, por la misma razón que en
  el archivo 17: la tabla que se añada el mes que viene se quedaría
  fuera sin que nadie lo notara — y una tabla fuera es una tabla donde
  el «solo mirar» no se cumple.
*/
do $$
declare
  t text;
  donde text;
begin
  foreach t in array array[
    'categorias', 'documentos', 'movimientos', 'recordatorios', 'compra', 'unidades'
  ]
  loop
    -- `unidades` no tiene hogar_id propio: cuelga de su sección.
    if t = 'unidades' then
      donde := 'exists (select 1 from categorias c where c.id = unidades.seccion_id'
               || ' and c.hogar_id = mi_hogar())';
    else
      donde := format('%I.hogar_id = mi_hogar()', t);
    end if;

    execute format('drop policy if exists %s_crear on %I', t, t);
    execute format(
      'create policy %s_crear on %I for insert to authenticated with check (%s and puedo_escribir())',
      t, t, donde
    );

    execute format('drop policy if exists %s_editar on %I', t, t);
    execute format(
      'create policy %s_editar on %I for update to authenticated using (%s and puedo_escribir())',
      t, t, donde
    );

    execute format('drop policy if exists %s_borrar on %I', t, t);
    execute format(
      'create policy %s_borrar on %I for delete to authenticated using (%s and puedo_escribir())',
      t, t, donde
    );
  end loop;
end $$;

/*
  DOCUMENTOS, APARTE.

  El bucle de arriba les acaba de poner una condición más simple de la
  que tenían: se les había perdido por el camino la parte de «privado
  o mío», que ya estaba en el archivo 18. Se vuelven a escribir
  enteras, con las dos cosas.

  Crear lleva además `subido_por = auth.uid()`: nadie sube un papel
  firmándolo con el nombre de otro.
*/
drop policy if exists documentos_crear on documentos;
create policy documentos_crear on documentos
  for insert to authenticated with check (
    hogar_id = mi_hogar() and subido_por = auth.uid() and puedo_escribir()
  );

drop policy if exists documentos_editar on documentos;
create policy documentos_editar on documentos
  for update to authenticated using (
    hogar_id = mi_hogar()
    and (visibilidad = 'compartido' or subido_por = auth.uid())
    and puedo_escribir()
  );

drop policy if exists documentos_borrar on documentos;
create policy documentos_borrar on documentos
  for delete to authenticated using (
    hogar_id = mi_hogar()
    and (visibilidad = 'compartido' or subido_por = auth.uid())
    and puedo_escribir()
  );


-- ── 4 · Comprobación ───────────────────────────────────────
/*
  Dos cosas.

  La primera tiene que devolver TRUE: eres quien está ejecutando esto
  desde el editor de SQL, sin sesión, y ahí `auth.uid()` es nulo — así
  que cae en el `coalesce` y contesta que sí. Si contestara FALSE,
  algo está mal escrito.

  La segunda tiene que sacar DIECIOCHO filas: crear, editar y borrar
  de las seis tablas, y las tres de documentos entre ellas. Si sale
  alguna de menos, esa tabla se ha quedado sin la condición y ahí el
  «solo mirar» no se cumple.
*/
select puedo_escribir() as deberia_ser_true;

select
  tablename as tabla,
  policyname as politica,
  cmd as para
from pg_policies
where schemaname = 'public'
  and tablename in ('categorias','documentos','movimientos','recordatorios','compra','unidades')
  and cmd in ('INSERT','UPDATE','DELETE')
  and (qual ilike '%puedo_escribir%' or with_check ilike '%puedo_escribir%')
order by tabla, para;
