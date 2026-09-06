-- ═══════════════════════════════════════════════════════════════
-- 35 · NOTAS COMPARTIDAS
-- ═══════════════════════════════════════════════════════════════
--
-- Una nota NO es un recordatorio, y por eso no va en `recordatorios`.
--
-- Un recordatorio tiene fecha y se acaba: se hace y desaparece. Una
-- nota no tiene fecha y no se «hace» — está puesta, como el papel en
-- la nevera:
--
--     "La llave del garaje está en el cajón de la entrada"
--     "El del agua viene los martes por la mañana"
--     "He dejado los documentos del seguro encima de la mesa"
--
-- Meterlas en `recordatorios` habría sido más barato de escribir y
-- peor de usar: saldrían para siempre en «Por hacer · 14», que es
-- exactamente lo que hace que una lista de tareas deje de mirarse.
--
-- ─────────────────────────────────────────────────────────────
-- PARA LA CASA, O PARA UNA PERSONA
--
-- `para` a nulo = para toda la casa, como el corcho de la cocina.
-- `para` con alguien = se la estás dejando A ÉL, y él ve «Visto» para
-- decir que se ha enterado. Es el punto 16 del planteamiento.
--
-- Quien la recibe no puede editarla ni quitarla — solo decir que la
-- ha visto. Y quien la escribió sí. Una nota que el otro te puede
-- cambiar deja de ser tuya.
--
-- ─────────────────────────────────────────────────────────────
-- QUITAR NO ES BORRAR
--
-- `guardada_en` la aparta de la vista y la deja en «Guardadas». El
-- punto 5 pide que lo importante sea fácil de deshacer, y en una
-- pantalla pensada para un dedo de 75 años un botón que borra de
-- verdad al primer toque es una trampa.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · La tabla ───────────────────────────────────────────
create table if not exists notas (
  id          uuid primary key default gen_random_uuid(),

  hogar_id    uuid not null references hogares(id) on delete cascade,

  -- Lo que pone la nota. Sin título aparte: obligar a poner título a
  -- «la llave está en el cajón» es pedir trabajo para nada.
  texto       text not null check (length(trim(texto)) > 0),

  -- Nulo = para toda la casa. Con alguien = se la dejas a él.
  para        uuid references perfiles(id) on delete set null,

  escrita_por uuid not null references perfiles(id),
  creada_en   timestamptz not null default now(),
  cambiada_en timestamptz,

  -- Cuándo dijo el destinatario que se había enterado.
  vista_en    timestamptz,

  -- Quitada de la vista, pero no borrada.
  guardada_en timestamptz
);

/* Las que están puestas, que es lo que se pide en todas las
   pantallas. Las guardadas se miran una vez al año. */
create index if not exists idx_notas_puestas
  on notas (hogar_id, creada_en desc) where guardada_en is null;


-- ── 2 · Quién ve qué ───────────────────────────────────────
alter table notas enable row level security;

/*
  LAS CUATRO. Y la de borrar también.

  En este proyecto ya pasó: una tabla creada con leer, crear y editar
  y sin la de borrar. Un DELETE sin política NO da error — borra cero
  filas y contesta que todo ha ido bien. Costó una tarde entera.
*/
drop policy if exists notas_leer on notas;
create policy notas_leer on notas
  for select to authenticated using (hogar_id = mi_hogar());

/*
  Escribir una nota es escribir, así que quien solo mira no puede —
  `puedo_escribir()` es la función del 31.

  Y `escrita_por = auth.uid()`: nadie firma una nota con el nombre de
  otro. Sin esa línea, el navegador podría mandar cualquier autor.
*/
drop policy if exists notas_crear on notas;
create policy notas_crear on notas
  for insert to authenticated with check (
    hogar_id = mi_hogar()
    and escrita_por = auth.uid()
    and puedo_escribir()
  );

/*
  CAMBIARLA: solo quien la escribió.

  Con una excepción, y es la que hace que «Visto» funcione: el
  destinatario también puede tocar SU nota — para eso se la han
  dejado. Lo que pueda cambiar de ella se decide en el código
  (`app/api/notas`), que solo le deja poner la fecha de visto.

  Se podría afinar más aquí con un trigger que comprobara columna a
  columna. No se hace: sería una pieza más que mantener para proteger
  a una familia de sí misma. Quien recibe la nota ya podía leerla
  entera.
*/
drop policy if exists notas_editar on notas;
create policy notas_editar on notas
  for update to authenticated
  using (
    hogar_id = mi_hogar()
    and (escrita_por = auth.uid() or para = auth.uid())
    and puedo_escribir()
  )
  with check (
    hogar_id = mi_hogar()
    and (escrita_por = auth.uid() or para = auth.uid())
  );

/*
  BORRAR DEL TODO: solo quien la escribió.

  La aplicación no ofrece este botón —«Quitar» guarda, no borra— pero
  la política existe igualmente: el día que haga falta vaciar las
  guardadas, tiene que poder hacerse sin tocar la base de datos a
  mano. Y una política que no existe se descubre tarde y en silencio.
*/
drop policy if exists notas_borrar on notas;
create policy notas_borrar on notas
  for delete to authenticated using (
    hogar_id = mi_hogar()
    and escrita_por = auth.uid()
    and puedo_escribir()
  );


-- ── 3 · Comprobación ───────────────────────────────────────
/*
  DOS resultados:

  1 · Las cuatro políticas, con `puedo_escribir` en las tres que
      escriben. Si salen tres filas en vez de cuatro, falta una — y la
      que suele faltar es la de borrar.
  2 · La tabla vacía y con RLS puesto. `rls = true` no es un detalle:
      sin él, cualquiera con una sesión leería las notas de todas las
      casas de HUBI.
*/
select
  policyname                                    as politica,
  cmd                                           as para_que,
  coalesce(qual, with_check) ilike '%puedo_escribir%' as mira_si_puede_escribir
from pg_policies
where tablename = 'notas'
order by policyname;

select
  (select count(*) from notas)                                    as notas_ahora,
  (select relrowsecurity from pg_class where relname = 'notas')   as rls;
