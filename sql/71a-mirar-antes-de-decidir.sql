-- ═══════════════════════════════════════════════════════════════
-- 71a · MIRAR ANTES DE DECIDIR · SOLO MIRA, NO TOCA NADA
-- ═══════════════════════════════════════════════════════════════
--
-- **Este archivo no cambia nada.** Calcula lo que HARÍA el paso 71 y
-- lo enseña. Se ejecuta entero y se me manda lo que salga.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ ES EL PASO 71
--
-- Las cuatro funciones viejas de permisos no pasan por el modelo de
-- niveles (`claude/las-cuatro-funciones-viejas.md`):
--
--     puedo_ver_carpeta   ·  puedo_guardar_en
--     puedo_escribir      ·  puedo_en_agenda
--
-- De ellas cuelgan **32 políticas en 12 tablas**. O sea que el techo
-- de `clase`, el reparto por carpetas y la tabla de niveles solo
-- gobiernan donde alguien puso a mano una política restrictiva.
--
-- El 71 las hace pasar por `nivel_en`. Y eso cambia lo que significan
-- esas 32 políticas, así que primero se mira.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE EL MAPA YA HA ENSEÑADO, ANTES DE EJECUTAR NADA
--
-- **`puedo_escribir(casa)` NO puede ser una cáscara.** No recibe
-- ámbito, y de ella cuelgan cuatro preguntas distintas:
--
--     compra                          → ámbito `compra`
--     menus, recetas, rutinas_hechas  → ámbito `dia`
--     pagos_fijos, unidades           → ámbito `cuentas`
--     hogares, categorias (crear)     → ni uno ni otro: es la casa
--
-- Convertirla en una sola cáscara sería meter las cuatro en el mismo
-- saco. Lo correcto es sustituir la LLAMADA en cada política por el
-- ámbito que le toca, y dejar la función en paz.
--
-- **Y hay dos agujeros vivos que esto cierra**, los dos de la misma
-- forma que el de la pantalla de ayer:
--
--   · `nivel_por_rol('ayuda','cuentas')` es `nada`, pero hoy quien
--     ayuda en casa **puede escribir en `pagos_fijos` y `unidades`**,
--     porque `puedo_escribir` solo mira que el papel no sea `lector`.
--   · Y un asesor con `papel = 'miembro'` —el caso G4— también. El
--     62b cerró `movimientos`, pero `pagos_fijos` y `unidades` son
--     dinero igual y se quedaron fuera.
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE HAY QUE MIRAR EN LO QUE SALGA
--
-- La consulta 2 es la importante: **qué persona deja de poder hacer
-- qué**. Si ahí sale alguien de la familia perdiendo algo, el paso
-- está mal y no se da.
--
-- Lo que SÍ debe salir: la ayuda perdiendo cuentas, el asesor
-- perdiendo lo que no le toca, y la pantalla de la cocina perdiendo
-- casi todo.

-- ═══════════════════════════════════════════════════════════════
-- LAS EXPRESIONES NUEVAS, SIN INSTALARLAS
-- ═══════════════════════════════════════════════════════════════
/*
  Se definen en `pg_temp`, que vive solo en esta sesión y se borra al
  cerrarla. Así se puede calcular el «después» sin tocar el «antes».
*/
create or replace function pg_temp.nuevo_ver(casa uuid, cat uuid, quien uuid)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
  select puede(casa, ambito_de(cat), cat, 'mirar') into r;
  return coalesce(r, false);
end $$;

create or replace function pg_temp.nuevo_guardar(casa uuid, cat uuid, quien uuid)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
  select puede(casa, ambito_de(cat), cat, 'anadir') into r;
  return coalesce(r, false);
end $$;

create or replace function pg_temp.viejo_ver(casa uuid, cat uuid, quien uuid)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
  select puedo_ver_carpeta(casa, cat) into r;
  return coalesce(r, false);
end $$;

create or replace function pg_temp.viejo_guardar(casa uuid, cat uuid, quien uuid)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
  select puedo_guardar_en(casa, cat) into r;
  return coalesce(r, false);
end $$;

/* Y las de las tablas sin carpeta: compra, día a día, cuentas, agenda
   y la casa. Antes todas contestaban lo mismo —`papel <> 'lector'`—;
   después, cada una lo suyo. */
create or replace function pg_temp.antes_sin_carpeta(casa uuid, quien uuid)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
  select puedo_escribir(casa) into r;
  return coalesce(r, false);
end $$;

create or replace function pg_temp.despues_en(casa uuid, a text, quien uuid)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
  select puede(casa, a, null, 'anadir') into r;
  return coalesce(r, false);
end $$;

create or replace function pg_temp.antes_agenda(casa uuid, quien uuid)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
  select puedo_en_agenda(casa) into r;
  return coalesce(r, false);
end $$;

/* Renombrar la casa y crear carpetas no son un ámbito: son actos de la
   casa entera. La regla propuesta es la misma que ya usa
   `poner_al_dia_la_cocina`: el dueño, o la familia. */
create or replace function pg_temp.despues_la_casa(casa uuid, quien uuid)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
    /*
     ── RENOMBRAR LA CASA Y CREAR CARPETAS ──

     Se intentó con «el dueño o la familia», y salieron dos fallos
     seguidos que enseñan por qué los casos especiales no valen:

       · con `coalesce(rol,'')`, quien tiene el rol a nulo —la gente
         de antes de que existiera la columna— perdía su propia casa;
       · y con `coalesce(rol,'familia')`, un LECTOR con el rol a nulo
         la ganaba.

     La regla buena no es un caso especial: es el modelo.
     `puede(casa,'casa',null,'todo')` ya contesta bien las cinco
     situaciones, y el techo de `lector` lo aplica `nivel_en` por su
     cuenta — que es exactamente para lo que existe.

         familia          → todo    → sí
         familia/lector   → mirar   → no
         ayuda            → nada    → no
         asesor           → mirar   → no
         dispositivo      → nada    → no
  */
  select puede(casa, 'casa', null, 'todo') into r;
  return coalesce(r, false);
end $$;

create or replace function pg_temp.despues_agenda(casa uuid, quien uuid)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
  /* El asesor SÍ apunta en la agenda: es la decisión del 64b, escrita
     en el comentario de `puedo_en_agenda`. Un asesor que no puede
     poner «el día 20 hay un pago» tiene que mandarlo por WhatsApp, y
     entonces MAPPEL no sirve para lo que se hizo. */
  select puede(casa, 'agenda', null, 'anadir')
      or coalesce(mi_rol(casa), 'familia') = 'asesor' into r;
  return coalesce(r, false);
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LO QUE CUESTA · esto va DENTRO de cada listado de papeles
-- ═══════════════════════════════════════════════════════════════
/*
  `puedo_ver_carpeta` está en la política de SELECT de `documentos` y
  de `categorias`: se evalúa una vez por fila, en cada pantalla que
  liste papeles.

  El paso 61 ya enseñó lo que pasa cuando esto no se mide: `nivel_en`
  costaba 35 veces más que lo que sustituía, y se descubrió a tiempo
  porque se midió ANTES de meterlo en una política.

  Los dos números de abajo son milisegundos para mil llamadas. Si el
  nuevo sale desproporcionado, el paso 71 no se da tal cual: se da con
  un índice o con la función reescrita en plpgsql, como se hizo en el
  61c.
*/
do $$
declare
  casa uuid; quien uuid; cat uuid;
  t0 timestamptz; viejo numeric; nuevo numeric;
begin
  select m.hogar_id, m.perfil_id into casa, quien
    from miembros m
   where m.clase = 'persona' and m.aceptado_en is not null
   order by (m.papel = 'propietario') desc limit 1;

  select c.id into cat from categorias c where c.hogar_id = casa limit 1;

  if cat is null then
    raise notice 'Sin carpetas con las que medir.';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', quien::text, true);

  t0 := clock_timestamp();
  for i in 1..1000 loop perform puedo_ver_carpeta(casa, cat); end loop;
  viejo := extract(epoch from clock_timestamp() - t0) * 1000;

  t0 := clock_timestamp();
  for i in 1..1000 loop perform puede(casa, ambito_de(cat), cat, 'mirar'); end loop;
  nuevo := extract(epoch from clock_timestamp() - t0) * 1000;

  raise notice 'Mil llamadas · ANTES: % ms · DESPUES: % ms · x%',
    round(viejo), round(nuevo), round(nuevo / greatest(viejo, 0.001), 1);
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 2 · ⚠️  QUIÉN DEJA DE PODER QUÉ · LAS CARPETAS
-- ═══════════════════════════════════════════════════════════════
-- Una fila por cada persona × carpeta raíz donde la respuesta CAMBIA.
-- Si esto sale vacío, el paso no hace nada en carpetas.
--
-- **Lo que NO puede salir aquí: nadie de la familia perdiendo nada.**
select
  p.nombre                                  as quien,
  coalesce(m.rol, '—')                      as su_papel,
  m.clase,
  c.nombre                                  as la_carpeta,
  coalesce(c.ambito, 'sin clasificar')      as su_ambito,
  case when pg_temp.viejo_ver(m.hogar_id, c.id, m.perfil_id)
       then 've' else 'no ve' end           as antes_ver,
  case when pg_temp.nuevo_ver(m.hogar_id, c.id, m.perfil_id)
       then 've' else 'no ve' end           as despues_ver,
  case when pg_temp.viejo_guardar(m.hogar_id, c.id, m.perfil_id)
       then 'guarda' else 'no guarda' end   as antes_guardar,
  case when pg_temp.nuevo_guardar(m.hogar_id, c.id, m.perfil_id)
       then 'guarda' else 'no guarda' end   as despues_guardar
from miembros m
join perfiles p   on p.id = m.perfil_id
join categorias c on c.hogar_id = m.hogar_id and c.padre_id is null
where m.aceptado_en is not null
  and (
       pg_temp.viejo_ver(m.hogar_id, c.id, m.perfil_id)
         <> pg_temp.nuevo_ver(m.hogar_id, c.id, m.perfil_id)
    or pg_temp.viejo_guardar(m.hogar_id, c.id, m.perfil_id)
         <> pg_temp.nuevo_guardar(m.hogar_id, c.id, m.perfil_id)
  )
order by p.nombre, c.nombre;


-- ═══════════════════════════════════════════════════════════════
-- 3 · ⚠️  Y LO QUE NO ES UNA CARPETA
-- ═══════════════════════════════════════════════════════════════
-- La compra, el día a día, las cuentas, la agenda y la casa. Hoy las
-- cinco contestan lo MISMO —`papel <> 'lector'`— y después cada una
-- responde lo suyo.
--
-- Aquí sí debe salir gente perdiendo cosas. Lo que hay que mirar es
-- que sean las correctas.
select
  p.nombre                             as quien,
  coalesce(m.rol, '—')                 as su_papel,
  m.clase,
  t.donde,
  /* El «antes» de la agenda NO es `puedo_escribir`: es
     `puedo_en_agenda`, que además deja pasar al asesor. Comparar la
     agenda contra la función equivocada hacía que el asesor pareciera
     GANAR un permiso que ya tenía. */
  case
    when t.donde = 'la agenda'
      then case when pg_temp.antes_agenda(m.hogar_id, m.perfil_id) then 'sí' else 'no' end
    else case when pg_temp.antes_sin_carpeta(m.hogar_id, m.perfil_id) then 'sí' else 'no' end
  end                                  as antes,
  case
    when t.donde = 'la agenda'
      then case when pg_temp.despues_agenda(m.hogar_id, m.perfil_id) then 'sí' else 'no' end
    when t.donde = 'la casa (renombrarla, crear carpetas)'
      then case when pg_temp.despues_la_casa(m.hogar_id, m.perfil_id) then 'sí' else 'no' end
    else case when pg_temp.despues_en(m.hogar_id, t.ambito, m.perfil_id) then 'sí' else 'no' end
  end                                  as despues
from miembros m
join perfiles p on p.id = m.perfil_id
cross join (values
  ('compra',  'la lista de la compra'),
  ('dia',     'menús, recetas, lo del día'),
  ('cuentas', 'pagos fijos y unidades'),
  ('agenda',  'la agenda'),
  ('casa',    'la casa (renombrarla, crear carpetas)')
) as t(ambito, donde)
where m.aceptado_en is not null
order by p.nombre, t.donde;


-- ═══════════════════════════════════════════════════════════════
-- 4 · EL RESUMEN, PARA LEERLO DE UN VISTAZO
-- ═══════════════════════════════════════════════════════════════
select
  (select count(*) from miembros where aceptado_en is not null)        as gente_en_total,
  (select count(*) from categorias where padre_id is null)             as carpetas_raiz,
  (select count(*)
     from miembros m
     join categorias c on c.hogar_id = m.hogar_id and c.padre_id is null
    where m.aceptado_en is not null
      and ( pg_temp.viejo_ver(m.hogar_id, c.id, m.perfil_id)
              <> pg_temp.nuevo_ver(m.hogar_id, c.id, m.perfil_id)
         or pg_temp.viejo_guardar(m.hogar_id, c.id, m.perfil_id)
              <> pg_temp.nuevo_guardar(m.hogar_id, c.id, m.perfil_id))) as decisiones_que_cambian;
