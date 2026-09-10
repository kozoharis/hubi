-- ═══════════════════════════════════════════════════════════════
-- 55 · EL ENSAYO
-- ═══════════════════════════════════════════════════════════════
--
-- Hace la migración entera y después la deshace.
--
-- Abre una transacción, crea `soy_de()` y las cinco funciones que
-- reciben el espacio, reescribe las 63 políticas, se inventa dos
-- espacios con gente dentro, comprueba una por una las cosas que cada
-- persona debe y no debe poder hacer, y termina en ROLLBACK.
--
-- Al acabar, la base de datos está exactamente como estaba. Ni las
-- políticas nuevas, ni la gente inventada, ni una fila de más.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ ESTO SE PUEDE HACER
--
-- Postgres deshace también los cambios de ESTRUCTURA. Crear una
-- función, borrar una política y crear otra son cosas que caben dentro
-- de una transacción y se van con ella. No es un truco: es una
-- garantía del motor.
--
-- Y por eso el ensayo va contra el esquema de verdad y no contra una
-- copia. Una copia puede haberse desviado —una columna que se añadió a
-- mano un martes, una política que se rehízo y no se apuntó— y
-- entonces el verde de la copia no dice nada del original.
--
-- ─────────────────────────────────────────────────────────────
-- LAS POLÍTICAS NO SE ESCRIBEN: SE GENERAN
--
-- Ninguna de las 63 está transcrita aquí. Se leen del catálogo tal
-- como están AHORA MISMO y se les aplican cinco sustituciones
-- mecánicas. Copiarlas a mano habría sido escribir sesenta y tres
-- condiciones de seguridad de memoria, y con que una sola saliera con
-- un `or` donde había un `and`, la puerta quedaría abierta y el ensayo
-- diría que todo está bien.
--
-- Si aparece una política que las cinco reglas no saben tratar, esto
-- se para y la nombra. No adivina.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE EJECUTA
--
--   Supabase → SQL Editor → New query → pegar entero → Run
--
-- Tarda unos segundos. Al final escribe una tabla con una línea por
-- comprobación. Si alguna sale mal, la última instrucción revienta
-- diciendo cuál.
--
-- Da igual cómo termine: no queda nada.

begin;

set local statement_timeout = '120s';


-- ═══════════════════════════════════════════════════════════════
-- 1 · SOY_DE
-- ═══════════════════════════════════════════════════════════════
--
-- «¿Eres miembro aceptado de ESE espacio?» Nada más.
--
-- Es la pieza que sustituye a `mi_hogar()`, y la diferencia entre las
-- dos es la que sostiene todo lo demás:
--
--   `mi_hogar()` contesta CUÁL espacio, leyendo un dato global de la
--   persona. Dos pestañas comparten ese dato y se pisan.
--
--   `soy_de(x)` contesta SÍ o NO sobre el espacio que le preguntes. No
--   depende de ningún estado: la pregunta lleva dentro la respuesta.
--
-- Y una cosa que NO es, porque se acordó expresamente:
--
--   SOY_DE NO SIGNIFICA «PUEDO VER TODO».
--
-- Pertenecer te deja entrar al espacio. Lo que ves y lo que puedes
-- hacer dentro lo siguen decidiendo el papel, el rol, la visibilidad
-- de cada documento y los permisos por carpeta — que siguen ahí, en
-- las mismas políticas, detrás de este primer término. Las
-- comprobaciones D, E, F, G y H de abajo existen precisamente para
-- demostrarlo.

create or replace function soy_de(casa uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from miembros m
    where m.perfil_id = auth.uid()
      and m.hogar_id = casa
      and m.aceptado_en is not null
  )
$$;

/* `security definer` no es un descuido: es lo que evita el nudo del
   SQL 20. Esta función lee `miembros`, y las políticas de `miembros`
   preguntarían por ella. Saltándose las políticas para su propia
   lectura, la pregunta no se muerde la cola. */

revoke all on function soy_de(uuid) from public;
grant execute on function soy_de(uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 2 · LAS CINCO QUE ADIVINABAN, AHORA PREGUNTAN
-- ═══════════════════════════════════════════════════════════════
--
-- Aquí está la mitad del trabajo que no se ve. Cambiar el primer
-- término de las políticas no habría bastado: treinta y cuatro de las
-- sesenta y tres llaman a alguna de estas cinco, y estas cinco
-- averiguaban el espacio por su cuenta con `mi_hogar()`.
--
-- O sea: se habría quitado el estado global de la puerta y se habría
-- quedado dentro, donde no se ve.
--
-- Las viejas NO se borran. Se quedan con su firma de siempre, sin
-- argumento, por si algo fuera de las políticas las llama. Éstas son
-- otras: mismo nombre, un argumento más.

create or replace function mi_rol(casa uuid) returns text
language sql stable security definer set search_path = public
as $$
  select m.rol from miembros m
  where m.perfil_id = auth.uid() and m.hogar_id = casa
$$;

create or replace function puedo_escribir(casa uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select papel <> 'lector' from miembros
      where perfil_id = auth.uid() and hogar_id = casa),
    true
  )
$$;

create or replace function puedo_en_agenda(casa uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select puedo_escribir(casa) or coalesce(mi_rol(casa), 'familia') = 'asesor'
$$;

create or replace function puedo_ver_carpeta(casa uuid, cat uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when cat is null then true
    when coalesce(
      (select ve_todo from miembros
        where perfil_id = auth.uid() and hogar_id = casa),
      true
    ) then true
    else exists (
      select 1 from permisos_carpeta p
      where p.perfil_id = auth.uid()
        and p.hogar_id = casa
        and p.categoria_id = raiz_de(cat)
        and p.ver
    )
  end
$$;

create or replace function puedo_guardar_en(casa uuid, cat uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select
    puedo_escribir(casa)
    and puedo_ver_carpeta(casa, cat)
    and case
      when cat is null then true
      when coalesce(
        (select escribe_todo from miembros
          where perfil_id = auth.uid() and hogar_id = casa),
        true
      ) then true
      else exists (
        select 1 from permisos_carpeta p
        where p.perfil_id = auth.uid()
          and p.hogar_id = casa
          and p.categoria_id = raiz_de(cat)
          and p.escribir
      )
    end
$$;

revoke all on function mi_rol(uuid)                from public;
revoke all on function puedo_escribir(uuid)        from public;
revoke all on function puedo_en_agenda(uuid)       from public;
revoke all on function puedo_ver_carpeta(uuid, uuid) from public;
revoke all on function puedo_guardar_en(uuid, uuid)  from public;

grant execute on function mi_rol(uuid)                to authenticated;
grant execute on function puedo_escribir(uuid)        to authenticated;
grant execute on function puedo_en_agenda(uuid)       to authenticated;
grant execute on function puedo_ver_carpeta(uuid, uuid) to authenticated;
grant execute on function puedo_guardar_en(uuid, uuid)  to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 3 · LAS 63 POLÍTICAS, GENERADAS
-- ═══════════════════════════════════════════════════════════════
--
-- Cinco sustituciones sobre el texto que Postgres tiene guardado.
-- Ninguna otra. Cada política nueva se diferencia de la vieja
-- únicamente en esto:
--
--   1 · (hogar_id = mi_hogar())      →  soy_de(hogar_id)
--   2 · lo que quede de mi_hogar()   →  <la tabla>.hogar_id
--   3 · mi_rol()                     →  mi_rol(hogar_id)
--       puedo_escribir()             →  puedo_escribir(hogar_id)
--       puedo_en_agenda()            →  puedo_en_agenda(hogar_id)
--   4 · puedo_ver_carpeta(x)         →  puedo_ver_carpeta(hogar_id, x)
--       puedo_guardar_en(x)          →  puedo_guardar_en(hogar_id, x)
--   5 · si después de todo eso no hay ningún soy_de(), se le pone
--       delante. Una política sin soy_de sería una puerta sin puerta.
--
-- Y si al terminar queda un `mi_hogar` suelto en alguna, se para.

do $$
declare
  p            record;
  tabla        text;
  clave        text;   -- cómo se llama el espacio en esta tabla
  cond         text;
  chequeo      text;
  ordenes      text;
  hechas       int := 0;
begin
  for p in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  loop
    tabla := p.tablename;

    /* `hogares` guarda su espacio en `id`; el resto, en `hogar_id`.
       `perfiles`, `pasos_dados` y `suscripciones_push` no tienen
       espacio: lo suyo es de la persona, no de la casa. */
    clave := case
      when tabla = 'hogares' then 'id'
      when exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = tabla
          and c.column_name = 'hogar_id'
      ) then 'hogar_id'
      else null
    end;

    cond    := p.qual;
    chequeo := p.with_check;

    if cond is null and chequeo is null then
      continue;
    end if;

    /* Ninguna de las dos menciona el espacio: es de la persona y se
       queda exactamente como está. `pasos_dados`, y las de `perfiles`
       y `miembros` que solo miran `auth.uid()`. */
    if coalesce(cond, '') !~ 'mi_hogar' and coalesce(chequeo, '') !~ 'mi_hogar' then
      continue;
    end if;

    if clave is null then
      /* Menciona `mi_hogar()` pero la tabla no tiene espacio propio:
         `perfiles_leer`, que mira los miembros de tu casa. Ahí el
         espacio es el de la fila de `miembros` que se está mirando. */
      cond    := replace(coalesce(cond, ''),    'm.hogar_id = mi_hogar()', 'soy_de(m.hogar_id)');
      chequeo := replace(coalesce(chequeo, ''), 'm.hogar_id = mi_hogar()', 'soy_de(m.hogar_id)');
      if cond = '' then cond := null; end if;
      if chequeo = '' then chequeo := null; end if;
    else
      /* 1 · el primer término */
      cond    := replace(cond,    '(' || clave || ' = mi_hogar())', 'soy_de(' || clave || ')');
      chequeo := replace(chequeo, '(' || clave || ' = mi_hogar())', 'soy_de(' || clave || ')');

      /* 2 · lo que quede: dentro de un `exists`, atado a ESTA fila.
         `m.hogar_id = mi_hogar()` en las rutinas quiere decir «tu
         pertenencia a la casa de esta rutina», no a una cualquiera. */
      cond    := replace(cond,    'mi_hogar()', tabla || '.' || clave);
      chequeo := replace(chequeo, 'mi_hogar()', tabla || '.' || clave);

      /* 3 y 4 · las funciones reciben el espacio */
      cond    := replace(cond,    'mi_rol()',           'mi_rol(' || clave || ')');
      chequeo := replace(chequeo, 'mi_rol()',           'mi_rol(' || clave || ')');
      cond    := replace(cond,    'puedo_escribir()',   'puedo_escribir(' || clave || ')');
      chequeo := replace(chequeo, 'puedo_escribir()',   'puedo_escribir(' || clave || ')');
      cond    := replace(cond,    'puedo_en_agenda()',  'puedo_en_agenda(' || clave || ')');
      chequeo := replace(chequeo, 'puedo_en_agenda()',  'puedo_en_agenda(' || clave || ')');
      cond    := replace(cond,    'puedo_ver_carpeta(', 'puedo_ver_carpeta(' || clave || ', ');
      chequeo := replace(chequeo, 'puedo_ver_carpeta(', 'puedo_ver_carpeta(' || clave || ', ');
      cond    := replace(cond,    'puedo_guardar_en(',  'puedo_guardar_en(' || clave || ', ');
      chequeo := replace(chequeo, 'puedo_guardar_en(',  'puedo_guardar_en(' || clave || ', ');

      /* 5 · la puerta, si no la puso ya la regla 1 */
      if cond is not null and cond !~ 'soy_de\(' then
        cond := 'soy_de(' || tabla || '.' || clave || ') and (' || cond || ')';
      end if;
      if chequeo is not null and chequeo !~ 'soy_de\(' then
        chequeo := 'soy_de(' || tabla || '.' || clave || ') and (' || chequeo || ')';
      end if;
    end if;

    if coalesce(cond, '') ~ 'mi_hogar' or coalesce(chequeo, '') ~ 'mi_hogar' then
      raise exception
        'La política %.% se queda con un mi_hogar() que estas reglas no saben tratar. No se adivina: %',
        tabla, p.policyname, coalesce(cond, chequeo);
    end if;

    ordenes := format('drop policy %I on public.%I;', p.policyname, tabla) ||
      format(' create policy %I on public.%I as %s for %s to %s%s%s;',
        p.policyname, tabla,
        case p.permissive when 'PERMISSIVE' then 'permissive' else 'restrictive' end,
        case p.cmd when 'ALL' then 'all' else lower(p.cmd) end,
        array_to_string(p.roles, ', '),
        case when cond    is not null then ' using (' || cond || ')' else '' end,
        case when chequeo is not null then ' with check (' || chequeo || ')' else '' end
      );

    execute ordenes;
    hechas := hechas + 1;
  end loop;

  raise notice 'Políticas reescritas: %', hechas;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 4 · LA PUERTA DE LOS PERMISOS POR CARPETA
-- ═══════════════════════════════════════════════════════════════
--
-- Ésta no la arregla ninguna sustitución, y es un fallo de verdad que
-- está en producción ahora mismo:
--
--     permisos_carpeta.permisos_mandar
--       exists (select 1 from miembros m
--                where m.perfil_id = auth.uid()
--                  and m.papel = 'propietario')   ← sin espacio
--
-- Ser propietario de CUALQUIER espacio te deja repartir permisos de
-- carpeta en el espacio que estés mirando. Quien tiene su casa y entra
-- como simple miembro en la de un cliente puede, ahí dentro,
-- concederse a sí mismo las carpetas que no le abrieron.
--
-- Es la tercera de la misma familia, después del 53 y el 54. Se ata a
-- la fila.

drop policy if exists permisos_mandar on public.permisos_carpeta;
create policy permisos_mandar on public.permisos_carpeta
  for all to authenticated
  using (
    soy_de(hogar_id)
    and exists (
      select 1 from miembros m
      where m.perfil_id = auth.uid()
        and m.hogar_id = permisos_carpeta.hogar_id
        and m.papel = 'propietario'
    )
  )
  with check (
    soy_de(hogar_id)
    and exists (
      select 1 from miembros m
      where m.perfil_id = auth.uid()
        and m.hogar_id = permisos_carpeta.hogar_id
        and m.papel = 'propietario'
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- 5 · EL VALOR POR DEFECTO QUE SEGUÍA ADIVINANDO
-- ═══════════════════════════════════════════════════════════════
--
-- Doce tablas tienen esto:
--
--     hogar_id uuid not null default mi_hogar()
--
-- O sea: si un día una inserción se deja el espacio sin poner, la base
-- de datos lo rellena con el estado global. Y con las políticas nuevas
-- eso PASARÍA la comprobación —`soy_de()` diría que sí, porque eres
-- miembro de esa casa— y el documento se archivaría en el espacio
-- equivocado sin un solo error.
--
-- Es el último sitio donde `casa_activa` podía decidir dónde va un
-- papel. Hoy no muerde: las diecisiete inserciones de HUBI escriben el
-- espacio a mano (eso lo dejó comprobado el paso 1, y `probar-espacio`
-- lo vigila). Pero un defecto que solo es inofensivo mientras nadie se
-- despiste no es una garantía, es una casualidad.
--
-- Sin defecto, una inserción olvidadiza no adivina: falla en el sitio,
-- con un mensaje claro, y se arregla en un minuto.

do $$
declare t record;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'hogar_id'
      and column_default ~ 'mi_hogar'
    order by table_name
  loop
    execute format('alter table public.%I alter column hogar_id drop default', t.table_name);
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 6 · GENTE INVENTADA
-- ═══════════════════════════════════════════════════════════════
--
-- Dos espacios y seis personas, elegidas para que cada una haga fallar
-- una cosa distinta si la migración está mal.
--
--   CASA · una familia
--   CLIENTE · el espacio de un cliente
--
--   ANA   propietaria en CASA. En CLIENTE, nada.
--   BENI  miembro en CASA · LECTOR en CLIENTE.
--   CARO  propietaria en CASA · ASESORA en CLIENTE, con papel de lector.
--   GORKA asesor en CLIENTE, pero con papel de miembro.
--   DANI  miembro en CLIENTE, pero sin ver todo: solo la carpeta Finca.
--   EVA   invitada a CLIENTE y sin contestar.
--   FRAN  no está en ninguno.
--
-- Beni y Caro son las importantes: son las que existen en los dos
-- sitios, y por tanto las únicas que pueden demostrar que un espacio
-- ya no contesta por el otro.
--
-- La clave ajena de `perfiles` hacia `auth.users` se suelta un momento
-- para no tener que inventar usuarios de verdad. Vuelve al terminar
-- —se la lleva el ROLLBACK como todo lo demás— y así este archivo no
-- depende de qué columnas exija la tabla de usuarios de Supabase.

alter table perfiles drop constraint perfiles_id_fkey;

insert into hogares (id, nombre) values
  ('aaaa0000-0000-4000-8000-000000000001', 'ENSAYO · Casa'),
  ('bbbb0000-0000-4000-8000-000000000002', 'ENSAYO · Cliente');

insert into perfiles (id, nombre) values
  ('11110000-0000-4000-8000-000000000001', 'Ana'),
  ('22220000-0000-4000-8000-000000000002', 'Beni'),
  ('33330000-0000-4000-8000-000000000003', 'Caro'),
  ('44440000-0000-4000-8000-000000000004', 'Dani'),
  ('55550000-0000-4000-8000-000000000005', 'Eva'),
  ('66660000-0000-4000-8000-000000000006', 'Fran'),
  ('77770000-0000-4000-8000-000000000007', 'Gorka');

insert into miembros (hogar_id, perfil_id, papel, rol, ve_todo, escribe_todo, aceptado_en) values
  ('aaaa0000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-000000000001', 'propietario', 'familia', true,  true,  now()),
  ('aaaa0000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000002', 'miembro',     'familia', true,  true,  now()),
  ('aaaa0000-0000-4000-8000-000000000001', '33330000-0000-4000-8000-000000000003', 'propietario', 'familia', true,  true,  now()),
  /* Beni entró en CASA ANTES que en CLIENTE. Es lo que hacía que la
     casa vieja contestara por la nueva: sin esto, el fallo del 53 y el
     54 no se puede reproducir. */
  ('bbbb0000-0000-4000-8000-000000000002', '22220000-0000-4000-8000-000000000002', 'lector',      'familia', true,  true,  now()),
  ('bbbb0000-0000-4000-8000-000000000002', '33330000-0000-4000-8000-000000000003', 'lector',      'asesor',  true,  true,  now()),
  ('bbbb0000-0000-4000-8000-000000000002', '44440000-0000-4000-8000-000000000004', 'miembro',     'familia', false, false, now()),
  ('bbbb0000-0000-4000-8000-000000000002', '55550000-0000-4000-8000-000000000005', 'miembro',     'familia', true,  true,  null),
  /* Gorka es asesor con papel de MIEMBRO. No es un descuido del
     ensayo: es la configuración que hoy deja escribir las cuentas, y
     está aquí para que eso quede dicho en voz alta. */
  ('bbbb0000-0000-4000-8000-000000000002', '77770000-0000-4000-8000-000000000007', 'miembro',     'asesor',  true,  true,  now());

/* Una carpeta raíz en cada espacio, y una segunda en CLIENTE para que
   Dani pueda tener una sí y otra no. */
insert into categorias (id, hogar_id, padre_id, nombre, segmento_drive, naturaleza) values
  ('c0000000-0000-4000-8000-00000000000a', 'aaaa0000-0000-4000-8000-000000000001', null, 'Finca', 'FINCA', 'neutro'),
  ('c0000000-0000-4000-8000-00000000000b', 'bbbb0000-0000-4000-8000-000000000002', null, 'Finca', 'FINCA', 'neutro'),
  ('c0000000-0000-4000-8000-00000000000c', 'bbbb0000-0000-4000-8000-000000000002', null, 'Salud', 'SALUD', 'neutro');

insert into permisos_carpeta (hogar_id, perfil_id, categoria_id, ver, escribir) values
  ('bbbb0000-0000-4000-8000-000000000002', '44440000-0000-4000-8000-000000000004',
   'c0000000-0000-4000-8000-00000000000b', true, false);

insert into documentos
  (id, hogar_id, categoria_id, titulo, subido_por, visibilidad,
   drive_file_id, drive_folder_id, nombre_archivo, tipo_mime) values
  ('d0000000-0000-4000-8000-00000000000a', 'aaaa0000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-00000000000a', 'ENSAYO · papel de CASA',
   '11110000-0000-4000-8000-000000000001', 'compartido',
   'ensayo-a', 'ensayo-carpeta', 'ensayo-a.pdf', 'application/pdf'),
  ('d0000000-0000-4000-8000-00000000000b', 'bbbb0000-0000-4000-8000-000000000002',
   'c0000000-0000-4000-8000-00000000000b', 'ENSAYO · papel de CLIENTE · Finca',
   '11110000-0000-4000-8000-000000000001', 'compartido',
   'ensayo-b', 'ensayo-carpeta', 'ensayo-b.pdf', 'application/pdf'),
  ('d0000000-0000-4000-8000-00000000000c', 'bbbb0000-0000-4000-8000-000000000002',
   'c0000000-0000-4000-8000-00000000000c', 'ENSAYO · papel de CLIENTE · Salud',
   '11110000-0000-4000-8000-000000000001', 'compartido',
   'ensayo-c', 'ensayo-carpeta', 'ensayo-c.pdf', 'application/pdf');

/* Nadie tiene casa activa puesta. Es a propósito: si algo siguiera
   dependiendo del estado global, aquí se caería. */
update perfiles set casa_activa = null
where id in (
  '11110000-0000-4000-8000-000000000001','22220000-0000-4000-8000-000000000002',
  '33330000-0000-4000-8000-000000000003','44440000-0000-4000-8000-000000000004',
  '55550000-0000-4000-8000-000000000005','66660000-0000-4000-8000-000000000006',
  '77770000-0000-4000-8000-000000000007'
);


-- ═══════════════════════════════════════════════════════════════
-- 7 · LA MATRIZ
-- ═══════════════════════════════════════════════════════════════
--
-- Once comprobaciones. Cada una dice qué debería pasar y qué pasa.
--
-- Están escritas en las dos direcciones a propósito: por cada «esto
-- NO se puede» hay un «esto sí», con la misma persona o con una
-- parecida. Una prueba que solo comprueba negaciones sale en verde
-- también cuando todo está roto y nadie puede hacer nada.

create temp table ensayo (
  letra    text,
  que      text,
  esperado text,
  obtenido text
) on commit drop;

/* La tabla de resultados la escriben las personas inventadas, así que
   necesitan permiso. `pg_temp` es un alias que no vale para dar
   permisos: hay que decir el nombre real del esquema temporal, que
   cambia en cada sesión. */
do $$
declare esquema text;
begin
  select nspname into esquema from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to authenticated', esquema);
  execute format('grant all on %I.ensayo to authenticated', esquema);
end $$;

/*
  Para probar lo que NO se puede hacer.

  Un SELECT que la seguridad no permite devuelve cero filas y ya está.
  Pero un INSERT que no permite LANZA UN ERROR, y un error aquí
  tumbaría la transacción entera y nos quedaríamos sin saber qué pasó
  en las demás. Así que se intenta dentro de una caja: la caja se
  rompe, el ensayo sigue, y lo que devuelve es qué pasó.
*/
create or replace function ensayo_intenta(orden text) returns text
language plpgsql
as $$
begin
  execute orden;
  return 'deja';
exception
  when insufficient_privilege then return 'no deja';
  when others                 then return 'no deja (' || sqlstate || ')';
end $$;

grant execute on function ensayo_intenta(text) to authenticated;

/* Ponerse en la piel de alguien: exactamente como llega una sesión de
   verdad desde el navegador —el papel `authenticated` y el testigo con
   su identificador—, no con un atajo de servidor. */
create or replace function ensayo_soy(quien uuid) returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', quien::text, 'role', 'authenticated')::text, true);
end $$;


-- ── A · Ana ve lo suyo ────────────────────────────────────────
select ensayo_soy('11110000-0000-4000-8000-000000000001');
set local role authenticated;
insert into ensayo values ('A', 'Ana ve los papeles de CASA', '1',
  (select count(*)::text from documentos where hogar_id = 'aaaa0000-0000-4000-8000-000000000001'));

-- ── B · y no ve lo del otro ───────────────────────────────────
insert into ensayo values ('B', 'Ana no ve nada de CLIENTE', '0',
  (select count(*)::text from documentos where hogar_id = 'bbbb0000-0000-4000-8000-000000000002'));

/* Sin filtro tampoco: si `soy_de` significara «puedo ver todo», aquí
   saldrían los tres. */
insert into ensayo values ('B2', 'Ana, preguntando sin decir el espacio, sigue viendo solo el suyo', '1',
  (select count(*)::text from documentos where titulo like 'ENSAYO%'));
reset role;

-- ── C · el de fuera no ve nada ────────────────────────────────
select ensayo_soy('66660000-0000-4000-8000-000000000006');
set local role authenticated;
insert into ensayo values ('C', 'Fran, que no está en ningún espacio, no ve ningún papel', '0',
  (select count(*)::text from documentos where titulo like 'ENSAYO%'));
reset role;

-- ── D · pertenecer no es ver todo ─────────────────────────────
/* Dani ES miembro aceptado de CLIENTE: `soy_de()` dice que sí. Y aun
   así solo ve la carpeta que le abrieron. Ésta es la comprobación que
   pediste expresamente. */
select ensayo_soy('44440000-0000-4000-8000-000000000004');
set local role authenticated;
insert into ensayo values ('D', 'Dani pertenece a CLIENTE pero solo ve la carpeta que le abrieron', '1',
  (select count(*)::text from documentos where titulo like 'ENSAYO%'));
insert into ensayo values ('D2', 'y el papel que ve es el de Finca, no el de Salud', 'ENSAYO · papel de CLIENTE · Finca',
  (select coalesce(max(titulo), '(ninguno)') from documentos where titulo like 'ENSAYO%'));
insert into ensayo values ('D3', 'Dani no puede guardar en la carpeta que solo puede mirar', 'no deja',
  ensayo_intenta($q$
    insert into documentos (hogar_id, categoria_id, titulo, subido_por, visibilidad,
                            drive_file_id, drive_folder_id, nombre_archivo, tipo_mime)
    values ('bbbb0000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-00000000000b',
            'ENSAYO · de Dani', '44440000-0000-4000-8000-000000000004', 'compartido',
            'x', 'y', 'z.pdf', 'application/pdf')
  $q$));
reset role;

-- ── E y F · el lector, en un sitio y en el otro ───────────────
/* Beni entró en CASA primero, donde escribe. En CLIENTE es lector.
   Éste es exactamente el fallo que cerraron el 53 y el 54, y aquí se
   comprueba que la migración lo deja cerrado por construcción. */
select ensayo_soy('22220000-0000-4000-8000-000000000002');
set local role authenticated;
insert into ensayo values ('E', 'Beni, lector en CLIENTE, no puede guardar allí', 'no deja',
  ensayo_intenta($q$
    insert into documentos (hogar_id, categoria_id, titulo, subido_por, visibilidad,
                            drive_file_id, drive_folder_id, nombre_archivo, tipo_mime)
    values ('bbbb0000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-00000000000b',
            'ENSAYO · de Beni en CLIENTE', '22220000-0000-4000-8000-000000000002', 'compartido',
            'x', 'y', 'z.pdf', 'application/pdf')
  $q$));

insert into ensayo values ('F', 'y en CASA, donde es miembro normal, sí puede', 'deja',
  ensayo_intenta($q$
    insert into documentos (hogar_id, categoria_id, titulo, subido_por, visibilidad,
                            drive_file_id, drive_folder_id, nombre_archivo, tipo_mime)
    values ('aaaa0000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-00000000000a',
            'ENSAYO · de Beni en CASA', '22220000-0000-4000-8000-000000000002', 'compartido',
            'x2', 'y2', 'z2.pdf', 'application/pdf')
  $q$));

-- ── J · el que está en los dos ────────────────────────────────
insert into ensayo values ('J', 'Beni, que está en los dos, ve los dos espacios juntos si no dice cuál', '4',
  (select count(*)::text from documentos where titulo like 'ENSAYO%'));
insert into ensayo values ('J2', 'y diciendo el espacio, solo el que pide', '2',
  (select count(*)::text from documentos
    where titulo like 'ENSAYO%' and hogar_id = 'aaaa0000-0000-4000-8000-000000000001'));
reset role;

-- ── G · el asesor ─────────────────────────────────────────────
/* Caro es propietaria de CASA y asesora en CLIENTE. Puede ponerle
   tareas al cliente, y no puede tocarle las cuentas. */
select ensayo_soy('33330000-0000-4000-8000-000000000003');
set local role authenticated;
insert into ensayo values ('G', 'Caro, asesora en CLIENTE, sí puede dejar una tarea allí', 'deja',
  ensayo_intenta($q$
    insert into recordatorios (hogar_id, titulo, creado_por, fecha)
    values ('bbbb0000-0000-4000-8000-000000000002', 'ENSAYO · tarea del asesor',
            '33330000-0000-4000-8000-000000000003', current_date)
  $q$));

insert into ensayo values ('G2', 'y no puede apuntar un gasto en las cuentas del cliente', 'no deja',
  ensayo_intenta($q$
    insert into movimientos (hogar_id, categoria_id, tipo, concepto, importe, creado_por, fecha)
    values ('bbbb0000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-00000000000b',
            'gasto', 'ENSAYO · gasto del asesor', 10, '33330000-0000-4000-8000-000000000003', current_date)
  $q$));

/* La tercera puerta, la de los permisos por carpeta: Caro es
   propietaria de CASA, y eso no puede darle mando en CLIENTE. */
insert into ensayo values ('G3', 'Caro no puede repartirse permisos de carpeta en CLIENTE', 'no deja',
  ensayo_intenta($q$
    insert into permisos_carpeta (hogar_id, perfil_id, categoria_id, ver, escribir)
    values ('bbbb0000-0000-4000-8000-000000000002', '33330000-0000-4000-8000-000000000003',
            'c0000000-0000-4000-8000-00000000000c', true, true)
  $q$));
reset role;

-- ── G4 · lo que hoy NO impide el rol de asesor ────────────────
/*
  ESTO NO ES UN FALLO DE LA MIGRACIÓN. Es cómo funciona HUBI hoy, y la
  migración lo deja exactamente igual — que es justo lo que se le pide.

  El SQL 39 dice, escrito: «el asesor mira las cuentas, no las
  escribe». Pero lo que guarda la puerta de `movimientos` es
  `puedo_escribir()`, y eso solo deja fuera al papel `lector`. A un
  asesor con papel de MIEMBRO nadie le impide apuntar un gasto.

  O sea: lo que impide escribir las cuentas no es el ROL de asesor, es
  el PAPEL de lector. Funciona si al invitar a un asesor se le pone de
  lector —como Caro—, y no funciona si se le deja de miembro —como
  Gorka—.

  Se comprueba a propósito, para que quede escrito y se decida aparte:
  o el rol de asesor cierra por sí solo las cuentas, o la pantalla de
  invitar tiene que poner el papel de lector sin preguntar.
*/
select ensayo_soy('77770000-0000-4000-8000-000000000007');
set local role authenticated;
insert into ensayo values ('G4', 'un asesor con papel de miembro SÍ puede tocar las cuentas — antes y después', 'deja',
  ensayo_intenta($q$
    insert into movimientos (hogar_id, categoria_id, tipo, concepto, importe, creado_por, fecha)
    values ('bbbb0000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-00000000000b',
            'gasto', 'ENSAYO · gasto de Gorka', 10, '77770000-0000-4000-8000-000000000007', current_date)
  $q$));
reset role;

-- ── H · la invitación sin contestar ───────────────────────────
select ensayo_soy('55550000-0000-4000-8000-000000000005');
set local role authenticated;
insert into ensayo values ('H', 'Eva, invitada a CLIENTE y sin contestar, no ve nada', '0',
  (select count(*)::text from documentos where titulo like 'ENSAYO%'));
reset role;

-- ── I · escribir en un espacio ajeno ──────────────────────────
select ensayo_soy('11110000-0000-4000-8000-000000000001');
set local role authenticated;
insert into ensayo values ('I', 'Ana no puede meter un papel en CLIENTE ni escribiendo el espacio a mano', 'no deja',
  ensayo_intenta($q$
    insert into documentos (hogar_id, categoria_id, titulo, subido_por, visibilidad,
                            drive_file_id, drive_folder_id, nombre_archivo, tipo_mime)
    values ('bbbb0000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-00000000000b',
            'ENSAYO · colado', '11110000-0000-4000-8000-000000000001', 'compartido',
            'x3', 'y3', 'z3.pdf', 'application/pdf')
  $q$));

-- ── K · sin espacio escrito, ya no adivina ────────────────────
insert into ensayo values ('K', 'una inserción que se deja el espacio falla en vez de adivinarlo', 'no deja',
  ensayo_intenta($q$
    insert into documentos (categoria_id, titulo, subido_por, visibilidad,
                            drive_file_id, drive_folder_id, nombre_archivo, tipo_mime)
    values ('c0000000-0000-4000-8000-00000000000a', 'ENSAYO · sin espacio',
            '11110000-0000-4000-8000-000000000001', 'compartido',
            'x4', 'y4', 'z4.pdf', 'application/pdf')
  $q$));
reset role;


-- ═══════════════════════════════════════════════════════════════
-- 8 · EL RESULTADO
-- ═══════════════════════════════════════════════════════════════

select
  letra,
  case when obtenido is not distinct from esperado then 'bien' else '⚠ MAL' end as como,
  que,
  esperado,
  obtenido
from ensayo
order by letra;

do $$
declare fallos int;
begin
  select count(*) into fallos from ensayo where obtenido is distinct from esperado;
  if fallos > 0 then
    raise exception 'El ensayo NO pasa: % comprobaciones mal. Mira la tabla de arriba.', fallos;
  end if;
  raise notice 'Las % comprobaciones, bien.', (select count(*) from ensayo);
end $$;


-- ═══════════════════════════════════════════════════════════════
-- Y AHORA SE DESHACE TODO
-- ═══════════════════════════════════════════════════════════════

rollback;
