-- ═══════════════════════════════════════════════════════════════
-- LOS MENÚS DE LA SEMANA, Y LAS IDEAS DE DÓNDE SALEN
-- ═══════════════════════════════════════════════════════════════
--
-- Dos cosas que van juntas y por eso viven juntas:
--
--  · QUÉ SE COME cada día. Lunes comida, lunes cena, martes…
--  · Y EL SITIO DONDE SE GUARDAN LAS IDEAS: un vídeo de YouTube que
--    alguien vio, una receta de un blog, «lo que hizo mi madre».
--
-- Separadas no sirven de gran cosa. La lista de enlaces sola se queda
-- en un cajón de cosas que nunca se cocinan; el menú solo obliga a
-- acordarse de dónde estaba aquella receta. Juntas, se elige del cajón
-- y queda puesto en el día.
--
-- ─────────────────────────────────────────────────────────────
-- QUIÉN LO VE — Y ESTO ES UNA DECISIÓN, NO UN DESCUIDO
--
-- El sql/37 dejó una regla clara: quien tiene el rol «ayuda» ve LO
-- SUYO. No la agenda de la familia, no las notas que se dejan entre
-- ellos, no las facturas. Se escribió porque un permiso que promete
-- una cosa y hace otra es peor que no tener permisos.
--
-- Los menús son la EXCEPCIÓN a esa regla, y a propósito: quien cocina
-- tiene que saber qué toca hoy. Un menú que la persona que cocina no
-- puede leer no es un menú, es una nota entre dos.
--
-- Así que aquí la frontera es la casa, sin más: todo el que está en
-- ella lo ve y lo escribe. No hay nada privado en «el martes, lentejas»
-- — y si algún día lo hubiera, esta tabla no sería el sitio.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · El cajón de las ideas ──────────────────────────────
/*
  Se llama `recetas` porque es lo que la gente diría, pero aquí cabe
  cualquier cosa que dé de comer: un enlace de YouTube, una página, o
  solo un nombre escrito a mano —«el pollo de la abuela»— sin enlace
  ninguno. Por eso la url es opcional y el título no.

  Al revés sería un archivador de enlaces, y la mitad de lo que se
  cocina en una casa no tiene enlace.
*/
create table if not exists recetas (
  id        uuid primary key default gen_random_uuid(),
  hogar_id  uuid not null default mi_hogar() references hogares(id) on delete cascade,

  titulo    text not null check (length(trim(titulo)) > 0),
  url       text,
  nota      text,

  creado_en  timestamptz not null default now(),
  creado_por uuid references perfiles(id) on delete set null
);

create index if not exists idx_recetas_casa on recetas (hogar_id, creado_en desc);


-- ── 2 · Y lo que toca cada día ─────────────────────────────
/*
  POR FECHA, NO POR DÍA DE LA SEMANA.

  Guardar «lunes: lentejas» sería más corto y sería una plantilla, no
  un menú: al llegar el lunes siguiente no sabrías si eso es lo de esta
  semana o lo que se puso hace tres meses. Con fecha se puede planificar
  la semana que viene sin pisar la de ahora, y queda el rastro de lo que
  se comió — que es justo lo que se mira cuando alguien pregunta «¿y
  esto cuándo lo hicimos?».

  Dos momentos y no cinco. Comida y cena es lo que se planifica; los
  desayunos y las meriendas no los planifica nadie, y ofrecerlos sería
  llenar la pantalla de huecos que siempre estarán vacíos.
*/
create table if not exists menus (
  id        uuid primary key default gen_random_uuid(),
  hogar_id  uuid not null default mi_hogar() references hogares(id) on delete cascade,

  fecha     date not null,
  momento   text not null check (momento in ('comida', 'cena')),
  que       text not null check (length(trim(que)) > 0),

  /* De dónde sale, si sale de algún sitio. Al borrar la receta el menú
     no se cae: lo que se comió aquel día se comió igual. */
  receta_id uuid references recetas(id) on delete set null,

  creado_en  timestamptz not null default now(),
  creado_por uuid references perfiles(id) on delete set null
);

/* Una comida y una cena por día. Sin esto, dos toques seguidos —o un
   móvil reintentando con mala cobertura— dejan dos comidas el martes y
   nadie sabe cuál manda. */
create unique index if not exists menus_uno_por_momento
  on menus (hogar_id, fecha, momento);

create index if not exists idx_menus_semana on menus (hogar_id, fecha);


-- ── 3 · Quién puede ────────────────────────────────────────
/*
  Leer: TODA la casa, incluida quien ayuda. Es la excepción explicada
  arriba.

  Escribir: quien pueda escribir. Quien «solo mira» no cambia el menú,
  igual que no cambia nada más.
*/
alter table recetas enable row level security;
alter table menus   enable row level security;

drop policy if exists recetas_leer on recetas;
create policy recetas_leer on recetas
  for select to authenticated using (hogar_id = mi_hogar());

drop policy if exists recetas_escribir on recetas;
create policy recetas_escribir on recetas
  for all to authenticated
  using (hogar_id = mi_hogar() and puedo_escribir())
  with check (hogar_id = mi_hogar() and puedo_escribir());

drop policy if exists menus_leer on menus;
create policy menus_leer on menus
  for select to authenticated using (hogar_id = mi_hogar());

drop policy if exists menus_escribir on menus;
create policy menus_escribir on menus
  for all to authenticated
  using (hogar_id = mi_hogar() and puedo_escribir())
  with check (hogar_id = mi_hogar() and puedo_escribir());


-- ── 4 · Comprobación ───────────────────────────────────────
/*
  Las dos tablas con `rls = true` y 2 políticas cada una.
*/
select
  c.relname        as tabla,
  c.relrowsecurity as rls,
  count(p.polname) as politicas
from pg_class c
left join pg_policy p on p.polrelid = c.oid
where c.relname in ('menus', 'recetas')
group by c.relname, c.relrowsecurity
order by c.relname;
