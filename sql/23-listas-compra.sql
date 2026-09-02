-- ───────────────────────────────────────────────────────────
--  VARIAS LISTAS DE LA COMPRA
--
--  Hasta ahora había UNA lista por categoría: una de casa, una de la
--  finca, una de Los Helechos. Y eso se queda corto, porque no es como
--  se compra de verdad: de casa hay la del lunes y la del fin de mes,
--  y son dos cosas distintas —van en días distintos, puede ir gente
--  distinta y cada una avisa por su cuenta—.
--
--  Así que la lista pasa a ser algo con nombre propio, y cada artículo
--  sabe a cuál pertenece.
--
--  ─────────────────────────────────────────────────────────
--  LO QUE NO CAMBIA, Y ES LO IMPORTANTE
--
--  Quien solo quiera apuntar pan no se entera de nada de esto. Cuando
--  en una categoría hay UNA sola lista, la pantalla no enseña ningún
--  selector: se ve exactamente igual que antes. El segundo nivel
--  aparece el día que alguien crea la segunda lista, y no antes.
--
--  Es la regla del punto 5: pocas decisiones por pantalla. Una función
--  que solo hace falta a veces no puede cobrarle una decisión a quien
--  no la usa nunca.
--
--  ─────────────────────────────────────────────────────────
--  Y LA FECHA VIVE EN LA LISTA, NO EN LA TAREA
--
--  Al ponerle día a una lista se crea una tarea normal en la Agenda
--  —para que salga en la semana, avise al móvil y se marque hecha— y
--  se guarda aquí su identificador. Sin eso, cambiar el día crearía
--  una tarea nueva cada vez y acabarían tres "hacer la compra" en la
--  misma semana.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

create table if not exists listas_compra (
  id           uuid primary key default gen_random_uuid(),

  -- "Del lunes", "Fin de mes", "Semanal". Lo pone quien la crea.
  nombre       text not null check (length(trim(nombre)) > 0),

  /* De qué categoría es: la casa (null), la finca, Los Helechos… Es
     la misma raíz que usan los papeles, no una lista aparte: el día
     que se cree la sección "Obras", su compra existe sola. */
  seccion_id   uuid references categorias(id) on delete set null,

  -- Cuándo se va, si se ha decidido. Puede no decidirse nunca.
  fecha        date,
  hora         time,

  /* A quién le toca. Null es "cualquiera": no se fuerza a elegir, y
     el día que sean tres en la casa esto sigue valiendo sin tocar
     nada — es una referencia a perfiles, no dos columnas fijas. */
  asignado_a   uuid references perfiles(id) on delete set null,

  /* La tarea que representa esta compra en la Agenda. Si se cambia el
     día, se cambia ELLA en vez de crear otra. */
  recordatorio_id uuid,

  archivada_en timestamptz,
  creada_por   uuid not null references perfiles(id),
  creada_en    timestamptz not null default now()
);

create index if not exists idx_listas_compra_vivas
  on listas_compra (seccion_id, creada_en) where archivada_en is null;


-- ── Cada cosa sabe en qué lista está ───────────────────────
alter table compra
  add column if not exists lista_id uuid references listas_compra(id) on delete set null;

create index if not exists idx_compra_lista on compra (lista_id);


-- ── El hogar, como en todas las demás ──────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'compra' and column_name = 'hogar_id') then
    alter table listas_compra add column if not exists hogar_id uuid;
    update listas_compra set hogar_id = mi_hogar() where hogar_id is null;
    alter table listas_compra alter column hogar_id set default mi_hogar();
  end if;
end $$;


-- ── Seguridad: las cuatro, y la de borrar también ──────────
/*
  Las cuatro. Ya sabemos lo que pasa cuando falta la de borrar: no da
  error, borra cero filas y dice que todo ha ido bien.
*/
alter table listas_compra enable row level security;

do $$
declare condicion text;
begin
  -- Si hay hogares, se acota a la casa; si no, a quien haya entrado.
  if exists (select 1 from information_schema.columns
             where table_name = 'listas_compra' and column_name = 'hogar_id') then
    condicion := 'hogar_id = mi_hogar()';
  else
    condicion := 'true';
  end if;

  execute 'drop policy if exists listas_leer on listas_compra';
  execute format('create policy listas_leer on listas_compra for select to authenticated using (%s)', condicion);

  execute 'drop policy if exists listas_crear on listas_compra';
  execute format('create policy listas_crear on listas_compra for insert to authenticated with check (%s)', condicion);

  execute 'drop policy if exists listas_editar on listas_compra';
  execute format('create policy listas_editar on listas_compra for update to authenticated using (%s)', condicion);

  execute 'drop policy if exists listas_borrar on listas_compra';
  execute format('create policy listas_borrar on listas_compra for delete to authenticated using (%s)', condicion);
end $$;


-- ── Lo que ya estaba apuntado no se queda huérfano ─────────
/*
  Cada categoría que tenga cosas apuntadas se lleva su lista, con el
  nombre más honesto que hay: "La compra". Nadie pierde nada y nadie
  tiene que recolocar lo suyo a mano.
*/
/*
  Ojo con `creada_por`: aquí había un `min()` sobre un identificador, y
  Postgres no sabe hacer eso —un uuid no es mayor ni menor que otro—.
  Se coge el de quien apuntó lo primero de esa categoría, que además
  es más honesto que un mínimo cualquiera: la lista es suya.
*/
insert into listas_compra (nombre, seccion_id, creada_por)
select
  'La compra',
  c.seccion_id,
  (array_agg(c.anadido_por order by c.creado_en))[1]
from compra c
where c.archivado_en is null
  and c.lista_id is null
group by c.seccion_id;

update compra c
set lista_id = l.id
from listas_compra l
where c.lista_id is null
  and c.archivado_en is null
  and l.nombre = 'La compra'
  and l.seccion_id is not distinct from c.seccion_id;


-- ── Comprobación ───────────────────────────────────────────
select l.nombre,
       coalesce(cat.nombre, 'Casa') as categoria,
       l.fecha,
       count(c.id) as cosas
from listas_compra l
left join categorias cat on cat.id = l.seccion_id
left join compra c on c.lista_id = l.id and c.archivado_en is null
where l.archivada_en is null
group by l.id, l.nombre, cat.nombre, l.fecha
order by categoria, l.creada_en;
