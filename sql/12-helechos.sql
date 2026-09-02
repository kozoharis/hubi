-- ───────────────────────────────────────────────────────────
--  LOS HELECHOS
--
--  La casa de Los Realejos: tres apartamentos en alquiler vacacional,
--  con sus propios gastos e ingresos. Sección con cuentas propias, al
--  mismo nivel que la Finca — no una carpeta dentro de Casa.
--
--  Por qué separada de la Finca: son dos economías distintas. Mezclar
--  la luz de los apartamentos con el agua de la finca haría que
--  ninguno de los dos balances significara nada.
--
--  DE MOMENTO LA CASA CUENTA COMO UNA SOLA, sin separar por
--  apartamento. Los cobros de las plataformas llegan en un pago que
--  cubre varias reservas de varios apartamentos, y partirlos a mano en
--  cada apunte sería pedir una decisión difícil en el peor momento.
--  Además, la luz, el seguro y la gestoría no son de ningún apartamento
--  en concreto.
--
--  Añadir el desglose por apartamento más adelante es fácil; quitarlo
--  cuando ya haya cien apuntes hechos con él, no.
--
--  Se puede ejecutar más de una vez sin duplicar nada.
-- ───────────────────────────────────────────────────────────

-- ── La raíz ────────────────────────────────────────────────
insert into categorias (padre_id, nombre, segmento_drive, icono, orden, naturaleza)
select null, 'Los Helechos', 'HELECHOS', '🔑', 15, 'neutro'
where not exists (
  select 1 from categorias where segmento_drive = 'HELECHOS' and padre_id is null
);

-- ── Gastos e ingresos ──────────────────────────────────────
insert into categorias (padre_id, nombre, segmento_drive, icono, orden, naturaleza)
select r.id, v.nombre, v.segmento, null, v.orden, 'neutro'
from categorias r
cross join (values
  ('Gastos',   'GASTOS',   1),
  ('Ingresos', 'INGRESOS', 2)
) as v(nombre, segmento, orden)
where r.segmento_drive = 'HELECHOS'
  and r.padre_id is null
  and not exists (
    select 1 from categorias c where c.padre_id = r.id and c.nombre = v.nombre
  );

-- ── En qué se gasta ────────────────────────────────────────
--  Salidas reales de una casa vacacional: la gestoría o la plataforma,
--  las limpiezas entre reservas, el mantenimiento, los suministros que
--  no paga el huésped, los seguros y las tasas del ayuntamiento.
insert into categorias (padre_id, nombre, segmento_drive, icono, orden, naturaleza)
select g.id, v.nombre, v.segmento, null, v.orden, 'gasto'
from categorias g
join categorias r on r.id = g.padre_id
cross join (values
  ('Gestión',          'GESTION',        1),
  ('Limpieza',         'LIMPIEZA',       2),
  ('Mantenimiento',    'MANTENIMIENTO',  3),
  ('Suministros',      'SUMINISTROS',    4),
  ('Ropa y menaje',    'ROPA',           5),
  ('Seguros',          'SEGUROS',        6),
  ('Tasas e impuestos','TASAS',          7),
  ('Obras y mejoras',  'OBRAS',          8),
  ('Otros gastos',     'OTROS',          9)
) as v(nombre, segmento, orden)
where r.segmento_drive = 'HELECHOS'
  and r.padre_id is null
  and g.nombre = 'Gastos'
  and not exists (
    select 1 from categorias c where c.padre_id = g.id and c.nombre = v.nombre
  );

-- ── De dónde entra ─────────────────────────────────────────
--  Separadas por origen porque es la comparación que de verdad se
--  hace: cuánto deja cada plataforma frente a lo que se reserva
--  directamente, que no paga comisión.
insert into categorias (padre_id, nombre, segmento_drive, icono, orden, naturaleza)
select g.id, v.nombre, v.segmento, null, v.orden, 'ingreso'
from categorias g
join categorias r on r.id = g.padre_id
cross join (values
  ('Airbnb',            'AIRBNB',   1),
  ('Booking',           'BOOKING',  2),
  ('Reservas directas', 'DIRECTAS', 3),
  ('Fianzas',           'FIANZAS',  4),
  ('Otros ingresos',    'OTROS',    5)
) as v(nombre, segmento, orden)
where r.segmento_drive = 'HELECHOS'
  and r.padre_id is null
  and g.nombre = 'Ingresos'
  and not exists (
    select 1 from categorias c where c.padre_id = g.id and c.nombre = v.nombre
  );
