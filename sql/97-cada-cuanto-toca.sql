-- ═══════════════════════════════════════════════════════════════
-- 97 · CADA CUÁNTO TOCA
-- ═══════════════════════════════════════════════════════════════
--
-- Haris: *«que se puedan programar de una vez cada semana o cada dos
-- semanas o cada 3 semanas o cada mes… esto para las tareas de
-- hogar»*.
--
-- Las rutinas —lo de cada semana— sabían repetirse de UNA manera:
-- todas las semanas. Y eso deja fuera la mitad de lo que se hace en
-- una casa: las sábanas cada dos semanas, los cristales una vez al
-- mes, la revisión de la caldera cada tres.
--
-- Hasta ahora la única salida era apuntarlas como tarea de la agenda.
-- Y eso es justo lo que el SQL 38 vino a evitar: una tarea sin marcar
-- se arrastra en rojo, y con doce al mes la agenda se llena de rojo y
-- deja de mirarse — con lo que se pierde también el rojo que sí
-- importaba, la ITV y el seguro.
--
-- ─────────────────────────────────────────────────────────────
-- DOS COLUMNAS, Y LA SEGUNDA ES LA QUE HACE QUE FUNCIONE
--
--   cada_semanas   cada cuántas semanas vuelve. 1, 2, 3 o 4.
--   desde          desde qué semana se cuenta.
--
-- Sin `desde` no hay manera de saber si ESTA semana toca. Una rutina
-- no tiene fecha —sólo día de la semana—, así que «cada dos semanas»
-- no significa nada hasta que se dice desde cuál. Con `desde`, la
-- cuenta es una resta: semanas entre su lunes y el lunes de hoy,
-- módulo `cada_semanas`.
--
-- ─────────────────────────────────────────────────────────────
-- Y POR QUÉ «CADA MES» SON CUATRO SEMANAS Y NO «EL PRIMER LUNES»
--
-- Son cosas distintas y conviene que quede escrito, porque la
-- diferencia se ve al año: cada cuatro semanas son TRECE veces al año
-- y el primer lunes son doce, así que a los pocos meses «el primer
-- lunes» ya no cae el primer lunes.
--
-- Se elige la de cuatro semanas por tres razones:
--
--   · Es UNA sola idea —cada cuántas semanas— y no dos modelos
--     conviviendo. La pantalla pregunta una cosa y la base guarda una
--     cosa.
--   · Es como se piensa una tarea de casa: «las sábanas, cada dos
--     semanas». Nadie dice «las sábanas el primer y el tercer lunes».
--   · Y no rompe nada de lo que ya hay: `dia` sigue mandando, el plan
--     de la semana sigue siendo una rejilla de trabajos por día.
--
-- El precio es que hay que LLAMARLA por su nombre. En la pantalla
-- pone «Cada cuatro semanas», no «el primer lunes de cada mes». Un
-- texto que promete una cosa y hace otra es el fallo que más caro
-- sale en MAPPEL, y aquí se evita diciendo la verdad.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ── 1 · Cada cuántas semanas ───────────────────────────────
/*
  `default 1` es lo que hace que esto no rompa nada: todas las rutinas
  que ya existen pasan a ser «cada semana», que es exactamente lo que
  venían haciendo. Nadie nota la migración.
*/
alter table rutinas
  add column if not exists cada_semanas smallint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rutinas_cada_semanas_conocido'
  ) then
    alter table rutinas add constraint rutinas_cada_semanas_conocido
      check (cada_semanas in (1, 2, 3, 4));
  end if;
end $$;

comment on column rutinas.cada_semanas is
  'Cada cuántas semanas vuelve: 1 cada semana, 2 cada dos, 3 cada tres, 4 cada cuatro (una vez al mes). Ver sql/97.';


-- ── 2 · Desde qué semana se cuenta ─────────────────────────
/*
  El ancla. Se guarda la fecha tal cual y la cuenta la normaliza a su
  lunes: así da igual que entre un martes: la semana es la misma.

  `default current_date` para las que ya existen: empiezan a contar
  hoy, y como todas son `cada_semanas = 1` eso no cambia nada —con
  periodo 1 toca siempre, se cuente desde donde se cuente—.
*/
alter table rutinas
  add column if not exists desde date not null default current_date;

comment on column rutinas.desde is
  'Desde qué semana cuenta la repeticion. Se normaliza a su lunes al preguntar. Ver sql/97.';


-- ── 3 · ¿Toca esta semana? ─────────────────────────────────
/*
  La misma cuenta que hace `lib/rutinas.ts`, aquí también.

  No porque alguien la vaya a llamar hoy —la pantalla filtra en el
  servidor de MAPPEL— sino para poder MIRARLO desde el editor de
  Supabase el día que algo no cuadre. Una cuenta que solo existe en
  TypeScript es una cuenta que no se puede comprobar contra los datos.

  `immutable`: con las mismas entradas da siempre lo mismo, así que
  Postgres puede usarla en un índice o en un check si algún día hace
  falta.
*/
create or replace function toca_esta_semana(desde date, cada smallint, el_dia date)
returns boolean language sql immutable as $$
  select case
    when cada is null or cada <= 1 then true
    else mod(
      /* Semanas enteras entre el lunes de `desde` y el lunes de `el_dia`.
         Positivo o negativo: `mod` de Postgres conserva el signo, así que
         se suma `cada` y se vuelve a tomar el resto para que una rutina
         anclada en el futuro no conteste cualquier cosa. */
      ( (el_dia - (extract(isodow from el_dia)::int - 1))
      - (desde  - (extract(isodow from desde )::int - 1)) ) / 7 + cada,
      cada
    ) = 0
  end
$$;

comment on function toca_esta_semana(date, smallint, date) is
  'Si una rutina que vuelve cada N semanas, anclada en `desde`, toca la semana de `el_dia`. Ver sql/97.';


-- ── 4 · Y nadie más puede escribir estas columnas ──────────
/*
  `rutinas` no tiene `grant` por columnas —no es `hogares`—, así que
  las políticas de siempre siguen mandando: el plan lo monta quien
  creó la casa, y eso lo comprueba `app/api/rutinas/route.ts` antes de
  escribir. Aquí no hace falta nada más.

  Se deja dicho para que quien lea esto dentro de dos años no busque
  un permiso que no existe.
*/

commit;


-- ═══════════════════════════════════════════════════════════════
-- CÓMO SE COMPRUEBA QUE HA IDO BIEN
-- ═══════════════════════════════════════════════════════════════
--
--   select cada_semanas, desde from rutinas limit 5;
--     → todas con 1 y con la fecha de hoy.
--
--   select toca_esta_semana('2026-10-05', 2, '2026-10-07');  → true
--   select toca_esta_semana('2026-10-05', 2, '2026-10-14');  → false
--   select toca_esta_semana('2026-10-05', 2, '2026-10-21');  → true
--   select toca_esta_semana('2026-10-05', 4, '2026-11-02');  → true
--   select toca_esta_semana('2026-10-05', 1, '2027-03-11');  → true
