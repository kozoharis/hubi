-- ═══════════════════════════════════════════════════════════════
-- 84 · QUIÉN VE CADA LISTA DE LA COMPRA
-- ═══════════════════════════════════════════════════════════════
--
-- Haris: *«que algunas listas de la compra puedan sólo verla la
-- familia, personas específicas o todo de la casa… así si hay algunas
-- compras que son más delicadas aparezcan sólo para los que
-- intervienen en ella»*.
--
-- Tres niveles por lista:
--
--     casa      todo el mundo de la casa. Como nacen todas.
--     familia   sólo quien tiene rol `familia`. Fuera la ayuda,
--               el asesor y quien sólo mira.
--     algunos   sólo las personas que se elijan, una a una.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  Y DE PASO, UN AGUJERO QUE LLEVA AHÍ DESDE EL SQL 16
--
-- La política de lectura de `compra` es, literalmente:
--
--     create policy compra_leer on compra
--       for select to authenticated using (true);
--
-- `true`. Sin `soy_de(hogar_id)` ni nada. O sea que hoy **cualquiera
-- que haya entrado en mappel puede leer la compra de cualquier casa**,
-- no sólo de la suya. No se nota porque las pantallas siempre filtran
-- por `hogar_id` al preguntar — pero la política es lo que protege, no
-- la pantalla, y ésta no protege.
--
-- Nació correcta para lo que había entonces: una casa, dos personas, y
-- «la compra es de los dos, entera». Con espacios, ayuda y asesor dejó
-- de serlo, y las tandas siguientes arreglaron `crear`, `editar` y
-- `borrar` y se dejaron `leer`.
--
-- Esto habría que arreglarlo aunque no quisiéramos lo de las listas
-- delicadas. Y además es la razón por la que lo de las listas
-- delicadas NO se puede hacer sólo en la pantalla: **si la lectura
-- está abierta, esconder una lista en la interfaz no la esconde.**
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE NO CAMBIA PARA NADIE
--
-- Todas las listas nacen y se quedan en `casa`. Hasta que alguien
-- diga otra cosa, esto no esconde absolutamente nada — lo único que
-- cambia de verdad el primer día es que la compra deja de verse desde
-- fuera de la casa, que es como tenía que haber estado siempre.
--
-- ─────────────────────────────────────────────────────────────
-- TRES DECISIONES QUE PARECEN DETALLES Y NO LO SON
--
-- 1 · LO QUE NO ESTÁ EN NINGUNA LISTA ES DE LA CASA.
--     `compra.lista_id` puede ser nulo: lo apuntado por voz, lo de
--     antes de que existieran las listas. Si eso se escondiera, el
--     primer día se le vaciaría la compra a media casa. Sin lista =
--     de la casa, y punto.
--
-- 2 · QUIEN LA CREA SIEMPRE LA VE.
--     Aunque ponga `algunos` y se olvide de incluirse. Si no, se
--     puede uno encerrar fuera de su propia lista y no hay manera de
--     volver a entrar: no se ve ni para cambiarla.
--
-- 3 · ESCRIBIR VA DETRÁS DE VER.
--     Quien no puede ver una lista tampoco puede apuntar en ella. Sin
--     esto se podría añadir a ciegas a una lista que no se ve, y lo
--     apuntado saldría en la pantalla de quien sí la ve, venido de la
--     nada.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop policy if exists compra_leer on compra;
--     create policy compra_leer on compra for select to authenticated using (true);
--     drop policy if exists listas_leer on listas_compra;
--     create policy listas_leer on listas_compra for select to authenticated
--       using (hogar_id = mi_hogar());
--     drop table if exists listas_compra_quien;
--     alter table listas_compra drop column if exists quien_ve;
--     drop function if exists puedo_ver_lista(uuid);
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
/*
  Nada de lo de abajo tiene sentido sin estas tres cosas. Y fallar
  aquí, con un mensaje que se lee, es infinitamente mejor que fallar
  a la mitad y dejar las políticas de la compra en un estado que nadie
  sabe cuál es.
*/
do $p84$
begin
  if to_regclass('public.listas_compra') is null then
    raise exception 'ABORTADO: no existe `listas_compra`. Falta el sql/23.';
  end if;
  if to_regprocedure('public.soy_de(uuid)') is null then
    raise exception 'ABORTADO: no existe `soy_de`. Falta el sql/56.';
  end if;
  if to_regprocedure('public.mi_rol(uuid)') is null then
    raise exception 'ABORTADO: no existe `mi_rol(casa)`. Falta el sql/56.';
  end if;

  raise notice 'Puerta pasada. Listas: %. Cosas en la compra: %.',
    (select count(*) from listas_compra),
    (select count(*) from compra);
end $p84$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · QUIÉN LA VE
-- ═══════════════════════════════════════════════════════════════
alter table listas_compra
  add column if not exists quien_ve text not null default 'casa';

/*
  La restricción se pone aparte y con su nombre, para poder volver a
  ejecutar el archivo sin que Postgres se queje de que ya existe.
*/
do $q84$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'listas_compra_quien_ve_ok'
  ) then
    alter table listas_compra
      add constraint listas_compra_quien_ve_ok
      check (quien_ve in ('casa', 'familia', 'algunos'));
  end if;
end $q84$;

comment on column listas_compra.quien_ve is
  'casa | familia | algunos. Quién ve esta lista. Paso 84.';


-- ── Y quiénes, cuando son algunos ──────────────────────────
/*
  Una tabla y no una columna con una lista dentro: así una persona que
  deja la casa desaparece de todas sus listas SOLA, por la clave
  ajena, sin que nadie tenga que acordarse de repasarlas.

  Es exactamente lo contrario de lo que pasa hoy con las tareas de
  quien se va, que se quedan apuntando a un nombre que ya no está.
*/
create table if not exists listas_compra_quien (
  lista_id   uuid not null references listas_compra(id) on delete cascade,
  perfil_id  uuid not null references perfiles(id)      on delete cascade,
  primary key (lista_id, perfil_id)
);

create index if not exists idx_listas_quien_perfil
  on listas_compra_quien (perfil_id);

alter table listas_compra_quien enable row level security;


-- ═══════════════════════════════════════════════════════════════
-- 2 · LA PREGUNTA, EN UN SOLO SITIO
-- ═══════════════════════════════════════════════════════════════
/*
  `security definer` para que la función pueda mirar `listas_compra`
  por dentro sin quedar atrapada en la política de lectura de la
  propia tabla —que es justo la que va a usar esta función—. Sin esto
  la política se preguntaría a sí misma y no devolvería nada nunca.

  `stable` y no `volatile`: dentro de una misma consulta contesta lo
  mismo, así que Postgres puede llamarla una vez por lista en vez de
  una vez por fila. Con doscientas cosas en la compra eso es la
  diferencia entre una consulta y doscientas.
*/
create or replace function puedo_ver_lista(lista uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $v84$
  select case
    /* Sin lista, de la casa. Lo apuntado por voz y lo de antes de que
       las listas existieran. */
    when lista is null then true
    else exists (
      select 1 from listas_compra l
       where l.id = lista
         and soy_de(l.hogar_id)
         and (
              l.quien_ve = 'casa'
           or (l.quien_ve = 'familia'
               and coalesce(mi_rol(l.hogar_id), 'familia') = 'familia')
           or (l.quien_ve = 'algunos'
               and exists (select 1 from listas_compra_quien q
                            where q.lista_id = l.id and q.perfil_id = auth.uid()))
           /* Y quien la creó, siempre. Que nadie se encierre fuera. */
           or l.creada_por = auth.uid()
         )
    )
  end
$v84$;

revoke all on function puedo_ver_lista(uuid) from public, anon;
grant execute on function puedo_ver_lista(uuid) to authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════
-- 3 · LAS POLÍTICAS
-- ═══════════════════════════════════════════════════════════════

-- ── Las listas ─────────────────────────────────────────────
/*
  `soy_de(hogar_id)` y no `hogar_id = mi_hogar()`, que es lo que había:
  `mi_hogar()` devuelve LA casa activa, así que quien tiene dos casas
  dejaba de ver las listas de la otra según por dónde entrara. Es la
  misma corrección que se le hizo al resto de tablas en el paso 56 y a
  ésta se le pasó.
*/
drop policy if exists listas_leer on listas_compra;
create policy listas_leer on listas_compra
  for select to authenticated
  using ( soy_de(hogar_id) and puedo_ver_lista(id) );

/*
  Cambiar una lista —su nombre, su día, quién la ve— sólo quien la ve.
  Y borrarla, igual.
*/
drop policy if exists listas_editar on listas_compra;
create policy listas_editar on listas_compra
  for update to authenticated
  using ( soy_de(hogar_id) and puedo_ver_lista(id) )
  with check ( soy_de(hogar_id) );

drop policy if exists listas_borrar on listas_compra;
create policy listas_borrar on listas_compra
  for delete to authenticated
  using ( soy_de(hogar_id) and puedo_ver_lista(id) );

/* Crear: de tu casa, y a tu nombre. Lo de «a tu nombre» es lo que
   hace cierta la regla de que quien la crea siempre la ve. */
drop policy if exists listas_crear on listas_compra;
create policy listas_crear on listas_compra
  for insert to authenticated
  with check ( soy_de(hogar_id) and creada_por = auth.uid() );


-- ── Quiénes la ven ─────────────────────────────────────────
/*
  Se lee y se cambia si se ve la lista. O sea: quien puede ver una
  lista puede cambiar a quién más se la enseña.

  Es deliberado y conviene que quede escrito. La alternativa —que sólo
  mande quien la creó— suena más segura y en una casa no lo es: deja
  una lista compartida que sólo una persona puede abrir a los demás, y
  el día que esa persona esté de viaje no hay salida.
*/
drop policy if exists listas_quien_leer on listas_compra_quien;
create policy listas_quien_leer on listas_compra_quien
  for select to authenticated using ( puedo_ver_lista(lista_id) );

drop policy if exists listas_quien_poner on listas_compra_quien;
create policy listas_quien_poner on listas_compra_quien
  for insert to authenticated with check ( puedo_ver_lista(lista_id) );

drop policy if exists listas_quien_quitar on listas_compra_quien;
create policy listas_quien_quitar on listas_compra_quien
  for delete to authenticated using ( puedo_ver_lista(lista_id) );


-- ── Y la compra ────────────────────────────────────────────
/*
  Aquí está el arreglo de verdad. Deja de ser `true`.
*/
drop policy if exists compra_leer on compra;
create policy compra_leer on compra
  for select to authenticated
  using ( soy_de(hogar_id) and puedo_ver_lista(lista_id) );

/*
  Y escribir va detrás de ver, en las tres. Se conserva la condición
  que ya tenían —`puede(hogar_id, 'compra', null, 'anadir')`, del paso
  71, que es la que deja apuntar a la pantalla de la cocina— y se le
  añade la de la lista.

  Envuelto por si el paso 71 no se hubiera ejecutado en esta base: sin
  `puede`, se cae a `soy_de` a secas, que es lo que había antes de
  aquel paso. Lo que NUNCA se cae es la condición de la lista.
*/
do $e84$
declare escribir text;
begin
  if to_regprocedure('public.puede(uuid,text,uuid,text)') is not null then
    escribir := 'soy_de(hogar_id) and puede(hogar_id, ''compra'', null, ''anadir'')';
  else
    escribir := 'soy_de(hogar_id)';
  end if;

  execute 'drop policy if exists compra_crear on compra';
  execute format(
    'create policy compra_crear on compra for insert to authenticated with check (%s and puedo_ver_lista(lista_id))',
    escribir);

  execute 'drop policy if exists compra_editar on compra';
  execute format(
    'create policy compra_editar on compra for update to authenticated using (%s and puedo_ver_lista(lista_id))',
    escribir);

  execute 'drop policy if exists compra_borrar on compra';
  execute format(
    'create policy compra_borrar on compra for delete to authenticated using (%s and puedo_ver_lista(lista_id))',
    escribir);
end $e84$;

commit;


-- ═══════════════════════════════════════════════════════════════
-- 4 · COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta esto después y mira que sale lo que pone. Si algo no
-- cuadra, NO sigas: dímelo y lo miramos.

-- 4.1 · La columna existe y todas las listas nacen «casa».
select quien_ve, count(*) as listas
from listas_compra
group by quien_ve
order by quien_ve;
-- ESPERADO: una sola fila, `casa`, con todas tus listas.

-- 4.2 · La lectura de la compra ya no es `true`.
select polname as politica,
       pg_get_expr(polqual, polrelid) as condicion
from pg_policy
where polrelid = 'compra'::regclass and polcmd = 'r';
-- ESPERADO: `compra_leer` con `soy_de(hogar_id) AND puedo_ver_lista(lista_id)`.
-- Si pone `true`, el archivo no ha llegado hasta aquí.

-- 4.3 · Y que no se te ha escondido nada sin querer.
select count(*) as cosas_que_veo from compra;
-- ESPERADO: las mismas que veías antes de ejecutar esto.
