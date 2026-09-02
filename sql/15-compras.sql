-- ───────────────────────────────────────────────────────────
--  LAS COMPRAS DE LA CASA, Y LAS DE CADA UNO
--
--  Hasta ahora, un ticket del súper y unas camisas acababan los dos en
--  "Casa → Compras", que es tanto como no clasificarlos. Y en cuanto
--  HUBI empezó a leer bien los tickets, esa carpeta se convirtió en el
--  cajón de sastre donde va a parar todo.
--
--  Se separan en dos sitios, y la línea no es caprichosa:
--
--    LO DE LA CASA es de los dos. La comida, los platos, las sábanas,
--    la fregona. Da igual quién pague: sirve para la casa.
--
--    LO DE CADA UNO es de una persona. La ropa, los zapatos, el bolso.
--    Mezclarlo con lo anterior significa que dentro de un año no se
--    puede saber cuánto se ha ido en vestir a nadie — y separarlo
--    entonces, con cien tickets ya archivados, no se puede hacer.
--
--  POR QUÉ "PERSONAL" ES UNA SECCIÓN Y NO UNA CARPETA DENTRO DE CASA.
--  Va separada por persona, igual que Salud, por dos motivos. Uno,
--  que cada uno encuentre lo suyo sin ir mirando ticket a ticket. Y
--  dos, porque el día que se decida qué significa "privado" —la
--  decisión que sigue abierta— esta sección estará ya partida por
--  quién es cada cosa, que es la parte imposible de hacer después.
--
--  TODAS LLEVAN naturaleza 'gasto'. Un ticket con importe se apunta
--  solo como gasto en cuanto se guarda, aunque todavía no exista una
--  pantalla de cuentas de la Casa. El dato se recoge desde el primer
--  día: cuando haya pantalla, tendrá historia que enseñar en vez de
--  empezar de cero.
--
--  Se puede ejecutar más de una vez sin duplicar nada.
-- ───────────────────────────────────────────────────────────

-- ── 1 · Casa → Compras → lo del día a día ──────────────────
insert into categorias (padre_id, nombre, segmento_drive, icono, orden, naturaleza)
select c.id, v.nombre, v.segmento, v.icono, v.orden, 'gasto'
from categorias c
join categorias r on r.id = c.padre_id
cross join (values
  ('Alimentación',          'ALIMENTACION',   '🛒', 1),
  ('Menaje',                'MENAJE',         '🍽', 2),
  ('Ropa de casa',          'ROPA_CASA',      '🛏', 3),
  ('Muebles y decoración',  'MUEBLES',        '🛋', 4),
  ('Electrodomésticos',     'ELECTRO',        '🔌', 5),
  ('Limpieza y droguería',  'LIMPIEZA',       '🧴', 6),
  ('Otras compras',         'OTRAS',          '📦', 7)
) as v(nombre, segmento, icono, orden)
where r.segmento_drive = 'CASA'
  and r.padre_id is null
  and c.nombre = 'Compras'
  and not exists (
    select 1 from categorias h where h.padre_id = c.id and h.nombre = v.nombre
  );

-- ── 2 · La sección de lo personal ──────────────────────────
insert into categorias (padre_id, nombre, segmento_drive, icono, orden, naturaleza)
select null, 'Personal', 'PERSONAL', '👕', 7, 'neutro'
where not exists (
  select 1 from categorias where segmento_drive = 'PERSONAL' and padre_id is null
);

-- ── 3 · Una carpeta por persona ────────────────────────────
--  Se leen de `perfiles`, no de una lista escrita aquí. Así el día que
--  entre una tercera persona, su carpeta aparece sola con volver a
--  ejecutar esto — sin tocar el código.
insert into categorias (padre_id, nombre, segmento_drive, orden, naturaleza)
select
  r.id,
  p.nombre,
  /* "Juan Miguel" → JUAN_MIGUEL. Con el nombre entero y no solo el
     primero, porque dos personas que compartieran nombre de pila
     crearían la misma carpeta en Drive. */
  upper(translate(replace(p.nombre, ' ', '_'),
                  'ÁÉÍÓÚÑÜáéíóúñü', 'AEIOUNUAEIOUNU')),
  (row_number() over (order by p.creado_en, p.nombre))::int,
  'neutro'
from categorias r
cross join perfiles p
where r.segmento_drive = 'PERSONAL'
  and r.padre_id is null
  and not exists (
    select 1 from categorias h where h.padre_id = r.id and h.nombre = p.nombre
  );

-- ── 4 · Y dentro de cada persona, en qué se le va ──────────
insert into categorias (padre_id, nombre, segmento_drive, icono, orden, naturaleza)
select q.id, v.nombre, v.segmento, v.icono, v.orden, 'gasto'
from categorias q
join categorias r on r.id = q.padre_id
cross join (values
  ('Ropa y calzado', 'ROPA',          '👕', 1),
  ('Complementos',   'COMPLEMENTOS',  '👜', 2),
  ('Peluquería',     'PELUQUERIA',    '✂️', 3),
  ('Regalos',        'REGALOS',       '🎁', 4),
  ('Otros',          'OTROS',         '📦', 5)
) as v(nombre, segmento, icono, orden)
where r.segmento_drive = 'PERSONAL'
  and r.padre_id is null
  and not exists (
    select 1 from categorias h where h.padre_id = q.id and h.nombre = v.nombre
  );
