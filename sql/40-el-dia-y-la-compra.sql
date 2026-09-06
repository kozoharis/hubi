-- ═══════════════════════════════════════════════════════════════
-- 40 · EL PARTE DEL DÍA, Y LA COMPRA QUE SE CIERRA
-- ═══════════════════════════════════════════════════════════════
--
-- Dos cosas que no tienen que ver entre sí, pero las dos son «lo que
-- pasó hoy» y por eso van juntas.
--
-- ─────────────────────────────────────────────────────────────
-- 1 · EL PARTE DEL DÍA
--
-- Quien ayuda en casa marca lo que ha hecho, y hasta aquí llegábamos.
-- Falta lo otro: cuántas horas ha estado, y si tiene algo que decir de
-- ese día —«no pude planchar, no había plancha», «me quedé una hora
-- más»—.
--
-- APUNTES PARA CUADRAR EL MES. NO UN REGISTRO DE JORNADA.
--
-- Esto hay que decirlo aquí y decirlo en la pantalla. Un registro de
-- jornada laboral tiene requisitos legales —conservación cuatro años,
-- inalterabilidad, entrega a la Inspección— que HUBI no cumple y que
-- no vamos a fingir que cumple. Lo que hay es una libreta compartida
-- para que a fin de mes los dos miren el mismo número.
--
-- Y POR ESO SOLO ESCRIBE ELLA.
--
-- Es lo único que hace que el número valga: si el empleador pudiera
-- corregirlo, no sería el parte de ella, sería el del empleador. Él lo
-- ve y no lo toca. Ella puede corregir el suyo mientras el día esté
-- cerca; después queda como está.
--
-- ─────────────────────────────────────────────────────────────
-- 2 · LA COMPRA SE CIERRA Y SE GUARDA ENTERA
--
-- Hasta hoy, «Ya he comprado» archivaba los artículos tachados y ya
-- está: la lista seguía viva y lo comprado desaparecía. Se perdía la
-- foto del conjunto — qué se compró aquel día, y cuánto costó.
--
-- Ahora la lista se CIERRA: queda guardada con lo que llevaba dentro,
-- se le puede enganchar el ticket del súper, y se abre una nueva
-- vacía. Con eso hay trazabilidad —esta lista, este ticket, este
-- importe— y además se puede recuperar: la compra de casa se repite
-- casi igual todas las semanas.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · El parte del día ───────────────────────────────────
create table if not exists dias_en_casa (
  hogar_id    uuid not null references hogares(id) on delete cascade,
  quien       uuid not null references perfiles(id) on delete cascade,
  fecha       date not null,

  /* Las horas del día. Nulas si solo dejó una nota — que también es
     un parte válido: «hoy no vine, tenía médico». */
  horas       numeric(4,2) check (horas is null or (horas >= 0 and horas <= 24)),

  -- Lo que quiera contar de ese día. En sus palabras.
  nota        text,

  apuntado_en timestamptz not null default now(),
  cambiado_en timestamptz,

  /* Uno por persona y día. Sin esto, dos toques con mala cobertura
     dejarían dos partes del mismo lunes y la cuenta del mes saldría
     inflada — el mismo fallo que ya evitamos en `rutinas_hechas`. */
  primary key (quien, fecha)
);

create index if not exists idx_dias_en_casa
  on dias_en_casa (hogar_id, fecha desc);


-- ── 2 · Quién ve y quién toca ──────────────────────────────
alter table dias_en_casa enable row level security;

/*
  LEER: la casa. Salvo quien ayuda, que ve el suyo.

  Es la misma regla que ya tienen los recordatorios y las notas desde
  el SQL 37: quien entra a trabajar no tiene por qué ver las horas de
  nadie más — y con dos personas ayudando en la misma casa, eso
  importa de verdad.
*/
drop policy if exists dias_leer on dias_en_casa;
create policy dias_leer on dias_en_casa
  for select to authenticated using (
    hogar_id = mi_hogar()
    and (
      coalesce(mi_rol(), 'familia') <> 'ayuda'
      or quien = auth.uid()
    )
  );

/*
  ESCRIBIR: SOLO ELLA, Y SOLO LO SUYO.

  `quien = auth.uid()` sin excepciones, ni siquiera para quien creó la
  casa. Es lo único que hace que el número valga algo: un parte que el
  empleador puede escribir no es el parte de ella.
*/
drop policy if exists dias_crear on dias_en_casa;
create policy dias_crear on dias_en_casa
  for insert to authenticated with check (
    hogar_id = mi_hogar() and quien = auth.uid()
  );

/*
  Y corregir, mientras el día esté cerca. Una semana: da margen para
  el «se me olvidó apuntar el martes» sin convertir el histórico en
  algo que se puede reescribir meses después.
*/
drop policy if exists dias_editar on dias_en_casa;
create policy dias_editar on dias_en_casa
  for update to authenticated using (
    hogar_id = mi_hogar()
    and quien = auth.uid()
    and fecha >= current_date - 7
  );

drop policy if exists dias_borrar on dias_en_casa;
create policy dias_borrar on dias_en_casa
  for delete to authenticated using (
    hogar_id = mi_hogar()
    and quien = auth.uid()
    and fecha >= current_date - 7
  );


-- ── 3 · La compra que se cierra ────────────────────────────
/*
  `archivada_en` ya existía y significaba «esta lista ya no se usa».
  Se le añade lo que le faltaba para que cerrarla sirva de algo: quién
  la cerró y con qué ticket.

  El ticket es un documento de los de siempre —está en Drive, tiene su
  carpeta y su importe—, así que aquí solo va la referencia. Duplicar
  el archivo sería tener dos sitios donde mirar y uno de los dos
  quedaría desactualizado.
*/
alter table listas_compra
  add column if not exists cerrada_por uuid references perfiles(id) on delete set null;

alter table listas_compra
  add column if not exists ticket_id uuid references documentos(id) on delete set null;

comment on column listas_compra.ticket_id is
  'El ticket del súper de esta compra. Es un documento de Drive, no una copia.';

create index if not exists idx_listas_cerradas
  on listas_compra (seccion_id, archivada_en desc) where archivada_en is not null;


-- ── 4 · Comprobación ───────────────────────────────────────
/*
  TRES resultados.

  1 · Las cuatro políticas del parte. Las de escribir tienen que decir
      `auth.uid()` en el `quien`: si alguna no lo dice, el empleador
      puede escribir el parte de ella y esto deja de servir.

  2 · Las columnas nuevas de `listas_compra`. Tres filas.

  3 · La tabla vacía y con RLS puesto. `rls = true` no es un detalle:
      sin él, cualquiera con una sesión vería las horas de todas las
      casas de HUBI.
*/
select policyname as politica, cmd as para_que,
       coalesce(qual, with_check) ilike '%auth.uid()%' as solo_ella
from pg_policies
where tablename = 'dias_en_casa'
order by policyname;

select column_name as columna, data_type as tipo
from information_schema.columns
where table_name = 'listas_compra'
  and column_name in ('archivada_en', 'cerrada_por', 'ticket_id')
order by column_name;

select
  (select count(*) from dias_en_casa) as partes,
  (select relrowsecurity from pg_class where relname = 'dias_en_casa') as rls_partes;
