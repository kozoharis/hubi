-- ═══════════════════════════════════════════════════════════════
-- 32 · LO QUE CADA CASA USA Y LO QUE NO
-- ═══════════════════════════════════════════════════════════════
--
-- Dos cosas pequeñas con el mismo fondo: HUBI trae de serie cosas que
-- no todas las casas quieren, y hasta ahora no había forma de decir
-- que no.
--
--   · LA COMPRA. Ocupa el primer sitio del inicio, encima de todo. A
--     quien no hace la compra con el móvil le sale ahí cada día una
--     tarjeta que nunca va a tocar.
--
--   · LAS CARPETAS BASE. Casa, Salud, Vehículos, Seguros y Documentos
--     importantes se crean solas. Quien no tiene coche carga con
--     «Vehículos» para siempre.
--
-- Las carpetas ya se pueden apagar sin tocar la base de datos: tienen
-- su columna `activa` desde el primer día, y apagarla las esconde sin
-- borrar nada. Lo único que faltaba era la pantalla.
--
-- La compra sí necesita un sitio donde guardarse, y es esto.
--
-- Se puede ejecutar dos veces seguidas sin romper nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · ¿Esta casa usa la lista de la compra? ──────────────
/*
  Encendida de serie: es lo que ya tienen Juan Miguel y Conchita, y
  una actualización que apaga sola algo que alguien usaba a diario
  sería un fallo, no una mejora.
*/
alter table hogares
  add column if not exists usa_compra boolean not null default true;


-- ── 1b · Y que se pueda cambiar ────────────────────────────
/*
  `hogares` no tenía política de UPDATE. Hasta hoy no hacía falta:
  nadie cambiaba nada de la casa. Sin ella, el interruptor no daría
  ningún error — cambiaría CERO filas y contestaría que todo bien, que
  es el fallo silencioso de siempre.

  Solo tu casa, y solo si puedes escribir: un lector no apaga la
  compra de los demás.
*/
drop policy if exists hogares_editar on hogares;
create policy hogares_editar on hogares
  for update to authenticated using (id = mi_hogar() and puedo_escribir());


-- ── 2 · Comprobación ───────────────────────────────────────
/*
  Una fila por casa, todas con `usa_compra` en true. Si alguna sale
  vacía, la columna no se ha creado bien.
*/
select
  h.nombre                      as casa,
  h.usa_compra                  as usa_la_compra,
  (select count(*) from categorias c
    where c.hogar_id = h.id and c.padre_id is null and c.activa)   as carpetas_encendidas,
  (select count(*) from categorias c
    where c.hogar_id = h.id and c.padre_id is null and not c.activa) as carpetas_apagadas
from hogares h
order by h.creado_en;
