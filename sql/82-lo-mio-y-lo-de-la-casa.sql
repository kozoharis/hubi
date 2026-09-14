-- ═══════════════════════════════════════════════════════════════
-- 82 · LO MÍO Y LO DE LA CASA
-- ═══════════════════════════════════════════════════════════════
--
-- El punto 21 del planteamiento, que llevaba desde el principio sin
-- cumplirse:
--
--   > Debemos contemplar documentos COMPARTIDOS y PRIVADOS.
--   > Especialmente para salud, documentación personal y determinados
--   > documentos administrativos.
--
-- Y lo que pidió Haris, que es lo mismo dicho mejor:
--
--   > *«Hay que hacer que puedas establecer más profundamente qué
--   > carpetas de la casa quieras compartir.»*
--   > *«Si es salud, tú puedas decidir si quieres hacerla visible solo
--   > para ti o para toda la familia. Sería lo más lógico.»*
--
-- ─────────────────────────────────────────────────────────────
-- LO QUE YA HABÍA, Y LO QUE NO SERVÍA
--
-- Existía `permisos_carpeta`: quién ve qué carpeta, por persona. Y es
-- otra cosa. Contesta **«¿a esta persona le abro esta carpeta?»** —un
-- permiso que se DA— y va por carpeta RAÍZ.
--
-- Lo que hace falta aquí es al revés y más hondo:
--
--   · Es una PERTENENCIA, no un permiso. «Esta carpeta es mía.»
--   · La decide su dueño, no quien reparte.
--   · Y tiene que poder ser «Salud → Conchita», que no es una raíz.
--
-- Meterlo en `permisos_carpeta` obligaría a escribir una fila de
-- NEGACIÓN por cada miembro. Y ahí está el fallo que no se ve: el día
-- que entre alguien nuevo en la casa no tendría fila, y vería la
-- carpeta privada de Conchita. Una privacidad que se rompe sola al
-- invitar a alguien no es una privacidad.
--
-- Con una sola columna, lo de dentro es de quien es y punto. Quien
-- llegue mañana no la ve porque no es suya, no porque nos hayamos
-- acordado de cerrársela.
--
-- ─────────────────────────────────────────────────────────────
-- Y GANA AL PROPIETARIO. A PROPÓSITO
--
-- Es la decisión más seria de este paso y la tomó Haris.
--
-- Hasta hoy, `papel = 'propietario'` devolvía `'todo'` y se acababa la
-- conversación. Si eso siguiera así, «solo para mí» querría decir
-- «solo para mí y para Juan Miguel», y entonces no significa nada:
-- los informes médicos de Conchita son justamente lo que el punto 21
-- pone como ejemplo.
--
-- Lo que se pierde a cambio, y hay que decirlo: **si alguien cierra
-- una carpeta y se olvida, nadie puede abrírsela desde dentro.** Se
-- compensa con que la carpeta SIGUE VIÉNDOSE, con su candado y el
-- nombre de quien es. No desaparece: se cierra.
--
-- ─────────────────────────────────────────────────────────────
-- LA PUERTA VA EN `nivel_en`, Y NO EN CADA TABLA
--
-- Porque de una carpeta cuelgan papeles, movimientos, carpetas hijas y
-- lo que venga después. Todas esas tablas preguntan por
-- `puedo_ver_carpeta`, que pregunta por `puede`, que pregunta por
-- `nivel_en`.
--
-- Una puerta puesta en cada tabla son cinco sitios donde acordarse; y
-- la sexta tabla, la que se escriba dentro de tres meses, no se
-- acordaría.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  Y DE PASO, UN FALLO QUE LLEVA TIEMPO MINTIENDO
--
-- `nivel_en` se salta el reparto por carpetas cuando el papel es
-- `familia`:
--
--       and m_rol is distinct from 'familia'
--
-- O sea que hoy se puede entrar en Ajustes → Gente → «Qué ve», decir
-- que Conchita solo ve Casa y Vehículos, guardar… y no pasa nada. La
-- pantalla dice que está repartido y ella lo sigue viendo todo.
--
-- Eso no es una función que falta: es una que MIENTE, y de las peores,
-- porque quien la usa se queda tranquilo.
--
-- Quitarlo es seguro: el bloque solo entra cuando `ve_todo` está en
-- falso, y `ve_todo` nace en verdadero. Mientras nadie diga «solo
-- algunas carpetas», no cambia nada para nadie.
--
-- CÓMO SE DESHACE
--
--     alter table categorias drop column privada_de;
--     -- y volver a crear `nivel_en` sin el bloque de privacidad
--     -- (la versión anterior está en el sql/71a).

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $p82a$
begin
  if to_regclass('public.categorias') is null then
    raise exception 'ABORTADO: no existe `categorias`.';
  end if;
  if to_regprocedure('public.nivel_en(uuid,text,uuid)') is null then
    raise exception 'ABORTADO: no existe `nivel_en`. Faltan los pasos 60 a 71.';
  end if;
  if to_regprocedure('public.es_ambito_de_carpeta(text)') is null then
    raise exception 'ABORTADO: no existe `es_ambito_de_carpeta`.';
  end if;

  raise notice 'Puerta pasada. Carpetas: %.', (select count(*) from categorias);
end $p82a$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · DE QUIÉN ES
-- ═══════════════════════════════════════════════════════════════
/*
  Null = de la casa, que es como nacen todas y como se quedan mientras
  nadie diga lo contrario.

  `on delete set null`: si esa persona deja de estar en MAPPEL, la
  carpeta vuelve a ser de la casa. La alternativa —quedarse cerrada
  para siempre a nombre de alguien que ya no está— es un cajón que
  nadie puede abrir.
*/
alter table categorias
  add column if not exists privada_de uuid references perfiles(id) on delete set null;

comment on column categorias.privada_de is
  'De quien es esta carpeta. Null = de la casa. Paso 82.';

create index if not exists idx_categorias_privada
  on categorias (hogar_id, privada_de) where privada_de is not null;


/*
  Y HEREDA HACIA ABAJO.

  Si «Salud → Conchita» es suya, lo es todo lo que cuelgue: Informes,
  Recetas, Pruebas. Preguntar solo por la carpeta exacta dejaría
  abierta la subcarpeta que alguien cree mañana dentro — y nadie
  volvería a mirar si estaba cerrada.

  Ocho niveles, como `raiz_de`: el mismo tope y por el mismo motivo,
  que un padre mal puesto no se convierta en una vuelta infinita.
*/
create or replace function de_quien_es(cat uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $p82b$
declare
  actual uuid := cat;
  suya   uuid;
  arriba uuid;
begin
  if cat is null then return null; end if;

  for i in 1..8 loop
    select privada_de, padre_id into suya, arriba from categorias where id = actual;
    if suya is not null then return suya; end if;
    if arriba is null then return null; end if;
    actual := arriba;
  end loop;

  return null;
end $p82b$;

comment on function de_quien_es(uuid) is
  'De quien es una carpeta, mirando hacia arriba. Null = de la casa. Paso 82.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · `nivel_en`, CON LA PUERTA Y SIN LA MENTIRA
-- ═══════════════════════════════════════════════════════════════
create or replace function nivel_en(casa uuid, a text, cat uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $p82c$
declare
  m_rol text; m_papel text; m_clase text; m_vetodo boolean;
  valor text; techo text; duenyo uuid;
begin
  select rol, papel, clase, ve_todo
    into m_rol, m_papel, m_clase, m_vetodo
    from miembros
   where perfil_id = auth.uid()
     and hogar_id  = casa
     and aceptado_en is not null;

  if not found then return 'nada'; end if;

  /*
    ── LO PRIMERO DE TODO: ¿ES DE ALGUIEN? ──

    Antes que el propietario, antes que el rol y antes que el reparto.
    Si esta carpeta es de otra persona, aquí se acaba la conversación.

    Va arriba y no abajo porque abajo no serviría: `propietario`
    devuelve `'todo'` cinco líneas más abajo y ya nadie vuelve a
    preguntar.
  */
  if cat is not null and es_ambito_de_carpeta(a) then
    duenyo := de_quien_es(cat);
    if duenyo is not null and duenyo is distinct from auth.uid() then
      return 'nada';
    end if;
  end if;

  if m_papel = 'propietario' then
    valor := 'todo';
  else
    valor := nivel_por_rol(m_rol, a);
  end if;

  /*
    ── EL REPARTO POR CARPETAS ──

    Ya no se salta a la familia. Antes ponía
    `and m_rol is distinct from 'familia'`, y eso hacía que repartirle
    el acceso a alguien de la familia no tuviera ningún efecto mientras
    la pantalla decía que sí.

    Sigue entrando solo cuando `ve_todo` está en falso, o sea cuando
    alguien ha dicho A PROPÓSITO «esta persona ve solo algunas
    carpetas». Con `ve_todo` en verdadero —que es como nace todo el
    mundo— esto no se toca.
  */
  if cat is not null
     and es_ambito_de_carpeta(a)
     and m_papel is distinct from 'propietario'
     and not coalesce(m_vetodo, false)
  then
    if exists (select 1 from permisos_carpeta p
                where p.perfil_id = auth.uid() and p.hogar_id = casa
                  and p.categoria_id = raiz_de(cat) and p.escribir) then
      valor := 'anadir';
    elsif exists (select 1 from permisos_carpeta p
                   where p.perfil_id = auth.uid() and p.hogar_id = casa
                     and p.categoria_id = raiz_de(cat) and p.ver) then
      valor := 'mirar';
    else
      valor := 'nada';
    end if;
  end if;

  if m_papel = 'lector' and orden(valor) > orden('mirar') then
    valor := 'mirar';
  end if;

  if m_clase = 'dispositivo' then
    techo := nivel_por_rol('casa', a);
    if orden(valor) > orden(techo) then valor := techo; end if;
  end if;

  return valor;
end $p82c$;


-- ═══════════════════════════════════════════════════════════════
-- 3 · LA CARPETA SE VE. LO DE DENTRO, NO
-- ═══════════════════════════════════════════════════════════════
/*
  Sin esto, una carpeta cerrada DESAPARECE de la lista, y eso está
  peor que mal: Juan Miguel abriría Papeles y la carpeta de Salud ya no
  estaría. No pensaría «es de Conchita»: pensaría que se ha borrado.

  Con esto, la carpeta sigue en su sitio con su candado y el nombre de
  quien es. **Se cierra, no se esconde.** Es lo que pide el mismo punto
  21: que quede claro quién puede ver cada cosa.

  Es una política PERMISIVA, que se suma a la que ya hay. Solo abre
  esto: la FILA de la carpeta, a la gente de la familia. No abre nada
  de lo que hay dentro — los papeles y los movimientos siguen pasando
  por `nivel_en`, que ya ha dicho que no.

  Y solo a la familia: quien viene a ayudar o el asesor no tienen por
  qué saber siquiera que existe.
*/
drop policy if exists categorias_lo_privado_se_ve_cerrado on categorias;
create policy categorias_lo_privado_se_ve_cerrado on categorias
  for select to authenticated
  using (
    soy_de(hogar_id)
    and de_quien_es(id) is not null
    and exists (
      select 1 from miembros m
       where m.perfil_id = auth.uid()
         and m.hogar_id = categorias.hogar_id
         and m.rol = 'familia'
         and m.clase = 'persona'
         and m.aceptado_en is not null
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- 4 · Y SOLO SU DUEÑO LA CIERRA Y LA ABRE
-- ═══════════════════════════════════════════════════════════════
/*
  Haris: *«cualquiera de los dos, sobre lo suyo»*.

  Tres movimientos y ninguno más:

      de la casa   →   mía          cerrarla
      mía          →   de la casa   abrirla
      mía          →   mía          no es un cambio

  Lo que NO se puede: ponerle una carpeta a otra persona, ni abrir la
  de otro. **Tampoco el propietario.** Si pudiera, «solo para mí» sería
  otra vez «solo para mí y para quien creó la casa».

  Va en un disparador y no en la política de escribir porque la
  política no distingue QUÉ columna cambió: con ella sola, cualquiera
  que pueda renombrar una carpeta podría además apropiársela de paso.
*/
create or replace function solo_su_duenyo_la_cierra()
returns trigger
language plpgsql
security definer
set search_path = public
as $p82d$
begin
  if new.privada_de is not distinct from old.privada_de then
    return new;
  end if;

  /* Cerrarla: de la casa, y para mí. */
  if old.privada_de is null and new.privada_de = auth.uid() then
    return new;
  end if;

  /* Abrirla: era mía, y vuelve a la casa. */
  if old.privada_de = auth.uid() and new.privada_de is null then
    return new;
  end if;

  raise exception
    'Una carpeta solo la cierra y la abre quien la tiene. Ni siquiera quien creo la casa.';
end $p82d$;

drop trigger if exists lo_privado_es_de_su_duenyo on categorias;
create trigger lo_privado_es_de_su_duenyo
  before update on categorias
  for each row execute function solo_su_duenyo_la_cierra();


-- ═══════════════════════════════════════════════════════════════
-- 5 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $p82e$
declare
  casa uuid; unoDeLaFamilia uuid; elOtro uuid; elDuenyo uuid;
  laCarpeta uuid; laHija uuid;
  ve boolean; colado boolean := false;
begin
  -- 5.1 · Quién hay para probar: dos de la familia en la misma casa.
  select m.hogar_id into casa
    from miembros m
   where m.rol = 'familia' and m.clase = 'persona' and m.aceptado_en is not null
   group by m.hogar_id having count(*) >= 2
   limit 1;

  if casa is null then
    raise notice 'No hay dos de la familia en ninguna casa. Se aplica igual, sin probar.';
    return;
  end if;

  select m.perfil_id into unoDeLaFamilia from miembros m
   where m.hogar_id = casa and m.rol = 'familia' and m.clase = 'persona'
     and m.aceptado_en is not null and m.papel = 'propietario' limit 1;

  select m.perfil_id into elOtro from miembros m
   where m.hogar_id = casa and m.rol = 'familia' and m.clase = 'persona'
     and m.aceptado_en is not null and m.perfil_id is distinct from unoDeLaFamilia limit 1;

  if unoDeLaFamilia is null or elOtro is null then
    raise notice 'No hay un propietario y otro de la familia. Se aplica igual, sin probar.';
    return;
  end if;

  -- 5.2 · Una carpeta de prueba con una hija dentro.
  insert into categorias (hogar_id, nombre, segmento_drive, ambito, orden)
       values (casa, 'Prueba 82', 'PRUEBA-82', 'salud', 999)
    returning id into laCarpeta;

  insert into categorias (hogar_id, padre_id, nombre, segmento_drive, ambito, orden)
       values (casa, laCarpeta, 'Dentro', 'DENTRO', 'salud', 1)
    returning id into laHija;

  -- 5.3 · De la casa: `de_quien_es` dice null, arriba y abajo.
  if de_quien_es(laCarpeta) is not null or de_quien_es(laHija) is not null then
    raise exception 'ABORTADO: una carpeta recien creada ya tiene dueno.';
  end if;
  raise notice 'Recien creada, la carpeta es de la casa. Bien.';

  /*
    5.4 · Se la queda EL OTRO (no el propietario), y hereda hacia abajo.

    Se hace CON SU SESIÓN puesta. La primera versión de esta prueba lo
    hacía como `postgres` y abortaba en la primera línea, con el
    disparador diciendo que nadie puede cerrar una carpeta ajena — y
    tenía razón: sin sesión, `auth.uid()` es nulo y no es de nadie.

    Es una prueba mejor así: cierra la carpeta el mismo camino por el
    que la cerrará Conchita.
  */
  perform set_config('request.jwt.claim.sub', elOtro::text, true);
  update categorias set privada_de = elOtro where id = laCarpeta;

  select de_quien_es(laHija) into elDuenyo;
  if elDuenyo is distinct from elOtro then
    raise exception 'ABORTADO: la hija no ha heredado el dueno.';
  end if;
  raise notice 'La hija hereda el dueno. Bien.';

  -- 5.5 · Y el PROPIETARIO no la ve.
  perform set_config('request.jwt.claim.sub', unoDeLaFamilia::text, true);
  set local role authenticated;
  select puedo_ver_carpeta(casa, laHija) into ve;
  reset role;

  if ve then
    raise exception 'ABORTADO: quien creo la casa ve una carpeta que no es suya.';
  end if;
  raise notice 'El propietario NO ve lo que no es suyo. Bien.';

  -- 5.6 · Su dueño sí.
  perform set_config('request.jwt.claim.sub', elOtro::text, true);
  set local role authenticated;
  select puedo_ver_carpeta(casa, laHija) into ve;
  reset role;

  if not ve then
    raise exception 'ABORTADO: su propio dueno no ve su carpeta.';
  end if;
  raise notice 'Su dueno si la ve. Bien.';

  -- 5.7 · Y el propietario no puede abrírsela.
  perform set_config('request.jwt.claim.sub', unoDeLaFamilia::text, true);
  begin
    update categorias set privada_de = null where id = laCarpeta;
    colado := true;
  exception
    when others then raise notice 'El propietario no puede abrir la carpeta de otro. Bien.';
  end;

  if colado then
    raise exception 'ABORTADO: el propietario ha abierto una carpeta que no es suya.';
  end if;

  /* Y se recoge. El disparador no deja borrar el `privada_de` desde
     otra sesión, así que primero se vuelve a poner quien la tiene. */
  perform set_config('request.jwt.claim.sub', elOtro::text, true);
  update categorias set privada_de = null where id = laCarpeta;
  delete from categorias where id = laCarpeta;
end $p82e$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · La casilla, puesta.
select
  column_name                                   as la_casilla,
  data_type                                     as de_que_tipo,
  (to_regprocedure('public.de_quien_es(uuid)') is not null)
                                                as la_funcion_existe_DEBE_SER_true
from information_schema.columns
where table_name = 'categorias' and column_name = 'privada_de';

-- 2 · Y qué carpetas son de alguien. Recién dado el paso: ninguna.
select
  h.nombre                     as la_casa,
  c.nombre                     as la_carpeta,
  coalesce(p.nombre, '—')      as de_quien_es
from categorias c
join hogares h on h.id = c.hogar_id
left join perfiles p on p.id = c.privada_de
where c.privada_de is not null
order by 1, 2;

commit;
