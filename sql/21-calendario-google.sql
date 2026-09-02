-- ───────────────────────────────────────────────────────────
--  VOLCAR EL CALENDARIO DE GOOGLE EN HUBI
--
--  Cada persona puede pegar la "dirección secreta en formato iCal" de
--  su calendario de Google. HUBI la lee desde el servidor y enseña sus
--  citas en la Agenda, junto a las de HUBI.
--
--  POR QUÉ ASÍ Y NO CON UN PERMISO DE GOOGLE
--
--  Para leer un calendario, Google exige el permiso `calendar.readonly`
--  y ése es SENSIBLE: justificación por escrito, verificación del
--  dominio y un vídeo demostrativo. Nos sacaría de la casilla de "no
--  sensible" justo cuando el plan es abrir HUBI a más familias.
--
--  La dirección iCal no necesita nada de eso: es un archivo de texto
--  que Google publica en una dirección larguísima e impredecible.
--
--  ─────────────────────────────────────────────────────────
--  ESA DIRECCIÓN ES UNA CONTRASEÑA, Y SE TRATA COMO TAL
--
--  Quien la tenga lee el calendario entero sin identificarse. Por eso:
--
--  · Se guarda CIFRADA, con la misma clave que el permiso de Drive.
--    En la base de datos no hay nada legible.
--  · No sale nunca al navegador. Solo el servidor la descifra, y solo
--    para ir a buscar las citas.
--  · Cada uno guarda la suya y solo ve la suya. El calendario personal
--    de alguien no se le enseña al otro por defecto: si lo quieren
--    compartir, Google Calendar ya sirve para eso y es su decisión,
--    no la nuestra.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

alter table perfiles
  add column if not exists ical_cifrado text;

comment on column perfiles.ical_cifrado is
  'Dirección iCal privada del calendario de Google de esta persona, cifrada. Es una contraseña: nunca debe salir al navegador ni escribirse en un registro.';


/*
  Y la fecha en que se conectó.

  No es adorno: sirve para poder decir en Ajustes "conectado desde el
  4 de septiembre". Una pantalla que solo dice "conectado" no deja
  saber si eso pasó ayer o hace un año, y cuando algo no cuadra ése es
  justo el dato que hace falta.
*/
alter table perfiles
  add column if not exists ical_desde timestamptz;


-- ── Comprobación ───────────────────────────────────────────
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'perfiles'
  and column_name in ('ical_cifrado', 'ical_desde')
order by column_name;
