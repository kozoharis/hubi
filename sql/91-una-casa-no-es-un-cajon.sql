-- ═══════════════════════════════════════════════════════════════
-- 91 · UNA CASA NO ES UN CAJÓN
-- ═══════════════════════════════════════════════════════════════
--
-- Haris, mirando El escritorio: *«¿cuál es la intención? No la
-- entiendo… y si yo no lo entiendo me da que los otros usuarios
-- tampoco»*.
--
-- Y la pantalla no estaba mal. Lo que estaba mal era lo que le
-- llegaba.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE SE VEÍA
--
--     SOLETES                 Familia · 26 papeles
--     TE ESPERA  8 cosas      ESTE TRIMESTRE  −293,88 €
--
--     Documentos personales   Familia · 2 papeles
--     TE ESPERA  Nada         ESTE TRIMESTRE  —
--
-- Una casa con su gente, sus gastos y su trimestre, comparada con un
-- cajón de papeles. Por eso no se entendía: **no se puede comparar lo
-- que no es comparable**, y la pantalla estaba haciendo justo eso
-- porque para la base de datos las dos cosas son lo mismo.
--
--     hogares ( id, nombre, creado_en )
--
-- Ni una palabra sobre QUÉ es cada una. Así que «Documentos
-- personales» tiene miembros, cuentas y trimestre exactamente igual
-- que SOLETES, y sale en todas partes donde salen las casas.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE SE AÑADE
--
-- Una columna: `hogares.clase`. Dos valores.
--
--     'casa'      ·  una casa de verdad, con su gente y sus cuentas.
--     'personal'  ·  un espacio de uno: papeles y poco más.
--
-- Nace en `'casa'` para todo lo que ya existe, que es lo que eran
-- hasta hoy. Marcar cuál es personal se hace a mano —abajo hay una
-- línea para eso— porque adivinarlo sería inventar: un espacio con un
-- solo miembro puede ser un cajón… o la casa de alguien que vive solo.
-- Y confundir esas dos es exactamente lo que ha traído hasta aquí.
--
-- ─────────────────────────────────────────────────────────────
-- Y LA PANTALLA DEJA DE MEZCLARLOS
--
-- `mi_escritorio()` pasa a contar sólo las casas. Un cajón de papeles
-- no tiene nada que comparar con otro: ni trimestre, ni gente
-- esperando, ni cuentas.
--
-- Lo demás NO cambia: el espacio personal se sigue viendo, se sigue
-- entrando en él y sus papeles siguen donde estaban. Lo único que
-- deja de hacer es salir en una tabla de comparar.
--
-- ⚠️  Ojo con esto: si marcas como `'personal'` todas tus casas menos
-- una, El escritorio se queda con una fila. La pantalla lo dice y no
-- se rompe, pero conviene saberlo antes de marcar.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ NO CAMBIA
--
-- Las políticas no se tocan: una columna nueva no cambia quién ve
-- qué. Y ninguna pantalla deja de funcionar si esto no se ejecuta —
-- el código pide la columna y, si la base no la tiene, vuelve a pedir
-- sin ella.
--
-- **Una columna nueva nunca puede ser obligatoria para lo que ya
-- funcionaba.** Séptima vez.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     alter table hogares drop column if exists clase;
--     -- y volver a ejecutar sql/52-el-escritorio.sql, que devuelve
--     -- `mi_escritorio()` a como estaba: sin filtrar por clase.
--
-- El orden importa: primero el 52 y luego la columna, o la función se
-- queda un momento apuntando a algo que ya no existe.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $p91$
begin
  if to_regclass('public.hogares') is null then
    raise exception 'ABORTADO: no existe `hogares`. Falta el paso 17.';
  end if;

  if to_regprocedure('public.mi_escritorio(date, date)') is null then
    raise exception 'ABORTADO: no existe `mi_escritorio()`. Falta el paso 52.';
  end if;

  raise notice 'Puerta pasada. Espacios ahora mismo: %.',
    (select count(*) from hogares);
end $p91$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA COLUMNA
-- ═══════════════════════════════════════════════════════════════
alter table hogares
  add column if not exists clase text not null default 'casa';

/* La restricción va aparte y con su nombre, para poder quitarla sin
   tocar la columna. Y se comprueba antes de crearla: `add constraint`
   no tiene `if not exists`. */
do $p91$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'hogares_clase_valida'
  ) then
    alter table hogares
      add constraint hogares_clase_valida check (clase in ('casa', 'personal'));
  end if;
end $p91$;

comment on column hogares.clase is
  'casa = una casa de verdad, con su gente y sus cuentas. personal = un espacio de uno, papeles y poco mas. Se marca a mano: adivinarlo por el numero de miembros confunde un cajon con la casa de quien vive solo. Paso 91.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · Y EL ESCRITORIO DEJA DE MEZCLARLOS
-- ═══════════════════════════════════════════════════════════════
/*
  ⚠️  ESTA FUNCIÓN ES LA DEL PASO 52, COPIADA LETRA POR LETRA.

  Lo único que cambia son DOS LÍNEAS dentro de `mias`: el `join` con
  `hogares` y la condición de la clase. Todo lo demás —la recursión con
  su guardia de hondura, los recuentos, las sumas por movimientos—
  está tal cual.

  Y se dice aquí arriba a propósito. Reescribir una función «de
  memoria» es la manera más fácil que hay de cambiar algo sin querer:
  un `fecha` donde ponía `fecha_documento`, un `<> 'hecho'` donde
  ponía `= 'pendiente'`. No da error: da otros números. Si mañana hay
  que tocarla otra vez, se copia del 52 y se cambia lo que toque.

  `coalesce(h.clase, 'casa')` aunque la columna sea `not null`: si
  alguien la quitara a mano sin volver a ejecutar el 52, esto sigue
  contestando en vez de reventar.
*/
create or replace function mi_escritorio(desde date, hasta date)
returns table (
  hogar_id      uuid,
  nombre        text,
  rol           text,
  papeles       bigint,
  ultimo_papel  date,
  esperando     bigint,
  ingresos      numeric,
  gastos        numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive
  /* LAS MÍAS. Todo lo de abajo cuelga de aquí, y aquí solo entra
     auth.uid(). Una invitación sin contestar no cuenta: que alguien te
     ofrezca su casa no te mete dentro. */
  mias as (
    select m.hogar_id, m.rol
    from miembros m
    /* ── LO ÚNICO NUEVO DEL PASO 91 ──
       Un cajón de papeles no se compara con una casa. */
    join hogares h on h.id = m.hogar_id
    where m.perfil_id = auth.uid()
      and m.aceptado_en is not null
      and coalesce(h.clase, 'casa') = 'casa'
  ),

  /* Las actividades —finca, obras, pisos—, que son las que llevan
     cuentas. Lo de la compra de casa no es asunto del asesor y no
     tiene por qué salir en su tabla. */
  raices as (
    select c.id, c.hogar_id
    from categorias c
    where c.padre_id is null
      and c.lleva_cuentas = true
      and c.hogar_id in (select hogar_id from mias)
  ),
  /* Y todo lo que cuelga de ellas, a la profundidad que sea: una casa
     puede tener Finca › Gastos › 2026 › T3 › Luz y otra solo Finca ›
     Gastos. Escribir «dos niveles» aquí sería acertar en una casa y
     fallar en la siguiente. */
  arbol as (
    select r.id, r.hogar_id, 1 as hondura from raices r
    union all
    select c.id, a.hogar_id, a.hondura + 1
    from categorias c
    join arbol a on c.padre_id = a.id
    /* Las dos condiciones son cinturón y tirantes, y las dos importan:

       `c.hogar_id = a.hogar_id` — nada impide en la base de datos que
       una categoría de una casa apunte como padre a la de otra. Hoy no
       pasa, y si pasara, sin esta línea el árbol de una casa se comería
       ramas de la vecina.

       `hondura < 12` — un padre que apunte a su propio nieto haría que
       esto girara para siempre, y una consulta infinita en una función
       que llama la pantalla al abrirla se ve como que MAPPEL no arranca.
       Doce niveles son cuatro veces lo más hondo que tiene nadie. */
    where c.hogar_id = a.hogar_id
      and a.hondura < 12
  )

  select
    h.id,
    h.nombre,
    mias.rol,

    (select count(*)
       from documentos d
      where d.hogar_id = h.id)                                   as papeles,

    (select max(d.fecha_documento)
       from documentos d
      where d.hogar_id = h.id)                                   as ultimo_papel,

    /* LO QUE ESTOY ESPERANDO de esta casa: lo que YO dejé apuntado
       ahí y sigue sin hacerse. Para un asesor es literalmente su
       lista de reclamaciones; para un hijo que echa una mano, lo que
       le pidió a sus padres. */
    (select count(*)
       from recordatorios r
      where r.hogar_id = h.id
        and r.creado_por = auth.uid()
        and r.estado = 'pendiente')                              as esperando,

    coalesce((select sum(mv.importe)
                from movimientos mv
               where mv.hogar_id = h.id
                 and mv.tipo = 'ingreso'
                 and mv.fecha between desde and hasta
                 and mv.categoria_id in
                     (select a.id from arbol a where a.hogar_id = h.id)), 0),

    coalesce((select sum(mv.importe)
                from movimientos mv
               where mv.hogar_id = h.id
                 and mv.tipo = 'gasto'
                 and mv.fecha between desde and hasta
                 and mv.categoria_id in
                     (select a.id from arbol a where a.hogar_id = h.id)), 0)

  from mias
  join hogares h on h.id = mias.hogar_id
  order by h.nombre;
$$;

/* Se vuelven a decir, aunque `create or replace` los conserva: si un
   día alguien la borra y la crea de nuevo, que estén escritos al lado
   ahorra el susto. */
revoke all on function mi_escritorio(date, date) from public, anon;
grant execute on function mi_escritorio(date, date) to authenticated;

comment on function mi_escritorio(date, date) is
  'Un resumen por CASA (clase = casa) donde el que llama es miembro aceptado. Los espacios personales no salen: paso 91. Nunca devuelve documentos ni movimientos, solo recuentos y sumas.';

commit;


-- ═══════════════════════════════════════════════════════════════
-- 3 · COMPROBACIÓN
-- ═══════════════════════════════════════════════════════════════
-- Ejecuta esto después, una consulta cada vez.

-- 3.1 · La columna está, y todo nació como casa.
select clase, count(*) from hogares group by clase;
-- ESPERADO: una sola fila, `casa`, con todos tus espacios.

-- 3.2 · La funcion sigue ahi y sigue contestando.
select nombre, papeles, esperando, ingresos, gastos
from mi_escritorio(date_trunc('quarter', current_date)::date, current_date);
-- ESPERADO: lo mismo que antes, porque todavia no has marcado nada.
-- ⚠️  Desde el editor SQL esto sale VACIO: la funcion pregunta por
-- `auth.uid()` y ahi eres nadie. No es un fallo. Se comprueba de
-- verdad abriendo la pantalla en mappel.


-- ═══════════════════════════════════════════════════════════════
-- 4 · Y AHORA SÍ: MARCAR LO QUE NO ES UNA CASA
-- ═══════════════════════════════════════════════════════════════
-- Primero mira qué tienes, para no marcar a ciegas:

select id, nombre, clase, creado_en from hogares order by creado_en;

-- Y marca el que sea un cajón de papeles. Por el NOMBRE y no por el
-- identificador, que es más fácil de leer y más fácil de equivocar
-- menos:

--     update hogares set clase = 'personal'
--      where nombre = 'Documentos personales';

-- Vuelve a abrir El escritorio: ese espacio ya no sale ahí. Sigue
-- estando en todo lo demás — se entra en él igual y sus papeles no se
-- han movido.

-- Y si te arrepientes:

--     update hogares set clase = 'casa'
--      where nombre = 'Documentos personales';
