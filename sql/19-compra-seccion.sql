-- ───────────────────────────────────────────────────────────
--  LA COMPRA, POR SECCIONES
--
--  "Abono y semillas para la finca". "Toallas para Los Helechos".
--  "Leche y pan" (para casa, que es lo normal y no hace falta decirlo).
--
--  Una sola lista, no tres. Se va al súper una vez, con un móvil, y
--  tener que entrar y salir de tres listas para no olvidarse de nada
--  es exactamente lo contrario de lo que hace falta empujando un
--  carro. La sección es una ETIQUETA, no una lista aparte: la pantalla
--  agrupa por ella y ya está.
--
--  Apunta a `categorias` y no a un texto libre porque las secciones ya
--  existen ahí, cada familia tiene las suyas, y así "para la obra"
--  funcionará el día que alguien active el módulo de Obras sin tocar
--  una línea de esto.
--
--  VACÍO significa "para la casa", que es el 90% de la compra. Poner
--  una sección obligatoria sería pedir una decisión para apuntar pan.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

alter table compra
  add column if not exists seccion_id uuid references categorias(id) on delete set null;

create index if not exists idx_compra_seccion
  on compra (seccion_id) where seccion_id is not null;
