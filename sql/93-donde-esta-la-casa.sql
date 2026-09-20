-- ═══════════════════════════════════════════════════════════════
-- 93 · DÓNDE ESTÁ LA CASA
-- ═══════════════════════════════════════════════════════════════
--
-- Haris: *«el tiempo que se refleja en la cocina no está bien»*.
--
-- No estaba estropeado: estaba puesto en Tenerife. Y no por error —
-- estaba escrito a mano, con todas las letras, en dos sitios:
--
--     lib/tiempo.ts   lat 28.39, lon -16.59   el norte de Tenerife
--     lib/tablon.ts   ZONA = 'Atlantic/Canary'
--
-- Las dos vienen del planteamiento original —Juan Miguel, Conchita,
-- Los Realejos— y ahí se quedaron cuando la aplicación se mudó.
--
-- ─────────────────────────────────────────────────────────────
-- Y LA SEGUNDA NO ES EL TIEMPO: ES QUÉ DÍA ES HOY
--
-- Esto es lo serio de este paso y conviene que quede escrito.
--
-- `ZONA` gobierna `hoyAqui()`, y `hoyAqui()` decide qué es «hoy» en
-- toda la aplicación: lo de hoy en la agenda, lo vencido, el día que
-- se apunta un gasto, cuándo le toca a un pago fijo. Con la zona de
-- Canarias puesta en una casa de la península, entre las 00:00 y las
-- 01:00 —las 02:00 en verano— mappel cree que todavía es ayer.
--
-- Una tarea apuntada a las 00:30 cae en el día anterior, y sale ya
-- vencida. Nadie relaciona eso nunca con un huso horario.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ UNA COLUMNA Y NO LA GEOLOCALIZACIÓN DEL APARATO
--
-- Porque una casa no se mueve, y preguntarle a un sensor por un dato
-- que es constante es aceptar que un día conteste otra cosa. Sin GPS
-- —una tablet de cocina en un wifi— la posición sale de triangular
-- redes, y eso coloca a cualquiera en el pueblo de al lado.
--
-- Y hay un motivo más fuerte: en el móvil, la ubicación del aparato
-- daría el tiempo de DONDE ESTÁ QUIEN MIRA. Y lo que se quiere saber
-- desde fuera es si en casa está lloviendo.
--
-- La ubicación del aparato sí entra, pero en su sitio: como un botón
-- que RELLENA esta casilla una vez, al configurarla, para no tener
-- que buscar el pueblo. Un atajo para escribir un dato, no la fuente
-- del dato.
--
-- ─────────────────────────────────────────────────────────────
-- CUATRO COLUMNAS Y NINGUNA OBLIGATORIA
--
--     sitio_nombre   «Madrid» · sólo para poder enseñarlo
--     sitio_lat      lo que pide la previsión
--     sitio_lon      lo mismo
--     sitio_zona     «Europe/Madrid»
--
-- `sitio_zona` se guarda aunque hoy sólo la use la previsión —para
-- pedirle a Open-Meteo los días partidos por la medianoche de allí y
-- no por la de Londres—. **Todavía NO manda sobre `hoyAqui()`**, que
-- sigue siendo una constante del despliegue, y eso está bien mientras
-- todas las casas estén en el mismo huso. El día que haya una casa en
-- Canarias y otra en Madrid habrá que llevarla hasta ahí, y entonces
-- el dato ya estará guardado en vez de haber que preguntarlo otra vez.
--
-- Vacías quieren decir «lo que diga el código», que a partir de hoy es
-- Madrid. O sea que esto se puede no ejecutar y la aplicación se
-- comporta igual de bien: **una columna nueva nunca puede ser
-- obligatoria para lo que ya funcionaba.** Es la novena vez.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     alter table hogares
--       drop column if exists sitio_nombre,
--       drop column if exists sitio_lat,
--       drop column if exists sitio_lon,
--       drop column if exists sitio_zona;
--
-- Se pierde el sitio elegido y vuelve a mandar el del código.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $p93$
begin
  if to_regclass('public.hogares') is null then
    raise exception 'ABORTADO: no existe `hogares`.';
  end if;

  raise notice 'Puerta pasada. Casas: %.', (select count(*) from hogares);
end $p93$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LAS CUATRO COLUMNAS
-- ═══════════════════════════════════════════════════════════════
alter table hogares
  add column if not exists sitio_nombre text,
  add column if not exists sitio_lat numeric(8,4),
  add column if not exists sitio_lon numeric(9,4),
  add column if not exists sitio_zona text;

/*
  Con su comprobación de cordura. No es paranoia: estos tres números
  van a salir de un buscador de pueblos y de un sensor, y los dos
  pueden devolver cualquier cosa un mal día. Una latitud de 900 no
  rompe nada visible — simplemente la previsión deja de llegar y esa
  esquina de la pared desaparece sin decir por qué.
*/
do $p93$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'hogares_sitio_valido'
  ) then
    alter table hogares
      add constraint hogares_sitio_valido check (
        (sitio_lat is null or (sitio_lat >= -90  and sitio_lat <= 90))
        and
        (sitio_lon is null or (sitio_lon >= -180 and sitio_lon <= 180))
      );
  end if;
end $p93$;

comment on column hogares.sitio_nombre is
  'Como se llama el sitio de la casa. Solo para enseñarlo. Paso 93.';
comment on column hogares.sitio_lat is
  'Latitud de la casa, para la prevision del tiempo. Nulo = la del codigo. Paso 93.';
comment on column hogares.sitio_lon is
  'Longitud de la casa. Nulo = la del codigo. Paso 93.';
comment on column hogares.sitio_zona is
  'Huso horario del sitio (Europe/Madrid). Hoy solo lo usa la prevision; hoyAqui() sigue siendo una constante del despliegue. Paso 93.';

commit;


-- ═══════════════════════════════════════════════════════════════
-- 2 · Y SI QUIERES DEJARLO PUESTO SIN ENTRAR EN AJUSTES
-- ═══════════════════════════════════════════════════════════════
/*
  NO hace falta: desde Ajustes → La casa se busca el pueblo y se
  guarda. Esto es sólo el atajo, por si prefieres dejarlo hecho ahora.

  Quita las dos barras de delante para ejecutarlo. Madrid capital:
*/
-- update hogares
--    set sitio_nombre = 'Madrid',
--        sitio_lat    = 40.4168,
--        sitio_lon    = -3.7038,
--        sitio_zona   = 'Europe/Madrid'
--  where sitio_lat is null;


-- ═══════════════════════════════════════════════════════════════
-- 3 · COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta esto después, una consulta cada vez, y mira que sale lo que
-- pone. Si algo no cuadra, NO sigas: dimelo y lo miramos.

-- 3.1 · Las cuatro columnas estan, y las cuatro admiten vacios.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'hogares' and column_name like 'sitio%'
order by column_name;
-- ESPERADO: cuatro filas, las cuatro `YES`.

-- 3.2 · Y no se ha perdido ninguna casa.
select count(*) as casas from hogares;
-- ESPERADO: las mismas que decia el aviso de la puerta, arriba.

-- 3.3 · Que sitio tiene cada una ahora mismo.
select nombre, sitio_nombre, sitio_lat, sitio_lon, sitio_zona
from hogares order by creado_en;
-- ESPERADO: todo vacio, si no has ejecutado el atajo de arriba. Con
-- las columnas vacias manda el codigo, que a partir de hoy es Madrid.
