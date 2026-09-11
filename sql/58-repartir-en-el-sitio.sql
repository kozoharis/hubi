-- ═══════════════════════════════════════════════════════════════
-- 58 · REPARTIR EN EL SITIO
-- ═══════════════════════════════════════════════════════════════
--
-- Los dos cabos que dejó suelto el paso 2, y que el paso 3 convirtió
-- en un fallo de verdad.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ PASA
--
-- `poner_rol()` y `poner_color()` son las dos acciones de Ajustes que
-- tocan a otra persona: ponerle un rol y ponerle un color. No son
-- políticas, así que la migración de las 63 no las tocó — y siguen
-- averiguando la casa con `mi_hogar()`, o sea con `casa_activa`.
--
-- Mientras el espacio era global, eso acertaba siempre. Desde el paso
-- 3 ya no: la pestaña puede estar en el espacio de un cliente mientras
-- `casa_activa` apunta a tu casa. Entonces abres Ajustes del cliente,
-- le cambias el rol a alguien, y **se lo cambias a alguien de tu
-- casa** — a la persona que tenga ese mismo identificador allí, si la
-- hay; y si no la hay, salta un «esa persona no está en tu casa» que
-- no se entiende, porque la estás viendo en la pantalla.
--
-- No lo introdujo el paso 3: estaba desde el 37. Lo que hizo el paso 3
-- fue hacerlo alcanzable.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE ARREGLA
--
-- Igual que las cinco de antes: reciben la casa en vez de adivinarla.
-- Las de siempre se quedan como están, por si algo fuera de la
-- aplicación las llama.
--
-- Y NO SE TRANSCRIBEN. Se leen del catálogo tal como están y se les
-- cambian dos cosas: la firma y el `mi_hogar()`. Copiar a mano el
-- cuerpo de una función que reparte permisos es exactamente donde se
-- cuela un `and` que debía ser un `or`.

begin;

do $$
declare
  viejo text;
  nuevo text;
  cuantas int := 0;
  f record;
begin
  for f in
    select
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as argumentos
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('poner_rol', 'poner_color')
      and p.pronargs = 2
  loop
    viejo := pg_get_functiondef(f.oid);

    /* La firma: una casa por delante. */
    nuevo := replace(
      viejo,
      format('%s(%s)', f.proname, f.argumentos),
      format('%s(casa_dicha uuid, %s)', f.proname, f.argumentos)
    );

    if nuevo = viejo then
      raise exception 'No he sabido reescribir la firma de %(%)', f.proname, f.argumentos;
    end if;

    /* Y la casa, que ya no se adivina. */
    if nuevo !~ 'mi_hogar\(\)' then
      raise exception '%(%) ya no llama a mi_hogar(). Míralo antes de seguir.',
        f.proname, f.argumentos;
    end if;
    nuevo := replace(nuevo, 'mi_hogar()', 'casa_dicha');

    execute nuevo;
    cuantas := cuantas + 1;
  end loop;

  if cuantas <> 2 then
    raise exception 'Esperaba reescribir dos funciones y he reescrito %.', cuantas;
  end if;

  raise notice 'Reescritas: % (poner_rol y poner_color, con la casa por delante)', cuantas;
end $$;

revoke all on function poner_rol(uuid, uuid, text)   from public;
revoke all on function poner_color(uuid, uuid, text) from public;
grant execute on function poner_rol(uuid, uuid, text)   to authenticated;
grant execute on function poner_color(uuid, uuid, text) to authenticated;


-- ── Comprobación ──────────────────────────────────────────────
/*
  Tienen que salir cuatro filas: las dos de siempre, con dos
  argumentos, y las dos nuevas con tres. Y las nuevas, sin rastro de
  `mi_hogar`.
*/
select
  p.proname,
  pg_get_function_identity_arguments(p.oid)     as argumentos,
  p.prosrc ~ 'mi_hogar'                          as adivina_la_casa
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('poner_rol', 'poner_color')
order by p.proname, p.pronargs;

commit;
