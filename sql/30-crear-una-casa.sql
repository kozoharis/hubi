-- ═══════════════════════════════════════════════════════════════
-- 30 · CREAR UNA CASA ENTERA, DE UNA VEZ  (bomba nº 3)
-- ═══════════════════════════════════════════════════════════════
--
-- QUÉ FALTA HOY
--
-- Nadie puede darse de alta. Y aunque pudiera, entraría SIN HOGAR: no
-- vería ni una actividad, ni un papel, ni una tarea. Parecería que
-- HUBI está roto, y en realidad sería la seguridad haciendo su
-- trabajo — todas las políticas dicen `hogar_id = mi_hogar()`, y si no
-- hay hogar no hay nada.
--
-- Crear una casa son cuatro cosas que van juntas:
--
--   1 · el hogar,
--   2 · la persona dentro de él, como propietaria,
--   3 · sus carpetas base,
--   4 · su actividad, si lleva cuentas de algo.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ ESTO ES UNA FUNCIÓN Y NO CUATRO CONSULTAS DESDE LA APP
--
-- Porque desde la aplicación serían cuatro viajes, y entre uno y otro
-- puede pasar cualquier cosa: se corta la cobertura, se cierra la
-- pestaña, Vercel congela la función. Y el resultado de quedarse a
-- medias es el peor posible: una persona con hogar pero sin carpetas,
-- o un hogar sin nadie dentro. Nadie se daría cuenta hasta que fuera
-- a guardar su primera factura.
--
-- Aquí es UNA transacción: o está todo o no está nada.
--
-- Y además:
--
-- · `security definer` — puede escribir en `hogares` y `miembros` por
--   debajo de las políticas. Tiene que poder: en el momento de
--   llamarla, quien la llama todavía no pertenece a ningún hogar, así
--   que las políticas le impedirían crear el suyo. Es el huevo y la
--   gallina, y ésta es la forma correcta de romperlo.
--
-- · Se puede llamar dos veces sin crear dos casas. Si ya tiene una,
--   devuelve la que tiene y no toca nada. Un doble toque en el botón
--   no puede dejar a nadie con dos hogares.
-- ═══════════════════════════════════════════════════════════════


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

  -- ── Ya tiene casa: se devuelve la suya y no se toca nada ──
  select m.hogar_id into casa from miembros m where m.perfil_id = yo limit 1;
  if casa is not null then
    return casa;
  end if;

  nombre_ok := nullif(btrim(coalesce(nombre_casa, '')), '');
  if nombre_ok is null then
    raise exception 'La casa necesita un nombre.';
  end if;
  nombre_ok := left(nombre_ok, 60);

  -- ── 1 · El hogar ─────────────────────────────────────────
  insert into hogares (nombre) values (nombre_ok) returning id into casa;

  -- ── 2 · La persona, como propietaria ─────────────────────
  /*
    'propietario' no es un adorno: es lo que decide quién puede
    conectar el Google Drive de esta casa. Quien la crea es quien
    conecta su cuenta.
  */
  insert into miembros (hogar_id, perfil_id, papel)
  values (casa, yo, 'propietario');

  -- ── 3 · Las carpetas que tiene todo el mundo ─────────────
  /*
    Cinco, y ni una más. El punto 5 pide pocas decisiones por
    pantalla, y quien abre HUBI por primera vez con veinte carpetas
    delante cierra la pestaña. Las que le falten se las crea él, que
    para eso existe la pantalla de partidas.
  */
  insert into categorias (hogar_id, nombre, segmento_drive, icono, orden)
  values
    (casa, 'Casa',                  'CASA',       '🏠', 1),
    (casa, 'Salud',                 'SALUD',      '❤️', 2),
    (casa, 'Vehículos',             'VEHICULOS',  '🚗', 3),
    (casa, 'Seguros',               'SEGUROS',    '🛡', 4),
    (casa, 'Documentos importantes','DOCUMENTOS', '📄', 5);

  -- Lo de dentro de cada una.
  insert into categorias (hogar_id, padre_id, nombre, segmento_drive, orden)
  select casa, c.id, v.nombre, v.segmento, v.orden
  from categorias c
  join (values
    ('CASA',       'Facturas',        'FACTURAS',        1),
    ('CASA',       'Reparaciones',    'REPARACIONES',    2),
    ('CASA',       'Garantías',       'GARANTIAS',       3),
    ('CASA',       'Compras',         'COMPRAS',         4),
    ('CASA',       'Documentación',   'DOCUMENTACION',   5),
    ('SALUD',      'Informes',        'INFORMES',        1),
    ('SALUD',      'Recetas',         'RECETAS',         2),
    ('SALUD',      'Pruebas',         'PRUEBAS',         3),
    ('SALUD',      'Citas',           'CITAS',           4),
    ('SALUD',      'Medicación',      'MEDICACION',      5),
    ('VEHICULOS',  'Seguro',          'SEGURO',          1),
    ('VEHICULOS',  'ITV',             'ITV',             2),
    ('VEHICULOS',  'Taller',          'TALLER',          3),
    ('VEHICULOS',  'Impuestos',       'IMPUESTOS',       4),
    ('VEHICULOS',  'Documentación',   'DOCUMENTACION',   5),
    ('SEGUROS',    'Casa',            'CASA',            1),
    ('SEGUROS',    'Coche',           'COCHE',           2),
    ('SEGUROS',    'Salud',           'SALUD',           3),
    ('SEGUROS',    'Personales',      'PERSONALES',      4),
    ('DOCUMENTOS', 'Contratos',       'CONTRATOS',       1),
    ('DOCUMENTOS', 'Bancos',          'BANCOS',          2),
    ('DOCUMENTOS', 'Administraciones','ADMINISTRACIONES',3),
    ('DOCUMENTOS', 'Otros',           'OTROS',           4)
  ) as v(raiz, nombre, segmento, orden) on v.raiz = c.segmento_drive
  where c.hogar_id = casa and c.padre_id is null;

  -- ── 4 · Y su actividad, si lleva cuentas de algo ─────────
  /*
    Esto es lo que hace que HUBI no sea «una aplicación para la finca
    de Juan Miguel». Uno tiene una finca, otro lleva obras, otro
    alquila pisos. Se le pregunta UNA vez, al principio, y a partir de
    ahí la aplicación habla su idioma: «la obra», «el piso», «la
    parcela».

    Quien no lleve cuentas de nada no ve nada de esto.
  */
  if actividad = 'finca' then
    insert into categorias (hogar_id, nombre, segmento_drive, icono, orden, lleva_cuentas, color, fondo)
    values (casa, 'Finca', 'FINCA', '🌿', 0, true, '#14B8A6', '#DFF7F3')
    returning id into raiz;

  elsif actividad = 'obra' then
    insert into categorias (
      hogar_id, nombre, segmento_drive, icono, orden,
      lleva_cuentas, color, fondo, usa_unidades, palabra_unidad
    )
    values (casa, 'Obras', 'OBRAS', '🧱', 0, true, '#F59E0B', '#FEF1DC', true, 'la obra')
    returning id into raiz;

  elsif actividad = 'alquileres' then
    /*
      `reparte_comunes` a true aquí y solo aquí: la luz o la comunidad
      de un edificio de pisos parecidos se reparte a partes iguales y
      es lo honesto. Entre una reforma de 40.000 € y un baño de 3.000
      sería mentir, y por eso las obras nacen con esto apagado.
    */
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

/*
  Quien puede llamarla: cualquiera que haya entrado. Y NADIE MÁS —
  `anon` no, expresamente: una función `security definer` abierta al
  público sería una puerta para crear hogares sin cuenta.
*/
revoke all on function crear_mi_casa(text, text) from public;
grant execute on function crear_mi_casa(text, text) to authenticated;


-- ── Comprobación ───────────────────────────────────────────
/*
  Tiene que salir UNA fila:

      funcion         seguridad   quien_puede
      ─────────────   ─────────   ─────────────
      crear_mi_casa   definer     authenticated

  Esto NO crea ninguna casa: solo mira que la función esté puesta. La
  primera casa nueva la creará quien se dé de alta desde HUBI.
*/
select
  p.proname                                            as funcion,
  case when p.prosecdef then 'definer' else 'invoker' end as seguridad,
  (
    select string_agg(r.rolname, ', ')
    from pg_roles r
    where has_function_privilege(r.rolname, p.oid, 'execute')
      and r.rolname in ('anon', 'authenticated')
  )                                                    as quien_puede
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'crear_mi_casa';
