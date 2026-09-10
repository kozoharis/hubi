-- ═══════════════════════════════════════════════════════════════
-- UN PAPEL PUEDE NECESITAR DOS AVISOS
-- ═══════════════════════════════════════════════════════════════
--
-- EL ERROR, TAL CUAL LO DIJO LA BASE DE DATOS
--
--   duplicate key value violates unique constraint
--   "idx_recordatorios_documento"
--
-- Hay un índice ÚNICO sobre `documento_origen_id`: cada documento puede
-- tener como mucho UN aviso. Se puso cuando un vencimiento era una sola
-- fecha, y entonces era correcto — evitaba que guardar dos veces el
-- mismo seguro dejara dos avisos idénticos en el calendario.
--
-- Lo que ha cambiado es el problema, no el índice. Un contrato que se
-- renueva solo tiene DOS fechas que importan:
--
--   · el último día para cancelarlo   ← la que sirve
--   · el día en que se renueva
--
-- Y las dos salen del mismo papel. Con el índice como está, HUBI manda
-- las dos filas juntas y chocan entre ellas: no es que haya un aviso
-- viejo estorbando, es que las dos nuevas comparten documento.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ SE PONE EN SU LUGAR, Y POR QUÉ NO SE QUITA A SECAS
--
-- La protección sigue haciendo falta. Guardar dos veces el mismo papel
-- no puede dejar dos «Vence: seguro del coche» el mismo día: eso enseña
-- a desconfiar del calendario, y un calendario del que se desconfía no
-- sirve para nada.
--
-- Así que la regla se afina en vez de levantarse:
--
--   ANTES  un documento → como mucho un aviso
--   AHORA  un documento → como mucho un aviso DE CADA CLASE
--
-- Y solo cuenta para los avisos que pone HUBI —los que llevan
-- `motivo`—. Los que escribe una persona sobre el mismo papel («llamar
-- a Silvia por lo del seguro», «pedir presupuesto a otra compañía») ya
-- no están limitados a uno: nunca debieron estarlo, y esa limitación
-- estaba ahí de rebote.
--
-- Necesita el `sql/43` ejecutado antes (es el que crea `motivo`).
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 0 · Que no falte lo de antes ───────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_name = 'recordatorios' and column_name = 'motivo'
  ) then
    raise exception
      'Falta la columna `motivo`. Ejecuta antes el sql/43-lo-que-vence.sql.';
  end if;
end $$;


-- ── 1 · Fuera el índice viejo ──────────────────────────────
/*
  Puede estar de dos formas y hay que contemplar las dos: como índice
  suelto (`create unique index`) o respaldando una restricción (`add
  constraint ... unique`). Si es lo segundo, `drop index` no lo quita —
  da error y el archivo se queda a medias.

  Se mira cuál es y se quita como corresponda.
*/
do $$
declare
  es_restriccion boolean;
begin
  select exists (
    select 1 from pg_constraint
     where conrelid = 'public.recordatorios'::regclass
       and conname  = 'idx_recordatorios_documento'
  ) into es_restriccion;

  if es_restriccion then
    alter table recordatorios drop constraint idx_recordatorios_documento;
    raise notice 'Quitada la restricción idx_recordatorios_documento.';
  elsif exists (
    select 1 from pg_class where relname = 'idx_recordatorios_documento'
  ) then
    execute 'drop index idx_recordatorios_documento';
    raise notice 'Quitado el índice idx_recordatorios_documento.';
  else
    raise notice 'No estaba: nada que quitar.';
  end if;
end $$;


-- ── 2 · Y en su lugar, uno por clase de aviso ──────────────
/*
  Dos condiciones, y cada una evita un problema distinto.

  `motivo is not null` — la regla solo gobierna los avisos que genera
  HUBI. Un papel puede tener su preaviso, su vencimiento, y encima los
  recordatorios que escriba quien quiera.

  `estado = 'pendiente'` — y ésta es la que evita una avería dentro de
  un año. Cuando llegue el vencimiento y alguien lo marque como HECHO,
  ese aviso se queda ahí: es la prueba de que aquel año sí se avisó a
  tiempo, y por eso HUBI no lo borra al rehacer. Sin esta condición, esa
  prueba bloquearía el aviso del año siguiente — y el fallo aparecería
  doce meses después, cuando nadie se acuerde de esto.

  Coincide exactamente con lo que borra HUBI antes de escribir: solo
  pendientes. La regla y el código dicen lo mismo, que es la única forma
  de que no se contradigan.
*/
create unique index if not exists recordatorios_un_aviso_por_clase
  on recordatorios (documento_origen_id, motivo)
  where documento_origen_id is not null
    and motivo is not null
    and estado = 'pendiente';


-- ── 3 · Comprobación ───────────────────────────────────────
/*
  Tiene que salir UNA fila: `recordatorios_un_aviso_por_clase`, y su
  definición debe incluir `(documento_origen_id, motivo)`.

  Y NO debe salir `idx_recordatorios_documento`. Si sigue apareciendo,
  el apartado 1 no ha hecho su trabajo y el aviso seguirá fallando.
*/
select
  indexname  as indice,
  indexdef   as definicion
from pg_indexes
where tablename = 'recordatorios'
  and (indexname like '%documento%' or indexname like '%aviso%')
order by indexname;
