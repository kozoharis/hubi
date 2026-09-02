-- ───────────────────────────────────────────────────────────
--  LOS HELECHOS · LOS TRES APARTAMENTOS Y LAS RESERVAS
--
--  Hasta ahora la casa contaba como una sola. Se empezó así a
--  propósito, y ahora se abre: hace falta saber qué apartamento se
--  reserva más y cuál renta más de verdad.
--
--  CINCO COLUMNAS, NINGUNA TABLA NUEVA.
--
--  Una reserva es un ingreso con cuatro datos más. Sacarla a su propia
--  tabla obligaría a sumar dos sitios para saber lo que entra, y a
--  acordarse siempre de los dos. Con dos usuarios y una casa, eso no
--  es arquitectura: es una trampa esperando.
--
--    apartamento  1, 2 o 3.  VACÍO = toda la casa.
--                 Vacío no es un olvido: la luz, el seguro y la
--                 gestoría no son de ningún apartamento. Se reparten
--                 luego a partes iguales al calcular la rentabilidad.
--
--    personas     cuántos vinieron.
--    noches       cuántas noches se quedaron.
--    huesped      a nombre de quién.
--    referencia   el número de la reserva en la plataforma.
--
--  La plataforma NO lleva columna: ya es la categoría del ingreso
--  (Airbnb, Booking, Reservas directas). Guardarla dos veces sería
--  garantizar que algún día las dos digan cosas distintas.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

alter table movimientos
  add column if not exists apartamento smallint,
  add column if not exists personas    smallint,
  add column if not exists noches      smallint,
  add column if not exists huesped     text,
  add column if not exists referencia  text;

-- ── Que los números tengan sentido ─────────────────────────
--  Un apartamento 7 en una casa de tres, o −2 personas, no es un dato
--  raro: es un fallo. Que lo pare la base de datos y no un `if` que
--  algún día alguien olvide poner.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'movimientos_apartamento_valido'
  ) then
    alter table movimientos
      add constraint movimientos_apartamento_valido
      check (apartamento is null or apartamento between 1 and 3);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'movimientos_estancia_valida'
  ) then
    alter table movimientos
      add constraint movimientos_estancia_valida
      check (
        (personas is null or personas between 1 and 20)
        and (noches is null or noches between 1 and 365)
      );
  end if;
end $$;

-- ── La misma reserva, una sola vez ─────────────────────────
--  Fotografiar dos veces la misma pantalla de Airbnb es lo más fácil
--  del mundo, y duplicaría el ingreso sin que nadie lo notara hasta
--  cuadrar las cuentas. El número de reserva lo impide aquí, en la
--  base de datos, que es donde una garantía se cumple siempre.
create unique index if not exists movimientos_referencia_unica
  on movimientos (referencia)
  where referencia is not null;

-- ── Buscar por apartamento sin recorrerlo todo ─────────────
create index if not exists movimientos_apartamento_fecha
  on movimientos (apartamento, fecha)
  where apartamento is not null;
