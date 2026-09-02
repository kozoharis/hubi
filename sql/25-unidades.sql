-- ───────────────────────────────────────────────────────────
--  LA UNIDAD
--
--  Ésta es la pieza que hace que HUBI le sirva a alguien más que a
--  esta casa.
--
--  Hoy Los Helechos son tres apartamentos, y están escritos a fuego:
--  `movimientos.apartamento` es un número del 1 al 3, con una
--  restricción en la base de datos que lo obliga. Sirve para esta
--  casa y para ninguna otra. El piso de la abuela es uno solo. Un
--  reformista tiene ocho obras, y el mes que viene nueve.
--
--  Pero si te fijas, son la misma forma:
--
--    Los Helechos  →  Helechos 1 · Helechos 2 · Helechos 3
--    Piso abuela   →  (una sola)
--    Obras         →  Obra Manuel · Baño de Ana · Calle Mayor
--
--  Una sección con varias cosas dentro, cada una con sus gastos y sus
--  ingresos, más un saco de gastos comunes que no son de ninguna.
--
--  ═════════════════════════════════════════════════════════
--  LOS DOS EJES. LEER ESTO ANTES DE TOCAR NADA.
--
--  En castellano las dos cosas se llaman «carpeta», y confundirlas es
--  el error más caro de deshacer:
--
--    LA UNIDAD    es DE QUIÉN es el gasto   → Obra Manuel, Helechos 2
--    EL CONCEPTO  es QUÉ CLASE de gasto es  → Materiales, Luz, Personal
--
--  Si «Obra Manuel» se hiciera una CATEGORÍA, se perdería para
--  siempre poder preguntar «¿cuánto llevo gastado en materiales este
--  año, en todas las obras?» — que es justo la pregunta que hace un
--  reformista en febrero con la declaración delante.
--
--  Separados, se cruzan, y sale la tabla que de verdad quiere ver.
--  Por eso la unidad es una tabla aparte y NO una categoría más.
--
--  ═════════════════════════════════════════════════════════
--  ESTE ARCHIVO NO CAMBIA NADA DE LO QUE SE VE
--
--  Solo AÑADE: una tabla, dos columnas y el relleno de lo que ya
--  existe. `movimientos.apartamento` se queda exactamente donde está
--  y las pantallas lo siguen usando. Nadie nota nada.
--
--  El cambio de verdad —que las pantallas lean la unidad en vez del
--  número— va después, cuando esto esté comprobado. Es la regla que
--  permite trabajar con la aplicación en marcha: primero añadir,
--  comprobar, y solo entonces cambiar lo que lee.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────


-- ── 1 · Qué secciones tienen unidades, y cuáles reparten ──────
/*
  Dos preguntas distintas, y hace falta responder las dos por
  separado:

  · ¿Esta sección se divide en unidades?  Los Helechos sí. La Finca
    no: la finca es una.

  · ¿Los gastos comunes se reparten entre ellas?  En Los Helechos SÍ
    —la luz, el seguro y la gestoría son de los tres y se parten a
    partes iguales, porque los tres se alquilan igual—.

    EN OBRAS ESO SERÍA MENTIR. Repartir la gasolina del mes entre una
    reforma de 40.000 € y un baño de 3.000 no dice nada de ninguna de
    las dos. Por eso son dos columnas y no una, y por eso repartir no
    viene puesto por defecto.

  Nacen en false, así que ninguna sección cambia de comportamiento
  por el hecho de que existan.
*/
alter table categorias
  add column if not exists usa_unidades    boolean not null default false,
  add column if not exists reparte_comunes boolean not null default false;


-- ── 2 · Las unidades ──────────────────────────────────────────
create table if not exists unidades (
  id          uuid primary key default gen_random_uuid(),

  /* De qué sección cuelga: la RAÍZ —Los Helechos, Obras, Vehículos—,
     no una subcategoría. Es el mismo árbol que usan los papeles, no
     una lista aparte. */
  seccion_id  uuid not null references categorias(id) on delete cascade,

  -- "Helechos 1", "Piso abuela", "Obra Manuel". Lo pone quien la crea.
  nombre      text not null check (length(trim(nombre)) > 0),

  /* Datos que solo algunos módulos usan. Un apartamento no tiene
     presupuesto; una obra sí, y sin él no se puede contestar lo único
     que de verdad quiere saber un reformista: cuánto le queda por
     cobrar. Se dejan preparados y vacíos: una columna nula no
     molesta a quien no la usa. */
  referencia  text,
  presupuesto numeric(12,2),

  orden       smallint not null default 0,

  /* No se borran: se desactivan. Una obra terminada no desaparece
     —sus gastos del año pasado siguen contando en la declaración—,
     simplemente deja de salir al apuntar cosas nuevas. */
  activa      boolean not null default true,

  creada_en   timestamptz not null default now()
);

create index if not exists idx_unidades_seccion
  on unidades (seccion_id, orden) where activa;


-- ── 3 · Cada apunte sabe de qué unidad es ─────────────────────
/*
  Nula a propósito, y no es un descuido: NULL significa «de la
  sección entera, de ninguna en concreto». La luz de Los Helechos es
  eso. Obligar a elegir una unidad haría imposible apuntar lo común.
*/
alter table movimientos
  add column if not exists unidad_id uuid references unidades(id) on delete set null;

create index if not exists idx_movimientos_unidad
  on movimientos (unidad_id, fecha) where unidad_id is not null;


-- ── 4 · El hogar, como en todas las demás ─────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'movimientos' and column_name = 'hogar_id') then
    alter table unidades add column if not exists hogar_id uuid;
    alter table unidades alter column hogar_id set default mi_hogar();
  end if;
end $$;


-- ── 5 · Seguridad: las cuatro, y la de borrar también ─────────
/*
  Las cuatro. Ya sabemos lo que pasa cuando falta alguna: no da
  error, afecta a cero filas y devuelve que todo ha ido bien.
*/
alter table unidades enable row level security;

do $$
declare condicion text;
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'unidades' and column_name = 'hogar_id') then
    condicion := 'hogar_id = mi_hogar()';
  else
    condicion := 'true';
  end if;

  execute 'drop policy if exists unidades_leer on unidades';
  execute format('create policy unidades_leer on unidades for select to authenticated using (%s)', condicion);

  execute 'drop policy if exists unidades_crear on unidades';
  execute format('create policy unidades_crear on unidades for insert to authenticated with check (%s)', condicion);

  execute 'drop policy if exists unidades_editar on unidades';
  execute format('create policy unidades_editar on unidades for update to authenticated using (%s)', condicion);

  execute 'drop policy if exists unidades_borrar on unidades';
  execute format('create policy unidades_borrar on unidades for delete to authenticated using (%s)', condicion);
end $$;


-- ── 6 · Los Helechos pasan a ser tres unidades ────────────────
do $$
declare
  raiz  uuid;
  casa  uuid;
  n     smallint;
  u     uuid;
begin
  select id into raiz from categorias
   where segmento_drive = 'HELECHOS' and padre_id is null
   limit 1;

  if raiz is null then
    raise notice 'No existe la sección Los Helechos. Nada que convertir.';
    return;
  end if;

  /*
    EL HOGAR SE PONE A MANO, Y ES IMPORTANTE.

    El `default mi_hogar()` no vale aquí: esto se ejecuta desde el
    editor de SQL, donde no hay ninguna sesión abierta, así que
    `mi_hogar()` devolvería nulo y las tres unidades nacerían SIN
    CASA. Una fila sin hogar no la ve nadie —ni su dueño—, y el fallo
    no daría ningún error: simplemente Los Helechos aparecerían
    vacíos y nadie sabría por qué.

    Hoy hay una sola casa, así que se coge ésa.
  */
  select id into casa from hogares order by creado_en limit 1;

  update categorias
     set usa_unidades = true, reparte_comunes = true
   where id = raiz;

  for n in 1..3 loop
    select id into u from unidades
     where seccion_id = raiz and nombre = 'Helechos ' || n
     limit 1;

    if u is null then
      insert into unidades (seccion_id, nombre, orden, hogar_id)
      values (raiz, 'Helechos ' || n, n, casa)
      returning id into u;
    end if;

    /* Los apuntes que ya existen se enganchan a su unidad. Solo los
       que aún no la tienen: volver a ejecutar esto no rehace nada. */
    update movimientos
       set unidad_id = u
     where apartamento = n
       and unidad_id is null;
  end loop;

  raise notice 'Los Helechos ya son tres unidades.';
end $$;


-- ── 7 · Comprobación ──────────────────────────────────────────
/*
  Lo que hay que mirar:

  · Las tres unidades salen, las tres CON CASA. Si alguna sale sin
    hogar, no la verá nadie al entrar.
  · «apuntes» tiene que coincidir con lo que había por apartamento.
  · La última fila, «(común, toda la casa)», son los gastos que no
    son de ninguno —la luz, el seguro, la gestoría—. Es normal que
    tenga apuntes: no es un fallo de la conversión.
*/
select
  coalesce(u.nombre, '(común, toda la casa)') as unidad,
  u.hogar_id is not null                      as tiene_casa,
  count(m.id)                                 as apuntes,
  coalesce(sum(m.importe) filter (where m.tipo = 'ingreso'), 0) as ingresos,
  coalesce(sum(m.importe) filter (where m.tipo = 'gasto'), 0)   as gastos
from movimientos m
left join unidades u on u.id = m.unidad_id
where m.apartamento is not null or m.unidad_id is not null
   or m.categoria_id in (
        select c.id from categorias c
        where c.id = (select id from categorias
                       where segmento_drive = 'HELECHOS' and padre_id is null limit 1)
      )
group by u.nombre, u.hogar_id
order by unidad;
