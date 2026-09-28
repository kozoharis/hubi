-- ═══════════════════════════════════════════════════════════════
-- 95 · QUÉ PASA DE VERDAD
-- ═══════════════════════════════════════════════════════════════
--
-- La tabla de sucesos: analítica de PRODUCTO. Nada más.
--
-- Hasta hoy mappel no podía contestar a la única pregunta que importa
-- antes de un piloto: ¿lo usan? No había ni una tabla, ni un contador,
-- ni un servicio externo. Esto lo arregla con lo mínimo.
--
-- ─────────────────────────────────────────────────────────────
-- LAS TRES PREGUNTAS, Y SÓLO TRES
--
--   ACTIVACIÓN     espacios creados que hacen algo en sus 7 primeros días
--   COLABORACIÓN   espacios donde ≥2 personas distintas hacen algo al mes
--   RECURRENCIA    espacios con actividad en 3 de las últimas 4 semanas
--
-- La segunda es la que dice si mappel es un producto o un archivador:
-- una casa donde sólo escribe una persona no es una casa compartida.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  ESTO NO ES UN REGISTRO TÉCNICO, Y HAY QUE DEFENDERLO
--
-- La tentación, dentro de seis meses, será meter aquí una latencia,
-- un código de error, un nombre de proveedor o «un campito para
-- depurar». El día que eso pase, esta tabla deja de poder mirarse
-- como analítica de producto y se convierte en un cajón de logs con
-- datos de familias dentro.
--
-- Por eso la lista de tipos y las claves de `detalle` NO son un
-- acuerdo entre personas: son restricciones de Postgres. Para meter
-- algo nuevo hay que escribir una migración y que alguien la lea.
--
-- La observabilidad técnica —tiempos, errores de API, fallos de
-- proveedor— es otro sistema y no vive aquí.
--
-- ─────────────────────────────────────────────────────────────
-- Y NO ES CONSUMO DE IA
--
-- Tampoco. Cuando llegue el día de saber cuánto cuesta la
-- inteligencia, será una TERCERA tabla (`uso_ia`) con su coste, su
-- modelo y sus unidades. Aquí no hay ni una columna donde quepa eso,
-- a propósito.
--
--   sucesos       comportamiento    ¿lo usan?
--   concesiones   comercial         ¿qué pueden usar?        → sql/96
--   uso_ia        económico         ¿cuánto nos cuesta?      → no existe
--
-- ─────────────────────────────────────────────────────────────
-- PRIVACIDAD · lo que sale y lo que no
--
-- Aquí no entra NADA escrito por una persona: ni el texto de una
-- nota, ni el nombre de un archivo, ni un importe, ni un proveedor,
-- ni una pregunta a la IA.
--
-- Pero los datos en bruto SIGUEN SIENDO INTERNOS. `hogar_id` y
-- `perfil_id` son identificadores relacionables: con ellos se puede
-- saber qué hizo una casa concreta. Nada de esta tabla sale fuera sin
-- agregar: números de espacios y porcentajes, nunca filas.
--
-- ─────────────────────────────────────────────────────────────
-- SI HAY QUE VOLVER ATRÁS
--
--   drop table if exists sucesos;
--   alter table hogares drop column if exists cohorte;
--
-- No hay nada que rescatar: ninguna pantalla lee esta tabla y ninguna
-- política de las que ya existen la menciona.

begin;

set local statement_timeout = '60s';

-- ═══════════════════════════════════════════════════════════════
-- 1 · LA TABLA
-- ═══════════════════════════════════════════════════════════════

create table if not exists sucesos (
  id         bigint generated always as identity primary key,

  -- Qué pasó. Lista cerrada, más abajo.
  tipo       text not null,

  /*
    De qué espacio. NULO sólo para `cuenta_creada`, que ocurre antes
    de que exista ninguna casa — lo obliga un check.

    `on delete cascade`: si se borra un espacio desaparecen sus
    sucesos. Es lo honesto y evita quedarse con el rastro de una casa
    que ya no existe.
  */
  hogar_id   uuid null references hogares(id) on delete cascade,

  /*
    Quién lo hizo. Hace falta para UNA cosa y sólo una: contar
    personas distintas por espacio, que es la métrica de colaboración.

    `on delete set null`: si alguien se borra, el suceso sigue
    contando para su espacio pero deja de estar atado a la persona.
  */
  perfil_id  uuid null references perfiles(id) on delete set null,

  -- Tres claves y ningún texto libre. Ver el apartado 3.
  detalle    jsonb not null default '{}'::jsonb,

  cuando     timestamptz not null default now()
);

comment on table sucesos is
  'Analitica de producto. Nunca contenido de usuario, nunca observabilidad tecnica, nunca consumo de IA. Datos brutos internos: fuera solo sale agregado.';

-- ═══════════════════════════════════════════════════════════════
-- 2 · LA LISTA CERRADA DE TIPOS
-- ═══════════════════════════════════════════════════════════════
--
-- Once. Y una nota de vocabulario para dentro de dos años: en mappel
-- una «tarea» es una fila de `recordatorios`. Los nombres de aquí son
-- los del PRODUCTO, no los de las tablas, porque son los que van a
-- leerse en una consulta de métricas.
--
-- `compra_apuntada` está aquí por una razón concreta: el propio
-- código dice que la compra «es lo que más se usa de todo mappel: un
-- papel se guarda una vez por semana, la compra es todos los días».
-- Sin ella, la recurrencia mediría todo mappel MENOS su función más
-- frecuente, y una casa que lo usa a diario saldría como inactiva.
--
-- `papel_no_entendido` es un tipo propio y no un `ok = false`. Que la
-- IA no entienda un documento SÍ es una métrica de producto —dice si
-- la promesa de automatización se sostiene—, pero es un hecho
-- distinto, no un atributo. Con un tipo propio, el significado lo
-- sigue definiendo esta lista y no queda ninguna puerta abierta para
-- que mañana entre aquí un código HTTP.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sucesos_tipo_conocido'
  ) then
    alter table sucesos add constraint sucesos_tipo_conocido check (
      tipo in (
        'cuenta_creada',
        'espacio_creado',
        'invitacion_aceptada',
        'documento_guardado',
        'tarea_creada',
        'tarea_hecha',
        'nota_creada',
        'compra_apuntada',
        'voz_usada',
        'papel_leido_por_ia',
        'papel_no_entendido'
      )
    );
  end if;
end $$;

-- ── El espacio es obligatorio salvo en el alta ────────────────
--
-- Escrito como restricción y no como costumbre: si mañana alguien
-- apunta una nota sin espacio, la inserción falla. Un suceso sin
-- espacio es un suceso que no cuenta para ninguna métrica.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sucesos_espacio_obligatorio'
  ) then
    alter table sucesos add constraint sucesos_espacio_obligatorio check (
      hogar_id is not null or tipo = 'cuenta_creada'
    );
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- 3 · `detalle` · TRES CLAVES, Y SUS VALORES TAMBIÉN CERRADOS
-- ═══════════════════════════════════════════════════════════════
--
--   origen   movil · escritorio · cocina    ¿se usa la pared de la cocina?
--   via      voz · foto · escrito           ¿se sostiene «hablar · fotografiar»?
--   rol      familia · ayuda · asesor · mirar   ¿quién colabora de verdad?
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  POR QUÉ NO SE USA `?|`, QUE ES EL ERROR EVIDENTE
--
-- La primera versión de esta restricción decía:
--
--     detalle ?| array['origen','via','rol']
--
-- y está MAL. `?|` comprueba que exista ALGUNA de esas claves, no que
-- todas las presentes estén permitidas. Comprobado en un Postgres 16
-- de verdad antes de escribir esto:
--
--     '{"origen":"movil","clave_no_autorizada":"x"}' ?| array[...]  →  TRUE
--
-- O sea que habría dejado pasar exactamente lo que pretendía impedir.
--
-- Lo correcto es RESTAR la lista blanca y exigir que no quede nada:
--
--     detalle - array['origen','via','rol'] = '{}'::jsonb
--
-- Ese mismo JSON da FALSE y la fila se rechaza.
--
-- ─────────────────────────────────────────────────────────────
-- Y LOS VALORES, QUE ES LO QUE CIERRA EL AGUJERO DE VERDAD
--
-- Con sólo la lista de claves, esto colaba:
--
--     {"origen": "llamar al abogado el martes"}
--
-- Clave permitida, texto libre dentro. Por eso cada clave declara
-- también sus valores posibles. Con las dos listas, en `detalle` no
-- cabe ni una letra escrita por una persona.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sucesos_detalle_cerrado'
  ) then
    alter table sucesos add constraint sucesos_detalle_cerrado check (
      jsonb_typeof(detalle) = 'object'
      and detalle - array['origen', 'via', 'rol'] = '{}'::jsonb
      and (detalle->>'origen' is null or detalle->>'origen' in ('movil', 'escritorio', 'cocina'))
      and (detalle->>'via'    is null or detalle->>'via'    in ('voz', 'foto', 'escrito'))
      and (detalle->>'rol'    is null or detalle->>'rol'    in ('familia', 'ayuda', 'asesor', 'mirar'))
    );
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- 4 · QUIÉN PUEDE TOCARLA · NADIE DESDE LA APLICACIÓN
-- ═══════════════════════════════════════════════════════════════
--
-- Éste es el cerrojo que más importa. `sucesos` no la lee ni la
-- escribe la aplicación: sólo el servidor con la llave de servicio.
--
--   · Ninguna pantalla puede enseñarla.
--   · Ningún navegador puede inventarse un suceso.
--   · Y si mañana alguien escribe una consulta desde el cliente,
--     no falla a medias: falla del todo y se ve.
--
-- RLS activado y SIN NINGUNA POLÍTICA. Con RLS activo y cero
-- políticas, la respuesta a cualquier lectura es cero filas. El
-- `service_role` de Supabase salta RLS, que es justo lo que se
-- necesita.

alter table sucesos enable row level security;

revoke all on table sucesos from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5 · ÍNDICES · los dos que piden las tres métricas
-- ═══════════════════════════════════════════════════════════════

create index if not exists idx_sucesos_hogar_cuando on sucesos (hogar_id, cuando desc);
create index if not exists idx_sucesos_tipo_cuando  on sucesos (tipo, cuando desc);

-- ═══════════════════════════════════════════════════════════════
-- 6 · COHORTES · para comparar pilotos
-- ═══════════════════════════════════════════════════════════════
--
-- Una etiqueta corta que ponemos NOSOTROS a mano: `piloto-jm-conchita`,
-- `promotora-x`. Nunca sale de un dato de una persona y nunca se
-- calcula sola.
--
-- ⚠️  Y LO IMPORTANTE, QUE VIENE DE LA LECCIÓN DEL sql/94:
--
-- `hogares` tiene un `grant update` POR COLUMNAS. Esta columna NO se
-- añade a esa lista, y por eso la aplicación no puede escribirla ni
-- queriendo: no es una promesa nuestra, es que Postgres se lo impide.
-- Sólo la llave de servicio.
--
-- Si algún día alguien añade `cohorte` a ese grant, habrá convertido
-- una etiqueta de análisis en un dato que la app puede cambiar sola.

alter table hogares add column if not exists cohorte text;

comment on column hogares.cohorte is
  'Etiqueta manual para comparar pilotos. NO anadir al grant update de hogares: solo la llave de servicio la escribe.';

commit;

-- ═══════════════════════════════════════════════════════════════
-- COMPROBAR QUE HA IDO BIEN
-- ═══════════════════════════════════════════════════════════════
--
-- 1 · Las tres restricciones están puestas (deben salir 3 filas):
--
--     select conname from pg_constraint
--     where conrelid = 'sucesos'::regclass and contype = 'c';
--
-- 2 · La aplicación no puede leerla (debe dar 0 privilegios):
--
--     select count(*) from information_schema.role_table_grants
--     where table_name = 'sucesos' and grantee in ('anon','authenticated');
--
-- 3 · La cohorte existe y NO está en el grant de escritura
--     (debe salir cero):
--
--     select count(*) from information_schema.column_privileges
--     where table_name = 'hogares' and column_name = 'cohorte'
--       and grantee = 'authenticated' and privilege_type = 'UPDATE';
