-- ───────────────────────────────────────────────────────────
--  LAS UNIDADES, EN DRIVE Y CON SU NOMBRE DE VERDAD
--
--  Dos cosas que faltaban para que crear una unidad sirva de algo.
--
--  ═════════════════════════════════════════════════════════
--  1 · LA PALABRA. «UNIDAD» NO SALE NUNCA A LA PANTALLA.
--
--  «Unidad» es una palabra nuestra, de la fontanería. Juan Miguel no
--  tiene apartamentos que sean «unidades»: tiene APARTAMENTOS. Y un
--  reformista no tiene unidades: tiene OBRAS.
--
--  Así que cada sección guarda cómo se llama cada una de las suyas, y
--  HUBI construye las frases con esa palabra:
--
--      «+ Nueva obra»      «Cada obra»      «¿De qué obra es?»
--      «+ Nuevo apartamento»               «¿De qué apartamento es?»
--
--  Se guarda en singular y con su artículo, porque en castellano no
--  se puede adivinar el género: «el apartamento» pero «la obra». Con
--  la palabra sola saldría «Nueva apartamento», y una aplicación que
--  escribe mal no la respeta nadie.
--
--  ═════════════════════════════════════════════════════════
--  2 · SU CARPETA EN DRIVE.
--
--  Hasta ahora la unidad no existía en Drive: una factura de Helechos
--  2 y otra de Helechos 3 acababan las dos en la misma carpeta. A
--  partir de aquí la unidad es un nivel de carpeta, debajo de la
--  sección:
--
--      OBRAS / OBRA MANUEL / GASTOS / 2026 / T3 / MATERIALES
--      HELECHOS / HELECHOS 2 / GASTOS / 2026 / T3 / LUZ
--
--  Lo que no es de ninguna —la luz común, el seguro— se queda donde
--  está hoy, colgando de la sección. No va a ninguna unidad porque no
--  es de ninguna.
--
--  Aquí se guarda el identificador de esa carpeta, para poder
--  renombrarla en Drive cuando se renombre la unidad en HUBI.
--
--  ─────────────────────────────────────────────────────────
--  LOS PAPELES QUE YA ESTÁN GUARDADOS NO SE MUEVEN.
--
--  Se quedan en HELECHOS/GASTOS/... y los nuevos irán a
--  HELECHOS/HELECHOS 2/GASTOS/... Mover los archivos que ya están
--  significaría tocar el Drive de Juan Miguel por nuestra cuenta, y
--  eso no se hace sin que lo pida. En HUBI se siguen viendo todos
--  juntos igual: lo que cambia es la estantería, no la lista.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

alter table categorias
  add column if not exists palabra_unidad text;

comment on column categorias.palabra_unidad is
  'Cómo se llama cada una en esta sección, en singular y con artículo: "el apartamento", "la obra". Nulo = la sección no se divide.';

alter table unidades
  add column if not exists carpeta_drive_id text;


-- ── Los Helechos ya tienen su palabra ─────────────────────────
update categorias
   set palabra_unidad = 'el apartamento'
 where segmento_drive = 'HELECHOS'
   and padre_id is null
   and palabra_unidad is null;


-- ── Comprobación ──────────────────────────────────────────────
/*
  De las secciones que se dividen, todas tienen que tener palabra. Una
  sección con `usa_unidades` puesto y sin palabra dejaría la pantalla
  diciendo «+ Nueva» a secas.
*/
select
  c.nombre                              as seccion,
  c.usa_unidades                        as se_divide,
  c.reparte_comunes                     as reparte,
  coalesce(c.palabra_unidad, '⚠ SIN PALABRA') as palabra,
  count(u.id)                           as cuantas,
  count(u.carpeta_drive_id)             as con_carpeta
from categorias c
left join unidades u on u.seccion_id = c.id and u.activa
where c.padre_id is null
group by c.id, c.nombre, c.usa_unidades, c.reparte_comunes, c.palabra_unidad
order by c.orden;
