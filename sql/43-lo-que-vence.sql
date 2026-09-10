-- ═══════════════════════════════════════════════════════════════
-- LO QUE VENCE, LO QUE SE RENUEVA SOLO, Y EL DÍA QUE HAY QUE AVISAR
-- ═══════════════════════════════════════════════════════════════
--
-- QUÉ ESTABA MAL
--
-- Hasta hoy, cuando se guardaba un papel con fecha de vencimiento,
-- HUBI preguntaba «¿queréis que os avisemos?» y con la respuesta creaba
-- un recordatorio. Y ahí se acababa: EL PAPEL NO SE ACORDABA DE NADA.
--
-- Consecuencias, las tres reales:
--
--  · No se podía cambiar. Ni la fecha, ni el aviso, ni quitarlo. La
--    pantalla de corregir deja tocar el título, el importe y la
--    carpeta, y esto no, porque no había dónde guardarlo.
--  · Si el OCR no encontraba la fecha, no había forma de ponerla a
--    mano. La póliza que HUBI no supo leer no avisaba nunca.
--  · Al corregir la fecha del documento, el aviso se quedaba con la
--    vieja. Dos verdades distintas sobre el mismo papel.
--
-- Ahora el vencimiento es DEL PAPEL, y los avisos se deducen de él. Una
-- sola verdad; los recordatorios son su reflejo y se rehacen enteros
-- cada vez que el papel cambia.
--
-- ─────────────────────────────────────────────────────────────
-- Y LA PARTE NUEVA: LA FECHA QUE DE VERDAD IMPORTA NO ES LA DEL
-- VENCIMIENTO
--
-- Un contrato de hosting firmado el 8 de septiembre, de un año, que se
-- renueva solo salvo que avises con un mes de antelación.
--
-- La fecha importante NO es el 8 de septiembre del año que viene. Es el
-- 8 de AGOSTO: pasado ese día ya estás dentro de otro año entero,
-- quieras o no. Avisar el día del vencimiento es avisar un mes tarde —
-- llega puntual y no sirve absolutamente para nada.
--
-- Por eso se guardan tres cosas y no una: cuándo vence, si se renueva
-- solo, y con cuánto hay que avisar. Con eso HUBI calcula el último día
-- útil y pone ESE en el calendario, escrito como lo que hay que hacer y
-- no como una fecha: «Último día para cancelar el hosting».
--
-- Lo mismo vale para el seguro del coche, el del hogar, el gimnasio y
-- cualquier suscripción anual.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · Lo que ahora recuerda cada papel ───────────────────
/*
  `fecha_vencimiento` NO se crea aquí: existe desde el principio y el
  guardado ya la rellena cuando el OCR encuentra una fecha. Lo que
  faltaba era todo lo que la rodea — y sin eso, la fecha estaba guardada
  pero no se podía ni cambiar ni convertir en un aviso útil.
*/
alter table documentos
  add column if not exists se_renueva    boolean not null default false,
  add column if not exists preaviso_dias smallint,
  add column if not exists avisar_con    text not null default 'sin_aviso';

/*
  Las comprobaciones van sueltas y con `if not exists` a mano, porque
  `add constraint` no admite esa cláusula y ejecutar el archivo dos
  veces daría error justo en la mitad, dejando el resto sin aplicar.
*/
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documentos_avisar_con_valido'
  ) then
    alter table documentos add constraint documentos_avisar_con_valido
      check (avisar_con in ('sin_aviso', '1_dia', '1_semana', '1_mes'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'documentos_preaviso_razonable'
  ) then
    /* Hasta un año. Más que eso no es un preaviso, es un error de
       tecleo — y un aviso calculado a tres años vista sería ruido
       permanente en el calendario. */
    alter table documentos add constraint documentos_preaviso_razonable
      check (preaviso_dias is null or (preaviso_dias > 0 and preaviso_dias <= 365));
  end if;
end $$;

create index if not exists idx_documentos_vencen
  on documentos (fecha_vencimiento) where fecha_vencimiento is not null;


-- ── 2 · De dónde sale cada aviso ───────────────────────────
/*
  POR QUÉ HACE FALTA ESTA COLUMNA.

  Los avisos de un papel se REHACEN cada vez que se corrige el papel:
  se borran los que había y se vuelven a crear con los datos nuevos. Sin
  saber cuáles puso HUBI, ese borrado se llevaría por delante los
  recordatorios que hubiera puesto una persona sobre el mismo documento
  —«llamar a Silvia por lo del seguro»— y nadie sabría por qué han
  desaparecido.

  Así que solo se borra lo que lleva `motivo`. Lo que escribió una
  persona no lo toca nadie.

    vence    → el día del vencimiento
    preaviso → el último día para cancelar, antes de que se renueve
*/
alter table recordatorios
  add column if not exists motivo text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recordatorios_motivo_valido'
  ) then
    alter table recordatorios add constraint recordatorios_motivo_valido
      check (motivo is null or motivo in ('vence', 'preaviso'));
  end if;
end $$;

create index if not exists idx_recordatorios_de_papel
  on recordatorios (documento_origen_id, motivo)
  where documento_origen_id is not null;


-- ── 3 · Los avisos que ya había, marcados como suyos ───────
/*
  Los avisos de vencimiento creados hasta hoy no llevan `motivo`, así
  que la próxima corrección del papel no los tocaría: quedarían dos
  avisos del mismo vencimiento, el viejo con la fecha vieja y el nuevo
  con la buena, y ninguna forma de saber cuál manda mirando el
  calendario.

  Se adoptan. A partir de aquí se rehacen con el papel, como los demás.
*/
update recordatorios
   set motivo = 'vence'
 where motivo is null
   and tipo = 'vencimiento'
   and documento_origen_id is not null;


-- ── 4 · Comprobación ───────────────────────────────────────
/*
  Tienen que salir cinco filas: las tres columnas nuevas de
  `documentos`, la `fecha_vencimiento` que ya estaba, y el `motivo` de
  `recordatorios`. Si falta alguna, el archivo no se ha ejecutado
  entero.
*/
select table_name as tabla, column_name as columna, data_type as tipo
  from information_schema.columns
 where (table_name = 'documentos'
        and column_name in ('fecha_vencimiento', 'se_renueva', 'preaviso_dias', 'avisar_con'))
    or (table_name = 'recordatorios' and column_name = 'motivo')
 order by table_name, column_name;
