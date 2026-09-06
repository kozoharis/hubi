-- ═══════════════════════════════════════════════════════════════
-- 36 · LAS CUENTAS DE CASA
-- ═══════════════════════════════════════════════════════════════
--
-- Hoy solo tienen cuentas las ACTIVIDADES: la Finca, Los Helechos, las
-- obras. Lo que se gasta en la casa —la compra, una reparación, el
-- taller, el seguro— se guarda como papel y ahí muere. No hay ninguna
-- pantalla que diga cuánto se va al trimestre en todo eso.
--
-- Y hay un motivo de fondo, que es lo que arregla este archivo:
--
--   Las carpetas base de una casa nueva nacen con `naturaleza` a
--   'neutro'. O sea: aunque HUBI lea «127,43 €» en la factura de la
--   luz, NO apunta ningún gasto. El importe se queda en el papel.
--
-- En la casa de Juan Miguel no se nota porque el SQL 15 puso a mano
-- las subcarpetas de Compras como gasto. Cualquier casa creada con
-- `crear_mi_casa` no tiene eso: lleva semanas guardando facturas y su
-- balance de casa saldría a cero.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ CUENTA COMO DINERO, Y QUÉ NO
--
-- Una garantía no es un gasto: es un papel que guardas por si acaso.
-- Un informe médico tampoco. Se marcan como gasto solo las carpetas
-- donde de verdad sale dinero:
--
--   Casa        Facturas · Reparaciones · Compras · Restaurantes
--   Vehículos   Seguro · ITV · Taller · Impuestos
--   Seguros     todas
--   Salud       Medicación
--
-- El resto se queda neutro. Un papel guardado ahí no mueve las
-- cuentas, que es lo correcto: si las garantías contaran, el balance
-- del trimestre en que compras una lavadora saldría el doble de malo
-- de lo que fue.
--
-- ─────────────────────────────────────────────────────────────
-- Y DOS COSAS MÁS QUE VAN AQUÍ PORQUE VAN EN LA MISMA FUNCIÓN
--
-- · **Restaurantes y cafeterías**, carpeta propia dentro de Casa.
--   Comer fuera no es una compra de casa. Metido dentro de Compras
--   saldría mezclado con el súper en el desglose, y justo lo que se
--   quiere saber es cuánto se va en cada cosa.
--
-- · **Se puede crear una segunda casa.** `crear_mi_casa` tenía dentro
--   «si ya tienes casa, te devuelvo la tuya y no toco nada». Eso era
--   verdad cuando cada persona pertenecía a una sola; desde el SQL 34
--   ya no, y esa línea dejaba a medias la decisión que se tomó: quien
--   tiene su HUBI puede además llevar el de sus padres, y también al
--   revés. Ahora solo protege del doble toque: dos casas con el MISMO
--   nombre, de la misma persona, no se crean.
--
-- Se puede ejecutar más de una vez sin duplicar nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · La función, entera ─────────────────────────────────
create or replace function crear_mi_casa(
  nombre_casa text,
  actividad   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yo        uuid := auth.uid();
  casa      uuid;
  raiz      uuid;
  grupo_g   uuid;
  grupo_i   uuid;
  nombre_ok text;
begin
  if yo is null then
    raise exception 'Hay que entrar primero.';
  end if;

  nombre_ok := nullif(btrim(coalesce(nombre_casa, '')), '');
  if nombre_ok is null then
    raise exception 'La casa necesita un nombre.';
  end if;
  nombre_ok := left(nombre_ok, 60);

  /*
    ── EL DOBLE TOQUE, Y SOLO EL DOBLE TOQUE ──

    Antes aquí ponía «si ya tienes casa, te devuelvo la tuya». Protegía
    del botón pulsado dos veces, sí, pero de paso impedía tener una
    segunda casa — que es justo lo que el SQL 34 abrió.

    Ahora se mira el nombre: si esta persona ya tiene una casa que se
    llama igual, es el mismo toque repetido y se le devuelve aquélla.
    Dos casas distintas se llaman distinto.
  */
  select h.id into casa
  from hogares h
  join miembros m on m.hogar_id = h.id
  where m.perfil_id = yo
    and lower(btrim(h.nombre)) = lower(nombre_ok)
  limit 1;

  if casa is not null then
    return casa;
  end if;

  -- ── El hogar ─────────────────────────────────────────────
  insert into hogares (nombre) values (nombre_ok) returning id into casa;

  -- ── La persona, como propietaria ─────────────────────────
  /*
    'propietario' no es un adorno: es lo que decide quién puede
    conectar el Google Drive de esta casa.

    `aceptado_en` puesto: quien crea la casa está dentro desde el
    primer segundo. Sin esta línea —columna del SQL 34— se quedaría
    fuera de su propia casa, invitado a sí mismo.
  */
  insert into miembros (hogar_id, perfil_id, papel, aceptado_en)
  values (casa, yo, 'propietario', now());

  -- ── Las carpetas que tiene todo el mundo ─────────────────
  insert into categorias (hogar_id, nombre, segmento_drive, icono, orden)
  values
    (casa, 'Casa',                  'CASA',       '🏠', 1),
    (casa, 'Salud',                 'SALUD',      '❤️', 2),
    (casa, 'Vehículos',             'VEHICULOS',  '🚗', 3),
    (casa, 'Seguros',               'SEGUROS',    '🛡', 4),
    (casa, 'Documentos importantes','DOCUMENTOS', '📄', 5);

  /*
    Lo de dentro, YA CON SU NATURALEZA.

    Ésta es la línea que faltaba. Una casa nueva nacía con todo a
    'neutro' y por tanto sin cuentas posibles: guardabas la factura de
    la luz, HUBI leía el importe, y no lo apuntaba en ninguna parte.
  */
  insert into categorias (hogar_id, padre_id, nombre, segmento_drive, orden, naturaleza)
  select casa, c.id, v.nombre, v.segmento, v.orden, v.natura
  from categorias c
  join (values
    ('CASA',       'Facturas',                 'FACTURAS',        1, 'gasto'),
    ('CASA',       'Reparaciones',             'REPARACIONES',    2, 'gasto'),
    ('CASA',       'Compras',                  'COMPRAS',         3, 'gasto'),
    ('CASA',       'Restaurantes y cafeterías','RESTAURANTES',    4, 'gasto'),
    ('CASA',       'Garantías',                'GARANTIAS',       5, 'neutro'),
    ('CASA',       'Documentación',            'DOCUMENTACION',   6, 'neutro'),
    ('SALUD',      'Informes',                 'INFORMES',        1, 'neutro'),
    ('SALUD',      'Recetas',                  'RECETAS',         2, 'neutro'),
    ('SALUD',      'Pruebas',                  'PRUEBAS',         3, 'neutro'),
    ('SALUD',      'Citas',                    'CITAS',           4, 'neutro'),
    ('SALUD',      'Medicación',               'MEDICACION',      5, 'gasto'),
    ('VEHICULOS',  'Seguro',                   'SEGURO',          1, 'gasto'),
    ('VEHICULOS',  'ITV',                      'ITV',             2, 'gasto'),
    ('VEHICULOS',  'Taller',                   'TALLER',          3, 'gasto'),
    ('VEHICULOS',  'Impuestos',                'IMPUESTOS',       4, 'gasto'),
    ('VEHICULOS',  'Documentación',            'DOCUMENTACION',   5, 'neutro'),
    ('SEGUROS',    'Casa',                     'CASA',            1, 'gasto'),
    ('SEGUROS',    'Coche',                    'COCHE',           2, 'gasto'),
    ('SEGUROS',    'Salud',                    'SALUD',           3, 'gasto'),
    ('SEGUROS',    'Personales',               'PERSONALES',      4, 'gasto'),
    ('DOCUMENTOS', 'Contratos',                'CONTRATOS',       1, 'neutro'),
    ('DOCUMENTOS', 'Bancos',                   'BANCOS',          2, 'neutro'),
    ('DOCUMENTOS', 'Administraciones',         'ADMINISTRACIONES',3, 'neutro'),
    ('DOCUMENTOS', 'Otros',                    'OTROS',           4, 'neutro')
  ) as v(raiz, nombre, segmento, orden, natura) on v.raiz = c.segmento_drive
  where c.hogar_id = casa and c.padre_id is null;

  -- ── Y su actividad, si lleva cuentas de algo ─────────────
  if actividad = 'finca' then
    insert into categorias (hogar_id, nombre, segmento_drive, icono, orden, lleva_cuentas, color, fondo)
    values (casa, 'Finca', 'FINCA', '🌿', 0, true, '#14B8A6', '#DFF7F3')
    returning id into raiz;

  elsif actividad = 'obra' then
    insert into categorias (
      hogar_id, nombre, segmento_drive, icono, orden,
      lleva_cuentas, color, fondo, usa_unidades, palabra_unidad
    )
    values (casa, 'Obras', 'OBRAS', '👷', 0, true, '#F59E0B', '#FEF1DC', true, 'la obra')
    returning id into raiz;

  elsif actividad = 'alquileres' then
    insert into categorias (
      hogar_id, nombre, segmento_drive, icono, orden,
      lleva_cuentas, color, fondo, usa_unidades, palabra_unidad, reparte_comunes
    )
    values (casa, 'Alquileres', 'ALQUILERES', '🔑', 0, true, '#8B5CF6', '#EEE8FE', true, 'el piso', true)
    returning id into raiz;
  end if;

  if raiz is not null then
    insert into categorias (hogar_id, padre_id, nombre, segmento_drive, icono, orden, naturaleza)
    values (casa, raiz, 'Gastos', 'GASTOS', '💸', 1, 'gasto')
    returning id into grupo_g;

    insert into categorias (hogar_id, padre_id, nombre, segmento_drive, icono, orden, naturaleza)
    values (casa, raiz, 'Ingresos', 'INGRESOS', '💰', 2, 'ingreso')
    returning id into grupo_i;

    if actividad = 'finca' then
      insert into categorias (hogar_id, padre_id, nombre, segmento_drive, orden, naturaleza)
      values
        (casa, grupo_g, 'Agua',            'AGUA',          1, 'gasto'),
        (casa, grupo_g, 'Luz',             'LUZ',           2, 'gasto'),
        (casa, grupo_g, 'Productos',       'PRODUCTOS',     3, 'gasto'),
        (casa, grupo_g, 'Obras y mejoras', 'OBRAS',         4, 'gasto'),
        (casa, grupo_g, 'Maquinaria',      'MAQUINARIA',    5, 'gasto'),
        (casa, grupo_g, 'Mantenimiento',   'MANTENIMIENTO', 6, 'gasto'),
        (casa, grupo_g, 'Otros',           'OTROS',         7, 'gasto'),
        (casa, grupo_i, 'Ventas',          'VENTAS',        1, 'ingreso'),
        (casa, grupo_i, 'Otros ingresos',  'OTROS',         2, 'ingreso');

    elsif actividad = 'obra' then
      insert into categorias (hogar_id, padre_id, nombre, segmento_drive, orden, naturaleza)
      values
        (casa, grupo_g, 'Albañilería',     'ALBANILERIA',    1, 'gasto'),
        (casa, grupo_g, 'Estructura',      'ESTRUCTURA',     2, 'gasto'),
        (casa, grupo_g, 'Instalaciones',   'INSTALACIONES',  3, 'gasto'),
        (casa, grupo_g, 'Carpintería',     'CARPINTERIA',    4, 'gasto'),
        (casa, grupo_g, 'Materiales',      'MATERIALES',     5, 'gasto'),
        (casa, grupo_g, 'Mano de obra',    'MANODEOBRA',     6, 'gasto'),
        (casa, grupo_g, 'Otros',           'OTROS',          7, 'gasto'),
        (casa, grupo_i, 'Certificaciones', 'CERTIFICACIONES',1, 'ingreso'),
        (casa, grupo_i, 'Otros ingresos',  'OTROS',          2, 'ingreso');

    elsif actividad = 'alquileres' then
      insert into categorias (hogar_id, padre_id, nombre, segmento_drive, orden, naturaleza)
      values
        (casa, grupo_g, 'Luz',            'LUZ',          1, 'gasto'),
        (casa, grupo_g, 'Agua',           'AGUA',         2, 'gasto'),
        (casa, grupo_g, 'Comunidad',      'COMUNIDAD',    3, 'gasto'),
        (casa, grupo_g, 'Limpieza',       'LIMPIEZA',     4, 'gasto'),
        (casa, grupo_g, 'Reparaciones',   'REPARACIONES', 5, 'gasto'),
        (casa, grupo_g, 'Otros',          'OTROS',        6, 'gasto'),
        (casa, grupo_i, 'Alquiler',       'ALQUILER',     1, 'ingreso'),
        (casa, grupo_i, 'Otros ingresos', 'OTROS',        2, 'ingreso');
    end if;
  end if;

  return casa;
end;
$$;

revoke all on function crear_mi_casa(text, text) from public;
grant execute on function crear_mi_casa(text, text) to authenticated;


-- ── 2 · Restaurantes, en las casas que ya existen ──────────
insert into categorias (hogar_id, padre_id, nombre, segmento_drive, icono, orden, naturaleza)
select c.hogar_id, c.id, 'Restaurantes y cafeterías', 'RESTAURANTES', '🍽', 8, 'gasto'
from categorias c
where c.segmento_drive = 'CASA'
  and c.padre_id is null
  and not exists (
    select 1 from categorias h
    where h.padre_id = c.id and h.segmento_drive = 'RESTAURANTES'
  );


-- ── 3 · Y las carpetas donde de verdad sale dinero ─────────
/*
  Solo se toca lo que sigue en 'neutro'. Si alguien ha decidido a mano
  que su carpeta de Garantías es un gasto, es su casa y se respeta:
  esto viene a rellenar un hueco, no a corregir a nadie.
*/
update categorias h
   set naturaleza = 'gasto'
  from categorias r
 where h.padre_id = r.id
   and r.padre_id is null
   and h.naturaleza = 'neutro'
   and (
        (r.segmento_drive = 'CASA'
         and h.segmento_drive in ('FACTURAS','REPARACIONES','COMPRAS','RESTAURANTES'))
     or (r.segmento_drive = 'VEHICULOS'
         and h.segmento_drive in ('SEGURO','ITV','TALLER','IMPUESTOS'))
     or (r.segmento_drive = 'SEGUROS')
     or (r.segmento_drive = 'SALUD' and h.segmento_drive = 'MEDICACION')
   );

/*
  Y las nietas de Casa → Compras (Alimentación, Menaje, Limpieza…),
  que en la casa de Juan Miguel ya estaban puestas por el SQL 15 pero
  en cualquier otra no existen o están en neutro.
*/
update categorias n
   set naturaleza = 'gasto'
  from categorias h
  join categorias r on r.id = h.padre_id
 where n.padre_id = h.id
   and r.padre_id is null
   and n.naturaleza = 'neutro'
   and r.segmento_drive = 'CASA'
   and h.segmento_drive = 'COMPRAS';


-- ── 4 · Comprobación ───────────────────────────────────────
/*
  DOS resultados.

  1 · Una fila por casa: cuántas de sus carpetas cuentan como dinero
      FUERA de las actividades, y si tiene ya la de Restaurantes.
      Ninguna debería salir con `cuentan = 0` — eso sería una casa que
      guarda facturas y no suma nada.

  2 · Cuánto hay ya apuntado fuera de las actividades. Si sale 0 no es
      un fallo: es que hasta hoy no se apuntaba. A partir de ahora sí.
*/
/*
  Cada carpeta con su raíz. Se calcula una vez y sirve para las dos
  comprobaciones — y es exactamente lo que hace la pantalla nueva:
  «de qué raíz cuelga esto, y esa raíz ¿lleva cuentas propias?».
*/
with recursive arbol as (
  select id, hogar_id, id as raiz_id, naturaleza, segmento_drive
  from categorias where padre_id is null
  union all
  select c.id, c.hogar_id, a.raiz_id, c.naturaleza, c.segmento_drive
  from categorias c join arbol a on c.padre_id = a.id
),
deCasa as (
  select a.*
  from arbol a
  join categorias r on r.id = a.raiz_id
  where r.lleva_cuentas is not true      -- fuera las actividades
)
select
  h.nombre                                                   as casa,
  count(*) filter (where d.naturaleza <> 'neutro')           as cuentan,
  count(*) filter (where d.segmento_drive = 'RESTAURANTES')  as restaurantes
from hogares h
join deCasa d on d.hogar_id = h.id
group by h.nombre
order by h.nombre;

with recursive arbol as (
  select id, id as raiz_id from categorias where padre_id is null
  union all
  select c.id, a.raiz_id from categorias c join arbol a on c.padre_id = a.id
)
select
  count(*)                                                    as movimientos_de_casa,
  coalesce(sum(m.importe) filter (where m.tipo = 'gasto'), 0) as gastado
from movimientos m
join arbol a on a.id = m.categoria_id
join categorias r on r.id = a.raiz_id
where r.lleva_cuentas is not true;
