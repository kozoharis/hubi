-- ═══════════════════════════════════════════════════════════════
-- 71a-bis · SOLO LO QUE CAMBIA, EN UNA SOLA TABLA
-- ═══════════════════════════════════════════════════════════════
--
-- **No cambia nada.** Es el mismo cálculo del 71a, pero devolviendo
-- **una sola tabla** en vez de cuatro.
--
-- El motivo es tonto y ya nos mordió en el 62b: el editor de Supabase
-- enseña el resultado de la ÚLTIMA consulta, así que de las cuatro del
-- 71a solo se veía el resumen. El resumen dice «1 decisión cambia» y
-- eso está muy bien, pero no dice cuál.
--
-- Aquí sale todo junto y **solo las filas que cambian**. Si algo no
-- aparece, es que se queda como está.

create or replace function pg_temp.ver_con(casa uuid, cat uuid, quien uuid, nuevo boolean)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
  if nuevo then select puede(casa, ambito_de(cat), cat, 'mirar') into r;
  else          select puedo_ver_carpeta(casa, cat) into r;
  end if;
  return coalesce(r, false);
end $$;

create or replace function pg_temp.guardar_con(casa uuid, cat uuid, quien uuid, nuevo boolean)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);
  if nuevo then select puede(casa, ambito_de(cat), cat, 'anadir') into r;
  else          select puedo_guardar_en(casa, cat) into r;
  end if;
  return coalesce(r, false);
end $$;

/*
  Las cinco preguntas que hoy contesta `puedo_escribir` (y la agenda,
  que contesta `puedo_en_agenda`), antes y después.

  `casa` no es un ámbito: renombrar la casa y crear carpetas son actos
  de la casa entera, y la regla propuesta es la misma que ya usa
  `poner_al_dia_la_cocina` — el dueño, o la familia.
*/
create or replace function pg_temp.sin_carpeta(casa uuid, a text, quien uuid, nuevo boolean)
returns boolean language plpgsql stable as $$
declare r boolean;
begin
  perform set_config('request.jwt.claim.sub', quien::text, true);

  if not nuevo then
    if a = 'agenda' then select puedo_en_agenda(casa) into r;
    else                 select puedo_escribir(casa) into r;
    end if;
  elsif a = 'agenda' then
    /* El asesor SÍ apunta en la agenda: decisión del 64b. */
    select puede(casa, 'agenda', null, 'anadir')
        or coalesce(mi_rol(casa), 'familia') = 'asesor' into r;
  elsif a = 'la casa' then
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
  else
    select puede(casa, a, null, 'anadir') into r;
  end if;

  return coalesce(r, false);
end $$;


-- ═══════════════════════════════════════════════════════════════
-- LA ÚNICA TABLA · solo lo que cambia
-- ═══════════════════════════════════════════════════════════════
select * from (

  -- ── Las carpetas ──
  select
    'carpeta'                              as de_que_va,
    p.nombre                               as quien,
    coalesce(m.rol, '—')                   as su_papel,
    m.clase,
    c.nombre || '  (' || coalesce(c.ambito, 'sin clasificar') || ')' as donde,
    case
      when pg_temp.ver_con(m.hogar_id, c.id, m.perfil_id, false)
        <> pg_temp.ver_con(m.hogar_id, c.id, m.perfil_id, true)
      then case when pg_temp.ver_con(m.hogar_id, c.id, m.perfil_id, true)
                then 'EMPIEZA a verla' else 'DEJA de verla' end
      else '—' end                         as mirar,
    case
      when pg_temp.guardar_con(m.hogar_id, c.id, m.perfil_id, false)
        <> pg_temp.guardar_con(m.hogar_id, c.id, m.perfil_id, true)
      then case when pg_temp.guardar_con(m.hogar_id, c.id, m.perfil_id, true)
                then 'EMPIEZA a guardar' else 'DEJA de guardar' end
      else '—' end                         as guardar
  from miembros m
  join perfiles p   on p.id = m.perfil_id
  join categorias c on c.hogar_id = m.hogar_id and c.padre_id is null
  where m.aceptado_en is not null
    and ( pg_temp.ver_con(m.hogar_id, c.id, m.perfil_id, false)
            <> pg_temp.ver_con(m.hogar_id, c.id, m.perfil_id, true)
       or pg_temp.guardar_con(m.hogar_id, c.id, m.perfil_id, false)
            <> pg_temp.guardar_con(m.hogar_id, c.id, m.perfil_id, true) )

  union all

  -- ── Y lo que no es una carpeta ──
  select
    'lo demas',
    p.nombre,
    coalesce(m.rol, '—'),
    m.clase,
    t.donde,
    '—',
    case when pg_temp.sin_carpeta(m.hogar_id, t.ambito, m.perfil_id, true)
         then 'EMPIEZA a poder' else 'DEJA de poder' end
  from miembros m
  join perfiles p on p.id = m.perfil_id
  cross join (values
    ('compra',  'la lista de la compra'),
    ('dia',     'menús, recetas, lo del día'),
    ('cuentas', 'pagos fijos y unidades'),
    ('agenda',  'la agenda'),
    ('la casa', 'la casa: renombrarla y crear carpetas')
  ) as t(ambito, donde)
  where m.aceptado_en is not null
    and pg_temp.sin_carpeta(m.hogar_id, t.ambito, m.perfil_id, false)
          <> pg_temp.sin_carpeta(m.hogar_id, t.ambito, m.perfil_id, true)

) todo
order by de_que_va, quien, donde;
