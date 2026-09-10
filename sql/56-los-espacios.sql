-- ═══════════════════════════════════════════════════════════════
-- 56 · LOS ESPACIOS
-- ═══════════════════════════════════════════════════════════════
--
-- Esto es el ensayo del 55 con `commit` en vez de `rollback`.
--
-- Literalmente: las partes que cambian la base de datos —`soy_de()`,
-- las cinco funciones, el generador de políticas, los permisos de
-- carpeta y los valores por defecto— son el MISMO TEXTO. No una copia
-- parecida: el mismo. Se sacan del 55 al escribir este archivo,
-- justamente para que no puedan separarse un día sin que nadie lo note.
--
-- Lo que sobra aquí es lo que solo servía para probar: la gente
-- inventada, la matriz y el ROLLBACK.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ CAMBIA, EN UNA FRASE
--
-- Las políticas dejan de preguntar «¿CUÁL es tu espacio?» —que se
-- contestaba con un dato global de la persona, el mismo en todas las
-- pestañas— y pasan a preguntar «¿eres miembro de ESTE espacio?».
--
-- ─────────────────────────────────────────────────────────────
-- ANTES DE EJECUTARLO
--
--   1. El ensayo (55) tiene que haber salido entero en verde. Ya lo
--      hizo: 18 de 18.
--   2. El código de la aplicación tiene que estar desplegado, con las
--      239 consultas y las 27 inserciones diciendo su espacio. Si no,
--      lo primero que pasará es que no se pueda guardar nada.
--
-- ─────────────────────────────────────────────────────────────
-- SI HAY QUE VOLVER ATRÁS
--
-- Se ejecuta `sql/57-volver-de-los-espacios.sql`. No deshace esto a
-- mano ni de memoria: lee la copia que guarda el apartado 0 de aquí
-- abajo y vuelve a poner las políticas TAL COMO ESTABAN, letra por
-- letra.
--
-- Un guion de vuelta escrito a mano es otro archivo que puede tener un
-- fallo, y se descubriría en el peor momento posible.

begin;

set local statement_timeout = '120s';


-- ═══════════════════════════════════════════════════════════════
-- 0 · LA COPIA, ANTES DE TOCAR NADA
-- ═══════════════════════════════════════════════════════════════
--
-- La foto de cómo están las políticas y los valores por defecto ahora
-- mismo. Es de lo que bebe la vuelta atrás.
--
-- Las dos tablas llevan seguridad por filas activada y NINGUNA
-- política. Eso, en Supabase, significa que nadie las lee desde fuera:
-- ni con la llave pública ni con una sesión. Solo el servidor.
--
-- Guardan condiciones de seguridad —dónde está cada puerta y cómo se
-- abre— y eso no tiene por qué poder leerlo quien entra en HUBI.

create table if not exists politicas_antes_de_los_espacios (
  guardadas_en timestamptz not null default now(),
  tabla        text not null,
  politica     text not null,
  permisiva    text not null,
  papeles      text[] not null,
  orden        text not null,
  condicion    text,
  comprobacion text
);

create table if not exists defectos_antes_de_los_espacios (
  guardadas_en timestamptz not null default now(),
  tabla        text not null,
  columna      text not null,
  defecto      text not null
);

alter table politicas_antes_de_los_espacios enable row level security;
alter table defectos_antes_de_los_espacios  enable row level security;

/* Si esto se ejecutara dos veces, la segunda foto sería de las
   políticas YA cambiadas y la vuelta atrás dejaría de servir. Se
   guarda solo la primera vez. */
insert into politicas_antes_de_los_espacios
  (tabla, politica, permisiva, papeles, orden, condicion, comprobacion)
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and not exists (select 1 from politicas_antes_de_los_espacios);

insert into defectos_antes_de_los_espacios (tabla, columna, defecto)
select table_name, column_name, column_default
from information_schema.columns
where table_schema = 'public' and column_default ~ 'mi_hogar'
  and not exists (select 1 from defectos_antes_de_los_espacios);

do $$
declare cuantas int;
begin
  select count(*) into cuantas from politicas_antes_de_los_espacios;
  if cuantas = 0 then
    raise exception 'No se ha guardado ninguna política. Sin copia no se sigue.';
  end if;
  raise notice 'Copia guardada: % políticas y % valores por defecto.',
    cuantas, (select count(*) from defectos_antes_de_los_espacios);
end $$;


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
-- Y SE QUEDA
-- ═══════════════════════════════════════════════════════════════
--
-- Después de esto, comprueba en HUBI, por este orden:
--
--   1. Que el Inicio carga y enseña lo de siempre.
--   2. Que los Papeles siguen ahí, con el mismo número.
--   3. Que las Cuentas dan las mismas cifras.
--   4. Que se puede GUARDAR: un papel, una tarea, algo de la compra.
--
-- El 4 es el importante. Leer seguía funcionando aunque algo estuviera
-- mal; guardar es lo que toca la política de escritura y el valor por
-- defecto que se acaba de quitar.
--
-- Si algo falla: `sql/57-volver-de-los-espacios.sql`.

commit;
