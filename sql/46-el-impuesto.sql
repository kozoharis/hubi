-- ═══════════════════════════════════════════════════════════════
-- EL IGIC Y EL IVA
-- ═══════════════════════════════════════════════════════════════
--
-- Hasta hoy un apunte era un número: 127,43 €. Para una casa está bien.
-- Para quien factura, no: en esa cifra van dos cosas distintas —lo que
-- cuesta y el impuesto— y la segunda no es dinero suyo, es dinero que
-- está de paso y que hay que liquidar.
--
-- ─────────────────────────────────────────────────────────────
-- LA DECISIÓN QUE GOBIERNA TODO ESTO: EL TOTAL NO SE TOCA
--
-- `movimientos.importe` sigue siendo el TOTAL, exactamente igual que
-- ayer. No se migra ni un apunte, y el balance de los años anteriores
-- sigue diciendo lo mismo.
--
-- Y hay un motivo más importante que la comodidad: si algún día el
-- desglose estuviera mal —un tipo equivocado, una factura exenta— EL
-- BALANCE SIGUE SIENDO CORRECTO. Lo que se paga es lo que se paga. El
-- impuesto es una lectura de ese número, nunca el número.
--
-- Por eso tampoco se guarda la base: se calcula restando. Guardar
-- total, base y cuota es guardar la misma verdad tres veces, y tres
-- copias de una verdad acaban siendo tres verdades distintas.
--
-- ─────────────────────────────────────────────────────────────
-- Y APAGADO DE SERIE
--
-- Juan Miguel y Conchita no facturan a nadie. Para ellos esto no puede
-- existir: ni una palabra nueva en pantalla, ni un botón más. Se
-- enciende casa por casa, y mientras esté apagado HUBI se comporta
-- exactamente igual que antes de este archivo.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · ¿Esta casa lleva impuesto? ─────────────────────────
/*
  Tres valores y no un `boolean`, porque no es lo mismo: en Canarias es
  IGIC con sus tipos (7 general) y en la península IVA con los suyos (21
  general). Un sí/no obligaría a adivinar cuál, y adivinar el impuesto
  de alguien es de las cosas que no se hacen.
*/
alter table hogares
  add column if not exists impuesto text not null default 'ninguno';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'hogares_impuesto_valido'
  ) then
    alter table hogares add constraint hogares_impuesto_valido
      check (impuesto in ('ninguno', 'igic', 'iva'));
  end if;
end $$;


-- ── 2 · El tipo habitual de cada partida ───────────────────
/*
  «Luz» siempre lleva el mismo tipo. «Productos» también. Ponerlo una
  vez en la partida ahorra ponerlo en cada factura — que es la
  diferencia entre que esto se use y que no se use.

  Nulo = no se ha dicho, y entonces se aplica el general de la casa.
*/
alter table categorias
  add column if not exists impuesto_tipo numeric(5,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'categorias_impuesto_razonable'
  ) then
    alter table categorias add constraint categorias_impuesto_razonable
      check (impuesto_tipo is null or (impuesto_tipo >= 0 and impuesto_tipo <= 100));
  end if;
end $$;


-- ── 3 · Y lo que de verdad se aplicó a cada apunte ─────────
/*
  El tipo se guarda AUNQUE se pueda deducir de la partida. Un apunte de
  hace dos años tiene que seguir diciendo qué se le aplicó ENTONCES,
  aunque la partida haya cambiado de tipo desde entonces. Si no, cambiar
  hoy el tipo de «Luz» reescribiría en silencio la declaración de un
  trimestre ya presentado.

  La cuota también se guarda, y por lo mismo: es un hecho contable, no
  una cuenta que se rehace cada vez que se abre la pantalla.

  Nulo en `impuesto_tipo` = este apunte no está desglosado. Se cuenta
  aparte y se dice; no se reparte a ojo.
*/
alter table movimientos
  add column if not exists impuesto_tipo  numeric(5,2),
  add column if not exists impuesto_cuota numeric(12,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'movimientos_impuesto_razonable'
  ) then
    alter table movimientos add constraint movimientos_impuesto_razonable
      check (impuesto_tipo is null or (impuesto_tipo >= 0 and impuesto_tipo <= 100));
  end if;

  /* La cuota nunca puede ser mayor que el total ni negativa. Un tipo
     mal tecleado —700 en vez de 7— se para aquí antes de ensuciar un
     trimestre entero. */
  if not exists (
    select 1 from pg_constraint where conname = 'movimientos_cuota_cabe_en_el_total'
  ) then
    alter table movimientos add constraint movimientos_cuota_cabe_en_el_total
      check (
        impuesto_cuota is null
        or (impuesto_cuota >= 0 and impuesto_cuota <= abs(importe))
      );
  end if;
end $$;

/* Para la cuenta del trimestre: solo interesan los que llevan cuota. */
create index if not exists idx_movimientos_con_impuesto
  on movimientos (fecha) where impuesto_cuota is not null;


-- ── 4 · Comprobación ───────────────────────────────────────
/*
  Tienen que salir CUATRO filas:

    categorias    impuesto_tipo
    hogares       impuesto
    movimientos   impuesto_cuota
    movimientos   impuesto_tipo

  Si falta alguna, el archivo no se ha ejecutado entero.
*/
select
  table_name  as tabla,
  column_name as columna,
  data_type   as tipo,
  coalesce(column_default, '—') as por_defecto
from information_schema.columns
where (table_name = 'hogares'     and column_name = 'impuesto')
   or (table_name = 'categorias'  and column_name = 'impuesto_tipo')
   or (table_name = 'movimientos' and column_name in ('impuesto_tipo', 'impuesto_cuota'))
order by table_name, column_name;
