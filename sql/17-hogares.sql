-- ───────────────────────────────────────────────────────────
--  FASE 1a · EL HOGAR — SOLO PONER LOS CIMIENTOS
--
--  Este archivo NO cambia el comportamiento de nada. Crea dos tablas,
--  añade una columna a las demás y la rellena. Después de ejecutarlo,
--  HUBI funciona exactamente igual que antes.
--
--  Es a propósito. La fase 1 entera —columnas Y políticas de acceso—
--  toca todas las tablas de la aplicación. Hacerlo de una vez
--  significa que, si algo se rompe, no se sabe si fue la columna o la
--  política. Partido en dos, entre medias se comprueba que todo sigue
--  igual, y solo entonces se toca lo peligroso.
--
--  Lo que NO se hace aquí, y va en la 1b:
--    · Las políticas de acceso por hogar.
--    · Los NOT NULL y los cambios de clave primaria.
--    · No guardar el texto leído en Salud ni en Personal.
--
--  ══════════════════════════════════════════════════════════
--  TRES BOMBAS QUE HABÍA PUESTAS, Y QUE ESTO DESACTIVA
--  ══════════════════════════════════════════════════════════
--
--  Al mirar las claves de las tablas para escribir esto aparecieron
--  tres sitios donde la SEGUNDA familia habría reventado — no con un
--  error raro, sino chocando de frente con la primera:
--
--  1 · `carpetas_drive.ruta` es la CLAVE PRIMARIA. Dos familias con
--      "FINCA/GASTOS/2026/T3/LUZ" son la misma fila. La segunda
--      familia habría guardado sus facturas en la carpeta de Drive de
--      la primera. No es un fallo de permisos: es peor.
--
--  2 · `categorias` es única por (padre, nombre). Dos familias no
--      pueden tener las dos una carpeta raíz llamada "Casa".
--
--  3 · `conexion_drive` tiene literalmente `check (id = 1)`. Una sola
--      fila, para siempre. La segunda familia no puede conectar su
--      Drive porque la tabla no admite una segunda conexión.
--
--  Las tres se arreglan en la 1b, junto con el código que las usa.
--  Quedan escritas aquí para que no se olviden: son exactamente el
--  tipo de cosa que se descubre el día que entra alguien de fuera.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

-- ── 1 · El hogar ───────────────────────────────────────────
create table if not exists hogares (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null default 'Mi casa',
  creado_en  timestamptz not null default now()
);

-- ── 2 · Quién pertenece a cada hogar ───────────────────────
--  Tabla aparte y no una columna en `perfiles` porque el día que
--  alguien lleve dos —su casa y la de su madre— la columna habría que
--  romperla. Con la tabla, ya cabe.
create table if not exists miembros (
  hogar_id   uuid not null references hogares(id) on delete cascade,
  perfil_id  uuid not null references perfiles(id) on delete cascade,
  papel      text not null default 'miembro'
               check (papel in ('propietario', 'miembro')),
  unido_en   timestamptz not null default now(),
  primary key (hogar_id, perfil_id)
);

create index if not exists idx_miembros_perfil on miembros(perfil_id);

alter table hogares  enable row level security;
alter table miembros enable row level security;

-- Por ahora, cualquiera que haya entrado ve lo suyo. En la 1b esto se
-- aprieta junto con todo lo demás.
drop policy if exists hogares_leer on hogares;
create policy hogares_leer on hogares
  for select to authenticated using (
    exists (select 1 from miembros m where m.hogar_id = hogares.id and m.perfil_id = auth.uid())
  );

drop policy if exists miembros_leer on miembros;
create policy miembros_leer on miembros
  for select to authenticated using (
    exists (select 1 from miembros m where m.hogar_id = miembros.hogar_id and m.perfil_id = auth.uid())
  );

-- ── 3 · De qué hogar es quien pregunta ─────────────────────
/*
  Esta función es la que hará que el código apenas cambie.

  Con ella se puede poner `default mi_hogar()` en cada tabla: una
  inserción que no diga de qué hogar es, lo averigua sola. Y en la 1b,
  las políticas serán `hogar_id = mi_hogar()`, sin tocar ni una
  consulta de la aplicación.

  `security definer` porque tiene que poder leer `miembros` por debajo
  de las políticas; si no, se mordería la cola: para saber tu hogar
  haría falta ya saber tu hogar.
*/
create or replace function mi_hogar() returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hogar_id from miembros where perfil_id = auth.uid() order by unido_en limit 1
$$;

-- ── 4 · El hogar número 1: Juan Miguel y Conchita ──────────
insert into hogares (nombre)
select 'Casa de Juan Miguel y Conchita'
where not exists (select 1 from hogares);

insert into miembros (hogar_id, perfil_id, papel)
select
  (select id from hogares order by creado_en limit 1),
  p.id,
  case when p.es_propietario_drive then 'propietario' else 'miembro' end
from perfiles p
where not exists (
  select 1 from miembros m where m.perfil_id = p.id
);

-- ── 5 · La columna, en todas partes ────────────────────────
/*
  Se hace en bucle y no a mano tabla por tabla. Escribiéndolo nueve
  veces, la décima tabla que se añada el mes que viene se queda fuera
  sin que nadie lo note — y una tabla sin hogar es una tabla que
  cualquiera puede leer.
*/
do $$
declare
  t text;
  primero uuid := (select id from hogares order by creado_en limit 1);
begin
  foreach t in array array[
    'categorias', 'documentos', 'carpetas_drive', 'conexion_drive',
    'movimientos', 'recordatorios', 'compra'
  ]
  loop
    execute format(
      'alter table %I add column if not exists hogar_id uuid references hogares(id)', t
    );

    -- Todo lo que ya existe es del primer hogar.
    execute format('update %I set hogar_id = $1 where hogar_id is null', t) using primero;

    /* Y a partir de ahora, quien inserte sin decirlo hereda el suyo.
       Esto es lo que hará que la 1b no tenga que reescribir cada
       consulta de la aplicación. */
    execute format('alter table %I alter column hogar_id set default mi_hogar()', t);

    execute format(
      'create index if not exists idx_%s_hogar on %I (hogar_id)', t, t
    );
  end loop;
end $$;

-- ── 6 · Comprobación ───────────────────────────────────────
/*
  Que el resultado se vea, en vez de suponerlo. Debe salir una fila
  por tabla, con 0 en `sin_hogar`. Si alguna tiene filas sin hogar,
  NO se sigue con la 1b.
*/
select 'categorias'     as tabla, count(*) filter (where hogar_id is null) as sin_hogar, count(*) as total from categorias
union all select 'documentos',     count(*) filter (where hogar_id is null), count(*) from documentos
union all select 'carpetas_drive', count(*) filter (where hogar_id is null), count(*) from carpetas_drive
union all select 'conexion_drive', count(*) filter (where hogar_id is null), count(*) from conexion_drive
union all select 'movimientos',    count(*) filter (where hogar_id is null), count(*) from movimientos
union all select 'recordatorios',  count(*) filter (where hogar_id is null), count(*) from recordatorios
union all select 'compra',         count(*) filter (where hogar_id is null), count(*) from compra
union all select 'miembros',       0::bigint,                                count(*) from miembros
order by tabla;
