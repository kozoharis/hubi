-- ═══════════════════════════════════════════════════════════════
-- 72 · LO QUE SE QUEDA A LA VISTA
-- ═══════════════════════════════════════════════════════════════
--
-- Una casilla nueva en los recordatorios: **destacado**.
--
-- Lo que hace: algo destacado sale SIEMPRE en el tablón de la pantalla
-- de la cocina, esté en la semana que esté. «La comunión es el 4 de
-- octubre», «el viernes viene el fontanero», «no olvidar el pasaporte».
--
-- Es lo contrario de una fecha. Una fecha dice CUÁNDO; destacar dice
-- QUE NO SE OLVIDE, y eso no caduca el domingo.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  Y ES UNA COLUMNA, NO UNA TABLA
--
-- Se planteó una tabla `destacados` con su fila por cosa destacada.
-- Sería más «limpio» y sería peor: habría que mantenerla al día cuando
-- se borra un recordatorio, cuando se marca hecho, cuando se cambia de
-- casa. Una casilla en la fila que ya existe no se desincroniza nunca,
-- porque no hay dos sitios.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  LA TRAMPA DE LOS PERMISOS POR COLUMNA, OTRA VEZ
--
-- Ésta ya mordió en el paso 68 y vuelve a morder aquí. Medido en la
-- base de ensayo antes de escribir nada:
--
--     ACL de `recordatorios`  →  authenticated = ardDxt
--                                                  ↑ falta la `w`
--
-- O sea que `authenticated` **no tiene UPDATE a nivel de tabla**: lo
-- tiene columna por columna, en 22 columnas. Y eso significa que una
-- columna nueva nace SIN permiso de escritura, en silencio: la casilla
-- existiría, la política dejaría pasar, y el `update` no cambiaría nada
-- sin dar error.
--
-- Por eso este paso termina con un `grant update (destacado)` explícito
-- y lo comprueba con `has_column_privilege` antes de confirmar.
--
-- ─────────────────────────────────────────────────────────────
-- QUIÉN PUEDE DESTACAR
--
-- Nadie nuevo. Manda la política de siempre, `recordatorios_editar`,
-- que desde el paso 71 pasa por `puedo_en_agenda`. O sea:
--
--     la familia            → sí
--     la ayuda              → sí (desde el 71b)
--     el asesor             → solo lo que escribió él
--     la pantalla de casa   → NO
--
-- Que la pantalla no pueda destacar es correcto y es lo mismo que no
-- pueda tachar: una pared que decide qué es importante no la quiere
-- nadie. Se destaca desde el móvil, y la pared lo enseña.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     alter table recordatorios drop column destacado;

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  tiene_tabla boolean;
  cuantas int;
begin
  if not exists (select 1 from pg_class where relname = 'recordatorios') then
    raise exception 'ABORTADO: no existe `recordatorios`.';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_name = 'recordatorios' and column_name = 'destacado'
  ) then
    raise notice 'La columna `destacado` ya existe. Este paso solo repasara los permisos.';
  end if;

  /* Se enseña el reparto de UPDATE tal como está, porque de ahí sale
     la decisión de abajo. */
  select has_table_privilege('authenticated', 'recordatorios', 'update')
    into tiene_tabla;

  select count(*) into cuantas
    from information_schema.column_privileges
   where table_name = 'recordatorios'
     and grantee = 'authenticated' and privilege_type = 'UPDATE';

  raise notice 'UPDATE de tabla para authenticated: %  ·  columnas con permiso propio: %',
    tiene_tabla, cuantas;

  if not tiene_tabla then
    raise notice 'Como se esperaba: el permiso va por columna, asi que la nueva hay que darla a mano.';
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA CASILLA
-- ═══════════════════════════════════════════════════════════════
/*
  `not null default false`: no existe «destacado a medias». Un nulo aquí
  obligaría a escribir `coalesce(destacado,false)` en cada consulta de
  cada pantalla, y el día que a alguien se le olvide, una cosa destacada
  desaparece del tablón sin que nadie sepa por qué.
*/
alter table recordatorios
  add column if not exists destacado boolean not null default false;

comment on column recordatorios.destacado is
  'Se queda a la vista en la pantalla de la cocina, esté en la semana que esté. Paso 72.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · EL PERMISO DE ESCRIBIRLA
-- ═══════════════════════════════════════════════════════════════
/*
  Esto es lo que el paso 68 enseñó a hacer: NO basta con que la política
  RLS deje pasar. Sin este `grant`, el `update` se ejecuta, no da error
  y no cambia nada — que es la peor de las tres cosas que podían pasar.

  Solo `authenticated`: `anon` quedó cerrado en el 68b y ahí se queda.
*/
grant update (destacado) on table recordatorios to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 3 · Y PARA BUSCARLAS RÁPIDO
-- ═══════════════════════════════════════════════════════════════
/*
  La pantalla de la cocina pide lo destacado cada vez que se refresca,
  o sea cada cinco minutos, todo el día. Es una consulta pequeña pero
  constante, y sin índice recorre la tabla entera de la casa.

  Parcial —`where destacado`— porque lo normal es que haya tres cosas
  destacadas entre doscientas: un índice sobre toda la columna guardaría
  doscientos `false` que no sirven para nada.
*/
create index if not exists recordatorios_destacado
  on recordatorios (hogar_id)
  where destacado;


-- ═══════════════════════════════════════════════════════════════
-- 4 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  puede_escribir boolean;
  casa uuid; alguien uuid; laPantalla uuid;
  toco int;
begin
  select has_column_privilege('authenticated', 'recordatorios', 'destacado', 'update')
    into puede_escribir;

  if not puede_escribir then
    raise exception
      'ABORTADO: `authenticated` no puede escribir `destacado`. El grant no ha servido.';
  end if;
  raise notice 'El permiso de columna esta puesto.';

  /* Que una PERSONA pueda destacar de verdad, no solo en teoría. */
  select m.perfil_id, m.hogar_id into alguien, casa
    from miembros m
   where m.clase = 'persona' and m.papel = 'propietario' and m.aceptado_en is not null
   limit 1;

  if alguien is not null and exists (select 1 from recordatorios where hogar_id = casa) then
    perform set_config('request.jwt.claim.sub', alguien::text, true);
    set local role authenticated;
    with tocadas as (
      update recordatorios set destacado = true
       where hogar_id = casa and id = (select id from recordatorios where hogar_id = casa limit 1)
      returning 1
    ) select count(*) into toco from tocadas;
    reset role;

    if toco = 0 then
      raise exception 'ABORTADO: el dueno de la casa no ha podido destacar nada.';
    end if;
    raise notice 'El dueno de la casa destaca: bien.';

    /* Y se deja como estaba: esto es una prueba, no un cambio. */
    update recordatorios set destacado = false where hogar_id = casa;
  end if;

  /* Y que la PANTALLA no pueda. */
  select m.perfil_id, m.hogar_id into laPantalla, casa
    from miembros m where m.clase = 'dispositivo' and m.aceptado_en is not null limit 1;

  if laPantalla is not null and exists (select 1 from recordatorios where hogar_id = casa) then
    perform set_config('request.jwt.claim.sub', laPantalla::text, true);
    set local role authenticated;
    with tocadas as (
      update recordatorios set destacado = true where hogar_id = casa returning 1
    ) select count(*) into toco from tocadas;
    reset role;

    if toco > 0 then
      raise exception
        'ABORTADO: la pantalla de la cocina ha podido destacar % cosas. No debe.', toco;
    end if;
    raise notice 'La pantalla de la cocina no destaca: bien.';
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · La casilla, puesta y con su permiso.
--     Las tres columnas de la derecha: false, false, true.
select
  c.column_name                                                              as la_casilla,
  c.is_nullable                                                              as admite_nulo_DEBE_SER_NO,
  c.column_default                                                           as por_defecto_DEBE_SER_false,
  has_column_privilege('authenticated','recordatorios','destacado','update') as se_puede_escribir_DEBE_SER_true
from information_schema.columns c
where c.table_name = 'recordatorios' and c.column_name = 'destacado';

-- 2 · Cuántas cosas hay destacadas ahora mismo. Recién dado el paso,
--     cero en todas las casas.
select h.nombre as la_casa, count(*) filter (where r.destacado) as destacadas
from hogares h
left join recordatorios r on r.hogar_id = h.id and r.eliminado_en is null
group by 1 order by 1;

commit;
