-- ═══════════════════════════════════════════════════════════
--  J+C · FAMILY HUB — HITO 1
--  Tablas, seguridad y categorías iniciales
--
--  Ejecutar una sola vez en:
--  Supabase → SQL Editor → New query → pegar todo → Run
-- ═══════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────
--  1. PERFILES — quién es quién
-- ───────────────────────────────────────────────────────────

create table if not exists perfiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  nombre                text not null,
  color                 text not null default '#3A7D6E',
  es_propietario_drive  boolean not null default false,
  creado_en             timestamptz not null default now()
);

-- Cuando se crea un usuario, se crea su perfil automáticamente.
create or replace function crear_perfil_al_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfiles (id, nombre)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function crear_perfil_al_registrar();


-- ───────────────────────────────────────────────────────────
--  2. CATEGORÍAS — jerárquicas y editables
-- ───────────────────────────────────────────────────────────

create table if not exists categorias (
  id              uuid primary key default gen_random_uuid(),
  padre_id        uuid references categorias(id) on delete cascade,
  nombre          text not null,
  segmento_drive  text not null,
  icono           text,
  orden           integer not null default 0,
  naturaleza      text not null default 'neutro'
                    check (naturaleza in ('gasto', 'ingreso', 'neutro')),
  activa          boolean not null default true,
  creada_en       timestamptz not null default now(),

  constraint categoria_unica unique nulls not distinct (padre_id, nombre)
);

create index if not exists idx_categorias_padre on categorias(padre_id);


-- ───────────────────────────────────────────────────────────
--  3. CARPETAS DE DRIVE — evita carpetas duplicadas
-- ───────────────────────────────────────────────────────────

create table if not exists carpetas_drive (
  ruta             text primary key,
  drive_folder_id  text not null,
  creada_en        timestamptz not null default now()
);


-- ───────────────────────────────────────────────────────────
--  4. CONEXIÓN CON DRIVE — una sola fila, siempre
-- ───────────────────────────────────────────────────────────

create table if not exists conexion_drive (
  id                      smallint primary key default 1 check (id = 1),
  refresh_token_cifrado   text,
  email_cuenta            text,
  carpeta_raiz_id         text,
  estado                  text not null default 'sin_conectar'
                            check (estado in ('sin_conectar', 'activa', 'caducada')),
  actualizado_en          timestamptz not null default now()
);

insert into conexion_drive (id) values (1) on conflict (id) do nothing;


-- ───────────────────────────────────────────────────────────
--  5. DOCUMENTOS
-- ───────────────────────────────────────────────────────────

create table if not exists documentos (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null,
  categoria_id      uuid not null references categorias(id),

  drive_file_id     text not null,
  drive_folder_id   text not null,
  nombre_archivo    text not null,
  tipo_mime         text not null,
  tamano_bytes      bigint,

  fecha_documento   date not null default current_date,
  anio              integer generated always as
                      (extract(year from fecha_documento)::integer) stored,
  trimestre         integer generated always as
                      (extract(quarter from fecha_documento)::integer) stored,

  -- Se rellenarán con el OCR (fase 2). Vacíos por ahora.
  importe           numeric(12,2),
  proveedor         text,
  texto_ocr         text,

  visibilidad       text not null default 'compartido'
                      check (visibilidad in ('compartido', 'privado')),
  subido_por        uuid not null references perfiles(id),
  notas             text,

  eliminado_en      timestamptz,
  creado_en         timestamptz not null default now(),

  busqueda tsvector generated always as (
    to_tsvector('spanish',
      coalesce(titulo, '') || ' ' ||
      coalesce(proveedor, '') || ' ' ||
      coalesce(notas, '') || ' ' ||
      coalesce(texto_ocr, '')
    )
  ) stored
);

create index if not exists idx_documentos_busqueda   on documentos using gin(busqueda);
create index if not exists idx_documentos_categoria  on documentos(categoria_id);
create index if not exists idx_documentos_fecha      on documentos(fecha_documento desc);


-- ═══════════════════════════════════════════════════════════
--  SEGURIDAD  —  Row Level Security
-- ═══════════════════════════════════════════════════════════

alter table perfiles        enable row level security;
alter table categorias      enable row level security;
alter table documentos      enable row level security;
alter table carpetas_drive  enable row level security;
alter table conexion_drive  enable row level security;

-- carpetas_drive y conexion_drive NO llevan ninguna política:
-- sin políticas, ningún navegador puede leerlas ni escribirlas.
-- Solo el servidor, con la Secret key, puede tocarlas.

-- PERFILES — los dos se ven entre sí
drop policy if exists perfiles_leer on perfiles;
create policy perfiles_leer on perfiles
  for select to authenticated using (true);

drop policy if exists perfiles_editar_el_suyo on perfiles;
create policy perfiles_editar_el_suyo on perfiles
  for update to authenticated using (id = auth.uid());

-- CATEGORÍAS — los dos pueden verlas y crearlas
drop policy if exists categorias_leer on categorias;
create policy categorias_leer on categorias
  for select to authenticated using (true);

drop policy if exists categorias_crear on categorias;
create policy categorias_crear on categorias
  for insert to authenticated with check (true);

drop policy if exists categorias_editar on categorias;
create policy categorias_editar on categorias
  for update to authenticated using (true);

-- DOCUMENTOS — compartidos los ven los dos; privados, solo quien lo subió
drop policy if exists documentos_leer on documentos;
create policy documentos_leer on documentos
  for select to authenticated using (
    eliminado_en is null
    and (visibilidad = 'compartido' or subido_por = auth.uid())
  );

drop policy if exists documentos_crear on documentos;
create policy documentos_crear on documentos
  for insert to authenticated with check (subido_por = auth.uid());

drop policy if exists documentos_editar on documentos;
create policy documentos_editar on documentos
  for update to authenticated using (
    visibilidad = 'compartido' or subido_por = auth.uid()
  );


-- ═══════════════════════════════════════════════════════════
--  CATEGORÍAS INICIALES
-- ═══════════════════════════════════════════════════════════

-- Nivel 1
insert into categorias (nombre, segmento_drive, icono, orden) values
  ('Finca',                  'FINCA',       '🌿', 1),
  ('Seguros',                'SEGUROS',     '🛡', 2),
  ('Salud',                  'SALUD',       '❤️', 3),
  ('Casa',                   'CASA',        '🏠', 4),
  ('Vehículos',              'VEHICULOS',   '🚗', 5),
  ('Documentos importantes', 'DOCUMENTOS',  '📄', 6)
on conflict do nothing;

-- Nivel 2 — Finca
insert into categorias (padre_id, nombre, segmento_drive, icono, orden, naturaleza)
select id, 'Gastos', 'GASTOS', '💸', 1, 'gasto'
from categorias where segmento_drive = 'FINCA' and padre_id is null
on conflict do nothing;

insert into categorias (padre_id, nombre, segmento_drive, icono, orden, naturaleza)
select id, 'Ingresos', 'INGRESOS', '💰', 2, 'ingreso'
from categorias where segmento_drive = 'FINCA' and padre_id is null
on conflict do nothing;

-- Nivel 3 — Finca / Gastos
insert into categorias (padre_id, nombre, segmento_drive, orden, naturaleza)
select g.id, v.nombre, v.segmento, v.orden, 'gasto'
from categorias g
cross join (values
  ('Agua',              'AGUA',           1),
  ('Luz',               'LUZ',            2),
  ('Productos',         'PRODUCTOS',      3),
  ('Obras y mejoras',   'OBRAS',          4),
  ('Maquinaria',        'MAQUINARIA',     5),
  ('Mantenimiento',     'MANTENIMIENTO',  6),
  ('Otros',             'OTROS',          7)
) as v(nombre, segmento, orden)
where g.nombre = 'Gastos'
  and g.padre_id = (select id from categorias where segmento_drive = 'FINCA' and padre_id is null)
on conflict do nothing;

-- Nivel 3 — Finca / Ingresos
insert into categorias (padre_id, nombre, segmento_drive, orden, naturaleza)
select g.id, v.nombre, v.segmento, v.orden, 'ingreso'
from categorias g
cross join (values
  ('Ventas cooperativa', 'COOPERATIVA', 1),
  ('Otros ingresos',     'OTROS',       2)
) as v(nombre, segmento, orden)
where g.nombre = 'Ingresos'
  and g.padre_id = (select id from categorias where segmento_drive = 'FINCA' and padre_id is null)
on conflict do nothing;

-- Nivel 2 — Seguros
insert into categorias (padre_id, nombre, segmento_drive, orden)
select r.id, v.nombre, v.segmento, v.orden
from categorias r
cross join (values
  ('Casa',       'CASA',        1),
  ('Coche',      'COCHE',       2),
  ('Salud',      'SALUD',       3),
  ('Personales', 'PERSONALES',  4),
  ('Finca',      'FINCA',       5)
) as v(nombre, segmento, orden)
where r.segmento_drive = 'SEGUROS' and r.padre_id is null
on conflict do nothing;

-- Nivel 2 — Salud
insert into categorias (padre_id, nombre, segmento_drive, orden)
select r.id, v.nombre, v.segmento, v.orden
from categorias r
cross join (values
  ('Juan Miguel', 'JUAN_MIGUEL', 1),
  ('Conchita',    'CONCHITA',    2)
) as v(nombre, segmento, orden)
where r.segmento_drive = 'SALUD' and r.padre_id is null
on conflict do nothing;

-- Nivel 3 — Salud / cada persona
insert into categorias (padre_id, nombre, segmento_drive, orden)
select p.id, v.nombre, v.segmento, v.orden
from categorias p
cross join (values
  ('Informes',   'INFORMES',    1),
  ('Recetas',    'RECETAS',     2),
  ('Pruebas',    'PRUEBAS',     3),
  ('Citas',      'CITAS',       4),
  ('Medicación', 'MEDICACION',  5)
) as v(nombre, segmento, orden)
where p.padre_id = (select id from categorias where segmento_drive = 'SALUD' and padre_id is null)
on conflict do nothing;

-- Nivel 2 — Casa
insert into categorias (padre_id, nombre, segmento_drive, orden)
select r.id, v.nombre, v.segmento, v.orden
from categorias r
cross join (values
  ('Facturas',      'FACTURAS',      1),
  ('Reparaciones',  'REPARACIONES',  2),
  ('Garantías',     'GARANTIAS',     3),
  ('Compras',       'COMPRAS',       4),
  ('Documentación', 'DOCUMENTACION', 5)
) as v(nombre, segmento, orden)
where r.segmento_drive = 'CASA' and r.padre_id is null
on conflict do nothing;

-- Nivel 2 — Vehículos
insert into categorias (padre_id, nombre, segmento_drive, orden)
select r.id, v.nombre, v.segmento, v.orden
from categorias r
cross join (values
  ('Seguro',        'SEGURO',        1),
  ('ITV',           'ITV',           2),
  ('Taller',        'TALLER',        3),
  ('Impuestos',     'IMPUESTOS',     4),
  ('Documentación', 'DOCUMENTACION', 5)
) as v(nombre, segmento, orden)
where r.segmento_drive = 'VEHICULOS' and r.padre_id is null
on conflict do nothing;

-- Nivel 2 — Documentos importantes
insert into categorias (padre_id, nombre, segmento_drive, orden)
select r.id, v.nombre, v.segmento, v.orden
from categorias r
cross join (values
  ('Contratos',       'CONTRATOS',       1),
  ('Bancos',          'BANCOS',          2),
  ('Administraciones','ADMINISTRACIONES',3),
  ('Otros',           'OTROS',           4)
) as v(nombre, segmento, orden)
where r.segmento_drive = 'DOCUMENTOS' and r.padre_id is null
on conflict do nothing;


-- ═══════════════════════════════════════════════════════════
--  COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════

select
  (select count(*) from categorias)                          as categorias_creadas,
  (select count(*) from categorias where padre_id is null)   as categorias_raiz,
  (select count(*) from conexion_drive)                      as conexion_drive;
