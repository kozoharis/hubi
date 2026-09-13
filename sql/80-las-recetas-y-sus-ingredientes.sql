-- ═══════════════════════════════════════════════════════════════
-- 80 · LAS RECETAS Y SUS INGREDIENTES
-- ═══════════════════════════════════════════════════════════════
--
-- Haris: *«las recetas deberían poder escribirse si es que no tienen
-- un enlace… y también un espacio donde añadir ingredientes, que
-- estarán vinculados con la compra»*.
--
-- Escribirla ya se podía a medias: `recetas.nota` existe desde el paso
-- 48. Lo que faltaba es que se ENSEÑE cuando hay enlace —la pared solo
-- la sacaba si no lo había— y lo que faltaba del todo son los
-- ingredientes.
--
-- ─────────────────────────────────────────────────────────────
-- Y LO BUENO ES LO DE «VINCULADOS CON LA COMPRA»
--
-- Un ingrediente escrito en una receta y luego copiado a mano a la
-- lista de la compra es trabajo doble hecho por una persona. Con esto,
-- en la pared sale un botón: **Añadir a la compra**, y entran los seis
-- de golpe.
--
-- Es exactamente el principio del punto 29: la complejidad la pone el
-- sistema, no Juan Miguel con un boli.
--
-- ─────────────────────────────────────────────────────────────
-- UNA COLUMNA `text[]`, Y NO UNA TABLA
--
-- Tentación: `ingredientes` como tabla, con cantidad, unidad y orden.
-- Sería lo «correcto» y aquí sería sobrearquitectura — el punto 22 lo
-- dice con todas las letras.
--
-- Un ingrediente de una receta de casa es una línea de texto: «medio
-- kilo de harina», «dos huevos». No se suma, no se filtra, no se
-- consulta por separado. Se lee y se manda a la compra tal cual.
--
-- Una tabla traería su clave, su RLS, sus políticas, su orden y su
-- borrado en cascada. Cinco cosas que mantener para guardar seis
-- líneas de texto.
--
-- ─────────────────────────────────────────────────────────────
-- NO HACE FALTA NINGUNA POLÍTICA NUEVA
--
-- Ni una. `recetas` ya tiene las suyas del paso 48, y una columna
-- nueva cae dentro de las que hay. Lo único que hay que comprobar es
-- que `authenticated` pueda ESCRIBIRLA — la trampa de siempre, que ya
-- nos ha mordido tres veces: si el UPDATE está dado por columnas, la
-- nueva nace sin permiso y el `update` no cambia nada EN SILENCIO.
--
-- CÓMO SE DESHACE
--
--     alter table recetas drop column ingredientes;

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.recetas') is null then
    raise exception 'ABORTADO: no existe `recetas`. Falta el paso 48.';
  end if;

  raise notice 'Puerta pasada. Recetas guardadas: %.', (select count(*) from recetas);
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA COLUMNA
-- ═══════════════════════════════════════════════════════════════
alter table recetas
  add column if not exists ingredientes text[];

comment on column recetas.ingredientes is
  'Lo que lleva, una linea por ingrediente. Se manda entero a la compra desde la pared. Paso 80.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · EL PERMISO DE ESCRIBIRLA
-- ═══════════════════════════════════════════════════════════════
/*
  Se MIDE antes de decidir, no se supone. Si `authenticated` tiene
  UPDATE a nivel de tabla, la columna nueva nace escribible; si lo
  tiene por columnas, hay que darla a mano.
*/
do $$
declare tiene_tabla boolean; tiene_insert boolean;
begin
  select has_table_privilege('authenticated', 'recetas', 'update') into tiene_tabla;
  select has_table_privilege('authenticated', 'recetas', 'insert') into tiene_insert;

  if tiene_tabla then
    raise notice 'UPDATE de tabla: si. La columna nueva nace escribible.';
  else
    execute 'grant update (ingredientes) on table recetas to authenticated';
    raise notice 'UPDATE por columnas: dado a mano el de `ingredientes`.';
  end if;

  if not tiene_insert then
    execute 'grant insert (ingredientes) on table recetas to authenticated';
    raise notice 'INSERT por columnas: dado a mano el de `ingredientes`.';
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 3 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  casa uuid; alguien uuid; laReceta uuid; salieron text[];
begin
  if not has_column_privilege('authenticated','recetas','ingredientes','update') then
    raise exception 'ABORTADO: `authenticated` no puede escribir `ingredientes`.';
  end if;
  raise notice 'El permiso de columna esta puesto.';

  select m.hogar_id, m.perfil_id into casa, alguien
    from miembros m
   where m.clase = 'persona' and m.aceptado_en is not null limit 1;

  if casa is null then
    raise notice 'No hay con quien probar. Se aplica igual.';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', alguien::text, true);
  set local role authenticated;

  insert into recetas (hogar_id, titulo, nota, ingredientes, creado_por)
       values (casa, 'Prueba del paso 80',
               'Se mezcla todo y al horno.',
               array['Medio kilo de harina', 'Dos huevos', 'Leche'],
               alguien)
    returning id into laReceta;

  select ingredientes into salieron from recetas where id = laReceta;
  reset role;

  if laReceta is null then
    raise exception 'ABORTADO: no se ha podido guardar una receta con ingredientes.';
  end if;

  if array_length(salieron, 1) <> 3 then
    raise exception 'ABORTADO: se guardaron 3 ingredientes y han vuelto %.',
      coalesce(array_length(salieron, 1), 0);
  end if;
  raise notice 'Una receta escrita, con sus 3 ingredientes. Bien.';

  /* Y se recoge: esto era una prueba. */
  delete from recetas where id = laReceta;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · La columna, puesta y escribible.
select
  column_name                                                          as la_casilla,
  data_type                                                            as de_que_tipo,
  has_column_privilege('authenticated','recetas','ingredientes','update')
                                                                       as se_puede_escribir_DEBE_SER_true
from information_schema.columns
where table_name = 'recetas' and column_name = 'ingredientes';

-- 2 · Y cómo están las recetas que ya hay. Recién dado el paso,
--     todas sin ingredientes — se van poniendo a mano.
select
  h.nombre                                                  as la_casa,
  r.titulo                                                  as la_receta,
  case when r.url is not null then 'con enlace' else 'escrita' end     as como_es,
  coalesce(array_length(r.ingredientes, 1), 0)              as cuantos_ingredientes
from recetas r
join hogares h on h.id = r.hogar_id
order by 1, 2;

commit;
