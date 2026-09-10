-- ═══════════════════════════════════════════════════════════════
-- HUBI · LOS TRES QUE FALTAN
-- ═══════════════════════════════════════════════════════════════
--
-- 10 de septiembre de 2026. Los tres seguidos, en orden, para pegarlos
-- de una vez en el editor de SQL de Supabase.
--
--     50   la casilla de «hablar» en Primeros pasos
--     51   una tarea para varias personas
--     52   la tabla de todas tus casas
--
-- ─────────────────────────────────────────────────────────────
-- SI ALGO FALLA
--
-- Postgres para en la primera línea que no le gusta y no ejecuta lo
-- que venga después. Así que si sale un error, dime CUÁL de los tres
-- bloques estaba —el mensaje trae el número de línea— y lo miramos.
-- Los anteriores ya habrán quedado hechos; volver a ejecutar el
-- archivo entero no rompe nada, porque los tres están escritos para
-- poder repetirse.
--
-- ─────────────────────────────────────────────────────────────
-- Y LO ÚLTIMO QUE VERÁS SALDRÁ VACÍO
--
-- Al final del 52 hay una comprobación que devuelve CERO FILAS, y eso
-- es lo correcto: en el editor de Supabase no hay sesión iniciada, así
-- que la consulta no sabe de quién eres y no tiene ninguna casa tuya
-- que enseñar.
--
-- Que ahí salieran filas SÍ sería un problema.



-- ███████████████████████████████████████████████████████████████
-- ███  50 · La casilla de «hablar» en Primeros pasos
-- ███████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════
-- 50 · LOS PRIMEROS PASOS
-- ═══════════════════════════════════════════════════════════════
--
-- Una tabla de cuatro columnas para una tarjeta que desaparece sola.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ HACE FALTA, SI CASI TODO SE PODÍA SABER YA
--
-- La tarjeta de «Primeros pasos» se tacha sola: cada paso se marca
-- cuando la persona lo hace de verdad, no cuando ve un vídeo. Y tres
-- de los cuatro pasos ya se pueden saber de lo que hay:
--
--     guardar un papel   ->  documentos.subido_por
--     apuntar en agenda  ->  recordatorios.creado_por
--     dejar una nota     ->  notas.escrita_por
--
-- El cuarto, HABLARLE, no deja rastro en ninguna parte. Una consulta
-- por voz no escribe nada, y un recordatorio dictado es idéntico a
-- uno escrito a mano.
--
-- Se podría haber cambiado el paso por otro que sí se supiera. Pero
-- hablar es la mitad de lo que HUBI promete —hablar, fotografiar,
-- consultar— y dejarlo fuera de los primeros pasos sería enseñar el
-- producto sin su mejor parte.
--
-- ─────────────────────────────────────────────────────────────
-- Y GENERAL, NO SOLO PARA LA VOZ
--
-- La tabla guarda «paso» como texto en vez de una columna por paso.
-- El día que los primeros pasos sean otros —o haya un segundo grupo
-- de pasos para quien ayuda en casa— no hace falta tocar el esquema.

create table if not exists pasos_dados (
  perfil_id uuid not null references perfiles(id) on delete cascade,
  paso      text not null,
  cuando    timestamptz not null default now(),
  primary key (perfil_id, paso)
);

alter table pasos_dados enable row level security;

-- Cada uno los suyos, y solo los suyos. Aquí no hay nada que
-- compartir: que Conchita haya hablado con HUBI no es asunto de nadie
-- más, y desde luego no del asesor.
drop policy if exists pasos_leer on pasos_dados;
create policy pasos_leer on pasos_dados
  for select to authenticated using (perfil_id = auth.uid());

drop policy if exists pasos_crear on pasos_dados;
create policy pasos_crear on pasos_dados
  for insert to authenticated with check (perfil_id = auth.uid());

drop policy if exists pasos_borrar on pasos_dados;
create policy pasos_borrar on pasos_dados
  for delete to authenticated using (perfil_id = auth.uid());

-- ── Comprobación ───────────────────────────────────────────
-- Debe salir la tabla con 0 filas y las tres políticas.
select 'pasos_dados' as tabla, count(*) as filas from pasos_dados;
select policyname from pg_policies where tablename = 'pasos_dados' order by policyname;


-- ███████████████████████████████████████████████████████████████
-- ███  51 · Una tarea para varias personas
-- ███████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════
-- 51 · UNA COSA PARA VARIAS PERSONAS
-- ═══════════════════════════════════════════════════════════════
--
-- Una columna. Nada más.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE SE PEDÍA
--
-- «Recoged los dos la medicación» tenía que poder apuntarse una vez y
-- aparecerle a los dos en su tablón. Hasta ahora `asignado_a` era UNA
-- persona, o nulo — y nulo significaba «de la casa», que no es lo
-- mismo que «de estos dos y no de los otros dos».
--
-- ─────────────────────────────────────────────────────────────
-- Y POR QUÉ NO HAY TABLA NUEVA
--
-- La forma «de libro» sería una tabla `recordatorio_para` con una
-- fila por persona. Se descartó, y por un motivo concreto: se decidió
-- que **cada uno marca la suya**. Que Juan Miguel firme los papeles no
-- los firma por Conchita.
--
-- Con esa decisión, una tarea para dos personas ES dos tareas: dos
-- estados, dos fechas de hecho, dos avisos al móvil. Y eso ya lo sabe
-- hacer esta tabla desde el primer día.
--
-- Así que una tarea para dos se guarda como dos filas hermanas, y lo
-- único que hace falta es saber que nacieron juntas:
--
--     grupo_id
--
-- Lo que se gana no es elegancia, es que DIECINUEVE archivos que leen
-- `asignado_a` siguen funcionando sin tocarlos: la agenda, el mes, el
-- día, los avisos del móvil, las cuentas, la compra, los
-- vencimientos. Una tabla nueva habría obligado a reescribir cada
-- consulta de la casa para una función que se usa de vez en cuando.
--
-- ─────────────────────────────────────────────────────────────
-- PARA QUÉ SIRVE EL GRUPO, ENTONCES
--
-- Hoy, para poder decir «esto es de los dos» al enseñarlo, y para que
-- borrar una no deje huérfana a la otra sin que nadie sepa que existía.
--
-- Mañana, para poder contestar «¿lo han hecho ya los dos?» sin una
-- migración. Es una columna nulable: no cuesta nada tenerla y cuesta
-- un rato no haberla puesto.
--
-- Lo que NO hace: cambiar una no cambia la otra. Si Conchita mueve la
-- suya al jueves, la de Juan Miguel se queda donde estaba. Es lo menos
-- sorprendente de las dos posibilidades — quien abre una tarea que
-- pone su nombre está tocando la suya.

alter table recordatorios
  add column if not exists grupo_id uuid;

comment on column recordatorios.grupo_id is
  'Las que se apuntaron de una vez para varias personas comparten este valor. Nulo = de una sola persona.';

-- Se busca por grupo solo para enseñar «y a Conchita también» y para
-- las hermanas de una. Nunca es la condición principal de una
-- consulta, así que un índice normal y parcial es de sobra.
create index if not exists idx_recordatorios_grupo
  on recordatorios(grupo_id) where grupo_id is not null;

-- ─────────────────────────────────────────────────────────────
-- Y NO HACE FALTA TOCAR NINGUNA POLÍTICA
--
-- Cada fila sigue teniendo su `hogar_id`, su `asignado_a` y su
-- `creado_por`, que es de lo único que hablan las políticas de RLS del
-- archivo 37. Una fila hermana no es un caso especial para ellas: es
-- una fila más, con nombre y dueño, exactamente como todas.


-- ███████████████████████████████████████████████████████████████
-- ███  52 · La tabla de todas tus casas
-- ███████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════
-- 52 · EL ESCRITORIO
-- ═══════════════════════════════════════════════════════════════
--
-- Un resumen por cada casa donde estás. Una función, ninguna tabla
-- nueva y NINGUNA política tocada.
--
-- ─────────────────────────────────────────────────────────────
-- DE DÓNDE SALE ESTO
--
-- Un asesor de verdad dijo la frase: «cada uno de mis clientes podría
-- tener esta aplicación, yo los invito y llevo a quince desde aquí —
-- pero desde el móvil eso es imposible».
--
-- Y no es imposible porque las pantallas sean pequeñas. Es imposible
-- porque para saber cuál de las quince casas le está esperando tiene
-- que entrar en las quince, una por una.
--
-- Pero no se llama «el asesor», y es a propósito. Un asesor con quince
-- casas y un hijo con dos —la suya y la de sus padres— tienen el mismo
-- problema y les sirve la misma pantalla. Ponerle el nombre de un rol
-- la habría dejado escondida para el segundo.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ UNA FUNCIÓN Y NO CAMBIAR LAS POLÍTICAS
--
-- Todo HUBI está atado a UNA casa: `mi_hogar()` dice cuál estás
-- mirando, y todas las políticas de todas las tablas preguntan «¿esta
-- fila es de esa casa?». Es lo que hace que la finca de una familia no
-- aparezca jamás en la de otra.
--
-- Lo cómodo sería cambiar esas políticas a «¿es de ALGUNA de mis
-- casas?». Y sería el cambio más peligroso que se ha hecho aquí,
-- porque —lección ya pagada en este proyecto— **una política mal
-- escrita no da error: enseña lo que no debía**. No se vería como una
-- avería. Se vería como que el gestor de la familia A abre su
-- escritorio y encuentra dentro las facturas de la familia B.
--
-- Así que las políticas se quedan EXACTAMENTE como están, y esto es
-- una puerta aparte, estrecha y con una sola forma:
--
--     entra   quién eres (auth.uid(), que no se puede falsear)
--     sale    un recuento y dos sumas por casa
--
-- Esta función no puede devolver un documento aunque quisiera. No hay
-- ninguna columna en su salida donde quepa.
--
-- ─────────────────────────────────────────────────────────────
-- `security definer`, Y POR QUÉ AQUÍ SÍ
--
-- Se salta las políticas — que es justo lo que hace falta, porque las
-- políticas contestarían solo por la casa que estás mirando.
--
-- Lo que la hace segura es que la lista de casas NO es un parámetro:
-- se calcula dentro, de `auth.uid()`, y todo lo demás cuelga de ella.
-- Quien la llame con lo que quiera solo puede obtener sus propias
-- casas. Los dos parámetros son fechas, y una fecha no abre nada.

-- ── El resumen ────────────────────────────────────────────────
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
    where m.perfil_id = auth.uid()
      and m.aceptado_en is not null
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
       que llama la pantalla al abrirla se ve como que HUBI no arranca.
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

/* Que la pueda llamar quien ha entrado, y nadie más. `anon` es quien
   no ha iniciado sesión: para él `auth.uid()` es nulo y la función
   devolvería cero filas igualmente, pero no hace falta ni ofrecérsela. */
revoke all on function mi_escritorio(date, date) from public, anon;
grant execute on function mi_escritorio(date, date) to authenticated;

comment on function mi_escritorio(date, date) is
  'Un resumen por casa donde el que llama es miembro aceptado. Nunca devuelve documentos ni movimientos: solo recuentos y sumas.';


-- ── Comprobación ──────────────────────────────────────────────
/*
  Ejecútala desde el SQL Editor de Supabase y saldrá VACÍA. No es un
  fallo: ahí no hay sesión, así que `auth.uid()` es nulo y no hay
  ninguna casa tuya que enseñar. Es exactamente lo que tiene que pasar.

  Que devuelva filas sin sesión SÍ sería el fallo.

  La prueba de verdad se hace desde HUBI: entra, ve a Ajustes → El
  escritorio, y comprueba que salen tus casas y solo las tuyas.
*/
select * from mi_escritorio(date_trunc('quarter', current_date)::date,
                            current_date);
