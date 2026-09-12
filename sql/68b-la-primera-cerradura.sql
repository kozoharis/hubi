-- ═══════════════════════════════════════════════════════════════
-- 68b · LA PRIMERA CERRADURA
-- ═══════════════════════════════════════════════════════════════
--
-- El 68a contestó: **30 de 31** funciones `security definer` las puede
-- llamar `anon`, que es el rol de quien NO ha entrado — el de la clave
-- pública que va escrita en el navegador de cualquiera.
--
-- Y no lo concedió nadie. Lo pone Supabase solo:
--
--     select defaclrole::regrole, defaclobjtype, defaclacl from pg_default_acl;
--     → postgres | r | {anon=arwdDxt/postgres, authenticated=arwdDxt/postgres, ...}
--     → postgres | f | {anon=X/postgres,       authenticated=X/postgres,       ...}
--
-- Toda tabla nueva del esquema `public` nace con los cuatro permisos
-- para `anon`, y toda función nueva nace ejecutable por `anon`.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE ESTO ES, Y LO QUE NO ES
--
-- **No hay una puerta abierta hoy.** Se ha ido a probar, no a suponer,
-- con las dos funciones que más daño harían:
--
--     poner_rol(<el ayudante>, 'familia')  como anon
--       → ERROR: Esa persona no está en tu casa.
--
--     crear_mi_casa('Casa del intruso', 'finca')  como anon
--       → ERROR: Hay que entrar primero.
--
-- Se defienden solas, porque todas miran `auth.uid()` y sin sesión eso
-- es nulo.
--
-- Lo que hay es que **estamos dependiendo de la segunda cerradura
-- porque la primera se dejó suelta**. Una `security definer` se salta
-- las políticas por definición: si alguna, hoy o dentro de seis meses,
-- se escribe sin ese guardia al principio, no queda nada detrás.
--
-- Esto pone la primera cerradura.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ SE PUEDE QUITAR SIN ROMPER LA ENTRADA
--
-- Ésta era la pregunta que faltaba: **¿HUBI llama a algo con la clave
-- pública antes de que exista la sesión?** Se ha ido a mirar al código,
-- y la respuesta es que no.
--
-- La clave pública se usa en tres sitios y en ninguno toca `public`:
--
--     lib/supabase/navegador.ts   el cliente del navegador. Lo usan
--                                 `app/entrar/page.tsx` (signInWithOtp,
--                                 verifyOtp) y `app/boton-salir.tsx`
--                                 (signOut) — todo en el esquema `auth`,
--                                 que esto no toca.
--     lib/supabase/sesion.ts      la usa como clave del cliente, pero
--                                 con la cookie de sesión: el rol
--                                 efectivo es `authenticated`.
--     app/api/comprobacion:242    la sonda de seguridad, que lee
--                                 `categorias` SIN sesión esperando que
--                                 la base le diga que no.
--
-- Esa sonda además sale reforzada: hoy recibe cero filas porque la RLS
-- la para; después recibirá «permiso denegado», que es una respuesta
-- más temprana y más clara. El código ya la contempla
-- (`if (error) { ok = true; filasVisiblesSinSesion = 0 }`).
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE NO SE TOCA, Y POR QUÉ
--
-- **Las funciones de disparador.** Devuelven `trigger` y no las llama
-- nadie a mano: las llama Postgres al escribir una fila, y ahí no se
-- vuelve a comprobar el permiso. Una de ellas es
-- `crear_perfil_al_registrar`, que corre al darse de alta alguien
-- nuevo. No hay ninguna razón para tocarla y sí una para no hacerlo,
-- así que se quedan fuera.
--
-- **`service_role`.** Es la llave de servicio, y tiene que poder.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     grant execute on all functions in schema public to anon;
--     grant all on all tables in schema public to anon;

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA · cómo estaba antes, escrito antes de tocar nada
-- ═══════════════════════════════════════════════════════════════
create temporary table como_estaba on commit drop as
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute'))          as funciones_abiertas,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and has_table_privilege('anon', c.oid, 'select'))              as tablas_legibles;

do $$
declare f int; t int;
begin
  select funciones_abiertas, tablas_legibles into f, t from como_estaba;
  raise notice 'Antes de tocar nada: % funciones definer abiertas a anon, % tablas legibles por anon.', f, t;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LAS FUNCIONES
-- ═══════════════════════════════════════════════════════════════
/*
  Se recorren y se cierran una a una, en vez de con un
  `revoke execute on all functions`, por dos motivos:

    · el `all functions` alcanzaría también a las de disparador, que
      queremos dejar en paz;
    · y así el `raise notice` dice cuáles se han tocado, que es lo que
      luego se puede contrastar con el parte.

  `anon` y `public` los dos: `public` porque es el que hereda todo el
  mundo, y `anon` porque es el que Supabase pone POR SU NOMBRE — y un
  `revoke` a `public` no quita lo que está a nombre de otro. Ése fue el
  fallo de forma que descubrió el 68.
*/
do $$
declare
  la_funcion text;
  la_tenia boolean;
  cuantas int := 0;
  devueltas int := 0;
begin
  for la_funcion, la_tenia in
    select format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)),
           /* Se mira ANTES de revocar: si alguna función estuviera
              cerrada a `authenticated` a propósito, este paso no es
              quién para abrírsela. Solo se le devuelve lo que ya
              tenía y va a perder al quitarle el permiso a `public`. */
           has_function_privilege('authenticated', p.oid, 'execute')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       /* Las de disparador, fuera: las llama Postgres, no la app. */
       and p.prorettype <> 'trigger'::regtype
     order by p.proname
  loop
    execute format('revoke execute on function public.%s from public, anon', la_funcion);
    if la_tenia then
      execute format('grant execute on function public.%s to authenticated', la_funcion);
      devueltas := devueltas + 1;
    end if;
    cuantas := cuantas + 1;
  end loop;

  raise notice 'Cerradas a anon: % funciones. Devueltas a authenticated: %.', cuantas, devueltas;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 2 · LAS TABLAS
-- ═══════════════════════════════════════════════════════════════
/*
  Aquí `anon` no necesita NADA: no hay una sola consulta de HUBI que
  toque una tabla de `public` sin sesión (el porqué, arriba).

  Esto no sustituye a la RLS ni la debilita: es la puerta de antes. Con
  las dos, una política mal escrita mañana no se lleva por delante una
  tabla entera para quien no ha entrado siquiera.

  `authenticated` no se toca en este paso. Sus permisos de tabla son
  los que han ido poniendo el 66 y el 67, columna por columna, y
  revocarle aquí en bloque desharía aquello.
*/
do $$
declare
  la_tabla text;
  cuantas int := 0;
begin
  for la_tabla in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by c.relname
  loop
    execute format('revoke all on table public.%I from anon', la_tabla);
    cuantas := cuantas + 1;
  end loop;

  raise notice 'Cerradas a anon: % tablas.', cuantas;
end $$;

/* Y las secuencias, que son de la misma familia: `anon` las recibe con
   `rwU` por el mismo permiso por defecto. No llegan a PostgREST, así
   que no es una puerta —pero quitarlas no cuesta nada y deja el
   inventario entero en la misma frase. */
revoke all on all sequences in schema public from anon;


-- ═══════════════════════════════════════════════════════════════
-- 3 · Y QUE LAS QUE SE CREEN MAÑANA NAZCAN CERRADAS
-- ═══════════════════════════════════════════════════════════════
/*
  Sin esto, el paso 69 crea una tabla y vuelve a nacer abierta. Sería
  arreglar el síntoma cada vez en lugar de la causa.

  Se cambia el permiso POR DEFECTO del rol `postgres`, que es quien
  crea las cosas desde el editor de SQL. Los que ya están puestos no se
  tocan hacia atrás: de eso se han encargado los dos apartados de
  arriba.

  OJO: esto no afecta a lo que cree el panel de Supabase con otro rol.
  Si algún día una tabla nueva vuelve a salir abierta en el 68a, es por
  ahí.
*/
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke all on sequences from anon;


-- ═══════════════════════════════════════════════════════════════
-- 4 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
/*
  Lo que tiene que dejar de funcionar y lo que tiene que seguir
  funcionando, aquí dentro y con la transacción abierta. Si algo no
  sale como debe, `raise` y no se confirma nada.
*/
do $$
declare
  ok boolean;
  quien uuid; casa uuid;
begin
  -- ── TIENE que dejar de funcionar: `anon` llama a una definer ──
  begin
    set local role anon;
    perform soy_de('00000000-0000-4000-a000-000000000001'::uuid);
    reset role; ok := true;
  exception when others then reset role; ok := false; end;
  if ok then
    raise exception 'ABORTADO: anon todavia puede llamar a soy_de().';
  end if;
  raise notice 'anon llamando a una funcion definer: BLOQUEADO.';

  -- ── TIENE que dejar de funcionar: `anon` lee una tabla ──
  begin
    set local role anon;
    perform 1 from categorias limit 1;
    reset role; ok := true;
  exception when others then reset role; ok := false; end;
  if ok then
    raise exception 'ABORTADO: anon todavia puede leer `categorias`.';
  end if;
  raise notice 'anon leyendo una tabla: BLOQUEADO.';

  -- ── TIENE que seguir funcionando: quien SI ha entrado ──
  select m.perfil_id, m.hogar_id into quien, casa
    from miembros m
   where m.clase = 'persona' and m.aceptado_en is not null limit 1;

  if quien is null then
    raise notice 'No hay con quien probar el lado bueno. Se aplica igual.';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', quien::text, true);

  begin
    set local role authenticated;
    if not soy_de(casa) then
      reset role;
      raise exception 'ABORTADO: soy_de() dice que un miembro no es de su casa.';
    end if;
    perform puede(casa, 'papeles', null, 'mirar');
    perform 1 from categorias where hogar_id = casa limit 1;
    reset role; ok := true;
  exception
    when sqlstate 'P0001' then reset role; raise;
    when others then reset role; ok := false;
  end;
  if not ok then
    raise exception 'ABORTADO: quien SI ha entrado ha dejado de poder leer. No se aplica nada.';
  end if;
  raise notice 'Quien si ha entrado: sigue funcionando.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Antes y después, en la misma fila.
--     Las dos columnas de la derecha TIENEN que salir en cero.
/* Las de disparador se descuentan a propósito: se han dejado abiertas
   —el apartado «lo que no se toca» dice por qué— y contarlas aquí
   haría que este parte nunca llegara a cero y no se pudiera leer de un
   vistazo. Salen con nombre y apellidos en la consulta 4. */
select
  e.funciones_abiertas                                               as funciones_abiertas_antes,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute'))           as funciones_abiertas_AHORA_DEBE_SER_0,
  e.tablas_legibles                                                  as tablas_legibles_antes,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and has_table_privilege('anon', c.oid, 'select'))               as tablas_legibles_AHORA_DEBE_SER_0
from como_estaba e;

-- 2 · Y que quien SÍ ha entrado conserva lo suyo.
--     Las tres, en true.
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
      and not has_function_privilege('authenticated', p.oid, 'execute')) = 0
    as authenticated_las_puede_llamar_todas_DEBE_SER_true,
  has_table_privilege('authenticated','categorias','select')
    as sigue_leyendo_categorias_DEBE_SER_true,
  has_any_column_privilege('authenticated','categorias','update')
    as sigue_pudiendo_renombrar_DEBE_SER_true;

-- 3 · Los permisos por defecto, ya sin `anon` en tablas ni funciones.
select
  defaclrole::regrole as los_pone,
  case defaclobjtype when 'r' then 'tablas' when 'f' then 'funciones'
       when 'S' then 'secuencias' else defaclobjtype::text end as sobre,
  defaclacl as quien_los_recibe
from pg_default_acl
order by 2;

-- 4 · Y las que quedan abiertas, con su nombre, para que el número de
--     arriba no sea un misterio. TIENEN que ser solo de disparador —
--     la columna de la derecha, toda en true.
select
  p.proname                                    as la_funcion,
  pg_get_function_result(p.oid) = 'trigger'    as es_de_disparador_DEBE_SER_true
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')
order by 1;

commit;
