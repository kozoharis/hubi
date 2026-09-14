-- ═══════════════════════════════════════════════════════════════
-- 73 · EL TABLÓN DE FOTOS
-- ═══════════════════════════════════════════════════════════════
--
-- Fotos de la familia pasando en la pantalla de la cocina. Se suben
-- desde el móvil de cualquiera de la casa, y también **desde la propia
-- tableta**, con su cámara.
--
-- Lo pidió Haris así: «se me ocurre una chorrada pero hará que esa
-- tablet viva más». No es una chorrada: una pantalla que solo informa se
-- vuelve mobiliario; una que además enseña a la familia se mira.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ NO VAN A GOOGLE DRIVE
--
-- El planteamiento dice «Drive será el archivo», y esto parece
-- contradecirlo. No lo contradice: esa regla es sobre DOCUMENTACIÓN —
-- facturas, pólizas, informes, lo que hay que poder encontrar dentro de
-- diez años en una carpeta con su nombre.
--
-- Una foto de la familia en la cocina no es un documento: es decoración
-- de la casa. Y una pared que pasa fotos cada veinte segundos haría
-- decenas de llamadas a Drive al día por decoración — con el token de
-- Juan Miguel, y quedándose sin retratos el día que esa conexión falle.
--
-- Así que van a Supabase Storage, en un sitio aparte que no toca nada
-- de lo que sostiene el producto de verdad.
--
-- ─────────────────────────────────────────────────────────────
-- EL CUBO ES PRIVADO Y NO LLEVA NI UNA POLÍTICA
--
-- Esto es deliberado y conviene entenderlo antes de tocarlo.
--
-- Las fotos **no las sube el navegador**: las sube el servidor de MAPPEL,
-- que primero comprueba con la sesión de quien pregunta que es de esta
-- casa, y solo entonces las escribe con la llave de servicio. Y para
-- enseñarlas, el servidor firma una dirección que caduca.
--
-- O sea que a `storage.objects` no llega nunca nadie que no sea el
-- servidor. Poner ahí políticas sería escribir una segunda cerradura
-- para una puerta a la que no da ninguna calle — y ya sabemos lo que
-- pasa con dos reglas para lo mismo.
--
-- Lo que SÍ lleva cerradura es la tabla de abajo, que es por donde se
-- sabe qué fotos existen.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  QUIÉN VE LAS FOTOS · EL MODELO NO SIRVE AQUÍ, Y HAY QUE DECIRLO
--
-- Se intentó con `puede(casa,'casa',null,'mirar')`, que sería lo
-- coherente. Y da dos respuestas equivocadas:
--
--     asesor       →  mirar  →  SÍ     ← un asesor NO ve los retratos
--     dispositivo  →  nada   →  NO     ← la pared TIENE que verlos
--
-- Justo al revés en los dos casos. No es que el modelo esté mal: es que
-- esto es una categoría nueva. Una foto de la cocina es de **quien vive
-- en la casa y de la pared**, y de nadie más — ni de la ayuda, ni del
-- asesor, por mucho acceso que tengan a papeles.
--
-- Así que se escribe UNA función, `de_casa_o_pared`, y las tres
-- políticas la usan. Lo que no se hace es repetir el `coalesce` a mano
-- en cada una: eso es exactamente lo que falló dos veces en el paso 71.
--
-- ─────────────────────────────────────────────────────────────
-- Y LA PARED SUBE, PERO NO BORRA
--
-- Subir es la mitad de lo que se pidió, así que un `dispositivo` puede
-- insertar aquí — es la ÚNICA tabla de MAPPEL donde puede escribir algo
-- que no sea la lista de la compra.
--
-- Borrar no. Una pantalla colgada en una pared, a la que llega
-- cualquiera que entre en la casa, no puede hacer desaparecer una foto.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop table fotos_casa;
--     drop function de_casa_o_pared(uuid);
--     delete from storage.buckets where id = 'fotos-casa';

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
declare falta text;
begin
  foreach falta in array array['soy_pantalla_de_casa', 'soy_de', 'mi_rol'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = falta
    ) then
      raise exception 'ABORTADO: falta la funcion `%`. Hay pasos anteriores sin dar.', falta;
    end if;
  end loop;

  raise notice 'Puerta pasada. Casas: %  ·  pantallas colgadas: %',
    (select count(*) from hogares),
    (select count(*) from miembros where clase = 'dispositivo');
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · QUIÉN ES DE LA CASA O ES LA PARED
-- ═══════════════════════════════════════════════════════════════
/*
  Un sitio, una respuesta. Las tres políticas de abajo preguntan aquí.

  `coalesce(m.rol, 'familia')` porque la gente de antes de que existiera
  la columna tiene el rol a nulo y es familia — es el mismo caso que
  rompió dos veces el paso 71, y aquí está escrito UNA vez en lugar de
  tres.
*/
create or replace function de_casa_o_pared(casa uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select m.clase = 'dispositivo' or coalesce(m.rol, 'familia') = 'familia'
      from miembros m
     where m.perfil_id = auth.uid()
       and m.hogar_id  = casa
       and m.aceptado_en is not null
  ), false)
$$;

revoke all on function de_casa_o_pared(uuid) from public, anon;
grant execute on function de_casa_o_pared(uuid) to authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════
-- 2 · LA TABLA
-- ═══════════════════════════════════════════════════════════════
create table if not exists fotos_casa (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references hogares(id) on delete cascade,

  /* Dónde está el fichero dentro del cubo: «<hogar_id>/<uuid>.jpg».
     El cubo va aparte y no aquí: si algún día se cambia de sitio, se
     cambia en un fichero de código y no en cada fila. */
  ruta        text not null,

  /*
    Quién la subió. `on delete set null` y NO cascade, a diferencia de
    `recordatorios.creado_por`: el día que alguien salga de la casa, sus
    tareas son suyas pero **las fotos de la familia son de la familia**.
    Borrar a una persona no puede llevarse los retratos.

    Es exactamente la trampa que dejó anotada el paso 70, resuelta al
    revés porque aquí la respuesta correcta es la otra.
  */
  subida_por  uuid references perfiles(id) on delete set null,

  /* Opcional y corto. Una foto en una cocina no necesita metadatos,
     pero «Verano en Los Realejos» cuesta poco y dice mucho. */
  pie         text check (pie is null or length(trim(pie)) between 1 and 80),

  creado_en   timestamptz not null default now()
);

comment on table fotos_casa is
  'Fotos que pasan en la pantalla de la cocina. Paso 73.';

create index if not exists fotos_casa_por_casa
  on fotos_casa (hogar_id, creado_en desc);


-- ═══════════════════════════════════════════════════════════════
-- 3 · LA CERRADURA
-- ═══════════════════════════════════════════════════════════════
alter table fotos_casa enable row level security;

/*
  Los permisos de columna, con la forma que enseñó el paso 68: primero
  se quita todo, y luego se da lo justo. `revoke ... from public` NO
  quita lo que `anon` y `authenticated` tienen por nombre —eso lo
  descubrimos por las malas—, así que se les nombra.

  Y el INSERT va por columnas: `id` y `creado_en` los pone la base, y
  nadie debe poder escribirlos a mano.
*/
revoke all on table fotos_casa from public, anon, authenticated;
grant select on table fotos_casa to authenticated;
grant insert (hogar_id, ruta, subida_por, pie) on table fotos_casa to authenticated;
grant delete on table fotos_casa to authenticated;

drop policy if exists "fotos_leer" on fotos_casa;
create policy "fotos_leer" on fotos_casa for select to authenticated
  using ( de_casa_o_pared(hogar_id) );

/* La pared SÍ sube: es la mitad de lo que se pidió, y la única tabla
   de MAPPEL donde un aparato escribe algo que no es la compra.
   `subida_por = auth.uid()` para que nadie suba a nombre de otro. */
drop policy if exists "fotos_subir" on fotos_casa;
create policy "fotos_subir" on fotos_casa for insert to authenticated
  with check ( de_casa_o_pared(hogar_id) and subida_por = auth.uid() );

/* Y no borra. Cualquiera que entre en la casa puede tocar esa pantalla;
   hacer desaparecer una foto de la familia no puede estar a un toque de
   distancia de un invitado. */
drop policy if exists "fotos_quitar" on fotos_casa;
create policy "fotos_quitar" on fotos_casa for delete to authenticated
  using ( de_casa_o_pared(hogar_id) and not soy_pantalla_de_casa(hogar_id) );


-- ═══════════════════════════════════════════════════════════════
-- 4 · EL CUBO
-- ═══════════════════════════════════════════════════════════════
/*
  Privado —`public = false`— y con tope de tamaño y de tipo en el propio
  cubo, que es la cerradura que no depende de que el código se acuerde.

  Envuelto porque en la base de ensayo local no existe el esquema
  `storage`: ahí el paso se aplica igual y solo se salta esto.
*/
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'No hay esquema `storage` (base de ensayo). El cubo se salta.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos-casa', 'fotos-casa', false, 8388608,
          array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
     set public = false,
         file_size_limit = 8388608,
         allowed_mime_types = array['image/jpeg','image/png','image/webp'];

  raise notice 'Cubo `fotos-casa` listo: privado, 8 MB por foto, solo imagenes.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 5 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  casa uuid; dela uuid; laAyuda uuid; elAsesor uuid; laPantalla uuid; borradas int;
  r boolean;
begin
  select m.hogar_id, m.perfil_id into casa, dela
    from miembros m
   where m.clase='persona' and m.papel='propietario' and m.aceptado_en is not null limit 1;

  if dela is null then
    raise notice 'No hay con quien probar. Se aplica igual.';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', dela::text, true);
  select de_casa_o_pared(casa) into r;
  if not r then raise exception 'ABORTADO: el dueno de la casa no ve las fotos.'; end if;
  raise notice 'El dueno de la casa: ve las fotos.';

  select perfil_id into laAyuda from miembros
   where hogar_id = casa and rol = 'ayuda' and aceptado_en is not null limit 1;
  if laAyuda is not null then
    perform set_config('request.jwt.claim.sub', laAyuda::text, true);
    select de_casa_o_pared(casa) into r;
    if r then raise exception 'ABORTADO: la ayuda ve las fotos de la familia. No debe.'; end if;
    raise notice 'La ayuda: no ve las fotos. Bien.';
  end if;

  select perfil_id into elAsesor from miembros
   where hogar_id = casa and rol = 'asesor' and aceptado_en is not null limit 1;
  if elAsesor is not null then
    perform set_config('request.jwt.claim.sub', elAsesor::text, true);
    select de_casa_o_pared(casa) into r;
    if r then raise exception 'ABORTADO: el asesor ve las fotos de la familia. No debe.'; end if;
    raise notice 'El asesor: no ve las fotos. Bien.';
  end if;

  select perfil_id into laPantalla from miembros
   where hogar_id = casa and clase = 'dispositivo' and aceptado_en is not null limit 1;
  if laPantalla is not null then
    perform set_config('request.jwt.claim.sub', laPantalla::text, true);
    select de_casa_o_pared(casa) into r;
    if not r then raise exception 'ABORTADO: la pantalla de la cocina no ve las fotos.'; end if;
    raise notice 'La pantalla de la cocina: ve las fotos. Bien.';

    /* Y que puede SUBIR pero no BORRAR. Se prueba de verdad. */
    set local role authenticated;
    insert into fotos_casa (hogar_id, ruta, subida_por)
      values (casa, 'prueba/ensayo.jpg', laPantalla);
    raise notice 'La pantalla de la cocina: sube. Bien.';

    /* Un `with ... delete` no se puede meter dentro de un `if`: Postgres
       exige que una consulta que escribe vaya al primer nivel. Va a una
       variable y se mira después. */
    with t as (delete from fotos_casa where hogar_id = casa returning 1)
      select count(*) into borradas from t;
    reset role;

    if borradas > 0 then
      raise exception 'ABORTADO: la pantalla de la cocina ha podido borrar % foto(s). No debe.',
        borradas;
    end if;
    raise notice 'La pantalla de la cocina: no borra. Bien.';

    /* Y se deja limpio: esto era una prueba. */
    delete from fotos_casa where ruta = 'prueba/ensayo.jpg';
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Quién ve las fotos de cada casa. La familia y la pantalla en
--     «SI»; la ayuda y el asesor en «NO».
select
  h.nombre                       as la_casa,
  p.nombre                       as quien,
  coalesce(m.rol, '—')           as su_papel,
  m.clase,
  case when m.clase = 'dispositivo' or coalesce(m.rol,'familia') = 'familia'
       then 'SI' else 'NO' end   as ve_las_fotos
from miembros m
join perfiles p on p.id = m.perfil_id
join hogares h  on h.id = m.hogar_id
where m.aceptado_en is not null
order by 1, 5 desc, 2;

-- 2 · La tabla, con sus tres políticas y ninguna más.
select
  count(*) filter (where cmd = 'SELECT') as leer_DEBE_SER_1,
  count(*) filter (where cmd = 'INSERT') as subir_DEBE_SER_1,
  count(*) filter (where cmd = 'DELETE') as quitar_DEBE_SER_1,
  count(*) filter (where cmd = 'UPDATE') as cambiar_DEBE_SER_0
from pg_policies where schemaname = 'public' and tablename = 'fotos_casa';

commit;
