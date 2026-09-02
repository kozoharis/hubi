-- ───────────────────────────────────────────────────────────
--  PERMISOS CONCEDIDOS Y CALENDARIO DE HUBI
--
--  `alcances` guarda qué permisos nos dio Google exactamente al
--  conectar. Sin esto no hay forma de saber si el permiso guardado
--  incluye ya el del calendario o es uno viejo de solo Drive — y una
--  aplicación que no sabe qué puede hacer acaba fallando en silencio.
--
--  `calendario_id` guarda el calendario que HUBI crea dentro de la
--  cuenta de Juan Miguel, para no crear uno nuevo cada vez.
-- ───────────────────────────────────────────────────────────

alter table conexion_drive
  add column if not exists alcances text;

alter table conexion_drive
  add column if not exists calendario_id text;

-- El identificador del evento en Google, para poder actualizarlo o
-- borrarlo después en vez de crear uno nuevo cada vez.
alter table recordatorios
  add column if not exists evento_google text;
