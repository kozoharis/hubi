-- ═══════════════════════════════════════════════════════════════
-- 94 · Y EL PERMISO DE ESCRIBIRLO
-- ═══════════════════════════════════════════════════════════════
--
--     No se ha podido guardar el cambio.
--     permission denied for table hogares
--
-- El paso 93 creó las cuatro columnas del sitio y están bien. Lo que
-- falta es el permiso de ESCRIBIRLAS, que en `hogares` no va por
-- tabla: va por columna.
--
-- ─────────────────────────────────────────────────────────────
-- LA TRAMPA, Y ESTÁ PUESTA A PROPÓSITO
--
-- El paso 69 hizo esto, y con buen criterio:
--
--     revoke update on table hogares from authenticated;
--     grant  update (nombre, usa_compra, impuesto) on table hogares
--       to authenticated;
--
-- Porque en `hogares` hay columnas que la aplicación NO debe escribir
-- nunca: `id`, que referencian catorce tablas; `creado_en`; y
-- `tipos_en_casa` y `notas_en_casa`, que las escribe una función
-- `security definer` para que no puedan quedarse diciendo una cosa
-- mientras las filas dicen otra.
--
-- El efecto secundario es éste: **cualquier columna nueva de
-- `hogares` nace sin permiso de escritura y nadie se entera hasta que
-- alguien intenta guardar**. Y Postgres lo dice de una manera que
-- parece un problema de la tabla entera —«permission denied for table
-- hogares»— cuando en realidad sobra el permiso de una columna.
--
-- Este proyecto ya se había avisado a sí mismo de esto: el paso 89
-- comprueba a propósito que en `compra` no haya permisos por columna,
-- *«o la tableta podría asignar y no guardarse nada»*. Aquí sí los
-- hay, y hoy se ha visto por qué se comprueba.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  LA REGLA QUE HAY QUE RECORDAR
--
-- **Cada columna nueva de `hogares` que Ajustes tenga que escribir
-- hay que añadirla a la lista de abajo.** No hay manera de que salte
-- solo: lo único que se puede hacer es dejarlo escrito aquí y en el
-- paso 69, y comprobarlo con la consulta del final.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ NO CAMBIA
--
-- Nada de lo que ya se podía escribir, y nada de lo que no. Se vuelve
-- a poner el mismo permiso con cuatro columnas más — las cuatro del
-- sitio, que son las que la pantalla de Ajustes tiene que guardar.
--
-- `id`, `creado_en`, `clase`, `tipos_en_casa` y `notas_en_casa` siguen
-- fuera, que es donde tienen que estar.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     revoke update on table hogares from authenticated;
--     grant  update (nombre, usa_compra, impuesto) on table hogares
--       to authenticated;
--
-- Se vuelve a no poder guardar el sitio de la casa.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $p94$
begin
  if to_regclass('public.hogares') is null then
    raise exception 'ABORTADO: no existe `hogares`.';
  end if;

  /* Sin las columnas del 93, este permiso no se puede dar: Postgres
     no deja dar permiso sobre una columna que no existe, y el error
     que daría no diría que falta el paso anterior. */
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'hogares' and column_name = 'sitio_lat'
  ) then
    raise exception 'ABORTADO: falta el paso 93. Ejecutalo antes que este.';
  end if;

  raise notice 'Puerta pasada. Columnas de hogares que se pueden escribir ahora: %.',
    (select count(*) from information_schema.column_privileges
      where table_name = 'hogares'
        and grantee = 'authenticated'
        and privilege_type = 'UPDATE');
end $p94$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · EL PERMISO, CON LAS CUATRO NUEVAS DENTRO
-- ═══════════════════════════════════════════════════════════════
/*
  Se revoca y se vuelve a dar entero en vez de añadir las cuatro
  sueltas. Así esta lista es LA lista: quien lea este archivo ve de un
  vistazo todo lo que la aplicación puede escribir en `hogares`, sin
  tener que juntarlo con lo que puso el paso 69.
*/
revoke update on table hogares from authenticated;

grant update (
  nombre,
  usa_compra,
  impuesto,
  sitio_nombre,
  sitio_lat,
  sitio_lon,
  sitio_zona
) on table hogares to authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════
-- 2 · COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta esto después y mira que sale lo que pone.

-- 2.1 · Que se puede escribir, y que NO se puede escribir.
select column_name
from information_schema.column_privileges
where table_name = 'hogares'
  and grantee = 'authenticated'
  and privilege_type = 'UPDATE'
order by column_name;
-- ESPERADO: exactamente estas siete, ni una mas:
--   impuesto · nombre · sitio_lat · sitio_lon · sitio_nombre ·
--   sitio_zona · usa_compra
--
-- Si aparece `id`, `creado_en`, `tipos_en_casa` o `notas_en_casa`,
-- AVISA: alguien ha dado el permiso de la tabla entera y eso deshace
-- el paso 69.

-- 2.2 · Y que sigue habiendo politica de UPDATE, que es la otra mitad.
select polname
from pg_policy
where polrelid = 'public.hogares'::regclass and polcmd = 'w';
-- ESPERADO: `hogares_editar`. El permiso dice QUE columnas; la
-- politica dice QUE FILAS —solo las de tu casa, y solo si mandas en
-- ella—. Hacen falta las dos.
