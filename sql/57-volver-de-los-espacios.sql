-- ═══════════════════════════════════════════════════════════════
-- 57 · VOLVER DE LOS ESPACIOS
-- ═══════════════════════════════════════════════════════════════
--
-- Deshace el 56 y deja la base de datos como estaba antes.
--
-- ─────────────────────────────────────────────────────────────
-- NO DESHACE DE MEMORIA
--
-- Este archivo no sabe cómo eran las políticas. Las lee de la copia
-- que guardó el 56 antes de tocar nada, y las vuelve a poner letra por
-- letra.
--
-- Escribir la vuelta a mano habría sido escribir sesenta y tres
-- condiciones de seguridad otra vez, de memoria, para ejecutarlas
-- precisamente el día en que algo ha ido mal y hay prisa. Un fallo ahí
-- no se descubre: se queda.
--
-- ─────────────────────────────────────────────────────────────
-- CUÁNDO SE USA
--
-- Si después del 56 algo no va: no se guarda, una pantalla sale vacía,
-- las cuentas cambian de cifra.
--
-- Se ejecuta entero y HUBI vuelve a estar como esta mañana. Después ya
-- miramos qué pasó, con calma.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ NO DESHACE, Y POR QUÉ NO HACE FALTA
--
-- Las funciones nuevas —`soy_de()` y las cinco que reciben el
-- espacio— se quedan puestas. No estorban: nadie las llama una vez
-- restauradas las políticas viejas, y borrarlas sería una operación
-- más que puede fallar en el momento de más prisa.
--
-- Tampoco se toca el código de la aplicación. Las 239 consultas que
-- dicen su espacio siguen funcionando con las políticas viejas: con un
-- espacio activo, `hogar_id = mi_hogar()` y `.eq('hogar_id', <ese
-- mismo>)` dan lo mismo. Es lo que se comprobó desplegando el paso 1.

begin;

set local statement_timeout = '120s';

do $$
declare
  p       record;
  cuantas int;
  hechas  int := 0;
begin
  select count(*) into cuantas from politicas_antes_de_los_espacios;

  if cuantas = 0 then
    raise exception
      'No hay copia de las políticas. Este archivo no puede inventarse cómo eran: no se sigue.';
  end if;

  raise notice 'Restaurando % políticas de la copia del %.',
    cuantas, (select max(guardadas_en) from politicas_antes_de_los_espacios);

  for p in
    select * from politicas_antes_de_los_espacios order by tabla, politica
  loop
    execute format('drop policy if exists %I on public.%I', p.politica, p.tabla);
    execute format(
      'create policy %I on public.%I as %s for %s to %s%s%s',
      p.politica, p.tabla,
      case p.permisiva when 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      case p.orden when 'ALL' then 'all' else lower(p.orden) end,
      array_to_string(p.papeles, ', '),
      case when p.condicion    is not null then ' using (' || p.condicion || ')' else '' end,
      case when p.comprobacion is not null then ' with check (' || p.comprobacion || ')' else '' end
    );
    hechas := hechas + 1;
  end loop;

  raise notice 'Políticas restauradas: %', hechas;
end $$;


/* Y los valores por defecto que quitó el 56. Se vuelven a poner
   exactamente como estaban, con su texto guardado. */
do $$
declare d record; puestos int := 0;
begin
  for d in select * from defectos_antes_de_los_espacios order by tabla, columna
  loop
    execute format('alter table public.%I alter column %I set default %s',
                   d.tabla, d.columna, d.defecto);
    puestos := puestos + 1;
  end loop;
  raise notice 'Valores por defecto restaurados: %', puestos;
end $$;


/*
  Y se vacía la copia.

  No por limpieza: porque una copia vieja es peor que ninguna. Si
  mañana se vuelve a intentar el 56, tiene que hacer una foto NUEVA de
  cómo estén las políticas entonces. Con la foto de hoy guardada, el 56
  se la saltaría —«ya hay copia»— y la vuelta atrás del segundo intento
  restauraría un estado de hace semanas.

  Va dentro de la misma transacción que la restauración: si algo falla
  arriba, esto tampoco ocurre y la copia sigue intacta.
*/
delete from politicas_antes_de_los_espacios;
delete from defectos_antes_de_los_espacios;


-- ── Comprobación ──────────────────────────────────────────────
/*
  Tiene que salir `soy_de` en cero y `mi_hogar` en el número de antes.
  Si `soy_de` no es cero, alguna política se quedó sin restaurar y hay
  que mirar cuál antes de dar esto por bueno.
*/
select
  count(*) filter (where coalesce(qual, '') || coalesce(with_check, '') ~ 'soy_de')   as con_soy_de,
  count(*) filter (where coalesce(qual, '') || coalesce(with_check, '') ~ 'mi_hogar') as con_mi_hogar,
  count(*)                                                                            as en_total
from pg_policies
where schemaname = 'public';

commit;
