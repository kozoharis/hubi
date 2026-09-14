-- ═══════════════════════════════════════════════════════════════
-- 81 · EL PLATO QUE VUELVE, Y LO QUE HACE FALTA PARA HACERLO
-- ═══════════════════════════════════════════════════════════════
--
-- Haris, de una vez:
--
--   *«poder crearlo en un solo sitio y luego asignarle el día o días
--   que se repite en la semana, si es comida o cena y si se repite
--   cada semana, cada dos o cada tres… y siempre hay que hacer una
--   checklist para que se pueda hacer, si no que se haga otro»*.
--
-- Son dos cosas y las dos caben en la tabla que ya hay.
--
-- ─────────────────────────────────────────────────────────────
-- 1 · POR QUÉ NO HAY TABLA DE «PLANES»
--
-- La tentación era una tabla `planes_menu`: receta, día de la semana,
-- momento, cada cuántas semanas, desde, hasta. Y luego una vista o un
-- proceso que la convirtiera en días.
--
-- Sería lo «correcto» y aquí sobra. Lo que se guarda al final es lo
-- mismo que ya se guardaba —**un plato en un día concreto**— y la
-- tabla `menus` ya lo hace, con su índice de una comida y una cena por
-- día. Lo único que faltaba era saber que veinticuatro de esas filas
-- nacieron juntas. Eso es una columna, no una tabla.
--
-- Con tabla aparte habría dos verdades sobre qué se come el viernes:
-- la del plan y la de la fila. El día que alguien cambie una sola
-- cena, hay que decidir cuál manda. Sin ella no hay nada que decidir.
--
-- ─────────────────────────────────────────────────────────────
-- 2 · TRES MESES POR DELANTE, Y ESTO CONTRADICE AL PASO 11
--
-- El sql/11 dejó escrito, para las tareas que se repiten, que **no se
-- generan las doce del año por adelantado**: se crea la siguiente al
-- marcar hecha la actual. La razón era buena — con doce por delante el
-- calendario se llena de cosas que no han pasado y «hecho» deja de
-- significar nada.
--
-- Aquí se hace lo contrario, A PROPÓSITO, porque el motivo de allí no
-- existe aquí:
--
--   · **Un menú no se marca hecho.** No hay nada que se vacíe de
--     sentido.
--   · **Verlo por delante ES la función.** Un menú que solo aparece el
--     día que toca no sirve para planificar ni para comprar. Una tarea
--     recuerda; un menú se prepara.
--
-- Se escriben tres meses. Cuando se acaben, hay un botón para alargar
-- otros tres. No es infinito por una razón práctica: un plan que se
-- extiende solo para siempre es un plan que nadie revisa nunca.
--
-- ─────────────────────────────────────────────────────────────
-- 3 · Y LO QUE YA ESTÉ PUESTO NO SE PISA
--
-- Si el viernes 3 ya tiene cena, el plan **lo salta** y lo dice. Nunca
-- borra lo que decidió una persona para poner lo que decidió una
-- regla. Es la misma línea que ya gobierna todo el proyecto desde el
-- paso 69b.
--
-- ─────────────────────────────────────────────────────────────
-- 4 · «¿TIENES TODO ESTO?»
--
-- `comprobado_en` y `faltan` son la lista de comprobación. Un menú sin
-- comprobar no está mal: está sin mirar, y eso se ve de un vistazo en
-- la semana. Un menú comprobado con cosas en `faltan` es el que dice
-- «esto no se puede hacer todavía» — que es exactamente lo que pedía
-- Haris para poder cambiarlo por otro a tiempo.
--
-- El aviso de fecha NO se inventa aquí. Las listas de la compra ya
-- tienen `fecha`, `hora` y un `recordatorio_id` en la Agenda desde el
-- paso 23. Lo que falta va a una lista con fecha, y esa lista ya avisa.
--
-- ─────────────────────────────────────────────────────────────
-- NINGUNA POLÍTICA NUEVA
--
-- `menus` ya tiene las suyas (48, y luego el modelo de niveles). Una
-- columna nueva cae dentro. Lo único que hay que COMPROBAR —y se
-- comprueba, no se supone— es que `authenticated` pueda escribirlas:
-- si el permiso estuviera dado por columnas, las nuevas nacen sin él y
-- el `update` no cambia nada EN SILENCIO. Van tres veces en este
-- proyecto.
--
-- CÓMO SE DESHACE
--
--     alter table menus
--       drop column grupo_id, drop column cada_semanas,
--       drop column repite_hasta, drop column comprobado_en,
--       drop column faltan;

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.menus') is null then
    raise exception 'ABORTADO: no existe `menus`. Falta el paso 48.';
  end if;
  if to_regclass('public.listas_compra') is null then
    raise exception 'ABORTADO: no existe `listas_compra`. Falta el paso 23.';
  end if;

  raise notice 'Puerta pasada. Menus guardados: %.', (select count(*) from menus);
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LAS COLUMNAS
-- ═══════════════════════════════════════════════════════════════

/* Los que nacieron de la misma decisión. Null = puesto a mano, suelto. */
alter table menus add column if not exists grupo_id uuid;

/* Cada cuántas semanas vuelve: 1, 2 o 3. Es lo que se pidió y no hay
   que abrirlo más — «cada cuatro semanas» no lo dice nadie en una
   casa, dice «una vez al mes», y eso ya es otra cosa. */
alter table menus add column if not exists cada_semanas smallint;

/* Hasta dónde se ha escrito ya. El botón de alargar mira aquí para
   saber por dónde seguir sin repetir lo que hay. */
alter table menus add column if not exists repite_hasta date;

/* Cuándo se miró si estaban los ingredientes. Null = sin mirar. */
alter table menus add column if not exists comprobado_en timestamptz;

/* Lo que faltaba cuando se miró. Vacío y comprobado = se puede hacer. */
alter table menus add column if not exists faltan text[];

comment on column menus.grupo_id is
  'Los menus que nacieron de la misma decision de repetir. Paso 81.';
comment on column menus.cada_semanas is
  'Cada cuantas semanas vuelve: 1, 2 o 3. Paso 81.';
comment on column menus.repite_hasta is
  'Hasta que fecha se ha escrito ya la tanda. Paso 81.';
comment on column menus.comprobado_en is
  'Cuando se miro si estaban los ingredientes. Null = sin mirar. Paso 81.';
comment on column menus.faltan is
  'Lo que faltaba al mirarlo. Comprobado y vacio = se puede hacer. Paso 81.';


-- ── El límite de 1, 2 o 3, puesto una sola vez ──
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'menus_cada_semanas_valido'
  ) then
    alter table menus
      add constraint menus_cada_semanas_valido
      check (cada_semanas is null or cada_semanas in (1, 2, 3));
    raise notice 'Puesto el limite de 1, 2 o 3 semanas.';
  else
    raise notice 'El limite de semanas ya estaba.';
  end if;
end $$;


/* Para quitar o alargar una tanda entera sin recorrer la tabla. */
create index if not exists idx_menus_grupo
  on menus (hogar_id, grupo_id) where grupo_id is not null;


-- ═══════════════════════════════════════════════════════════════
-- 2 · EL PERMISO DE ESCRIBIRLAS
-- ═══════════════════════════════════════════════════════════════
/*
  Se MIDE. Si `authenticated` tiene UPDATE de tabla, las columnas
  nuevas nacen escribibles; si lo tiene por columnas, hay que darlas a
  mano una por una.
*/
do $$
declare
  laColumna text;
  tieneUpdate boolean;
  tieneInsert boolean;
begin
  select has_table_privilege('authenticated', 'menus', 'update') into tieneUpdate;
  select has_table_privilege('authenticated', 'menus', 'insert') into tieneInsert;

  if tieneUpdate and tieneInsert then
    raise notice 'Permisos de tabla: si. Las columnas nuevas nacen escribibles.';
  else
    foreach laColumna in array array[
      'grupo_id', 'cada_semanas', 'repite_hasta', 'comprobado_en', 'faltan'
    ] loop
      if not tieneUpdate then
        execute format('grant update (%I) on table menus to authenticated', laColumna);
      end if;
      if not tieneInsert then
        execute format('grant insert (%I) on table menus to authenticated', laColumna);
      end if;
    end loop;
    raise notice 'Permisos por columnas: dados a mano los de las cinco nuevas.';
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 3 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  laColumna text;
  casa uuid; alguien uuid;
  elGrupo uuid := gen_random_uuid();
  cuantos int;
  volvieron text[];
  colado boolean := false;
  elDia date := (current_date + 400);   -- lejos, para no tocar ninguna semana real
begin
  -- 3.1 · Las cinco, escribibles.
  foreach laColumna in array array[
    'grupo_id', 'cada_semanas', 'repite_hasta', 'comprobado_en', 'faltan'
  ] loop
    if not has_column_privilege('authenticated', 'menus', laColumna, 'update') then
      raise exception 'ABORTADO: `authenticated` no puede escribir `%`.', laColumna;
    end if;
  end loop;
  raise notice 'Las cinco columnas son escribibles.';

  /*
    3.2 · El límite hace su trabajo.

    OJO CON LA FORMA DE ESTO. La primera versión ponía el
    `raise exception 'ABORTADO'` DENTRO del bloque, justo detrás del
    insert. Y un `raise` dentro de un bloque con `when others` lo caza
    su propio manejador: el fallo se convertía en un aviso tranquilo y
    el guion seguía como si todo estuviera bien.

    Una comprobación que no puede fallar no es una comprobación. Así
    que el bloque solo levanta una bandera y quien decide está fuera.
  */
  begin
    insert into menus (hogar_id, fecha, momento, que, cada_semanas)
    select id, elDia, 'comida', 'No deberia entrar', 7 from hogares limit 1;
    colado := true;
  exception
    when check_violation then
      raise notice 'El limite rechaza 7 semanas. Bien.';
    when others then
      /* Sin casas en esta base no hay nada que insertar; no es un fallo. */
      raise notice 'No se ha podido probar el limite (no hay casas). Se sigue.';
  end;

  if colado then
    delete from menus where que = 'No deberia entrar';
    raise exception 'ABORTADO: ha entrado `cada_semanas = 7` y no debia.';
  end if;

  -- 3.3 · Y una tanda de verdad, con la sesión de alguien.
  select m.hogar_id, m.perfil_id into casa, alguien
    from miembros m
   where m.clase = 'persona' and m.aceptado_en is not null limit 1;

  if casa is null then
    raise notice 'No hay con quien probar. Se aplica igual.';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', alguien::text, true);
  set local role authenticated;

  insert into menus (hogar_id, fecha, momento, que, grupo_id, cada_semanas,
                     repite_hasta, comprobado_en, faltan, creado_por)
  values
    (casa, elDia,      'cena', 'Prueba 81 · una', elGrupo, 2, elDia + 14,
     now(), array['Harina', 'Huevos'], alguien),
    (casa, elDia + 14, 'cena', 'Prueba 81 · dos', elGrupo, 2, elDia + 14,
     null, null, alguien);

  select count(*) into cuantos from menus where grupo_id = elGrupo;
  select faltan into volvieron from menus where grupo_id = elGrupo and fecha = elDia;
  reset role;

  if cuantos <> 2 then
    raise exception 'ABORTADO: se escribieron 2 menus de la tanda y hay %.', cuantos;
  end if;
  if coalesce(array_length(volvieron, 1), 0) <> 2 then
    raise exception 'ABORTADO: se guardaron 2 cosas en `faltan` y han vuelto %.',
      coalesce(array_length(volvieron, 1), 0);
  end if;
  raise notice 'Una tanda de 2 menus con grupo, y `faltan` vuelve entero. Bien.';

  /* Y se recoge. */
  delete from menus where grupo_id = elGrupo;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Las cinco casillas, puestas y escribibles. DEBEN SER 5 y true.
select
  column_name                                                     as la_casilla,
  data_type                                                       as de_que_tipo,
  has_column_privilege('authenticated','menus',column_name,'update')
                                                                  as se_puede_escribir_DEBE_SER_true
from information_schema.columns
where table_name = 'menus'
  and column_name in ('grupo_id','cada_semanas','repite_hasta','comprobado_en','faltan')
order by 1;

-- 2 · Y cómo están los menús que ya hay. Recién dado el paso: todos
--     sueltos y sin comprobar. Es lo correcto.
select
  h.nombre                                              as la_casa,
  count(*)                                              as menus_guardados,
  count(*) filter (where m.grupo_id is not null)        as de_una_tanda,
  count(*) filter (where m.comprobado_en is not null)   as ya_comprobados
from menus m
join hogares h on h.id = m.hogar_id
group by h.nombre
order by 1;

commit;
