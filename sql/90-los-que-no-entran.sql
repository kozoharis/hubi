-- ═══════════════════════════════════════════════════════════════
-- 90 · LOS QUE NO ENTRAN · una persona sin contraseña
-- ═══════════════════════════════════════════════════════════════
--
-- Haris: *«sería bueno poder dar de alta a tus hijos, para que no sólo
-- puedan decir quién ha dibujado qué, sino para cosas más profundas:
-- tareas o rutinas»*. Y eligió, de las tres maneras posibles, la de
-- **una persona sin entrada**: tiene nombre, color y cosas suyas, pero
-- no tiene correo ni contraseña.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  ESTE PASO TOCA LA TABLA MÁS VIEJA DEL PROYECTO
--
-- Léelo entero antes de ejecutarlo. No hay prisa y no pasa nada por
-- dejarlo para mañana.
--
-- ─────────────────────────────────────────────────────────────
-- EL MURO
--
-- Hoy, en mappel, una persona ES una cuenta:
--
--     perfiles.id  uuid primary key references auth.users(id)
--
-- O sea que para que exista Paula hay que crearle un correo y una
-- contraseña. Para un adolescente vale; para un niño de siete años es
-- una contraseña que gestionar y una sesión abierta en una tableta que
-- toca cualquiera que entre en la cocina.
--
-- El problema es que están pegadas dos cosas que no son la misma:
--
--     QUIEN ENTRA        ·  correo, contraseña, permisos, sesiones.
--     DE QUIEN ES ALGO   ·  un nombre y un color al que apuntan las
--                           rutinas, las citas, las tareas, la compra.
--
-- Esto las separa. Y la recompensa es desproporcionada para lo que
-- cuesta: hay **32 columnas** en esta base que apuntan a `perfiles(id)`
-- —rutinas, agenda, notas, compra, fotos, pagos, listas—. En cuanto una
-- persona pueda existir sin contraseña, las 32 empiezan a funcionar
-- para los niños sin tocar una sola pantalla más.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ ESTO NO BORRA NADA
--
-- Una clave ajena no es información: es una regla que dice qué se
-- puede meter. Soltarla no toca ni una fila. Lo que sí hay que
-- reponer es lo que esa regla hacía además de vigilar: el
-- `on delete cascade`, o sea que al borrar una cuenta desapareciera su
-- perfil. Eso pasa a hacerlo un disparador, y hace exactamente lo
-- mismo.
--
-- Importa porque `quitar-una-pantalla-mal-dada.sql` se apoya en ello:
-- *«se borra la cuenta de auth.users y el resto cae solo»*. Sigue
-- cayendo solo.
--
-- ─────────────────────────────────────────────────────────────
-- Y NADIE TIENE QUE TOCAR LOS PERMISOS
--
-- Esto es lo bonito del asunto, y conviene entenderlo antes de seguir.
-- Todas las funciones de seguridad —`soy_de`, `mi_rol`,
-- `puedo_escribir`, `soy_pantalla_de_casa`— comparan contra
-- `auth.uid()`. El identificador de Paula no es el de nadie que entre,
-- así que **jamás coincide con `auth.uid()`**: el sistema de permisos
-- la ignora por completo.
--
-- No es un agujero: es lo correcto. Paula no puede ver nada porque
-- Paula no entra. Existe para que le apunten cosas, no para consultar.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop function if exists dar_de_alta_sin_entrada(uuid, text, text);
--     drop function if exists quitar_a_quien_no_entra(uuid);
--     drop trigger if exists al_borrar_usuario on auth.users;
--     drop function if exists borrar_perfil_al_borrar_usuario();
--     delete from perfiles where entra = false;   -- ⚠️ ver abajo
--     alter table perfiles drop column if exists entra;
--     alter table perfiles add constraint perfiles_id_fkey
--       foreign key (id) references auth.users(id) on delete cascade;
--
-- ⚠️  El `delete` de en medio hace falta: la clave ajena no se puede
-- volver a poner mientras existan perfiles sin cuenta detrás. Si para
-- entonces ya hay hijos dados de alta, eso los borra — y con ellos, sus
-- rutinas se quedan sin dueño (`para` a nulo, no se borran: es la
-- doctrina del paso 87 y del 89).
--
-- Y el antes queda guardado en `copias.perfiles_antes_del_90`.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $p90$
begin
  if to_regclass('public.perfiles') is null then
    raise exception 'ABORTADO: no existe `perfiles`. Falta el paso 01.';
  end if;

  if to_regclass('public.miembros') is null then
    raise exception 'ABORTADO: no existe `miembros`. Falta el paso 17.';
  end if;

  raise notice 'Puerta pasada. Perfiles ahora mismo: %. Cuentas: %.',
    (select count(*) from perfiles),
    (select count(*) from auth.users);
end $p90$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA COPIA DEL ANTES
-- ═══════════════════════════════════════════════════════════════
/*
  Son cuatro filas y cuesta nada, así que se hace.

  ⚠️  Y VA EN UN ESQUEMA APARTE, NO EN `public`.

  Esto no es manía: en Supabase, una tabla nueva en `public` la sirve
  PostgREST por la API. Una copia de `perfiles` ahí sería una lista de
  las personas de la casa colgada en internet — exactamente el agujero
  que el paso 84 vino a tapar en la compra.

  `copias` no está en los esquemas que PostgREST expone, así que no
  sale por la API. Y por si acaso, además se le quitan los permisos y
  se le enciende la seguridad por filas sin ninguna política, que es la
  manera de decir «aquí no entra nadie».
*/
create schema if not exists copias;
revoke all on schema copias from anon, authenticated;

create table if not exists copias.perfiles_antes_del_90 as
  select * from perfiles;

alter table copias.perfiles_antes_del_90 enable row level security;
revoke all on table copias.perfiles_antes_del_90 from anon, authenticated;

comment on table copias.perfiles_antes_del_90 is
  'Como estaba `perfiles` justo antes del paso 90. Se puede borrar cuando el 90 lleve un mes funcionando.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · SOLTAR LA CLAVE AJENA
-- ═══════════════════════════════════════════════════════════════
/*
  Se busca por lo que ES y no por cómo se llama. El nombre de serie es
  `perfiles_id_fkey`, pero si alguien la creó a mano puede llamarse de
  otra manera, y entonces un `drop constraint perfiles_id_fkey` fallaría
  sin que se entienda por qué.
*/
do $p90$
declare
  laClave text;
begin
  select tc.constraint_name into laClave
    from information_schema.table_constraints tc
    join information_schema.key_column_usage k
      on k.constraint_name = tc.constraint_name
     and k.table_schema = tc.table_schema
   where tc.table_schema = 'public'
     and tc.table_name = 'perfiles'
     and tc.constraint_type = 'FOREIGN KEY'
     and k.column_name = 'id'
   limit 1;

  if laClave is null then
    raise notice 'La clave ajena ya estaba suelta. No se toca nada.';
  else
    execute format('alter table perfiles drop constraint %I', laClave);
    raise notice 'Soltada la clave ajena %.', laClave;
  end if;
end $p90$;


-- ═══════════════════════════════════════════════════════════════
-- 3 · Y EL DISPARADOR QUE HACE LO QUE HACÍA LA CASCADA
-- ═══════════════════════════════════════════════════════════════
/*
  Al borrar una cuenta, su perfil se va. Y al irse el perfil se van sus
  filas de `miembros`, porque ESA cascada sigue en pie.

  `security definer` porque quien borra una cuenta desde el panel de
  Supabase no tiene por qué poder tocar `perfiles`.
*/
create or replace function borrar_perfil_al_borrar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from perfiles where id = old.id;
  return old;
end;
$$;

drop trigger if exists al_borrar_usuario on auth.users;
create trigger al_borrar_usuario
  after delete on auth.users
  for each row execute function borrar_perfil_al_borrar_usuario();


-- ═══════════════════════════════════════════════════════════════
-- 4 · QUIÉN ENTRA Y QUIÉN NO
-- ═══════════════════════════════════════════════════════════════
/*
  `true` por defecto, que es lo que son todos los que ya están: gente
  con su cuenta. Los que se creen sin entrada lo dirán poniéndolo a
  `false`.

  Va en `perfiles` y no en `miembros` a propósito: tener llave es una
  propiedad de la persona, no de su sitio en una casa. Si mañana Paula
  está en dos casas, sigue sin tener contraseña en las dos.
*/
alter table perfiles
  add column if not exists entra boolean not null default true;

comment on column perfiles.entra is
  'false = persona de la casa que NO tiene cuenta: no hay correo ni contrasena y nunca coincide con auth.uid(). Existe para que le apunten rutinas, citas y tareas. Paso 90.';


-- ═══════════════════════════════════════════════════════════════
-- 5 · DAR DE ALTA A ALGUIEN QUE NO ENTRA
-- ═══════════════════════════════════════════════════════════════
/*
  Una función y no un `insert` suelto desde la aplicación, por lo de
  siempre en este proyecto: **la cerradura la pone la base, no el
  JavaScript**. Aquí dentro se comprueba quién llama; si mañana la
  pantalla se equivoca, la base sigue diciendo que no.

  Sólo el propietario de la casa. Es la misma vara que usa
  `no_cambiar_clase` para dejar tocar la clase de un miembro, y por lo
  mismo: dar de alta a una persona no es apuntar la leche.

  Devuelve el identificador del nuevo perfil.
*/
create or replace function dar_de_alta_sin_entrada(
  casa       uuid,
  el_nombre  text,
  el_color   text default '#6FA88A'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo  uuid := gen_random_uuid();
  limpio text := btrim(coalesce(el_nombre, ''));
  tinte  text := upper(btrim(coalesce(el_color, '')));
begin
  if limpio = '' then
    raise exception 'Hace falta un nombre.';
  end if;

  if length(limpio) > 60 then
    raise exception 'El nombre es demasiado largo.';
  end if;

  /* Un color de verdad o el de serie. No se acepta cualquier texto:
     esto acaba pintado en la pared de la cocina. */
  if tinte !~ '^#[0-9A-F]{6}$' then
    tinte := '#6FA88A';
  end if;

  if coalesce((select papel from miembros
                where perfil_id = auth.uid() and hogar_id = casa),
              'ninguno') <> 'propietario' then
    raise exception 'Solo el propietario de la casa da de alta a alguien.';
  end if;

  insert into perfiles (id, nombre, entra)
    values (nuevo, limpio, false);

  /*
    `lector` y `familia`, y las dos cosas a la vez tienen sentido:

      papel = 'lector'   ·  no escribe. Da igual —nunca entra— pero si
                            algún día se le diera una cuenta, entraría
                            de mirar y no mandando.
      rol   = 'familia'  ·  es de la casa, no una visita. Es lo que
                            hace que salga en las listas de gente con
                            los demás.

    `aceptado_en` con fecha: no hay ninguna invitación que aceptar, y
    sin eso saldría eternamente como «pendiente» en La casa.
  */
  insert into miembros (hogar_id, perfil_id, papel, rol, clase, color, aceptado_en)
    values (casa, nuevo, 'lector', 'familia', 'persona', tinte, now());

  return nuevo;
end;
$$;

revoke all on function dar_de_alta_sin_entrada(uuid, text, text) from public, anon;
grant execute on function dar_de_alta_sin_entrada(uuid, text, text) to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 6 · Y QUITARLO
-- ═══════════════════════════════════════════════════════════════
/*
  Sólo a quien no entra. Esta función NO puede servir para borrar a una
  persona con cuenta: eso es otra cosa, tiene sus consecuencias y se
  hace desde donde se hace.

  Lo suyo no se borra con él. Sus rutinas y sus citas se quedan sin
  dueño —`para` a nulo— porque todas esas columnas son
  `on delete set null`. Es la doctrina del paso 87 y del 89: quitar a
  alguien no puede vaciar media casa sin avisar.
*/
create or replace function quitar_a_quien_no_entra(quien uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  sucasa uuid;
begin
  select hogar_id into sucasa from miembros where perfil_id = quien limit 1;
  if sucasa is null then return false; end if;

  if coalesce((select papel from miembros
                where perfil_id = auth.uid() and hogar_id = sucasa),
              'ninguno') <> 'propietario' then
    raise exception 'Solo el propietario de la casa quita a alguien.';
  end if;

  if not coalesce((select not entra from perfiles where id = quien), false) then
    raise exception 'Esa persona tiene cuenta. Esto solo quita a los que no entran.';
  end if;

  delete from perfiles where id = quien;
  return true;
end;
$$;

revoke all on function quitar_a_quien_no_entra(uuid) from public, anon;
grant execute on function quitar_a_quien_no_entra(uuid) to authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════
-- 7 · COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta esto después, una consulta cada vez, y mira que sale lo que
-- pone. Si algo no cuadra, NO sigas: dímelo y lo miramos.

-- 7.1 · La copia del antes está guardada.
select count(*) as guardados from copias.perfiles_antes_del_90;
-- ESPERADO: los mismos perfiles que decia el aviso de la puerta.

-- 7.2 · La clave ajena ya no está.
select count(*) as claves_ajenas_en_id
from information_schema.table_constraints tc
join information_schema.key_column_usage k
  on k.constraint_name = tc.constraint_name
where tc.table_name = 'perfiles'
  and tc.constraint_type = 'FOREIGN KEY'
  and k.column_name = 'id';
-- ESPERADO: 0.

-- 7.3 · Y el disparador que la sustituye, sí.
select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;
-- ESPERADO: `al_crear_usuario` y `al_borrar_usuario`. Si falta el
-- segundo, AVISA: borrar una cuenta dejaria su perfil colgando.

-- 7.4 · La columna está, y todos los de ahora entran.
select count(*) filter (where entra) as con_cuenta,
       count(*) filter (where not entra) as sin_cuenta
from perfiles;
-- ESPERADO: todos en `con_cuenta`, y 0 en `sin_cuenta`.

-- 7.5 · Las dos funciones están.
select proname from pg_proc
where proname in ('dar_de_alta_sin_entrada', 'quitar_a_quien_no_entra');
-- ESPERADO: las dos.


-- ═══════════════════════════════════════════════════════════════
-- 8 · LA PRUEBA DE VERDAD  (opcional, y se deshace)
-- ═══════════════════════════════════════════════════════════════
-- Esto da de alta a alguien y lo vuelve a quitar, para ver que la
-- tuberia entera funciona. Hay que ejecutarlo DESDE LA APLICACION o
-- con tu sesion, no desde el editor SQL: las funciones preguntan por
-- `auth.uid()`, y en el editor eso es nulo.
--
-- Desde el editor, en cambio, se puede hacer a mano lo mismo para
-- probar. Cambia el identificador de la casa por el tuyo:
--
--     insert into perfiles (id, nombre, entra)
--       values ('00000000-0000-0000-0000-0000000000aa', 'Prueba', false);
--
--     insert into miembros (hogar_id, perfil_id, papel, rol, clase, color, aceptado_en)
--       values ('AQUI-EL-ID-DE-TU-CASA',
--               '00000000-0000-0000-0000-0000000000aa',
--               'lector', 'familia', 'persona', '#D07E97', now());
--
-- Entra en mappel y mira que «Prueba» sale en la lista de gente, y que
-- se le puede poner una rutina. Cuando lo hayas visto:
--
--     delete from perfiles where id = '00000000-0000-0000-0000-0000000000aa';
--
-- Eso se lleva tambien su fila de `miembros`, por la cascada de
-- `miembros.perfil_id`, y deja sin dueño lo que le hubieras apuntado.
