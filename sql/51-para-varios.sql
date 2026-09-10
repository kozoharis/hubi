-- ═══════════════════════════════════════════════════════════════
-- 51 · UNA COSA PARA VARIAS PERSONAS
-- ═══════════════════════════════════════════════════════════════
--
-- Una columna. Nada más.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE SE PEDÍA
--
-- «Recoged los dos la medicación» tenía que poder apuntarse una vez y
-- aparecerle a los dos en su tablón. Hasta ahora `asignado_a` era UNA
-- persona, o nulo — y nulo significaba «de la casa», que no es lo
-- mismo que «de estos dos y no de los otros dos».
--
-- ─────────────────────────────────────────────────────────────
-- Y POR QUÉ NO HAY TABLA NUEVA
--
-- La forma «de libro» sería una tabla `recordatorio_para` con una
-- fila por persona. Se descartó, y por un motivo concreto: se decidió
-- que **cada uno marca la suya**. Que Juan Miguel firme los papeles no
-- los firma por Conchita.
--
-- Con esa decisión, una tarea para dos personas ES dos tareas: dos
-- estados, dos fechas de hecho, dos avisos al móvil. Y eso ya lo sabe
-- hacer esta tabla desde el primer día.
--
-- Así que una tarea para dos se guarda como dos filas hermanas, y lo
-- único que hace falta es saber que nacieron juntas:
--
--     grupo_id
--
-- Lo que se gana no es elegancia, es que DIECINUEVE archivos que leen
-- `asignado_a` siguen funcionando sin tocarlos: la agenda, el mes, el
-- día, los avisos del móvil, las cuentas, la compra, los
-- vencimientos. Una tabla nueva habría obligado a reescribir cada
-- consulta de la casa para una función que se usa de vez en cuando.
--
-- ─────────────────────────────────────────────────────────────
-- PARA QUÉ SIRVE EL GRUPO, ENTONCES
--
-- Hoy, para poder decir «esto es de los dos» al enseñarlo, y para que
-- borrar una no deje huérfana a la otra sin que nadie sepa que existía.
--
-- Mañana, para poder contestar «¿lo han hecho ya los dos?» sin una
-- migración. Es una columna nulable: no cuesta nada tenerla y cuesta
-- un rato no haberla puesto.
--
-- Lo que NO hace: cambiar una no cambia la otra. Si Conchita mueve la
-- suya al jueves, la de Juan Miguel se queda donde estaba. Es lo menos
-- sorprendente de las dos posibilidades — quien abre una tarea que
-- pone su nombre está tocando la suya.

alter table recordatorios
  add column if not exists grupo_id uuid;

comment on column recordatorios.grupo_id is
  'Las que se apuntaron de una vez para varias personas comparten este valor. Nulo = de una sola persona.';

-- Se busca por grupo solo para enseñar «y a Conchita también» y para
-- las hermanas de una. Nunca es la condición principal de una
-- consulta, así que un índice normal y parcial es de sobra.
create index if not exists idx_recordatorios_grupo
  on recordatorios(grupo_id) where grupo_id is not null;

-- ─────────────────────────────────────────────────────────────
-- Y NO HACE FALTA TOCAR NINGUNA POLÍTICA
--
-- Cada fila sigue teniendo su `hogar_id`, su `asignado_a` y su
-- `creado_por`, que es de lo único que hablan las políticas de RLS del
-- archivo 37. Una fila hermana no es un caso especial para ellas: es
-- una fila más, con nombre y dueño, exactamente como todas.
