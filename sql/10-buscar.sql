-- ───────────────────────────────────────────────────────────
--  QUE LA BÚSQUEDA ENCUENTRE LAS CARPETAS
--
--  El problema:
--
--  La columna `busqueda` se construye con el título, el proveedor,
--  las notas y el texto leído del papel. El NOMBRE DE LA CARPETA no
--  está ahí — vive en la tabla `categorias` — y una columna generada
--  no puede mirar otra tabla.
--
--  Resultado: buscar "facturas finca" no encontraba nada. "Finca" es
--  una carpeta, no una palabra del documento, y "factura" tampoco
--  suele estar escrita en un papel que se titula "Endesa agosto".
--
--  La solución es guardar la ruta como texto en la propia fila:
--  "Finca Gastos Luz". Se escribe al archivar el documento —que es
--  cuando se sabe— y a partir de ahí la columna generada sí la ve.
-- ───────────────────────────────────────────────────────────

alter table documentos
  add column if not exists ruta_texto text;

-- La columna generada hay que rehacerla: no se puede modificar en
-- el sitio. Se cae con ella el índice, así que se vuelve a crear.
drop index if exists idx_documentos_busqueda;

alter table documentos
  drop column if exists busqueda;

alter table documentos
  add column busqueda tsvector generated always as (
    to_tsvector('spanish',
      coalesce(titulo, '') || ' ' ||
      coalesce(proveedor, '') || ' ' ||
      coalesce(ruta_texto, '') || ' ' ||
      coalesce(notas, '') || ' ' ||
      coalesce(texto_ocr, '')
    )
  ) stored;

create index if not exists idx_documentos_busqueda
  on documentos using gin(busqueda);


-- ── Los que ya estaban guardados ───────────────────────────
--  Sin esto, lo de antes seguiría sin encontrarse. Sube por el árbol
--  de categorías hasta la raíz y junta los nombres.
with recursive rama as (
  select id, nombre, padre_id, nombre::text as ruta
  from categorias
  where padre_id is null

  union all

  select c.id, c.nombre, c.padre_id, r.ruta || ' ' || c.nombre
  from categorias c
  join rama r on c.padre_id = r.id
)
update documentos d
   set ruta_texto = rama.ruta
  from rama
 where rama.id = d.categoria_id
   and (d.ruta_texto is null or d.ruta_texto <> rama.ruta);
