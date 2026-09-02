-- ───────────────────────────────────────────────────────────
--  BORRAR TAREAS, Y REPETIRLAS ENTRE DOS FECHAS
--
--  Dos arreglos y una ampliación.
--
--  1 · POR QUÉ NO SE PODÍA BORRAR NADA
--
--  Las tablas se crearon con políticas de LEER, CREAR y EDITAR. De
--  BORRAR, ninguna — mirad `documentos` en 01-tablas.sql: están las
--  tres primeras y falta la cuarta. `recordatorios` salió del mismo
--  molde.
--
--  Y aquí está lo malo: en Postgres con seguridad por filas, un
--  borrado sin política NO DA ERROR. Borra cero filas y devuelve que
--  todo ha ido bien. La aplicación se creía que había borrado, cerraba
--  la pantalla, y la tarea seguía ahí.
--
--  Un fallo que se anuncia se arregla en diez minutos. Uno que dice
--  que todo va bien puede durar meses.
--
--  2 · LA TAREA QUE NO SE DEJABA BORRAR AUNQUE HUBIERA PERMISO
--
--  Una tarea que se repite crea la siguiente al marcarla hecha, y la
--  siguiente apunta a la anterior con `nace_de`. Esa referencia no
--  decía qué hacer si se borra la madre, así que Postgres se negaba:
--  no se puede borrar algo a lo que otra fila apunta.
--
--  Resultado: justo las tareas repetidas —las más probables de querer
--  quitar— eran las que no se dejaban. Ahora, al borrar la madre, la
--  hija se queda sin madre pero sigue en pie. Que es lo que se espera:
--  borrar "el agua de enero" no puede borrar la de febrero.
--
--  3 · REPETIR DESDE UNA FECHA HASTA OTRA
--
--  `repite_hasta` ya existía desde el 28/8, pero no había manera de
--  ponerlo: ni pantalla, ni voz. Aquí solo se comprueba que esté y que
--  tenga sentido — que el final no caiga antes del principio.
--
--  El principio es la fecha de la tarea. "Todos los lunes del 1 de
--  septiembre al 30 de octubre" es: fecha = 1 de septiembre,
--  repite = semanal, repite_hasta = 30 de octubre.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

-- ── 1 · Poder borrar ───────────────────────────────────────
drop policy if exists recordatorios_borrar on recordatorios;
create policy recordatorios_borrar on recordatorios
  for delete to authenticated using (true);

/*
  Y lo mismo para los documentos y los movimientos, por el mismo
  motivo. Todavía no hay pantalla para borrarlos, pero el día que la
  haya no queremos volver a pasar una tarde buscando por qué "se
  borra" sin borrarse.
*/
drop policy if exists documentos_borrar on documentos;
create policy documentos_borrar on documentos
  for delete to authenticated using (
    visibilidad = 'compartido' or subido_por = auth.uid()
  );

drop policy if exists movimientos_borrar on movimientos;
create policy movimientos_borrar on movimientos
  for delete to authenticated using (true);

-- ── 2 · Que la hija no impida borrar a la madre ────────────
alter table recordatorios drop constraint if exists recordatorios_nace_de_fkey;
alter table recordatorios
  add constraint recordatorios_nace_de_fkey
  foreign key (nace_de) references recordatorios(id) on delete set null;

-- ── 3 · Principio y fin de una repetición ──────────────────
alter table recordatorios
  add column if not exists repite_hasta date;

/*
  El final no puede ser anterior al principio.

  Sin esto, "repite todos los lunes hasta el mes pasado" se guarda tan
  ricamente y crea una tarea que nunca vuelve — sin decir nada. Que es
  el mismo tipo de silencio que nos ha costado esta tarde.
*/
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recordatorios_repite_hasta_valido'
  ) then
    alter table recordatorios
      add constraint recordatorios_repite_hasta_valido
      check (repite_hasta is null or fecha is null or repite_hasta >= fecha);
  end if;
end $$;
