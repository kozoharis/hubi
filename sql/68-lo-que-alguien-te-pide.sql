-- ═══════════════════════════════════════════════════════════════
-- 68 · LO QUE ALGUIEN TE PIDE
-- ═══════════════════════════════════════════════════════════════
--
-- Hasta ahora, cuando Silvia necesita la factura de septiembre, lo
-- escribe en el hilo del asesor y ahí se queda: mezclado con lo demás,
-- sin saber si se hizo, y sin nada que lo recuerde. Una nota no tiene
-- estado, y esto lo tiene — está pedido, o está resuelto.
--
-- Esto crea la tabla `peticiones` y las dos maneras de cerrarla.
--
-- ─────────────────────────────────────────────────────────────
-- LA DECISIÓN DE HOY: LA RESUELVEN LOS DOS
--
-- Se pregunto si una peticion la resuelve solo aquel a quien va
-- dirigida o cualquiera de la casa, y la respuesta fue **cualquiera**.
--
-- Eso tiene una consecuencia que conviene decir en voz alta:
--
--     `pedida_a` es UNA PISTA, no un cerrojo.
--
-- Dice «te lo pido a ti» —y sirve para que a esa persona le salga
-- arriba, y para que le llegue el aviso— pero no impide que lo
-- resuelva la otra. Que es lo que pasa en una casa: uno pide los
-- papeles del seguro y los sube quien los tenga a mano.
--
-- Lo que SÍ hace falta para cerrar es poder ESCRIBIR en ese sitio
-- (`'anadir'`). Quien solo mira no puede declarar hecha una cosa que
-- no puede hacer.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ NO HAY `grant update` NINGUNO
--
-- El 66 y el 67 enseñaron que una política de RLS no sabe decir «esta
-- columna sí y esta no», y que la herramienta para eso son los
-- permisos por columna. Aquí se va un paso más allá: **la app no puede
-- escribir NI UNA columna** de esta tabla después de crear la fila.
--
-- Todo cambio de estado pasa por `cerrar_peticion` o por
-- `anular_peticion`, que son `security definer` y por tanto sí pueden.
-- Así no hay manera de marcar algo como hecho sin pasar por las
-- comprobaciones, ni de escribir un `cerrada_por` que no seas tú.
--
-- Y el INSERT también va por columnas: `pedida_por` y `estado` **no se
-- mandan**, los pone el valor por defecto (`auth.uid()` y `'abierta'`).
-- Una fila no puede nacer ya cerrada ni a nombre de otro.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     drop function anular_peticion(uuid, uuid, text);
--     drop function cerrar_peticion(uuid, uuid, uuid);
--     drop trigger peticiones_coherentes on peticiones;
--     drop function peticion_coherente();
--     drop table peticiones;
--     alter table categorias drop constraint categorias_id_hogar;

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
/*
  Este paso se apoya en seis funciones de los pasos 60-67. Si alguna no
  estuviera, la tabla se crearía igual y las políticas fallarían más
  tarde, en una pantalla, con un error que no diría esto.
*/
do $$
declare faltan text;
begin
  if exists (select 1 from pg_class where relname = 'peticiones' and relkind = 'r') then
    raise exception 'ABORTADO: la tabla `peticiones` ya existe. Este paso ya se dio.';
  end if;

  select string_agg(n, ', ') into faltan
    from unnest(array['soy_de','puede','ambito_de','raiz_de',
                      'es_propietario','soy_pantalla_de_casa','mi_rol']) as n
   where not exists (
     select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public' and p.proname = n);

  if faltan is not null then
    raise exception 'ABORTADO: faltan funciones de los pasos anteriores: %', faltan;
  end if;

  raise notice 'Puerta pasada: estan las siete funciones y la tabla no existe todavia.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA TABLA
-- ═══════════════════════════════════════════════════════════════
/*
  ── `ambito` y `ambito_id`, y por qué van los dos ──

  `ambito` es la clave canónica —de qué VA esto— y es la que leen las
  políticas. `ambito_id` es la carpeta raíz concreta, y es la que
  permite pedir algo «de Los Helechos» y no «de la finca en general».

  Los ámbitos que no son carpeta (`agenda`, `cuentas`, `compra`, `dia`)
  no llevan carpeta, y los que sí lo son la llevan obligatoriamente. Lo
  dice un `check`, porque es una regla de la fila y no de otra tabla.
*/
create table peticiones (
  id           uuid primary key default gen_random_uuid(),
  hogar_id     uuid not null references hogares(id) on delete cascade,

  ambito       text not null
    check (ambito in ('papeles','casa','vehiculos','seguros','salud',
                      'finca','actividad','cuentas','agenda','compra','dia','otros')),
  ambito_id    uuid,

  /* Qué se pide, en cristiano. «La factura de la luz de septiembre». */
  que          text not null check (length(btrim(que)) > 0),
  nota         text,

  /*
    Quién la pide. NO se manda desde la app: lo pone el valor por
    defecto. Así no existe el caso de pedir algo en nombre de otro, y
    no hace falta una política que lo compruebe.
  */
  pedida_por   uuid not null default auth.uid() references perfiles(id),

  /* A quién se le pide. Nulo = a la casa, a quien pueda. Es una PISTA:
     no impide que la resuelva otro. */
  pedida_a     uuid references perfiles(id),

  para_cuando  date,

  estado       text not null default 'abierta'
    check (estado in ('abierta','cerrada','anulada')),

  /* Con qué papel se cerró, si se cerró con uno. `set null` al borrar
     el documento: la petición sigue cerrada, lo que se pierde es el
     enlace. */
  papel        uuid references documentos(id) on delete set null,
  cerrada_por  uuid references perfiles(id),
  cerrada_en   timestamptz,
  /* Por qué se anuló. Anular sin decir por qué, no. */
  motivo       text,

  creada_en    timestamptz not null default now(),

  constraint peticion_ambito_forma check (
    ( ambito in ('agenda','cuentas','compra','dia') and ambito_id is null )
    or
    ( ambito not in ('agenda','cuentas','compra','dia') and ambito_id is not null )
  )
);

/*
  ── LA CARPETA ES DE ESTA CASA, Y LO GARANTIZA LA ESTRUCTURA ──

  Se podría comprobar con el disparador de abajo y ya. Pero una clave
  foránea COMPUESTA lo hace imposible de saltarse, también desde una
  función `security definer` —que es donde los disparadores sí corren
  pero las políticas no—.

  Hace falta que `categorias(id, hogar_id)` sea único. Lo es de sobra,
  porque `id` ya es la clave primaria: el índice no añade ninguna
  restricción nueva, solo le da a Postgres algo a lo que apuntar.
*/
alter table categorias add constraint categorias_id_hogar unique (id, hogar_id);

alter table peticiones
  add constraint peticiones_carpeta_de_esta_casa
  foreign key (ambito_id, hogar_id) references categorias(id, hogar_id)
  on delete restrict;

/* Lo abierto de una casa, que es lo que se pinta. Parcial: lo cerrado
   se acumula para siempre y no hace falta en este índice. */
create index idx_peticiones_abiertas
  on peticiones (hogar_id, creada_en desc) where estado = 'abierta';

/* Y lo que te han pedido A TI. */
create index idx_peticiones_para
  on peticiones (hogar_id, pedida_a) where estado = 'abierta';

comment on column peticiones.pedida_a is
  'A quien se le pide. Es una PISTA, no un cerrojo: la peticion la puede cerrar '
  'cualquiera de la casa que tenga nivel «anadir» en ese ambito. Decidido el 12 '
  'de septiembre de 2026.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · QUE LA CARPETA CONCUERDE CON EL ÁMBITO
-- ═══════════════════════════════════════════════════════════════
/*
  La clave foránea garantiza que la carpeta es de esta casa. Faltan dos
  cosas que una clave foránea no sabe mirar:

    · que sea una RAÍZ y no una subcarpeta — sin esto se podría colgar
      una petición de «Luz» y el permiso se evaluaría contra el ámbito
      de «Nuestra casa», que es otro sitio;
    · y que su `ambito` sea el que la fila declara.

  Va en un disparador y no en un `check` porque mira otra tabla.
*/
create or replace function peticion_coherente()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  el_ambito text;
  tiene_padre boolean;
begin
  if new.ambito_id is null then return new; end if;

  select c.ambito, c.padre_id is not null
    into el_ambito, tiene_padre
    from categorias c
   where c.id = new.ambito_id and c.hogar_id = new.hogar_id;

  if not found then
    raise exception 'Esa carpeta no es de esta casa.';
  end if;

  if tiene_padre then
    raise exception
      'Una peticion se cuelga de una carpeta RAIZ, no de una subcarpeta: el permiso '
      'se mira en la raiz y colgarla mas abajo lo evaluaria en otro sitio.';
  end if;

  /* `is distinct from` y no `<>`: una raíz sin clasificar tiene
     `ambito` nulo, y con `<>` la comparación daría NULL y el `if` no
     entraría — o sea, colaría. */
  if el_ambito is distinct from new.ambito then
    raise exception
      'La carpeta y el ambito no concuerdan: la carpeta dice % y la peticion dice %.',
      coalesce(el_ambito, 'sin clasificar'), new.ambito;
  end if;

  return new;
end $$;

comment on function peticion_coherente() is
  'Comprueba que `ambito_id` es una carpeta RAIZ de esta casa y que su `ambito` es '
  'el que la fila declara. En disparador y no en politica: los disparadores SI '
  'corren dentro de las funciones security definer, que es por donde se escribe.';

create trigger peticiones_coherentes
  before insert or update on peticiones
  for each row execute function peticion_coherente();


-- ═══════════════════════════════════════════════════════════════
-- 3 · QUIÉN LAS VE Y QUIÉN LAS CREA
-- ═══════════════════════════════════════════════════════════════
alter table peticiones enable row level security;

/*
  ⚠️  UNA TABLA NUEVA EN SUPABASE NACE ABIERTA DE PAR EN PAR.

  Esto lo cazó la comprobación de abajo, y no lo sabía:

      select defaclrole::regrole, defaclobjtype, defaclacl from pg_default_acl;
      → postgres | r | {anon=arwdDxt/postgres,
                        authenticated=arwdDxt/postgres,
                        service_role=arwdDxt/postgres}

  Supabase deja puestos unos PERMISOS POR DEFECTO sobre el esquema
  `public`: toda tabla que se cree ahí le llega a `anon`, a
  `authenticated` y a `service_role` con **todos** los permisos —leer,
  insertar, actualizar, borrar, truncar— sin que nadie los conceda.

  O sea que la primera versión de este paso, que hacía

      revoke all on table peticiones from public;

  no quitaba nada: el permiso no estaba concedido a `public`, estaba
  concedido a `anon` y a `authenticated` por su nombre, y un `revoke` a
  `public` no toca los que van por nombre. La tabla se quedaba con
  UPDATE y DELETE abiertos, y todo el apartado 2 —«ni un `grant update`
  ninguno»— era mentira.

  Lo comprobó la prueba 3: cerró una petición con un `update` a pelo y
  lo consiguió.

  Y `anon` es todavía peor que `authenticated`: es el rol de quien
  NO ha entrado. Las políticas de RLS lo pararían igual —todas piden
  `auth.uid()`— pero eso es depender de la segunda puerta porque la
  primera se dejó abierta.

  La forma correcta es quitárselo a los tres por su nombre y devolver
  solo lo que hace falta, a quien hace falta.
*/
revoke all on table peticiones from public, anon, authenticated;
grant select on table peticiones to authenticated;

/*
  El INSERT, por columnas. Las que no están aquí no se pueden mandar:

    `pedida_por` · lo pone `default auth.uid()`
    `estado`     · lo pone `default 'abierta'`
    `papel`, `cerrada_por`, `cerrada_en`, `motivo` · solo las RPC

  Sin esto, una fila podría nacer cerrada, o a nombre de otro, y las
  dos comprobaciones de abajo se quedarían sin trabajo.
*/
grant insert (hogar_id, ambito, ambito_id, que, nota, pedida_a, para_cuando)
  on table peticiones to authenticated;

/* Y ni un UPDATE ni un DELETE. Todo cambio va por las dos funciones. */

create policy "peticiones_leer"
  on peticiones for select to authenticated
  using (
    soy_de(hogar_id)
    and puede(hogar_id, ambito, ambito_id, 'mirar')
  );

/* La pantalla de la cocina no se entera de esto. Restrictiva, como las
   del 63 y el 64: se suma a la de arriba en vez de competir con ella. */
create policy "peticiones_la_cocina_no"
  on peticiones as restrictive for select to authenticated
  using ( not soy_pantalla_de_casa(hogar_id) );

create policy "peticiones_pedir"
  on peticiones for insert to authenticated
  with check (
    soy_de(hogar_id)
    and not soy_pantalla_de_casa(hogar_id)
    /* Solo se puede pedir algo de un sitio que puedas ver. Pedir a
       ciegas sobre Salud sería una manera de averiguar que existe. */
    and puede(hogar_id, ambito, ambito_id, 'mirar')
  );


-- ═══════════════════════════════════════════════════════════════
-- 4 · CERRARLA
-- ═══════════════════════════════════════════════════════════════
/*
  ── EL PAPEL CON EL QUE SE CIERRA, TRES CONDICIONES ──

  «Es de la misma casa» no basta. Sin las otras dos, un asesor podría
  cerrar una petición de Cuentas adjuntando un informe médico que ni
  siquiera puede abrir, y dejar su identificador escrito en una fila
  que sí ve. O sea: enterarse de que ese informe existe.

    1 · el documento es de esta casa y no está borrado;
    2 · TÚ puedes verlo — con `puede(...,'mirar')`, que es la misma
        función que gobierna la pantalla: no hay una regla para mirar y
        otra para cerrar;
    3 · y es del mismo ámbito que la petición. Un «Modelo 303» de
        Cuentas no se cierra con un papel de Salud, ni al revés.
*/
create or replace function cerrar_peticion(casa uuid, la_peticion uuid, el_papel uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare p peticiones;
begin
  if not soy_de(casa) then
    raise exception 'No eres de esa casa.';
  end if;
  if soy_pantalla_de_casa(casa) then
    raise exception 'Una pantalla de casa no cierra peticiones.';
  end if;

  select * into p from peticiones
   where id = la_peticion and hogar_id = casa and estado = 'abierta';
  if not found then
    raise exception 'Esa peticion no existe en esta casa, o ya no esta abierta.';
  end if;

  /* Para cerrarla hay que poder escribir ahí. Quien solo mira no
     declara hecha una cosa que no puede hacer. */
  if not puede(casa, p.ambito, p.ambito_id, 'anadir') then
    raise exception 'No puedes cerrar peticiones de ese sitio.';
  end if;

  if el_papel is not null then
    if not exists (
      select 1 from documentos d
       where d.id = el_papel
         and d.hogar_id = casa
         and d.eliminado_en is null
         and puede(casa, ambito_de(d.categoria_id), d.categoria_id, 'mirar')
         and ambito_de(d.categoria_id) = p.ambito
         and ( p.ambito_id is null or raiz_de(d.categoria_id) = p.ambito_id )
    ) then
      raise exception
        'Ese papel no vale para cerrar esta peticion: o no es de esta casa, o no '
        'puedes verlo, o es de otro sitio.';
    end if;
  end if;

  update peticiones
     set estado      = 'cerrada',
         papel       = el_papel,
         cerrada_por = auth.uid(),
         cerrada_en  = now()
   where id = la_peticion;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 5 · ANULARLA
-- ═══════════════════════════════════════════════════════════════
/*
  Cerrar es «ya está». Anular es «esto ya no hace falta», y son cosas
  distintas: una petición anulada no cuenta como resuelta.

  Quién puede: quien la pidió (se retracta), a quien se la piden (la
  rechaza), el dueño de la casa, la familia —es su casa— y quien manda
  en ese ámbito. El dueño estaba fuera de la primera versión de esta
  regla, que decía `mi_rol(casa) = 'familia'` y confundía los dos ejes:
  `rol` y `papel` son cosas distintas.
*/
create or replace function anular_peticion(casa uuid, la_peticion uuid, el_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
declare p peticiones;
begin
  if not soy_de(casa) then
    raise exception 'No eres de esa casa.';
  end if;
  if soy_pantalla_de_casa(casa) then
    raise exception 'Una pantalla de casa no anula peticiones.';
  end if;
  if el_motivo is null or length(btrim(el_motivo)) = 0 then
    raise exception 'Para anular una peticion hay que decir por que.';
  end if;

  select * into p from peticiones
   where id = la_peticion and hogar_id = casa and estado = 'abierta';
  if not found then
    raise exception 'Esa peticion no existe en esta casa, o ya no esta abierta.';
  end if;

  if not (
       p.pedida_por = auth.uid()
    or p.pedida_a   = auth.uid()
    or es_propietario(casa)
    or mi_rol(casa) = 'familia'
    or puede(casa, p.ambito, p.ambito_id, 'todo')
  ) then
    raise exception 'No puedes anular esta peticion.';
  end if;

  update peticiones
     set estado      = 'anulada',
         motivo      = btrim(el_motivo),
         cerrada_por = auth.uid(),
         cerrada_en  = now()
   where id = la_peticion;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 6 · LAS DOS FUNCIONES, CERRADAS A `public`
-- ═══════════════════════════════════════════════════════════════
/*
  Una `security definer` ejecutable por cualquiera es una puerta que se
  salta las políticas y que puede abrir quien no ha entrado siquiera.

  Y aquí pasa lo MISMO que con la tabla, por el mismo motivo: los
  permisos por defecto de Supabase incluyen

      postgres | f | {anon=X/postgres, authenticated=X/postgres, ...}

  o sea que **toda función nueva nace ejecutable por `anon`**. Un
  `revoke ... from public` no se lo quita, porque `anon` lo tiene a su
  nombre.

  Por eso van los tres: `public`, `anon` y `authenticated`, y luego se
  devuelve solo a `authenticated`.

  `peticion_coherente` no se devuelve a nadie: es un disparador y lo
  llama Postgres, no la app.
*/
revoke execute on function cerrar_peticion(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function anular_peticion(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function peticion_coherente()              from public, anon, authenticated;
grant  execute on function cerrar_peticion(uuid, uuid, uuid) to authenticated;
grant  execute on function anular_peticion(uuid, uuid, text) to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 7 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
/*
  Lo que tiene que funcionar y lo que tiene que fallar, aquí dentro y
  con la transacción abierta. Si algo no sale como debe, no se confirma
  nada.

  Se prueba contra la casa que haya, con su propietario. Si la base
  estuviera vacía, se dice y se aplica igual.
*/
do $$
declare
  casa uuid; dueno uuid; raiz uuid; sub uuid; el_ambito text;
  laPeticion uuid; ok boolean;
begin
  select m.hogar_id, m.perfil_id into casa, dueno
    from miembros m
   where m.papel = 'propietario' and m.clase = 'persona' and m.aceptado_en is not null
   limit 1;

  select c.id, c.ambito into raiz, el_ambito
    from categorias c
   where c.hogar_id = casa and c.padre_id is null and c.ambito is not null
   limit 1;

  select c.id into sub
    from categorias c where c.hogar_id = casa and c.padre_id is not null limit 1;

  if casa is null or raiz is null then
    raise notice 'Sin datos con los que probar. Se aplica igual.';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', dueno::text, true);

  -- ── 1 · TIENE que funcionar: pedir algo ──
  set local role authenticated;
  insert into peticiones (hogar_id, ambito, ambito_id, que)
    values (casa, el_ambito, raiz, 'La factura de septiembre')
    returning id into laPeticion;
  reset role;
  raise notice 'Pedir algo: funciona.';

  -- ── 2 · y `pedida_por` es quien lo pidio, sin haberlo mandado ──
  if (select pedida_por from peticiones where id = laPeticion) is distinct from dueno then
    raise exception 'ABORTADO: `pedida_por` no se ha puesto solo.';
  end if;
  if (select estado from peticiones where id = laPeticion) <> 'abierta' then
    raise exception 'ABORTADO: la peticion no ha nacido abierta.';
  end if;
  raise notice 'Nace abierta y a nombre de quien la pide: correcto.';

  -- ── 3 · TIENE que fallar: escribir el estado a mano ──
  begin
    set local role authenticated;
    update peticiones set estado = 'cerrada' where id = laPeticion;
    reset role; ok := true;
  exception when others then reset role; ok := false; end;
  if ok then
    raise exception 'ABORTADO: todavia se puede cerrar una peticion a mano, sin pasar por la funcion.';
  end if;
  raise notice 'Cerrarla a mano: BLOQUEADO.';

  -- ── 4 · TIENE que fallar: colgarla de una SUBcarpeta ──
  if sub is not null then
    begin
      set local role authenticated;
      insert into peticiones (hogar_id, ambito, ambito_id, que)
        values (casa, el_ambito, sub, 'De una subcarpeta');
      reset role; ok := true;
    exception when others then reset role; ok := false; end;
    if ok then
      raise exception 'ABORTADO: se ha podido colgar una peticion de una subcarpeta.';
    end if;
    raise notice 'Colgarla de una subcarpeta: BLOQUEADO.';
  end if;

  -- ── 5 · TIENE que fallar: un ambito sin carpeta que lleva carpeta ──
  begin
    set local role authenticated;
    insert into peticiones (hogar_id, ambito, ambito_id, que)
      values (casa, 'cuentas', raiz, 'Cuentas con carpeta');
    reset role; ok := true;
  exception when others then reset role; ok := false; end;
  if ok then
    raise exception 'ABORTADO: `cuentas` ha aceptado una carpeta.';
  end if;
  raise notice 'Un ambito sin carpeta con carpeta puesta: BLOQUEADO.';

  -- ── 6 · TIENE que funcionar: cerrarla por la funcion ──
  set local role authenticated;
  perform cerrar_peticion(casa, laPeticion, null);
  reset role;
  if (select estado from peticiones where id = laPeticion) <> 'cerrada' then
    raise exception 'ABORTADO: `cerrar_peticion` no ha cerrado nada.';
  end if;
  if (select cerrada_por from peticiones where id = laPeticion) is distinct from dueno then
    raise exception 'ABORTADO: `cerrada_por` no es quien la ha cerrado.';
  end if;
  raise notice 'Cerrarla por la funcion: funciona, y deja escrito quien fue.';

  -- ── 7 · TIENE que fallar: cerrar la misma dos veces ──
  begin
    set local role authenticated;
    perform cerrar_peticion(casa, laPeticion, null);
    reset role; ok := true;
  exception when others then reset role; ok := false; end;
  if ok then
    raise exception 'ABORTADO: se ha podido cerrar dos veces la misma peticion.';
  end if;
  raise notice 'Cerrarla dos veces: BLOQUEADO.';

  -- ── 8 · TIENE que fallar: anular sin decir por que ──
  set local role authenticated;
  insert into peticiones (hogar_id, ambito, ambito_id, que)
    values (casa, el_ambito, raiz, 'Otra cosa') returning id into laPeticion;
  reset role;
  begin
    set local role authenticated;
    perform anular_peticion(casa, laPeticion, '   ');
    reset role; ok := true;
  exception when others then reset role; ok := false; end;
  if ok then
    raise exception 'ABORTADO: se ha podido anular sin motivo.';
  end if;
  raise notice 'Anular sin motivo: BLOQUEADO.';

  -- ── 9 · y con motivo, funciona ──
  set local role authenticated;
  perform anular_peticion(casa, laPeticion, 'Ya la trajo en mano');
  reset role;
  if (select estado from peticiones where id = laPeticion) <> 'anulada' then
    raise exception 'ABORTADO: `anular_peticion` no ha anulado nada.';
  end if;
  raise notice 'Anular con motivo: funciona.';

  /* Las de prueba no se quedan. Se borran con el rol de dueño de la
     base, que es el único que puede: `authenticated` no tiene DELETE. */
  delete from peticiones where hogar_id = casa;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Qué puede hacer la app con esta tabla.
--     Tiene que salir: leer sí, insertar sí, cambiar NO, borrar NO.
select
  has_table_privilege('authenticated','peticiones','select') as leer_DEBE_SER_true,
  /* `has_any_column_privilege` y no `has_table_privilege`: el permiso
     de crear se dio POR COLUMNAS, y a nivel de tabla es false a
     propósito. Con la función de tabla, este parte diría que no se
     pueden crear peticiones — y sí se pueden. */
  has_any_column_privilege('authenticated','peticiones','insert') as crear_DEBE_SER_true,
  has_table_privilege('authenticated','peticiones','update') as cambiar_DEBE_SER_false,
  has_table_privilege('authenticated','peticiones','delete') as borrar_DEBE_SER_false,
  has_table_privilege('public','peticiones','select')        as public_lee_DEBE_SER_false,
  /* El rol de quien no ha entrado. Las cuatro en false. */
  has_table_privilege('anon','peticiones','select')          as anon_lee_DEBE_SER_false,
  has_table_privilege('anon','peticiones','insert')          as anon_crea_DEBE_SER_false;

-- 2 · Y qué columnas puede escribir al crearla.
--     NO puede salir ni `pedida_por`, ni `estado`, ni `cerrada_por`.
select string_agg(a.attname, ', ' order by a.attnum) as columnas_que_se_pueden_mandar
from pg_attribute a
where a.attrelid = 'peticiones'::regclass
  and a.attnum > 0 and not a.attisdropped
  and has_column_privilege('authenticated', a.attrelid, a.attnum, 'insert');

-- 3 · Las políticas: 2 permisivas y 1 restrictiva.
select
  count(*) filter (where permissive = 'PERMISSIVE')  as permisivas_DEBE_SER_2,
  count(*) filter (where permissive = 'RESTRICTIVE') as restrictivas_DEBE_SER_1
from pg_policies where schemaname = 'public' and tablename = 'peticiones';

-- 4 · Las dos funciones, cerradas a `public` y con `search_path` fijo.
--     Las dos columnas de la derecha tienen que salir en false y true.
select
  p.proname,
  has_function_privilege('public', p.oid, 'execute') as la_abre_cualquiera_DEBE_SER_false,
  has_function_privilege('anon',   p.oid, 'execute') as la_abre_anon_DEBE_SER_false,
  exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
    as search_path_fijado_DEBE_SER_true
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('cerrar_peticion','anular_peticion','peticion_coherente')
order by 1;

-- 5 · Y que no queda ni una peticion de las de prueba.
select count(*) as peticiones_DEBE_SER_0 from peticiones;

commit;
