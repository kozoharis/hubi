-- ───────────────────────────────────────────────────────────
--  FOTO DE PERFIL
--
--  La foto se guarda aquí mismo, dentro de la fila del perfil,
--  como texto (una imagen pequeña codificada en base64).
--
--  Podría haber ido a un almacén de archivos aparte, pero eso
--  significaría un servicio nuevo, permisos nuevos y otro sitio donde
--  algo puede fallar — para dos personas y dos fotos de 30 KB. La
--  base de datos las guarda de sobra.
--
--  El límite de 120 KB no es decorativo: impide que una foto enorme
--  entre por descuido y haga lenta cada pantalla que lee el perfil.
-- ───────────────────────────────────────────────────────────

alter table perfiles
  add column if not exists foto text;

alter table perfiles
  drop constraint if exists foto_pequena;

alter table perfiles
  add constraint foto_pequena
  check (foto is null or length(foto) <= 120000);
