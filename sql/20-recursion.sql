-- ───────────────────────────────────────────────────────────
--  LA POLÍTICA QUE SE MORDÍA LA COLA
--
--  Esto es un fallo mío en `17-hogares.sql`, y ha estado rompiendo
--  tres cosas a la vez sin que ninguna dijera por qué.
--
--  ─────────────────────────────────────────────────────────
--  QUÉ ESTABA MAL
--
--  La política para leer `miembros` decía, literalmente:
--
--    "puedes ver esta fila de miembros SI existe una fila en
--     MIEMBROS que diga que eres de esa casa"
--
--  Para saber si puedes leer `miembros`, hay que leer `miembros`.
--  Y para eso, hay que leer `miembros`. Postgres lo detecta y corta
--  con un error: «infinite recursion detected in policy for relation
--  "miembros"».
--
--  Lo mismo en `hogares`. Y `perfiles_leer` (en el 18) mira dentro de
--  `miembros`, así que se contagiaba: LEER UN PERFIL DABA ERROR.
--
--  ─────────────────────────────────────────────────────────
--  POR QUÉ SE VEÍA COMO TRES AVERÍAS DISTINTAS
--
--  1 · «Juan Miguel» salía como «Jmnazco».
--      `leerPerfil` está escrito para no dejar nunca la pantalla sin
--      saludo: si la base de datos no responde, saca el nombre del
--      correo. Hacía justo lo que se le pidió — tapar el fallo. El
--      nombre real estaba guardado y bien; simplemente no se podía
--      leer.
--
--  2 · No se dejaba cambiar el nombre ni poner la foto.
--      Al guardar, la base de datos devuelve la fila cambiada para
--      confirmar — y devolverla es LEERLA. La lectura fallaba, así que
--      el cambio se daba por no hecho aunque se hubiera guardado.
--
--  3 · Lo del calendario.
--      `es_propietario_drive` sale de esa misma lectura. Sin poder
--      leerla, HUBI daba por hecho que Juan Miguel NO es el dueño del
--      Drive —ante la duda, no— y le escondía toda la parte de Google,
--      calendario incluido.
--
--  Y probablemente también el 404 de los papeles: aquellas consultas
--  cruzaban con `perfiles`.
--
--  ─────────────────────────────────────────────────────────
--  LA LECCIÓN
--
--  Una política de seguridad NO PUEDE PREGUNTARLE A SU PROPIA TABLA.
--  Cuando haga falta, se pregunta a través de una función
--  `security definer` —como `mi_hogar()`, que ya existe justo para
--  esto— porque esa sí lee por debajo de las políticas y no se muerde
--  la cola.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────


-- ── 1 · Miembros: sin mirarse a sí misma ───────────────────
/*
  `mi_hogar()` ya es `security definer`: lee `miembros` por debajo de
  las políticas. Se creó exactamente para no morderse la cola, y
  después se escribió la política sin usarla. Ahora sí.
*/
drop policy if exists miembros_leer on miembros;
create policy miembros_leer on miembros
  for select to authenticated using (hogar_id = mi_hogar());


-- ── 2 · Hogares: igual ─────────────────────────────────────
drop policy if exists hogares_leer on hogares;
create policy hogares_leer on hogares
  for select to authenticated using (id = mi_hogar());


-- ── 3 · Perfiles: y SIEMPRE el tuyo ────────────────────────
/*
  Fíjate en el `id = auth.uid()` del principio. No sobra: es una red.

  Aunque mañana los hogares se rompan otra vez, aunque `miembros` se
  quede vacía, aunque alguien escriba mal una política — TU PROPIO
  PERFIL SE PUEDE LEER SIEMPRE. Tu nombre y tu foto no pueden depender
  de que funcione el sistema de familias.

  Que alguien abra la aplicación y no encuentre ni su propio nombre es
  la clase de fallo que hace pensar que se ha perdido todo lo demás.
*/
drop policy if exists perfiles_leer on perfiles;
create policy perfiles_leer on perfiles
  for select to authenticated using (
    id = auth.uid()
    or exists (
      select 1 from miembros m
      where m.perfil_id = perfiles.id and m.hogar_id = mi_hogar()
    )
  );


-- ── 4 · Y poder cambiar el tuyo ────────────────────────────
/*
  La de editar ya existía desde el 01, pero sin `with check`. Sin él,
  Postgres usa el `using` también como comprobación —funciona— pero
  queda al azar de una regla implícita. Escrito, no se discute.
*/
drop policy if exists perfiles_editar_el_suyo on perfiles;
create policy perfiles_editar_el_suyo on perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ── 5 · Comprobación ───────────────────────────────────────
/*
  Estas tres consultas fallaban con "infinite recursion" antes de este
  archivo. Si ahora devuelven filas, está arreglado.

  Ojo: aquí, en el editor de Supabase, se ejecutan como dueño de la
  base de datos y las políticas ni se aplican. Así que esto comprueba
  que no hay error de sintaxis, no que el permiso sea el correcto. Lo
  de verdad se comprueba en /comprobacion, con la sesión de Juan
  Miguel puesta.
*/
select 'miembros' as tabla, count(*) from miembros
union all
select 'hogares', count(*) from hogares
union all
select 'perfiles', count(*) from perfiles;

-- Y que cada tabla del hogar tenga sus políticas.
select tablename as tabla, count(*) as politicas
from pg_policies
where schemaname = 'public'
  and tablename in ('perfiles', 'miembros', 'hogares')
group by tablename
order by tablename;
