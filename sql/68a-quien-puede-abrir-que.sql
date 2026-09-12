-- ═══════════════════════════════════════════════════════════════
-- 68a · QUIÉN PUEDE ABRIR QUÉ · SOLO MIRA, NO TOCA NADA
-- ═══════════════════════════════════════════════════════════════
--
-- **Este archivo no cambia nada.** Son cuatro preguntas. Se ejecuta
-- entero y se me manda lo que salga.
--
-- ─────────────────────────────────────────────────────────────
-- DE DÓNDE SALE
--
-- Escribiendo el paso 68, su propia comprobación cazó esto:
--
--     select defaclrole::regrole, defaclobjtype, defaclacl from pg_default_acl;
--     → postgres | r | {anon=arwdDxt/postgres, authenticated=arwdDxt/postgres, ...}
--     → postgres | f | {anon=X/postgres,       authenticated=X/postgres,       ...}
--
-- Supabase deja unos PERMISOS POR DEFECTO sobre el esquema `public`:
--
--   · toda TABLA nueva le llega a `anon` y a `authenticated` con
--     **todos** los permisos —leer, insertar, cambiar, borrar—;
--   · toda FUNCIÓN nueva nace **ejecutable por `anon`**.
--
-- Y `anon` es el rol de quien **no ha entrado**: el que usa la clave
-- pública que va en el navegador.
--
-- Eso importa por dos motivos distintos:
--
--   1 · Un `revoke ... from public` NO se lo quita. El permiso no está
--       concedido a `public`, está concedido a `anon` por su nombre. Es
--       el mismo error de forma del paso 67 —`revoke` por columna bajo
--       un `grant` de tabla— en otro sitio.
--
--   2 · Una función `security definer` **se salta las políticas**. Si
--       alguna de las que hemos ido creando quedó abierta a `anon`,
--       cualquiera con la clave pública podría llamarla sin haber
--       entrado.
--
-- La RLS seguiría parando casi todo, porque las políticas piden
-- `auth.uid()` y sin sesión eso es nulo. Pero eso es depender de la
-- segunda puerta porque la primera se dejó abierta, y las dos son
-- nuestras.
--
-- Lo que sale de aquí decide si hace falta un paso 68b que lo cierre,
-- y de qué tamaño.

-- ═══════════════════════════════════════════════════════════════
-- 1 · LOS PERMISOS POR DEFECTO, PARA VERLOS
-- ═══════════════════════════════════════════════════════════════
-- Confirma que en tu base pasa lo mismo que en la de ensayo.
select
  defaclrole::regrole              as los_pone,
  case defaclobjtype
    when 'r' then 'tablas' when 'f' then 'funciones'
    when 'S' then 'secuencias' when 'T' then 'tipos' else defaclobjtype::text end as sobre,
  defaclacl                        as quien_los_recibe
from pg_default_acl;


-- ═══════════════════════════════════════════════════════════════
-- 2 · QUÉ TABLAS PUEDE TOCAR QUIEN NO HA ENTRADO
-- ═══════════════════════════════════════════════════════════════
-- Lo esperable es que salgan TODAS, y con las cuatro en `true`. Eso no
-- es una alarma por sí solo —la RLS está por debajo— pero dice el
-- tamaño de lo que hay que cerrar.
select
  c.relname                                              as la_tabla,
  c.relrowsecurity                                       as tiene_rls,
  has_table_privilege('anon', c.oid, 'select')           as anon_lee,
  has_table_privilege('anon', c.oid, 'insert')           as anon_crea,
  has_table_privilege('anon', c.oid, 'update')           as anon_cambia,
  has_table_privilege('anon', c.oid, 'delete')           as anon_borra
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and ( has_table_privilege('anon', c.oid, 'select')
     or has_table_privilege('anon', c.oid, 'insert')
     or has_table_privilege('anon', c.oid, 'update')
     or has_table_privilege('anon', c.oid, 'delete') )
order by c.relname;


-- ═══════════════════════════════════════════════════════════════
-- 3 · ⚠️  LA PREGUNTA IMPORTANTE
-- ═══════════════════════════════════════════════════════════════
-- Funciones `security definer` —las que se saltan las políticas— que
-- puede llamar quien no ha entrado, o que no tienen el `search_path`
-- fijado.
--
-- **Lo que quiero ver aquí es CERO FILAS.** Si sale alguna, hay que
-- cerrarla, y escribo el 68b antes de tocar nada más.
select
  p.proname                                          as la_funcion,
  pg_get_function_identity_arguments(p.oid)          as con_estos_argumentos,
  has_function_privilege('anon',   p.oid, 'execute') as la_llama_anon,
  has_function_privilege('public', p.oid, 'execute') as la_llama_cualquiera,
  (p.proconfig is null
   or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
                                                     as sin_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef                                    -- security definer
  and ( has_function_privilege('anon',   p.oid, 'execute')
     or has_function_privilege('public', p.oid, 'execute')
     or p.proconfig is null
     or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%') )
order by 1;


-- ═══════════════════════════════════════════════════════════════
-- 4 · Y CUÁNTAS SON EN TOTAL, PARA SABER EL TAMAÑO
-- ═══════════════════════════════════════════════════════════════
select
  count(*)                                                          as funciones_definer_en_total,
  count(*) filter (where has_function_privilege('anon', p.oid, 'execute')) as de_esas_abiertas_a_anon
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef;
