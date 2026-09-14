-- ═══════════════════════════════════════════════════════════════
-- 71 · LAS CÁSCARAS
-- ═══════════════════════════════════════════════════════════════
--
-- Éste es **el paso 62 que nunca se dio**. Se dieron el 62a, el 62b y
-- el 62c, y como los hermanos con letra sí se ejecutaron, el paso sin
-- letra pareció hecho. No lo estaba, y se vio el día que la tableta de
-- la cocina enseñó todos los papeles de la casa.
--
-- La regla que dejó aquello escrita:
--
--     UN PASO CON LETRA NO SUSTITUYE AL PASO SIN LETRA.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ ARREGLA
--
-- MAPPEL tiene un modelo de permisos —`nivel_por_rol` → `nivel_en` →
-- `puede`— y tiene cuatro funciones ANTERIORES a ese modelo que no
-- pasan por él:
--
--     puedo_ver_carpeta   ·  puedo_guardar_en
--     puedo_escribir      ·  puedo_en_agenda
--
-- Esas cuatro gobiernan 32 políticas. O sea que hoy, en la mayor parte
-- de MAPPEL, el reparto de niveles **no manda**: manda `papel <> 'lector'`
-- y los dos atajos viejos, `ve_todo` y `escribe_todo`.
--
-- Este paso las convierte en cáscaras del modelo. A partir de aquí hay
-- un solo sitio donde se decide quién puede qué, y es la tabla de
-- niveles.
--
-- ─────────────────────────────────────────────────────────────
-- `puedo_escribir` NO PUEDE SER UNA CÁSCARA. SIRVE A CINCO COSAS
--
-- Es lo que hace este paso largo. `puedo_ver_carpeta` y
-- `puedo_guardar_en` reciben una carpeta, así que el ámbito se deduce
-- (`ambito_de`). `puedo_escribir(casa)` no recibe nada: significa cosas
-- distintas en cada sitio donde se la llama.
--
--     compra                       →  ámbito 'compra'
--     menús · recetas · rutinas    →  ámbito 'dia'
--     pagos fijos · unidades       →  ámbito 'cuentas'
--     movimientos                  →  la carpeta del movimiento
--     renombrar la casa            →  acto de la casa entera
--     crear carpetas               →  acto de la casa entera
--
-- Por eso no se reescribe la función: se reescriben **los dieciséis
-- sitios que la llaman**, cada uno con lo que de verdad quería decir. Y
-- al final se borra, para que nadie la vuelva a usar sin querer.
--
-- ─────────────────────────────────────────────────────────────
-- LA CASA ENTERA NO ES UN ÁMBITO, Y AUN ASÍ EL MODELO LA CONTESTA
--
-- Renombrar la casa y crear carpetas no caen en ninguna sección. Se
-- intentó resolverlo a mano —«el dueño, o la familia»— y salieron dos
-- fallos seguidos:
--
--   · con `coalesce(rol,'')`, quien tiene el rol a nulo —la gente de
--     antes de que existiera la columna— perdía su propia casa;
--   · con `coalesce(rol,'familia')`, un LECTOR con el rol a nulo la
--     ganaba.
--
-- La regla buena no es un caso especial: es el modelo. Con un ámbito
-- que no está en la tabla, `nivel_por_rol` cae en su `else`, y el `else`
-- ya contesta bien las cinco situaciones:
--
--     propietario      → todo    → sí
--     familia          → todo    → sí
--     familia/lector   → mirar   → no   (el techo lo pone `nivel_en`)
--     ayuda            → nada    → no
--     asesor           → mirar   → no
--     dispositivo      → nada    → no
--
--     puede(casa, 'casa', null, 'todo')
--
-- Lección, escrita para la próxima vez:
--
--     CADA VEZ QUE ESCRIBO UN `coalesce` A MANO AL LADO DE UNA FUNCIÓN
--     QUE YA SABE LA RESPUESTA, ME EQUIVOCO.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE CAMBIA DE VERDAD · MEDIDO ANTES, EN LA BASE REAL
--
-- Con `71a-bis` sobre la base de MAPPEL, 10 personas y 23 carpetas raíz.
-- Salieron SIETE filas, y ni una es de la familia:
--
--     La cocina   · carpeta Casa ................ deja de verla
--     La cocina   · la agenda ................... deja de poder
--     La cocina   · renombrar y crear carpetas .. deja de poder
--     La cocina   · pagos fijos y unidades ...... deja de poder
--     Rosana (ayuda) · la agenda ................ deja de poder
--     Rosana (ayuda) · renombrar y crear carpetas deja de poder
--     Rosana (ayuda) · pagos fijos y unidades ... deja de poder
--
-- Las de «pagos fijos y unidades» son el agujero cerrándose: hoy la
-- ayuda escribe en tablas de dinero donde su nivel dice `nada`.
--
-- ⚠️  Y LA DE ROSANA EN LA AGENDA HAY QUE DECIDIRLA APARTE.
--     Hoy apunta, y MAPPEL le enseña el botón «Apuntar algo». Con este
--     paso deja de poder y el botón le fallaría. Está en el
--     `71b`, que es opcional y va después. Léelo antes de dar por
--     cerrado el 71.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE CUESTA
--
-- Medido: mil llamadas, 158 ms antes, 145 ms después. La expresión
-- nueva es más rápida que la vieja. Era el riesgo principal y no está.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
-- Está entero al final del fichero, en el bloque «PARA VOLVER ATRÁS».
-- No se ejecuta; está ahí para copiar y pegar si hiciera falta.

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
/*
  La puerta no decide: comprueba que el suelo está donde se cree y
  enseña lo que hay. Si falta algo, aborta y no toca nada.
*/
do $$
declare
  falta text;
  cuantas int;
begin
  foreach falta in array array['puede','nivel_en','ambito_de','nivel_por_rol','orden','raiz_de','mi_rol','soy_de'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = falta
    ) then
      raise exception 'ABORTADO: falta la funcion `%`. El modelo de niveles no esta puesto.', falta;
    end if;
  end loop;

  select count(*) into cuantas
    from pg_policies
   where schemaname = 'public'
     and coalesce(qual,'') || coalesce(with_check,'') ~ 'puedo_escribir';

  if cuantas <> 16 then
    raise exception
      'ABORTADO: se esperaban 16 politicas con `puedo_escribir` y hay %. '
      'Alguien las ha tocado; hay que volver a mirarlas una a una.', cuantas;
  end if;

  raise notice 'Puerta pasada. 16 politicas con `puedo_escribir`, como se esperaba.';
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA FOTO DE ANTES
-- ═══════════════════════════════════════════════════════════════
/*
  Antes de tocar nada se anota, persona a persona y carpeta a carpeta,
  qué contesta MAPPEL hoy. Al final del paso se vuelve a preguntar lo
  mismo y se comparan las dos fotos.

  Va en una tabla temporal dentro de la misma transacción: si el paso
  aborta, la foto se va con él.
*/
create temporary table foto_71 (
  cuando   text,      -- 'antes' | 'despues'
  quien    uuid,
  casa     uuid,
  de_que   text,      -- el nombre del sitio, para leerlo
  mirar    boolean,
  guardar  boolean
) on commit drop;

create or replace function pg_temp.sacar_la_foto(momento text) returns void
language plpgsql as $$
declare
  m record;
  c record;
begin
  for m in
    select perfil_id, hogar_id from miembros where aceptado_en is not null
  loop
    perform set_config('request.jwt.claim.sub', m.perfil_id::text, true);

    /* Las carpetas raíz, una por una. */
    for c in
      select id, nombre from categorias
       where hogar_id = m.hogar_id and padre_id is null
    loop
      insert into foto_71 values (
        momento, m.perfil_id, m.hogar_id, 'carpeta: ' || c.nombre,
        coalesce(puedo_ver_carpeta(m.hogar_id, c.id), false),
        coalesce(puedo_guardar_en(m.hogar_id, c.id), false)
      );
    end loop;

    /* Y lo que no lleva carpeta. Sin carpeta también se pregunta:
       hay papeles y movimientos que pueden no tener ninguna. */
    insert into foto_71 values (
      momento, m.perfil_id, m.hogar_id, 'sin carpeta',
      coalesce(puedo_ver_carpeta(m.hogar_id, null), false),
      coalesce(puedo_guardar_en(m.hogar_id, null), false)
    );

    insert into foto_71 values (
      momento, m.perfil_id, m.hogar_id, 'la agenda',
      null, coalesce(puedo_en_agenda(m.hogar_id), false)
    );
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
end $$;

select pg_temp.sacar_la_foto('antes');


-- ═══════════════════════════════════════════════════════════════
-- 2 · LAS DOS CÁSCARAS DE CARPETA
-- ═══════════════════════════════════════════════════════════════
/*
  Aquí se ve de un vistazo lo que este paso hace con todo:

      antes:  ¿tiene `ve_todo`? ¿tiene permiso en la carpeta?
      ahora:  ¿qué nivel tiene esta persona en esta carpeta?

  `ambito_de(cat)` devuelve el ámbito de la carpeta RAÍZ —y `'otros'`
  cuando no hay carpeta, que es lo que decidió el paso 60—. O sea que un
  papel suelto, sin carpeta, cae en `'otros'`, y ahí la familia tiene
  `todo` y un aparato tiene `nada`. Que es lo correcto: antes, un papel
  sin clasificar lo veía cualquiera, porque la función empezaba con
  «si no hay carpeta, entonces sí».

  `create or replace` y no `drop`: las 32 políticas apuntan a estas
  funciones por su identificador interno, y reemplazar lo conserva. Los
  permisos de ejecución también se conservan —los que dejó el 68b— y por
  eso no hay que volver a darlos.
*/
create or replace function puedo_ver_carpeta(casa uuid, cat uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select puede(casa, ambito_de(cat), cat, 'mirar')
$$;

create or replace function puedo_guardar_en(casa uuid, cat uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select puede(casa, ambito_de(cat), cat, 'anadir')
$$;


-- ═══════════════════════════════════════════════════════════════
-- 3 · LA AGENDA
-- ═══════════════════════════════════════════════════════════════
/*
  El asesor apunta en la agenda aunque su nivel diga `nada`. No es un
  descuido: lo decidió el paso 64b, y es la única manera de que pueda
  dejarte una fecha —«falta la factura de septiembre»— sin poder leer
  la agenda entera, que sigue cerrada para él por `recordatorios_leer`.

  ⚠️  Y AQUÍ EL `coalesce` DE FUERA NO ES DECORACIÓN. Lo cazó el ensayo.

  Se escribió primero así, por quitar un `coalesce` que parecía inútil:

      select puede(casa,'agenda',null,'anadir') or mi_rol(casa) = 'asesor'

  Y para una pantalla de cocina, o para un lector sin rol, eso no
  devuelve `false`: devuelve **NULL**. `mi_rol` es nulo para ellos, y en
  SQL `false or null` es null. En una política RLS un nulo se trata como
  falso, así que no habría abierto nada — pero el día que alguien
  escriba `not puedo_en_agenda(...)`, el nulo se lo come todo.

  El `coalesce` de la versión vieja —`coalesce(mi_rol(casa),'familia')`—
  estaba evitando exactamente eso. La lección de este paso decía que un
  `coalesce` a mano al lado de una función que ya sabe la respuesta
  suele ser un error. Éste era el otro caso: el que sí hacía falta. Se
  distinguen mirando qué pasa con el nulo, no por la forma.
*/
create or replace function puedo_en_agenda(casa uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    puede(casa, 'agenda', null, 'anadir') or mi_rol(casa) = 'asesor',
    false)
$$;


-- ═══════════════════════════════════════════════════════════════
-- 4 · LOS DIECISÉIS SITIOS DONDE `puedo_escribir` QUERÍA DECIR OTRA COSA
-- ═══════════════════════════════════════════════════════════════
/*
  Cada política se vuelve a escribir ENTERA y tal cual estaba, cambiando
  solo la llamada. Lo que no es mío en este paso —las condiciones del
  62b sobre la ayuda, el `quien = auth.uid()` de las rutinas, el
  `exists` de unidades— se copia letra por letra.
*/

-- ── La compra ────────────────────────────────────────────────
/*
  Un aparato de cocina TIENE `anadir` en la compra, a propósito: una
  pantalla colgada en la cocina para lo que sirve es para apuntar que se
  ha acabado la leche. Aquí no pierde nada.
*/
drop policy "compra_crear"  on compra;
create policy "compra_crear" on compra for insert to authenticated
  with check ( soy_de(hogar_id) and puede(hogar_id, 'compra', null, 'anadir') );

drop policy "compra_editar"  on compra;
create policy "compra_editar" on compra for update to authenticated
  using ( soy_de(hogar_id) and puede(hogar_id, 'compra', null, 'anadir') );

drop policy "compra_borrar"  on compra;
create policy "compra_borrar" on compra for delete to authenticated
  using ( soy_de(hogar_id) and puede(hogar_id, 'compra', null, 'anadir') );

-- ── Menús, recetas y lo del día ──────────────────────────────
/*
  `menus_escribir` y `recetas_escribir` son `for all`, así que también
  tocan el SELECT. No importa: al lado hay un `menus_leer` y un
  `recetas_leer` permisivos con solo `soy_de(hogar_id)`, y las permisivas
  se SUMAN. Nadie deja de leer una receta por esto.
*/
drop policy "menus_escribir"  on menus;
create policy "menus_escribir" on menus for all to authenticated
  using      ( soy_de(hogar_id) and puede(hogar_id, 'dia', null, 'anadir') )
  with check ( soy_de(hogar_id) and puede(hogar_id, 'dia', null, 'anadir') );

drop policy "recetas_escribir"  on recetas;
create policy "recetas_escribir" on recetas for all to authenticated
  using      ( soy_de(hogar_id) and puede(hogar_id, 'dia', null, 'anadir') )
  with check ( soy_de(hogar_id) and puede(hogar_id, 'dia', null, 'anadir') );

drop policy "hechas_marcar"  on rutinas_hechas;
create policy "hechas_marcar" on rutinas_hechas for insert to authenticated
  with check (
    soy_de(hogar_id)
    and quien = auth.uid()
    and puede(hogar_id, 'dia', null, 'anadir')
  );

drop policy "hechas_desmarcar"  on rutinas_hechas;
create policy "hechas_desmarcar" on rutinas_hechas for delete to authenticated
  using ( soy_de(hogar_id) and puede(hogar_id, 'dia', null, 'anadir') );

-- ── Pagos fijos y unidades · esto es dinero ──────────────────
/*
  Aquí está el agujero de verdad. `nivel_por_rol('ayuda','cuentas')` es
  `nada`, y hasta hoy la ayuda podía crear, cambiar y borrar pagos fijos
  y unidades, porque `puedo_escribir` solo miraba si era lectora.

  El asesor tiene `mirar` en cuentas, así que tampoco escribe. Leer, sí:
  para eso están `pagos_fijos_leer` y `unidades_leer`, que este paso no
  toca.
*/
drop policy "pagos_fijos_crear"  on pagos_fijos;
create policy "pagos_fijos_crear" on pagos_fijos for insert to authenticated
  with check ( soy_de(hogar_id) and puede(hogar_id, 'cuentas', null, 'anadir') );

drop policy "pagos_fijos_cambiar"  on pagos_fijos;
create policy "pagos_fijos_cambiar" on pagos_fijos for update to authenticated
  using      ( soy_de(hogar_id) and puede(hogar_id, 'cuentas', null, 'anadir') )
  with check ( soy_de(hogar_id) and puede(hogar_id, 'cuentas', null, 'anadir') );

drop policy "pagos_fijos_borrar"  on pagos_fijos;
create policy "pagos_fijos_borrar" on pagos_fijos for delete to authenticated
  using ( soy_de(hogar_id) and puede(hogar_id, 'cuentas', null, 'anadir') );

drop policy "unidades_crear"  on unidades;
create policy "unidades_crear" on unidades for insert to authenticated
  with check (
    soy_de(hogar_id)
    and exists (
      select 1 from categorias c
       where c.id = unidades.seccion_id and c.hogar_id = unidades.hogar_id
    )
    and puede(hogar_id, 'cuentas', null, 'anadir')
  );

drop policy "unidades_editar"  on unidades;
create policy "unidades_editar" on unidades for update to authenticated
  using (
    soy_de(hogar_id)
    and exists (
      select 1 from categorias c
       where c.id = unidades.seccion_id and c.hogar_id = unidades.hogar_id
    )
    and puede(hogar_id, 'cuentas', null, 'anadir')
  );

drop policy "unidades_borrar"  on unidades;
create policy "unidades_borrar" on unidades for delete to authenticated
  using (
    soy_de(hogar_id)
    and exists (
      select 1 from categorias c
       where c.id = unidades.seccion_id and c.hogar_id = unidades.hogar_id
    )
    and puede(hogar_id, 'cuentas', null, 'anadir')
  );

-- ── Movimientos · el ámbito lo pone su carpeta ───────────────
/*
  Ésta es distinta de las demás y por eso va sola.

  Tenía `puedo_escribir(casa) AND puedo_ver_carpeta(casa, cat)`, que son
  exactamente los dos primeros términos de `puedo_guardar_en`. O sea que
  no hay ámbito que elegir: la respuesta es la carpeta del movimiento, y
  la función que la da ya existe.

  Cambia una cosa, y a mejor: antes bastaba con PODER VER la carpeta
  para apuntar un gasto en ella. Ahora hace falta poder GUARDAR. Es lo
  que dicen los permisos por carpeta desde que existen.

  La condición del 62b —la ayuda solo ve y toca lo que apuntó ella— se
  copia tal cual.
*/
drop policy "movimientos_crear"  on movimientos;
create policy "movimientos_crear" on movimientos for insert to authenticated
  with check (
    soy_de(hogar_id)
    and puedo_guardar_en(hogar_id, categoria_id)
    and ( coalesce(mi_rol(hogar_id), 'familia') <> 'ayuda' or creado_por = auth.uid() )
  );

-- ── La casa entera ───────────────────────────────────────────
/*
  Renombrar la casa y crear carpetas. Lo que explica la cabecera: un
  ámbito que no está en la tabla cae en el `else` de `nivel_por_rol`, y
  el `else` ya contesta bien las cinco situaciones.
*/
drop policy "hogares_editar"  on hogares;
create policy "hogares_editar" on hogares for update to authenticated
  using ( soy_de(id) and puede(id, 'casa', null, 'todo') );

drop policy "categorias_crear"  on categorias;
create policy "categorias_crear" on categorias for insert to authenticated
  with check ( soy_de(hogar_id) and puede(hogar_id, 'casa', null, 'todo') );


-- ═══════════════════════════════════════════════════════════════
-- 5 · Y AHORA SE BORRAN LAS VIEJAS
-- ═══════════════════════════════════════════════════════════════
/*
  Dejarlas ahí sin usar es dejar la trampa puesta: el día que alguien
  escriba una política nueva, `puedo_escribir` seguirá pareciendo la
  respuesta obvia y volverá a abrir el mismo agujero.

  Se borran también las versiones de un solo argumento —`puedo_ver_carpeta(cat)`,
  `puedo_guardar_en(cat)`, `puedo_escribir()`, `puedo_en_agenda()`—, que
  son de cuando MAPPEL tenía una casa y ninguna las usa ya. Se comprobó:
  ninguna política las nombra y ninguna otra función las llama.

  Antes de borrar, la comprobación. Si quedara una sola política
  nombrando a `puedo_escribir`, esto aborta y no se borra nada.
*/
do $$
declare quedan int;
begin
  select count(*) into quedan
    from pg_policies
   where schemaname = 'public'
     and coalesce(qual,'') || coalesce(with_check,'') ~ 'puedo_escribir';

  if quedan > 0 then
    raise exception
      'ABORTADO: todavia hay % politica(s) llamando a `puedo_escribir`. '
      'Falta reescribir alguna.', quedan;
  end if;
end $$;

/* El orden importa: cada una llama a la siguiente. */
drop function if exists puedo_en_agenda();
drop function if exists puedo_guardar_en(uuid);
drop function if exists puedo_ver_carpeta(uuid);
drop function if exists puedo_escribir();
drop function if exists puedo_escribir(uuid);


-- ═══════════════════════════════════════════════════════════════
-- 6 · LA FOTO DE DESPUÉS, Y LA COMPARACIÓN
-- ═══════════════════════════════════════════════════════════════
select pg_temp.sacar_la_foto('despues');

/*
  La condición para seguir adelante es una sola y es sencilla:

      NADIE DE LA FAMILIA PIERDE NADA.

  Un paso de permisos que quita algo a quien vive en la casa está mal,
  por muy bien argumentado que esté. Si eso pasa, esto aborta y no queda
  ni rastro.

  Lo que sí puede perder es la ayuda, el asesor y la pantalla de la
  cocina: para eso está el paso. Eso se cuenta, no se aborta.
*/
do $$
declare
  f record;
  malas int := 0;
begin
  for f in
    select p.nombre as quien, coalesce(m.rol,'—') as rol, m.papel, m.clase,
           a.de_que,
           coalesce(a.mirar,false)   as mirar_antes,
           coalesce(d.mirar,false)   as mirar_despues,
           coalesce(a.guardar,false) as guardar_antes,
           coalesce(d.guardar,false) as guardar_despues
      from foto_71 a
      join foto_71 d
        on d.cuando = 'despues' and d.quien = a.quien
       and d.casa = a.casa and d.de_que = a.de_que
      join miembros m on m.perfil_id = a.quien and m.hogar_id = a.casa
      join perfiles p on p.id = a.quien
     where a.cuando = 'antes'
       and m.clase = 'persona'
       and ( m.papel = 'propietario' or coalesce(m.rol,'familia') = 'familia' )
       and ( ( coalesce(a.mirar,false)   and not coalesce(d.mirar,false) )
          or ( coalesce(a.guardar,false) and not coalesce(d.guardar,false) ) )
  loop
    malas := malas + 1;
    raise warning 'PIERDE: % (%, %) en «%»  ·  mirar %→%  ·  guardar %→%',
      f.quien, f.rol, f.papel, f.de_que,
      f.mirar_antes, f.mirar_despues, f.guardar_antes, f.guardar_despues;
  end loop;

  if malas > 0 then
    raise exception
      'ABORTADO: % situacion(es) en las que alguien de la familia pierde algo. '
      'No se aplica nada.', malas;
  end if;

  raise notice 'La familia no pierde nada. Comprobadas % situaciones.',
    (select count(*) from foto_71 where cuando = 'antes');
end $$;

/*
  Y la otra mitad de la comprobación, que se olvida siempre: que el paso
  no haya cerrado DE MÁS. Si el dueño de la casa dejara de poder guardar
  en sus propias carpetas, lo de arriba lo cazaría; pero si nadie
  pudiera ya guardar en ninguna parte, también «la familia no pierde
  nada» sería verdad sobre una base vacía. Así que se cuenta a mano.
*/
do $$
declare puede_alguien int;
begin
  select count(*) into puede_alguien
    from foto_71 f
    join miembros m on m.perfil_id = f.quien and m.hogar_id = f.casa
   where f.cuando = 'despues' and m.papel = 'propietario' and f.guardar;

  if puede_alguien = 0 then
    raise exception
      'ABORTADO: despues del paso no hay un solo sitio donde el dueno de una casa '
      'pueda guardar. Algo esta mal.';
  end if;

  raise notice 'Los duenos siguen pudiendo guardar en % sitios.', puede_alguien;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · Las cuatro funciones viejas, ahora sí, pasando por el modelo.
--     Las tres que quedan tienen que salir en «SI». `puedo_escribir` no
--     tiene que salir: está borrada.
select
  p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as la_funcion,
  case when p.prosrc ~ 'nivel_en|puede\(' then 'SI' else 'NO' end      as pasa_por_el_modelo
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('puedo_ver_carpeta','puedo_guardar_en','puedo_escribir','puedo_en_agenda')
order by 1;

-- 2 · Y que no queda ni una politica llamando a las viejas.
--     Las dos columnas, en 0.
select
  count(*) filter (where texto ~ 'puedo_escribir')  as politicas_con_puedo_escribir_DEBE_SER_0,
  count(*) filter (where texto ~ 'puedo_en_agenda\(\)') as con_la_version_vieja_DEBE_SER_0
from (
  select coalesce(qual,'') || coalesce(with_check,'') as texto
  from pg_policies where schemaname = 'public'
) t;

-- 3 · Todo lo que ha cambiado, persona a persona. Tiene que parecerse a
--     las siete filas del 71a-bis: la cocina y Rosana, y nadie mas.
select
  p.nombre                as quien,
  coalesce(m.rol,'—')     as su_papel,
  m.clase,
  a.de_que                as donde,
  case when coalesce(a.mirar,false) <> coalesce(d.mirar,false)
       then case when coalesce(d.mirar,false) then 'EMPIEZA a verlo' else 'DEJA de verlo' end
       else '—' end       as mirar,
  case when coalesce(a.guardar,false) <> coalesce(d.guardar,false)
       then case when coalesce(d.guardar,false) then 'EMPIEZA a poder' else 'DEJA de poder' end
       else '—' end       as guardar
from foto_71 a
join foto_71 d
  on d.cuando = 'despues' and d.quien = a.quien and d.casa = a.casa and d.de_que = a.de_que
join miembros m on m.perfil_id = a.quien and m.hogar_id = a.casa
join perfiles p on p.id = a.quien
where a.cuando = 'antes'
  and ( coalesce(a.mirar,false)   is distinct from coalesce(d.mirar,false)
     or coalesce(a.guardar,false) is distinct from coalesce(d.guardar,false) )
order by 1, 4;

commit;


-- ═══════════════════════════════════════════════════════════════
-- PARA VOLVER ATRÁS
-- ═══════════════════════════════════════════════════════════════
/*
  No se ejecuta. Está aquí para copiar y pegar si hiciera falta deshacer
  el paso entero.

begin;

create or replace function puedo_escribir(casa uuid)
returns boolean language sql stable security definer set search_path to 'public' as $x$
  select coalesce(
    (select papel <> 'lector' from miembros
      where perfil_id = auth.uid() and hogar_id = casa),
    false)
$x$;

create or replace function puedo_ver_carpeta(casa uuid, cat uuid)
returns boolean language sql stable security definer set search_path to 'public' as $x$
  select case
    when cat is null then true
    when coalesce((select ve_todo from miembros
                    where perfil_id = auth.uid() and hogar_id = casa), false) then true
    else exists (select 1 from permisos_carpeta p
                  where p.perfil_id = auth.uid() and p.hogar_id = casa
                    and p.categoria_id = raiz_de(cat) and p.ver)
  end
$x$;

create or replace function puedo_guardar_en(casa uuid, cat uuid)
returns boolean language sql stable security definer set search_path to 'public' as $x$
  select puedo_escribir(casa) and puedo_ver_carpeta(casa, cat) and case
    when cat is null then true
    when coalesce((select escribe_todo from miembros
                    where perfil_id = auth.uid() and hogar_id = casa), false) then true
    else exists (select 1 from permisos_carpeta p
                  where p.perfil_id = auth.uid() and p.hogar_id = casa
                    and p.categoria_id = raiz_de(cat) and p.escribir)
  end
$x$;

create or replace function puedo_en_agenda(casa uuid)
returns boolean language sql stable security definer set search_path to 'public' as $x$
  select puedo_escribir(casa) or coalesce(mi_rol(casa), 'familia') = 'asesor'
$x$;

drop policy "compra_crear" on compra;
create policy "compra_crear" on compra for insert to authenticated
  with check ( soy_de(hogar_id) and puedo_escribir(hogar_id) );
drop policy "compra_editar" on compra;
create policy "compra_editar" on compra for update to authenticated
  using ( soy_de(hogar_id) and puedo_escribir(hogar_id) );
drop policy "compra_borrar" on compra;
create policy "compra_borrar" on compra for delete to authenticated
  using ( soy_de(hogar_id) and puedo_escribir(hogar_id) );

drop policy "menus_escribir" on menus;
create policy "menus_escribir" on menus for all to authenticated
  using ( soy_de(hogar_id) and puedo_escribir(hogar_id) )
  with check ( soy_de(hogar_id) and puedo_escribir(hogar_id) );
drop policy "recetas_escribir" on recetas;
create policy "recetas_escribir" on recetas for all to authenticated
  using ( soy_de(hogar_id) and puedo_escribir(hogar_id) )
  with check ( soy_de(hogar_id) and puedo_escribir(hogar_id) );
drop policy "hechas_marcar" on rutinas_hechas;
create policy "hechas_marcar" on rutinas_hechas for insert to authenticated
  with check ( soy_de(hogar_id) and quien = auth.uid() and puedo_escribir(hogar_id) );
drop policy "hechas_desmarcar" on rutinas_hechas;
create policy "hechas_desmarcar" on rutinas_hechas for delete to authenticated
  using ( soy_de(hogar_id) and puedo_escribir(hogar_id) );

drop policy "pagos_fijos_crear" on pagos_fijos;
create policy "pagos_fijos_crear" on pagos_fijos for insert to authenticated
  with check ( soy_de(hogar_id) and puedo_escribir(hogar_id) );
drop policy "pagos_fijos_cambiar" on pagos_fijos;
create policy "pagos_fijos_cambiar" on pagos_fijos for update to authenticated
  using ( soy_de(hogar_id) and puedo_escribir(hogar_id) )
  with check ( soy_de(hogar_id) and puedo_escribir(hogar_id) );
drop policy "pagos_fijos_borrar" on pagos_fijos;
create policy "pagos_fijos_borrar" on pagos_fijos for delete to authenticated
  using ( soy_de(hogar_id) and puedo_escribir(hogar_id) );

drop policy "unidades_crear" on unidades;
create policy "unidades_crear" on unidades for insert to authenticated
  with check ( soy_de(hogar_id) and exists (select 1 from categorias c
      where c.id = unidades.seccion_id and c.hogar_id = unidades.hogar_id)
    and puedo_escribir(hogar_id) );
drop policy "unidades_editar" on unidades;
create policy "unidades_editar" on unidades for update to authenticated
  using ( soy_de(hogar_id) and exists (select 1 from categorias c
      where c.id = unidades.seccion_id and c.hogar_id = unidades.hogar_id)
    and puedo_escribir(hogar_id) );
drop policy "unidades_borrar" on unidades;
create policy "unidades_borrar" on unidades for delete to authenticated
  using ( soy_de(hogar_id) and exists (select 1 from categorias c
      where c.id = unidades.seccion_id and c.hogar_id = unidades.hogar_id)
    and puedo_escribir(hogar_id) );

drop policy "movimientos_crear" on movimientos;
create policy "movimientos_crear" on movimientos for insert to authenticated
  with check ( soy_de(hogar_id) and puedo_escribir(hogar_id)
    and puedo_ver_carpeta(hogar_id, categoria_id)
    and ( coalesce(mi_rol(hogar_id),'familia') <> 'ayuda' or creado_por = auth.uid() ) );

drop policy "hogares_editar" on hogares;
create policy "hogares_editar" on hogares for update to authenticated
  using ( soy_de(id) and puedo_escribir(id) );
drop policy "categorias_crear" on categorias;
create policy "categorias_crear" on categorias for insert to authenticated
  with check ( soy_de(hogar_id) and puedo_escribir(hogar_id) );

commit;
*/
