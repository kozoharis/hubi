-- ═══════════════════════════════════════════════════════════════
-- 69a · LO QUE NADIE TIENE POR QUÉ LEER
-- ═══════════════════════════════════════════════════════════════
--
-- El 68b cerró la puerta a quien NO ha entrado. Esto cierra tres
-- cosas a quien SÍ ha entrado, porque tampoco tiene por qué verlas.
--
-- Va antes del 69 —encender la pantalla de la cocina— a propósito: la
-- tableta va a ser un miembro más con sesión propia, o sea uno de esos
-- «que sí han entrado». Todo lo que se deje abierto a `authenticated`
-- se lo estamos dejando abierto también a un aparato colgado en la
-- pared de una cocina.
--
-- ─────────────────────────────────────────────────────────────
-- 1 · `perfiles.ical_cifrado`
--
-- El propio código dice, en `lib/agenda-google.ts`, por qué esa
-- consulta va con la llave de servicio:
--
--     «`perfiles.ical_cifrado` guarda la dirección del calendario de
--      una persona cifrada, y esa columna NO se le da a nadie —ni a su
--      dueño— desde el navegador.»
--
-- Y la base decía lo contrario:
--
--     select string_agg(a.attname, ', ')
--       from pg_attribute a
--      where a.attrelid = 'perfiles'::regclass
--        and has_column_privilege('authenticated', a.attrelid, a.attnum, 'select');
--     → id, nombre, color, es_propietario_drive, creado_en, foto,
--       ical_cifrado, ical_desde, ical_compartido, es_tecnico, casa_activa
--
-- O sea que cualquiera de la casa podía pedir
-- `GET /rest/v1/perfiles?select=ical_cifrado` y llevarse el texto
-- cifrado del calendario de los demás.
--
-- Está cifrado, sí. Pero es el cifrado de un secreto que no caduca —una
-- dirección iCal privada abre tu calendario entero para siempre— y la
-- llave vive en las variables de entorno. Guardar el candado al lado de
-- la puerta no es guardarlo.
--
-- Y sobre todo: **era una suposición escrita en un comentario y no
-- sostenida por la base**. Exactamente la misma forma del fallo de los
-- calendarios entre casas de esta mañana.
--
-- Se ha ido a mirar quién la lee: los cuatro sitios
-- (`agenda-google.ts` y `api/calendario/ical`) usan `clienteServidor()`.
-- `authenticated` no la necesita para nada.
--
-- ─────────────────────────────────────────────────────────────
-- 2 · `conexion_drive` · el testigo de Google
--
-- Guarda `refresh_token_cifrado`: el permiso permanente sobre el Drive
-- de Juan Miguel, que es donde vive TODA la documentación de la
-- familia.
--
-- Hoy no se puede leer, y conviene decir por qué: la tabla tiene RLS
-- encendido y **cero políticas**, o sea que deniega por omisión. Pero
-- el permiso de tabla sí está dado:
--
--     conexion_drive, columnas legibles por authenticated:
--       refresh_token_cifrado, email_cuenta, carpeta_raiz_id, estado,
--       actualizado_en, alcances, calendario_id, hogar_id
--
-- Que no se lea depende ENTERAMENTE de que nadie añada nunca una
-- política permisiva a esta tabla. Y añadir una política permisiva es
-- lo más natural del mundo el día que alguien quiera enseñar en
-- Ajustes de qué cuenta es el Drive — que es, de hecho, algo que HUBI
-- ya enseña (con la llave de servicio).
--
-- Las nueve lecturas de esta tabla en todo HUBI van con
-- `clienteServidor()`. `authenticated` no necesita ni una columna.
--
-- ─────────────────────────────────────────────────────────────
-- 3 · `suscripciones_push`
--
-- Misma forma: RLS encendido, cero políticas, y el permiso de tabla
-- dado sobre `endpoint`, `p256dh` y `auth` — que juntos son las
-- credenciales para mandarle una notificación al móvil de alguien.
--
-- Las seis lecturas van con la llave de servicio.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE **NO** HACE ESTE PASO, Y POR QUÉ
--
-- **a · La restrictiva `casa_no_lee_gente` del modelo V1.2 (§7.3).**
-- Decía que la pantalla de la cocina no pudiera leer `perfiles`. No se
-- pone, y creo que el modelo se equivocaba:
--
--   · rompería lo más básico de esa pantalla. Una tarea en la cocina
--     dice «Conchita · recoger la medicación», y sin `perfiles` no hay
--     de dónde sacar «Conchita»;
--   · y lo que se quería evitar ya está evitado: `perfiles_leer` limita
--     a la gente de TUS casas, y un dispositivo pertenece a una sola.
--     La tableta ve los nombres de esa casa y de nadie más.
--
-- Lo que sí hacía falta era que no viera las columnas de arriba, y eso
-- es lo que hace este paso — para ella y para todos.
--
-- **b · Los 7 «hallazgos» de la auditoría de enumerar personas.** Se
-- ejecutó la comprobación 25 del modelo V1.2 y salieron siete
-- funciones. Se han mirado una a una y **ninguna enumera personas**:
--
--     mi_escritorio, mis_casas, mis_invitaciones  →  devuelven CASAS
--     poner_rol ×2, poner_color ×2                →  escriben sobre UNA
--
-- La lista blanca de la auditoría estaba incompleta, nada más. Se deja
-- dicho aquí para no volver a investigarlo dentro de tres meses.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     grant select (ical_cifrado) on perfiles to authenticated;
--     grant all on table conexion_drive, suscripciones_push to authenticated;

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA · que la app no dependa de nada de esto
-- ═══════════════════════════════════════════════════════════════
/*
  Si `conexion_drive` tuviera una política permisiva, significaría que
  algo la lee CON LA SESIÓN, y este paso lo rompería en silencio: la
  consulta devolvería cero filas en vez de dar error. Mejor pararse.
*/
do $$
declare cuantas int;
begin
  select count(*) into cuantas
    from pg_policies
   where schemaname = 'public'
     and tablename in ('conexion_drive','suscripciones_push')
     and permissive = 'PERMISSIVE';

  if cuantas > 0 then
    raise exception
      'ABORTADO: `conexion_drive` o `suscripciones_push` tienen % politica(s) permisiva(s). '
      'Eso significa que algo las lee con la sesion, y quitarles el permiso lo romperia. '
      'Hay que mirar que es antes de dar este paso.', cuantas;
  end if;

  raise notice 'Puerta pasada: ninguna de las dos tablas de secretos se lee con la sesion.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · `perfiles` · TODAS LAS COLUMNAS MENOS LA DEL CALENDARIO
-- ═══════════════════════════════════════════════════════════════
/*
  La lección del 67, otra vez: un `revoke select (ical_cifrado)` NO
  hace nada mientras exista un `grant select` de la tabla entera. Hay
  que quitar el de tabla y devolver las columnas una a una.

  Y la lista se CALCULA —«todas menos ésta»— en vez de escribirse a
  mano, para que el día que `perfiles` tenga una columna nueva no se
  quede fuera sin que nadie sepa por qué.
*/
do $$
declare permitidas text;
begin
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into permitidas
    from pg_attribute a
   where a.attrelid = 'perfiles'::regclass
     and a.attnum > 0 and not a.attisdropped
     and a.attname <> 'ical_cifrado';

  execute 'revoke select on table perfiles from authenticated';
  execute format('grant select (%s) on table perfiles to authenticated', permitidas);

  raise notice 'perfiles · se puede leer todo menos ical_cifrado.';
end $$;

/* Y tampoco se escribe. `perfiles_editar_el_suyo` deja a cada uno
   tocar su fila, y sin esto podría ponerse el `ical_cifrado` a mano —o
   borrarle el calendario a nadie, porque la política es solo sobre la
   suya, pero escribir basura en una columna que luego se descifra es
   una manera de romper la agenda—. Quien la escribe de verdad es
   `/api/calendario/ical`, con la llave de servicio. */
do $$
declare permitidas text;
begin
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into permitidas
    from pg_attribute a
   where a.attrelid = 'perfiles'::regclass
     and a.attnum > 0 and not a.attisdropped
     and a.attname not in ('ical_cifrado','id');

  execute 'revoke update on table perfiles from authenticated';
  execute format('grant update (%s) on table perfiles to authenticated', permitidas);

  raise notice 'perfiles · se puede escribir todo menos ical_cifrado y el id.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 2 · LAS DOS TABLAS DE SECRETOS
-- ═══════════════════════════════════════════════════════════════
revoke all on table conexion_drive     from authenticated;
revoke all on table suscripciones_push from authenticated;

comment on table conexion_drive is
  'El permiso permanente sobre el Drive de la familia. Solo la llave de servicio. '
  'Ni `authenticated` ni `anon` tienen permiso de tabla: si algun dia hace falta '
  'ensenar de que cuenta es el Drive, se hace con una funcion que devuelva SOLO '
  '`email_cuenta` y `estado` — nunca abriendo la tabla.';

comment on table suscripciones_push is
  'Endpoint y claves para mandar avisos al movil de alguien. Solo la llave de '
  'servicio.';


-- ═══════════════════════════════════════════════════════════════
-- 3 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  quien uuid; casa uuid; ok boolean; comoSeLlama text;
begin
  select m.perfil_id, m.hogar_id into quien, casa
    from miembros m
   where m.clase = 'persona' and m.aceptado_en is not null limit 1;

  if quien is null then
    raise notice 'Sin nadie con quien probar. Se aplica igual.';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', quien::text, true);

  -- ── TIENE que seguir funcionando: leer el nombre de alguien ──
  begin
    set local role authenticated;
    select p.nombre into comoSeLlama from perfiles p where p.id = quien;
    reset role; ok := comoSeLlama is not null;
  exception when others then reset role; ok := false; end;
  if not ok then
    raise exception 'ABORTADO: ya no se puede leer el nombre de una persona. No se aplica nada.';
  end if;
  raise notice 'Leer el nombre de alguien: sigue funcionando.';

  -- ── TIENE que seguir funcionando: cambiarse la foto ──
  begin
    set local role authenticated;
    update perfiles set foto = foto where id = quien;
    reset role; ok := true;
  exception when others then reset role; ok := false; end;
  if not ok then
    raise exception 'ABORTADO: ya no se puede uno cambiar la foto.';
  end if;
  raise notice 'Cambiarse la foto: sigue funcionando.';

  -- ── TIENE que dejar de funcionar: leer el calendario cifrado ──
  begin
    set local role authenticated;
    perform p.ical_cifrado from perfiles p where p.id = quien;
    reset role; ok := true;
  exception when others then reset role; ok := false; end;
  if ok then
    raise exception 'ABORTADO: todavia se puede leer `ical_cifrado`.';
  end if;
  raise notice 'Leer el calendario cifrado: BLOQUEADO.';

  -- ── TIENE que dejar de funcionar: el testigo de Google ──
  begin
    set local role authenticated;
    perform 1 from conexion_drive limit 1;
    reset role; ok := true;
  exception when others then reset role; ok := false; end;
  if ok then
    raise exception 'ABORTADO: todavia se puede leer `conexion_drive`.';
  end if;
  raise notice 'Leer el testigo de Google: BLOQUEADO.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Qué columnas de `perfiles` se pueden leer y escribir.
--     En NINGUNA de las dos puede aparecer `ical_cifrado`.
select
  (select string_agg(a.attname, ', ' order by a.attnum)
     from pg_attribute a
    where a.attrelid = 'perfiles'::regclass and a.attnum > 0 and not a.attisdropped
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'select'))
    as se_pueden_leer,
  (select string_agg(a.attname, ', ' order by a.attnum)
     from pg_attribute a
    where a.attrelid = 'perfiles'::regclass and a.attnum > 0 and not a.attisdropped
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'update'))
    as se_pueden_escribir;

-- 2 · Las dos tablas de secretos, cerradas a todo el mundo menos a la
--     llave de servicio. Las cuatro primeras en false, la última en true.
select
  t.la_tabla,
  has_table_privilege('authenticated', t.la_tabla::regclass, 'select') as authenticated_lee_DEBE_SER_false,
  has_table_privilege('anon',          t.la_tabla::regclass, 'select') as anon_lee_DEBE_SER_false,
  has_table_privilege('service_role',  t.la_tabla::regclass, 'select') as la_llave_de_servicio_DEBE_SER_true,
  (select relrowsecurity from pg_class where relname = t.la_tabla)     as rls_encendido_DEBE_SER_true
from (values ('conexion_drive'), ('suscripciones_push')) as t(la_tabla)
order by 1;

-- 3 · Y un barrido, por si queda alguna columna de secreto abierta.
--     TIENE que salir cero filas.
select
  c.relname as la_tabla,
  a.attname as la_columna
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where n.nspname = 'public' and c.relkind = 'r'
  and a.attname ~* 'token|secret|clave|cifrad|refresh|password|p256dh|^auth$'
  and has_column_privilege('authenticated', c.oid, a.attnum, 'select')
order by 1, 2;

commit;
