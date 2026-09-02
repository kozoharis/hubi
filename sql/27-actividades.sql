-- ───────────────────────────────────────────────────────────
--  LAS ACTIVIDADES DEJAN DE ESTAR ESCRITAS EN EL CÓDIGO
--
--  Hoy «La Finca» y «Los Helechos» son dos archivos:
--
--      app/finca/page.tsx      verde, icono hoja, /finca
--      app/helechos/page.tsx   ámbar, llave, /helechos
--
--  Hacen exactamente lo mismo con otro nombre y otro color. Y eso
--  significa que HUBI necesita un programador cada vez que alguien
--  tiene una actividad que no habíamos previsto: una familia podría
--  crear «Obras» con sus categorías, sus unidades y sus carpetas en
--  Drive… y no tendría ninguna pantalla donde verlas.
--
--  A partir de aquí, la actividad es un dato como todo lo demás: su
--  nombre, su icono y su color viven en la base de datos, y hay UNA
--  sola pantalla de cuentas que sirve para todas.
--
--  ═════════════════════════════════════════════════════════
--  QUÉ HACE QUE UNA SECCIÓN SEA UNA «ACTIVIDAD»
--
--  Que tenga cuentas. Seguros, Salud o Vehículos son sitios donde se
--  guardan papeles; la Finca y Los Helechos, además, tienen ingresos,
--  gastos y balance. Ésa es la diferencia, y es la que decide si
--  aparece o no en la barra de abajo.
--
--  ═════════════════════════════════════════════════════════
--  ESTE ARCHIVO NO CAMBIA NADA DE LO QUE SE VE
--
--  Solo añade tres columnas y rellena las de la Finca y Los Helechos
--  con exactamente los mismos colores que ya tienen escritos en el
--  código. Cuando la pantalla nueva los lea de aquí, se verá igual.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

alter table categorias
  add column if not exists lleva_cuentas boolean not null default false,
  add column if not exists color text,
  add column if not exists fondo text;

comment on column categorias.lleva_cuentas is
  'La sección tiene ingresos, gastos y balance propios: es una ACTIVIDAD y sale en la barra de abajo. Seguros o Salud solo guardan papeles.';


-- ── La Finca y Los Helechos, con sus colores de siempre ───────
/*
  Los valores son los que ya están escritos en app/finca/page.tsx y
  app/helechos/page.tsx. No se «mejora» ninguno: el objetivo de este
  paso es que al leerlos de la base de datos se vea EXACTAMENTE igual
  que ahora. Cambiar un color aquí mezclaría dos cosas distintas y, si
  algo se viera raro, no sabríamos si es el color o la pantalla nueva.
*/
update categorias
   set lleva_cuentas = true,
       icono = coalesce(icono, '🌿'),
       color = coalesce(color, '#14B8A6'),
       fondo = coalesce(fondo, '#DFF7F3')
 where segmento_drive = 'FINCA' and padre_id is null;

update categorias
   set lleva_cuentas = true,
       icono = coalesce(icono, '🔑'),
       color = coalesce(color, '#F59E0B'),
       fondo = coalesce(fondo, '#FEF1DC')
 where segmento_drive = 'HELECHOS' and padre_id is null;


-- ── Comprobación ──────────────────────────────────────────────
/*
  Tienen que salir DOS actividades: La Finca y Los Helechos, las dos
  con color. Una actividad sin color se pintaría en gris y parecería
  apagada al lado de las demás.

  Y fíjate en «se_divide»: la Finca es una sola —no tiene unidades— y
  Los Helechos son tres. Que la Finca salga en `false` no es un fallo
  que haya que arreglar: la finca es una.
*/
select
  c.nombre                          as actividad,
  c.lleva_cuentas                   as tiene_cuentas,
  coalesce(c.color, '⚠ SIN COLOR')  as color,
  c.usa_unidades                    as se_divide,
  coalesce(c.palabra_unidad, '—')   as palabra,
  count(u.id)                       as cuantas
from categorias c
left join unidades u on u.seccion_id = c.id and u.activa
where c.padre_id is null and c.activa
group by c.id, c.nombre, c.lleva_cuentas, c.color, c.usa_unidades, c.palabra_unidad, c.orden
order by c.orden;
