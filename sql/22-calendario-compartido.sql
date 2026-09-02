-- ───────────────────────────────────────────────────────────
--  VER EL CALENDARIO DEL OTRO — PERO SOLO SI ÉL QUIERE
--
--  Al volcar los calendarios de Google se decidió que cada uno viera
--  solo el suyo. Era lo prudente para empezar, pero se queda corto:
--  media gracia de una agenda de casa es saber si el otro tiene algo
--  esa tarde antes de comprometerse.
--
--  LA REGLA: COMPARTIR LO DECIDE EL DUEÑO DEL CALENDARIO, NO EL OTRO.
--
--  Un calendario personal lleva dentro cosas de terceros: con quién se
--  ve uno, dónde, a qué hora. Que Juan Miguel pueda hacer visible el
--  calendario de Conchita sería colocarle a ella una decisión que es
--  suya. Así que cada uno enciende el suyo, en su pantalla de Ajustes,
--  y puede apagarlo cuando quiera sin desconectar nada.
--
--  Empieza APAGADO a propósito. Quien ya lo conectó no se encuentra de
--  pronto su agenda personal en la pantalla del otro por una
--  actualización que no pidió. Que la primera vez haya que ir a darle
--  es justo lo que queremos.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

alter table perfiles
  add column if not exists ical_compartido boolean not null default false;

comment on column perfiles.ical_compartido is
  'Si esta persona deja que el resto de su hogar vea las citas de su calendario de Google. Lo decide ella, nadie más.';


/*
  Y el color con el que se distingue en la Agenda.

  La columna `color` existe desde el primer día con un verde para
  todos, así que dos personas salían del mismo color y no había manera
  de saber de quién era cada cita. Se les dan dos que se distinguen
  bien —también para quien no aprecia bien los colores, porque además
  del color va SIEMPRE el nombre escrito al lado—.

  Solo a quien siga con el verde de fábrica: si alguien ya eligió el
  suyo, no se le toca.
*/
update perfiles p
set color = c.tono
from (
  select id, case
    when fila = 1 then '#3B82F6'   -- azul
    else '#8B5CF6'                 -- morado
  end as tono
  from (
    select id, row_number() over (order by creado_en) as fila
    from perfiles
  ) x
) c
where p.id = c.id
  and (p.color is null or p.color = '#3A7D6E');


-- ── Comprobación ───────────────────────────────────────────
select nombre, color, ical_compartido, (ical_cifrado is not null) as tiene_calendario
from perfiles
order by creado_en;
