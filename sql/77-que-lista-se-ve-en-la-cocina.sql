-- ═══════════════════════════════════════════════════════════════
-- 77 · QUÉ LISTA SE VE EN LA COCINA
-- ═══════════════════════════════════════════════════════════════
--
-- La compra de HUBI no es una lista: son varias. `listas_compra` guarda
-- la del sábado, la de la ferretería, la de la finca — cada una con su
-- nombre, su fecha y a quién le toca ir.
--
-- La pared las ignoraba todas y enseñaba una montonera con todo junto.
-- Haris: *«en la compra veo que no hay listas… es importante que las
-- listas se puedan asignar o decir si quieres que se visualicen en la
-- cocina»*.
--
-- ─────────────────────────────────────────────────────────────
-- UNA CASILLA, Y LA MISMA QUE YA ENTIENDE TODO EL MUNDO
--
-- `visible_en_casa`. El mismo nombre que en `recordatorios` y en
-- `notas`, y por el mismo motivo: quien lea este proyecto dentro de un
-- año no tiene que aprender una palabra nueva para la misma idea.
--
-- Y con el mismo valor por defecto que allí: **null**, que se lee como
-- «todavía no se ha decidido». No `false`: `false` significa «se ha
-- decidido que no», y son dos cosas distintas. La pantalla de ajustes
-- de la cocina ya distingue las dos desde el paso 69.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  LO QUE NO LLEVA, Y ES DELIBERADO
--
-- **No hay restrictiva sobre `compra`.** Podría parecer que falta —en
-- `recordatorios` y en `notas` sí la hay— y sería un error ponerla.
--
-- Una pantalla de cocina tiene `anadir` en el ámbito `compra` desde el
-- paso 61, a propósito: apuntar que se ha acabado la leche es
-- literalmente para lo que sirve. Cerrarle la lectura de la compra le
-- quitaría eso.
--
-- Lo que se decide aquí no es un permiso: es **qué se enseña**. Las
-- listas que no estén marcadas siguen siendo suyas y las puede leer;
-- simplemente no salen en la pared. Es una decisión de pantalla, no de
-- seguridad, y por eso la aplica la pantalla y no la base.
--
-- Con los papeles o las notas médicas sería al revés, y por eso allí sí
-- hay restrictiva. Aquí la distinción importa: **no toda decisión sobre
-- qué se ve es una cerradura.**
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE DESHACE
--
--     alter table listas_compra drop column visible_en_casa;

begin;

-- ═══════════════════════════════════════════════════════════════
-- 0 · LA PUERTA
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if not exists (select 1 from pg_class where relname = 'listas_compra') then
    raise exception 'ABORTADO: no existe `listas_compra`. El paso 23 no esta dado.';
  end if;

  raise notice 'Puerta pasada. Listas de la compra abiertas: %.',
    (select count(*) from listas_compra where archivada_en is null);
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1 · LA CASILLA
-- ═══════════════════════════════════════════════════════════════
alter table listas_compra
  add column if not exists visible_en_casa boolean;

comment on column listas_compra.visible_en_casa is
  'Si esta lista sale en la pantalla de la cocina. Null = sin decidir. Paso 77.';


-- ═══════════════════════════════════════════════════════════════
-- 2 · EL PERMISO DE ESCRIBIRLA
-- ═══════════════════════════════════════════════════════════════
/*
  La trampa de siempre, y ya van tres veces. Se mide antes de decidir:
  si `authenticated` tiene UPDATE a nivel de tabla, la columna nueva
  nace escribible y no hay que hacer nada; si lo tiene por columnas, hay
  que darla a mano o el `update` no cambiará nada EN SILENCIO.
*/
do $$
declare tiene_tabla boolean;
begin
  select has_table_privilege('authenticated', 'listas_compra', 'update') into tiene_tabla;

  if tiene_tabla then
    raise notice 'UPDATE de tabla: si. La columna nueva nace escribible.';
  else
    execute 'grant update (visible_en_casa) on table listas_compra to authenticated';
    raise notice 'UPDATE por columnas: dado a mano el de `visible_en_casa`.';
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 3 · LA COMPROBACIÓN, ANTES DE CONFIRMAR
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  casa uuid; alguien uuid; laLista uuid; cuantas int; puede boolean;
begin
  select has_column_privilege('authenticated','listas_compra','visible_en_casa','update')
    into puede;

  if not puede then
    raise exception 'ABORTADO: `authenticated` no puede escribir `visible_en_casa`.';
  end if;
  raise notice 'El permiso de columna esta puesto.';

  select m.hogar_id, m.perfil_id into casa, alguien
    from miembros m
   where m.clase = 'persona' and m.papel = 'propietario' and m.aceptado_en is not null limit 1;

  select id into laLista from listas_compra where hogar_id = casa limit 1;

  if laLista is null then
    raise notice 'No hay ninguna lista con la que probar. Se aplica igual.';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', alguien::text, true);
  set local role authenticated;
  update listas_compra set visible_en_casa = true where id = laLista;
  get diagnostics cuantas = row_count;
  reset role;

  if cuantas <> 1 then
    raise exception 'ABORTADO: el dueno de la casa no ha podido marcar una lista.';
  end if;
  raise notice 'El dueno de la casa marca una lista para la cocina. Bien.';

  /* Y se deja como estaba: esto era una prueba. */
  update listas_compra set visible_en_casa = null where id = laLista;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- 1 · La casilla, puesta y escribible.
select
  column_name                                                                  as la_casilla,
  is_nullable                                                                  as admite_nulo_DEBE_SER_YES,
  has_column_privilege('authenticated','listas_compra','visible_en_casa','update')
                                                                               as se_puede_escribir_DEBE_SER_true
from information_schema.columns
where table_name = 'listas_compra' and column_name = 'visible_en_casa';

-- 2 · Cómo está cada lista abierta ahora mismo. Recién dado el paso,
--     todas «sin decidir».
select
  h.nombre                                      as la_casa,
  l.nombre                                      as la_lista,
  case when l.visible_en_casa is null then 'sin decidir'
       when l.visible_en_casa then 'SI sale en la cocina'
       else 'no sale' end                       as en_la_cocina
from listas_compra l
join hogares h on h.id = l.hogar_id
where l.archivada_en is null
order by 1, 2;

commit;
