-- ═══════════════════════════════════════════════════════════════
-- QUÉ LE PASA A LA AGENDA CUANDO NO DEJA CREAR UN AVISO
-- ═══════════════════════════════════════════════════════════════
--
-- Esto NO CAMBIA NADA. Solo mira y cuenta. Se puede ejecutar las veces
-- que haga falta y no toca ni una fila.
--
-- El aviso del vencimiento no se crea y el `sql/43` está ejecutado, así
-- que la causa es otra. En vez de seguir probando a ciegas —que es lo
-- que nos costó tres sesiones con las notas— se le pregunta
-- directamente a la base de datos las cuatro cosas que pueden estar
-- impidiéndolo:
--
--   1. que falte alguna columna
--   2. que una comprobación (`check`) rechace alguno de los valores
--   3. que `hogar_id` no se rellene solo, y entonces la seguridad de
--      fila lo tumbe
--   4. qué políticas gobiernan escribir en la agenda
--
-- Devuelve cuatro tablas. Mándamelas tal cual, aunque parezcan un
-- galimatías: cada una descarta una causa.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · ¿Están todas las columnas? ─────────────────────────
-- Esperado: 5 filas.
select
  '1 · columnas'                as apartado,
  table_name                    as tabla,
  column_name                   as columna,
  data_type                     as tipo,
  is_nullable                   as admite_nulo,
  coalesce(column_default, '—') as valor_por_defecto
from information_schema.columns
where (table_name = 'documentos'
       and column_name in ('fecha_vencimiento', 'se_renueva', 'preaviso_dias', 'avisar_con'))
   or (table_name = 'recordatorios' and column_name = 'motivo')
order by table_name, column_name;


-- ── 2 · ¿Qué valores acepta cada columna de recordatorios? ──
/*
  Aquí está el sospechoso número uno.

  HUBI intenta escribir un aviso con `tipo = 'vencimiento'`,
  `motivo = 'preaviso'` y `aviso_previo = '1_mes'`. Si alguna de esas
  columnas tiene una comprobación que no incluya alguno de esos tres
  valores, Postgres rechaza la fila entera — y el mensaje que llega
  arriba es exactamente el que estás viendo.

  Mira sobre todo si `aviso_previo` admite '1_mes', '1_semana' y
  '1_dia', y si `tipo` admite 'vencimiento'.
*/
select
  '2 · qué acepta' as apartado,
  con.conname      as comprobacion,
  pg_get_constraintdef(con.oid) as dice
from pg_constraint con
join pg_class    cl on cl.oid = con.conrelid
join pg_namespace ns on ns.oid = cl.relnamespace
where ns.nspname = 'public'
  and cl.relname = 'recordatorios'
  and con.contype in ('c', 'f')
order by con.conname;


-- ── 3 · ¿Se rellena solo el hogar? ─────────────────────────
/*
  Sospechoso número dos.

  La política de escritura de la agenda exige `hogar_id = mi_hogar()`.
  Nadie manda ese dato desde la aplicación: se rellena solo con
  `default mi_hogar()`. Si a `recordatorios` le falta ese valor por
  defecto, la fila nace sin casa y la seguridad la rechaza — y desde
  fuera se ve igual que un fallo de permisos.

  Tiene que decir `mi_hogar()`.
*/
select
  '3 · el hogar'  as apartado,
  column_name     as columna,
  coalesce(column_default, 'NO TIENE — aquí está el fallo') as valor_por_defecto
from information_schema.columns
where table_name = 'recordatorios'
  and column_name = 'hogar_id';


-- ── 4 · Quién puede escribir en la agenda ──────────────────
-- Por descarte, si lo de arriba está bien.
select
  '4 · permisos' as apartado,
  polname        as politica,
  case polcmd
    when 'r' then 'leer'
    when 'a' then 'crear'
    when 'w' then 'cambiar'
    when 'd' then 'borrar'
    else polcmd::text
  end as para,
  coalesce(pg_get_expr(polqual,      polrelid), '—') as condicion,
  coalesce(pg_get_expr(polwithcheck, polrelid), '—') as al_escribir
from pg_policy
where polrelid = 'public.recordatorios'::regclass
order by polcmd, polname;
