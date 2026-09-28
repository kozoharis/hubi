-- ═══════════════════════════════════════════════════════════════
-- 96 · LO QUE PUEDE UN ESPACIO
-- ═══════════════════════════════════════════════════════════════
--
-- Las concesiones de capacidades. Responde a UNA pregunta:
--
--     ¿qué puede usar este espacio?
--
-- Y hoy no la usa nadie. Se crea, se prueba y se deja quieta. Ninguna
-- pantalla la consulta, ninguna funcionalidad depende de ella, nada
-- se bloquea.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ AHORA, SI NO SIRVE TODAVÍA
--
-- No por «luego cuesta más» —una tabla cuesta lo mismo hoy que en
-- marzo—. Por otra cosa:
--
--     Sin esto, la PRIMERA funcionalidad de pago se colgará de algo.
--
-- De `rol`, de `clase`, o de una columna `tiene_premium` en `hogares`
-- puesta un viernes. Y ese primer atajo es el que obliga a rehacer,
-- porque mezcla QUIÉN ERES con QUÉ HAS CONTRATADO.
--
-- Identidad, pertenencia y capacidad comercial son tres cosas
-- distintas y aquí se quedan separadas.
--
-- ═══════════════════════════════════════════════════════════════
-- ⚠️  LAS DOS REGLAS QUE ESTA TABLA EXISTE PARA PROTEGER
-- ═══════════════════════════════════════════════════════════════
--
-- Están aquí, y no sólo en la documentación, porque ésta es la tabla
-- a la que algún día alguien va a querer añadirle una columna
-- `puede_ver boolean`. Que lo lea antes.
--
-- ── 1 · SPONSOR ≠ MEMBER ──
--
--     `miembros` es la tabla de quien PUEDE VER.
--     Un sponsor no ve nada, luego un sponsor NO está en `miembros`.
--     Nunca.
--
-- Una aseguradora, un banco, una promotora o una empresa podrán
-- pagar mappel, activar capacidades, financiar un plan o conceder una
-- promoción. Nada de eso concede lectura, escritura, pertenencia, ni
-- acceso a documentos, conversaciones, gastos o preguntas a la IA. El
-- propietario y los miembros del espacio siguen siendo quienes eran.
--
-- El motivo técnico, y es serio: TODAS las políticas de mappel
-- preguntan «¿eres miembro de este espacio?». Si un sponsor llegara a
-- ser una fila de `miembros`, pasaría a ver el contenido POR
-- DEFINICIÓN, y taparlo obligaría a revisar y matizar las políticas
-- de las noventa y tantas migraciones, una por una, sin red.
--
-- Fíjate en que esta tabla NO TIENE NINGUNA COLUMNA DE PERMISO. Es
-- deliberado: no se puede conceder por error lo que no se puede
-- escribir.
--
-- ── 2 · APORTAR CONTENIDO ≠ TENER ACCESO ──
--
--     Provisionar contenido no concede acceso al espacio.
--
-- Una promotora podrá entregar planos, manuales, garantías, el libro
-- del edificio o certificados para que aparezcan precargados en el
-- mappel del comprador. Eso es una ENTREGA: ocurre una vez, hacia
-- dentro, y SE AGOTA AL OCURRIR. No deja permiso, no deja relación de
-- lectura, y no se puede consultar después.
--
-- Quien aporta un documento no obtiene por ello ningún derecho sobre
-- el espacio que lo recibe.
--
-- ─────────────────────────────────────────────────────────────
-- SI HAY QUE VOLVER ATRÁS
--
--   drop function if exists puede_el_espacio(uuid, text);
--   drop table if exists concesiones;

begin;

set local statement_timeout = '60s';

-- ═══════════════════════════════════════════════════════════════
-- 1 · CONCESIONES · y por qué no hay clave única
-- ═══════════════════════════════════════════════════════════════
--
-- La primera versión de esto tenía `primary key (hogar_id, capacidad)`
-- y estaba mal. Con esa clave, la misma capacidad no podría estar
-- concedida a la vez por dos sitios — y ése es exactamente el caso
-- que viene:
--
--     una promotora concede `ai_documents` hasta 2028
--     y el usuario, aparte, contrata un plan que también lo concede
--
-- Son dos concesiones. Ninguna sobrescribe a la otra, y cuando la
-- primera caduca, la segunda sigue en pie sin que nadie tenga que
-- hacer nada. Por eso son filas independientes con su propio origen,
-- su vigencia y su revocación.

create table if not exists concesiones (
  id          uuid primary key default gen_random_uuid(),

  hogar_id    uuid not null references hogares(id) on delete cascade,

  /*
    Qué se concede: `ai_basic`, `ai_documents`, `ai_voice`…

    SIN lista cerrada, y me aparto a propósito de lo que hace
    `sucesos` en el 95. La diferencia es real: la lista de sucesos se
    cierra porque es una superficie de PRIVACIDAD que degenera sola en
    un cajón de logs; ésta es una superficie COMERCIAL, no tiene ese
    riesgo, y cerrarla obligaría a una migración cada vez que producto
    invente una capacidad.

    Cerrar lo que hay que cerrar, y sólo eso.
  */
  capacidad   text not null,

  -- De dónde viene: la casa lo paga, una promoción, un patrocinio, una prueba.
  origen      text not null,

  /*
    El acuerdo del que sale, si hay uno. Un identificador OPACO: el
    código de un convenio, nunca una persona, nunca un correo.
  */
  origen_ref  text null,

  desde       date not null default current_date,

  -- `null` = sin caducidad.
  hasta       date null,

  /*
    Revocar es poner una fecha, no borrar la fila.

    Y una fecha nula en vez de un campo `estado` a propósito: contesta
    «¿está viva?» y además «¿cuándo dejó de estarlo?», y no invita a
    inventarse una máquina de estados que nadie ha pedido.
  */
  revocada_en timestamptz null,

  creada_en   timestamptz not null default now()
);

comment on table concesiones is
  'Que puede usar un espacio. NUNCA concede lectura ni escritura: ver las dos reglas en la cabecera de sql/96.';

create index if not exists idx_concesiones_hogar on concesiones (hogar_id, capacidad);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'concesiones_origen_valido'
  ) then
    alter table concesiones add constraint concesiones_origen_valido check (
      origen in ('casa', 'promocion', 'patrocinio', 'prueba')
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'concesiones_vigencia_coherente'
  ) then
    alter table concesiones add constraint concesiones_vigencia_coherente check (
      hasta is null or hasta >= desde
    );
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- 2 · QUIÉN LA VE
-- ═══════════════════════════════════════════════════════════════
--
-- Leer: los miembros del espacio, y nadie más. Es la MISMA regla que
-- todo lo demás de mappel —`soy_de(<este espacio>)`— y viene de la
-- misma función, para que no haya dos fuentes de verdad.
--
-- Escribir: NADIE desde la aplicación. Una concesión la crea la llave
-- de servicio, porque nace de un acuerdo comercial y no de un botón.

alter table concesiones enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'concesiones' and policyname = 'concesiones_leer'
  ) then
    create policy concesiones_leer on concesiones
      for select using (soy_de(hogar_id));
  end if;
end $$;

revoke all on table concesiones from anon, authenticated;
grant select on table concesiones to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3 · EL RESOLVEDOR · con el espacio EXPLÍCITO
-- ═══════════════════════════════════════════════════════════════
--
-- ⚠️  EL ESPACIO SE PASA. NO SE ADIVINA.
--
-- Una versión anterior de esto se llamaba `puede_el_espacio(capacidad)`
-- y dejaba el espacio implícito. Mal, y hay que decir por qué:
--
-- La forma «cómoda» de resolverlo por dentro sería `mi_hogar()`, que
-- lee `perfiles.casa_activa` — un dato GLOBAL de la persona, el mismo
-- en todas las pestañas. Ése es exactamente el mecanismo antiguo que
-- causó el fallo de las dos pestañas y que el paso de los espacios
-- vino a enterrar: abres tu casa en una pestaña y la de un cliente en
-- otra, y la respuesta depende de cuál cambiaste la última vez.
--
-- Aquí eso sería peor que un fallo de datos: sería conceder o negar
-- una capacidad mirando al espacio equivocado.
--
-- Así que el espacio es un parámetro obligatorio. Igual que
-- `accesoDrive(hogarId)` lo exige, y por la misma razón: que el
-- compilador —o quien lea la llamada— vea siempre de qué espacio se
-- está hablando.
--
-- ─────────────────────────────────────────────────────────────
-- Y POR QUÉ ES `security invoker`
--
-- Porque así el aislamiento lo pone la RLS de la tabla y no una
-- segunda comprobación escrita a mano dentro de la función. Un
-- mecanismo, no dos:
--
--   · miembro del espacio  → la política le deja ver sus filas
--                            → contesta la verdad
--   · no miembro           → la política le deja ver CERO filas
--                            → contesta `false`
--
-- Y `false` y no un error, que además no filtra nada: quien no es de
-- la casa no puede distinguir «no la tienen» de «no es asunto tuyo».
--
-- ─────────────────────────────────────────────────────────────
-- CERRADO POR DEFECTO
--
-- Sin concesión, `false`. Es una decisión y la sostengo: el día que
-- se enchufe la primera funcionalidad de pago, si nos olvidamos de
-- conceder la capacidad a las casas que ya existen, SE APAGA Y SE VE
-- EN EL ACTO. Abierto por defecto, ese mismo olvido regalaría la
-- funcionalidad en silencio durante meses.
--
-- Fallo ruidoso. Y es la dirección de la regla que ya rige los
-- permisos de mappel: se abre, no se cierra.

create or replace function puede_el_espacio(hogar uuid, cap text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from concesiones c
    where c.hogar_id = hogar
      and c.capacidad = cap
      and c.desde <= current_date
      and (c.hasta is null or c.hasta >= current_date)
      and c.revocada_en is null
  )
$$;

comment on function puede_el_espacio(uuid, text) is
  'Que puede usar un espacio. El espacio se pasa, no se adivina: nunca por casa_activa ni por estado global.';

revoke all on function puede_el_espacio(uuid, text) from public;
grant execute on function puede_el_espacio(uuid, text) to authenticated;

commit;

-- ═══════════════════════════════════════════════════════════════
-- COMPROBAR QUE HA IDO BIEN
-- ═══════════════════════════════════════════════════════════════
--
-- 1 · Sin ninguna concesión, todo cerrado (debe dar `false`):
--
--     select puede_el_espacio('<una casa tuya>', 'ai_documents');
--
-- 2 · La aplicación puede leer pero NO escribir
--     (debe salir sólo SELECT):
--
--     select privilege_type from information_schema.role_table_grants
--     where table_name = 'concesiones' and grantee = 'authenticated';
--
-- 3 · Y no ha aparecido ningún miembro nuevo en ninguna parte:
--
--     select count(*) from miembros;   -- el mismo número que antes
