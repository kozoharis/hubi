-- ═══════════════════════════════════════════════════════════════
-- 92 · CADA CUÁNTO SE PAGA
-- ═══════════════════════════════════════════════════════════════
--
-- Haris, mirando la pantalla de los pagos fijos: *«deberías de tener
-- los botones de cada dos meses adicional o también una opción de que
-- tú lo pongas… cada cuánto se repite»*.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE HAY, Y POR QUÉ ESTABA ASÍ
--
-- El paso 47 dejó tres ritmos y lo dejó escrito con todas las letras:
--
--     «Cada cuánto. Tres y no más: mensual, trimestral y anual cubren
--      el recibo de la luz, el seguro del coche y la cuota del
--      dominio. Meter "cada 45 días" sería añadir una casilla que
--      nadie de esta casa va a usar nunca.»
--
-- Era una decisión correcta con la información de entonces, y conviene
-- no borrarla: se escribió para no inventar casillas. Lo que ha
-- cambiado no es el criterio, es el dato — ahora hay alguien usándolo
-- que dice que le falta una. Eso no es «añadir por si acaso»: es
-- justamente lo contrario.
--
-- Los dos huecos reales son el seguro que se paga en dos plazos y la
-- cuota semestral. Ninguno cabe en mensual, trimestral o anual.
--
-- ─────────────────────────────────────────────────────────────
-- UN NÚMERO, NO CUATRO PALABRAS MÁS
--
-- La tentación es añadir 'bimestral' y 'semestral' al check y seguir.
-- Y entonces dentro de un año hace falta «cada cuatro meses» y hay que
-- volver a tocar la base de datos, la API y la pantalla para una cosa
-- que siempre fue un número.
--
-- Así que la columna nueva es EL NÚMERO DE MESES. Los botones de la
-- pantalla —todos los meses, cada dos, cada tres, cada seis, una vez
-- al año— pasan a ser atajos para escribir 1, 2, 3, 6 y 12, y el
-- «otro» escribe el que sea. La pantalla puede cambiar sus atajos
-- cuantas veces quiera sin tocar nada de aquí.
--
-- `cada` NO se jubila y no se toca: sigue ahí, con sus tres valores y
-- su check, porque es lo que lee el código que todavía no conoce la
-- columna nueva. Queda como espejo, y el espejo se escribe siempre
-- redondeando HACIA ARRIBA —2 meses se guarda como 'trimestral'— por
-- el motivo del paso 47: un periodo de más genera un apunte previsto
-- de más, y eso infla el balance. Un periodo de menos sólo hace que
-- falte una previsión, que se ve enseguida y no miente en las cuentas.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ NO CAMBIA
--
-- Nada de lo que hay. Los pagos existentes se rellenan con el número
-- que ya tenían (1, 3 ó 12), así que siguen generando exactamente los
-- mismos periodos. Y si esto no se ejecuta, el código pide la columna,
-- la base dice que no la conoce, y se vuelve a pedir sin ella: se
-- pierde poder elegir «cada dos meses», no los pagos fijos.
--
-- **Una columna nueva nunca puede ser obligatoria para lo que ya
-- funcionaba.** Es la octava vez que se escribe en este proyecto.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     alter table pagos_fijos drop column if exists cada_meses;
--
-- Se pierde el ritmo exacto de los que no sean 1, 3 ó 12; cada uno de
-- ésos pasa a comportarse como diga su `cada`.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $p92$
begin
  if to_regclass('public.pagos_fijos') is null then
    raise exception 'ABORTADO: no existe `pagos_fijos`. Falta el paso 47.';
  end if;

  raise notice 'Puerta pasada. Pagos fijos activos ahora mismo: %.',
    (select count(*) from pagos_fijos where activo);
end $p92$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA COLUMNA
-- ═══════════════════════════════════════════════════════════════
/*
  Entre 1 y 36. El techo no es por capricho: `periodosLlegados` corta
  en 24 vueltas, así que un ritmo de más de tres años no generaría
  nunca nada y sería una casilla que se puede rellenar y no hace nada.
  Y el suelo es 1 porque medio mes no es un mes.
*/
alter table pagos_fijos
  add column if not exists cada_meses smallint;

do $p92$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pagos_fijos_cada_meses_valido'
  ) then
    alter table pagos_fijos
      add constraint pagos_fijos_cada_meses_valido
      check (cada_meses is null or (cada_meses between 1 and 36));
  end if;
end $p92$;

comment on column pagos_fijos.cada_meses is
  'Cada cuantos meses se repite. Manda sobre `cada`, que se queda de espejo para el codigo viejo. Nulo = usa `cada`. Paso 92.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · Y LO QUE YA ESTABA, CON SU NÚMERO
-- ═══════════════════════════════════════════════════════════════
/*
  Para que la columna nueva sea la verdad desde el primer minuto y no
  haya que preguntarle a las dos en cada consulta. Sólo toca las que
  están vacías: ejecutar esto dos veces no cambia nada la segunda.
*/
update pagos_fijos
   set cada_meses = case cada
                      when 'mensual'    then 1
                      when 'trimestral' then 3
                      when 'anual'      then 12
                      else 1
                    end
 where cada_meses is null;

commit;


-- ═══════════════════════════════════════════════════════════════
-- 3 · COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta esto después, una consulta cada vez, y mira que sale lo que
-- pone. Si algo no cuadra, NO sigas: dimelo y lo miramos.

-- 3.1 · La columna esta, y admite vacios.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'pagos_fijos' and column_name = 'cada_meses';
-- ESPERADO: una fila. `smallint`, `YES`.

-- 3.2 · Ninguno se ha quedado sin numero.
select count(*) as sin_numero from pagos_fijos where cada_meses is null;
-- ESPERADO: 0.

-- 3.3 · Y cada uno tiene el numero que le toca por su palabra.
select cada, cada_meses, count(*) as cuantos
from pagos_fijos
group by cada, cada_meses
order by cada;
-- ESPERADO: mensual→1, trimestral→3, anual→12. Si sale otra pareja,
-- AVISA: quiere decir que alguien ya habia escrito un ritmo a mano.

-- 3.4 · No se ha perdido ninguno.
select count(*) as activos from pagos_fijos where activo;
-- ESPERADO: los mismos que decia el aviso de la puerta, arriba.
