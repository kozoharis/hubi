-- ───────────────────────────────────────────────────────────
--  TAREAS QUE SE REPITEN
--
--  Hay cosas que no pasan una vez: pagar el agua todos los meses,
--  regar los jueves, la revisión del coche cada año. Hasta ahora había
--  que volver a apuntarlas a mano cada vez, y eso significa que un día
--  se olvida.
--
--  Cómo funciona, y por qué así:
--
--  `repite` guarda cada cuánto vuelve. `repite_hasta` guarda hasta
--  cuándo, o nada si es para siempre.
--
--  Al marcar una como HECHA, HUBI crea la siguiente en ese momento
--  y la enlaza con `nace_de`. No se generan las doce del año por
--  adelantado.
--
--  Es a propósito. Con las doce por delante, el calendario se llena de
--  cosas que aún no han pasado y "hecho" deja de significar nada. Así,
--  cada tarea que se ve es real, tiene su día, y su "hecho" es de
--  verdad — además de quedar constancia de las que ya se hicieron.
--  Nunca hay dos iguales a la vez.
-- ───────────────────────────────────────────────────────────

alter table recordatorios
  add column if not exists repite text
    check (repite is null or repite in ('diaria', 'semanal', 'mensual', 'anual'));

alter table recordatorios
  add column if not exists repite_hasta date;

-- De qué tarea nace ésta. Sirve para poder seguir el hilo hacia atrás
-- —"esto viene del agua de enero"— sin tener que adivinarlo.
alter table recordatorios
  add column if not exists nace_de uuid references recordatorios(id);

create index if not exists idx_recordatorios_repite
  on recordatorios(repite) where repite is not null;
