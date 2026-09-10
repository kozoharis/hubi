-- ═══════════════════════════════════════════════════════════════
-- LO QUE SE PAGA TODOS LOS MESES
-- ═══════════════════════════════════════════════════════════════
--
-- Internet, el teléfono, el alquiler, los seguros, las suscripciones.
-- Importe conocido, día conocido, mes tras mes. Hasta hoy había que
-- fotografiar cada uno de esos papeles para que las cuentas cuadraran,
-- y el que se olvidaba no aparecía por ningún lado — ni el gasto, ni el
-- aviso de que faltaba.
--
-- De aquí salen dos cosas, y la segunda es la que de verdad importa:
--
--  1. LAS CUENTAS SE COMPLETAN SOLAS. Lo que se sabe que se paga, se
--     apunta sin fotografiar nada.
--
--  2. Y CUANDO LLEGA EL MES Y NO ESTÁ LA FACTURA, HUBI LO DICE:
--     «Falta la factura de Movistar de septiembre». Puede decirlo
--     porque sabe lo que se programó y puede compararlo con lo que
--     hay guardado. Eso es lo que convierte un archivador en algo que
--     se acuerda por ti.
--
-- ─────────────────────────────────────────────────────────────
-- EL PELIGRO, Y LA DECISIÓN QUE LO EVITA
--
-- Dar por pagado un gasto que quizá no ocurrió infla las cuentas, y
-- nadie lo nota en meses. Un recibo devuelto, una baja, un mes que la
-- compañía no pasó el cobro: si HUBI lo apunta igual, el balance miente
-- y miente hacia el lado peor —parece que se ha gastado más— sin que
-- haya ningún papel que lo desmienta.
--
-- Por eso un pago programado nace PREVISTO: cuenta en el balance, pero
-- marcado y visible, y se confirma con un toque o subiendo la factura.
-- Nunca se apunta nada en silencio.
--
-- Necesita el sql/46 ejecutado (el impuesto).
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · El plan ────────────────────────────────────────────
create table if not exists pagos_fijos (
  id        uuid primary key default gen_random_uuid(),
  hogar_id  uuid not null default mi_hogar() references hogares(id) on delete cascade,

  -- Como lo llamarían ellos: «Internet», «El seguro del coche».
  que       text not null check (length(trim(que)) > 0),

  /*
    De quién es. No es decorativo: es lo que permite reconocer la
    factura cuando llegue. Si el pago fijo dice «Movistar» y se guarda
    un papel cuyo proveedor es Movistar dentro de ese mes, HUBI sabe
    que ya no falta.
  */
  proveedor text,

  -- Dónde cuenta. La partida manda: de ella sale si es gasto o ingreso.
  categoria_id uuid not null references categorias(id),

  -- El TOTAL, como en todo HUBI. Nunca la base.
  importe   numeric(12,2) not null check (importe > 0),
  -- Y su IGIC/IVA, si se sabe. Nulo = el que toque por la partida.
  impuesto_tipo numeric(5,2)
    check (impuesto_tipo is null or (impuesto_tipo >= 0 and impuesto_tipo <= 100)),

  /*
    Cada cuánto. Tres y no más: mensual, trimestral y anual cubren el
    recibo de la luz, el seguro del coche y la cuota del dominio. Meter
    «cada 45 días» sería añadir una casilla que nadie de esta casa va a
    usar nunca.
  */
  cada      text not null check (cada in ('mensual', 'trimestral', 'anual')),

  /*
    Qué día del mes. Hasta el 28 a propósito: el 30 no existe en
    febrero, y un pago programado el 31 se saltaría siete meses al año.
    Quien cobra el 30 pone 28 y no pasa nada — esto sirve para saber
    QUÉ mes toca, no para clavar el día del cargo.
  */
  dia       smallint not null default 1 check (dia between 1 and 28),

  -- Desde cuándo. No se generan pagos anteriores a esta fecha.
  desde     date not null default current_date,
  -- Y hasta cuándo, si tiene fin. Nulo = sigue.
  hasta     date,

  /* ¿Llega un papel cada vez? El alquiler puede que no; la factura de
     la luz sí. Solo se echa en falta lo que se espera. */
  espera_papel boolean not null default true,

  -- Apagado sin borrarlo: una temporada de baja, un servicio en pausa.
  activo    boolean not null default true,

  creado_en  timestamptz not null default now(),
  creado_por uuid references perfiles(id)
);

create index if not exists idx_pagos_fijos_casa
  on pagos_fijos (hogar_id) where activo;


-- ── 2 · Y de qué pago nace cada apunte ─────────────────────
alter table movimientos
  add column if not exists pago_fijo_id uuid references pagos_fijos(id) on delete set null,
  /* El primer día del periodo que cubre. Un recibo de septiembre es
     2026-09-01 aunque se cargue el día 12: así «el de septiembre» es
     una cosa concreta y comparable. */
  add column if not exists periodo date,
  /* Apuntado porque tocaba, no porque se haya visto el papel. */
  add column if not exists previsto boolean not null default false;

/*
  UN PAGO, UN PERIODO, UN APUNTE.

  Sin esto, dos visitas de la tarea diaria el mismo día —un reintento,
  un despliegue— duplicarían el recibo de la luz. Y un balance con la
  luz dos veces no se descubre hasta que alguien lo suma a mano.
*/
create unique index if not exists pagos_fijos_un_apunte_por_periodo
  on movimientos (pago_fijo_id, periodo)
  where pago_fijo_id is not null;

create index if not exists idx_movimientos_previstos
  on movimientos (periodo) where previsto;


-- ── 3 · Quién puede ────────────────────────────────────────
/*
  Lo de siempre: tu casa, y solo si puedes escribir. Un lector ve lo
  que se paga cada mes —forma parte de las cuentas— pero no lo cambia.
*/
alter table pagos_fijos enable row level security;

drop policy if exists pagos_fijos_leer on pagos_fijos;
create policy pagos_fijos_leer on pagos_fijos
  for select to authenticated using (hogar_id = mi_hogar());

drop policy if exists pagos_fijos_crear on pagos_fijos;
create policy pagos_fijos_crear on pagos_fijos
  for insert to authenticated with check (
    hogar_id = mi_hogar() and puedo_escribir()
  );

drop policy if exists pagos_fijos_cambiar on pagos_fijos;
create policy pagos_fijos_cambiar on pagos_fijos
  for update to authenticated
  using (hogar_id = mi_hogar() and puedo_escribir())
  with check (hogar_id = mi_hogar() and puedo_escribir());

drop policy if exists pagos_fijos_borrar on pagos_fijos;
create policy pagos_fijos_borrar on pagos_fijos
  for delete to authenticated using (
    hogar_id = mi_hogar() and puedo_escribir()
  );


-- ── 4 · Comprobación ───────────────────────────────────────
/*
  Lo primero tiene que decir `rls = true` y salir 4 políticas.
  Lo segundo, las tres columnas nuevas de `movimientos`.
*/
select
  c.relname            as tabla,
  c.relrowsecurity     as rls,
  count(p.polname)     as politicas
from pg_class c
left join pg_policy p on p.polrelid = c.oid
where c.relname = 'pagos_fijos'
group by c.relname, c.relrowsecurity;

select column_name as columna, data_type as tipo
  from information_schema.columns
 where table_name = 'movimientos'
   and column_name in ('pago_fijo_id', 'periodo', 'previsto')
 order by column_name;
