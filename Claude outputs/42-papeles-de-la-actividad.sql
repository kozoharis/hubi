-- ═══════════════════════════════════════════════════════════════
-- SQL 42 · LOS PAPELES DE LA ACTIVIDAD
-- ═══════════════════════════════════════════════════════════════
--
-- Hasta hoy una actividad tenía dos cosas dentro: GASTOS e INGRESOS.
-- Las dos son dinero. Y por eso no había ningún sitio para lo que una
-- actividad tiene y no es dinero:
--
--     el contrato de alquiler del piso
--     la póliza del seguro de la finca
--     la licencia de obra
--     el certificado energético
--     la escritura
--
-- Un contrato no es un gasto. Tiene fecha, tiene importe escrito
-- dentro, y aun así no se gasta nada el día que lo firmas. Meterlo en
-- GASTOS para tener dónde ponerlo le sumaba 9.000 € al año a un piso
-- que no los había pagado.
--
-- Así que la actividad pasa a tener TRES cosas dentro:
--
--     💸 GASTOS      lo que sale
--     💰 INGRESOS    lo que entra
--     📄 DOCUMENTOS  lo que ni sale ni entra, pero hay que tener
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ 'neutro' NO ES UN DETALLE
--
-- `categorias.naturaleza` ya tenía tres valores desde el SQL 01, y
-- 'neutro' era el que casi no se usaba. Es justo el que hace que esto
-- funcione solo, sin tocar nada más:
--
--   · Al guardar un papel con importe, `app/api/documentos` solo
--     apunta un movimiento si la carpeta es 'gasto' o 'ingreso'. En
--     una 'neutro' el importe se guarda con el documento y NO entra
--     en el balance. Que es exactamente lo que queremos.
--
--   · `rutaDeCarpetas` ya trata las 'neutro' distinto: sin trimestre.
--     ALQUILERES / DOCUMENTOS / CONTRATOS / 2026, y no
--     .../2026/T3/CONTRATOS. Un contrato no es de un trimestre.
--
-- O sea: la pieza ya estaba puesta hace meses. Lo único que faltaba
-- era la carpeta.
--
-- ─────────────────────────────────────────────────────────────
-- Y POR QUÉ UN DISPARADOR Y NO COPIAR `crear_mi_casa`
--
-- Las actividades nacen por dos caminos: la función `crear_mi_casa`
-- del SQL 36, y `POST /api/actividades` cuando alguien añade una
-- después. Añadir la carpeta a mano en los dos sitios significa que
-- dentro de un año habrá un tercer camino y se olvidará — y una
-- actividad sin su carpeta de papeles no da ningún error: sale la
-- pantalla, y sencillamente no está.
--
-- El disparador la pone SIEMPRE, venga de donde venga el alta. Y no
-- se dispara a sí mismo porque solo mira las raíces con cuentas, y lo
-- que él crea cuelga de una.

begin;

-- ── 1 · La carpeta y lo que lleva dentro ───────────────────
/*
  Tres carpetas y no diez. Contratos y Seguros son las que tiene
  cualquier actividad —una finca, un piso, una obra— y «Otros papeles»
  evita el peor momento de todos: tener un papel en la mano y no
  encontrar dónde meterlo.

  Las suyas las añade cada familia desde «Cómo la llevas». Ese es el
  punto 11 del planteamiento y ya funciona: la lista de abajo es un
  punto de partida, no la ley.
*/
create or replace function papeles_de_la_actividad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  grupo uuid;
begin
  -- ¿Ya los tiene? Entonces no se toca nada.
  if exists (
    select 1 from categorias
    where padre_id = new.id and segmento_drive = 'DOCUMENTOS'
  ) then
    return new;
  end if;

  insert into categorias (hogar_id, padre_id, nombre, segmento_drive, icono, orden, naturaleza)
  values (new.hogar_id, new.id, 'Documentos', 'DOCUMENTOS', '📄', 3, 'neutro')
  returning id into grupo;

  insert into categorias (hogar_id, padre_id, nombre, segmento_drive, orden, naturaleza)
  values
    (new.hogar_id, grupo, 'Contratos',     'CONTRATOS', 1, 'neutro'),
    (new.hogar_id, grupo, 'Seguros',       'SEGUROS',   2, 'neutro'),
    (new.hogar_id, grupo, 'Otros papeles', 'OTROS_PAPELES', 3, 'neutro');

  return new;
end;
$$;

drop trigger if exists papeles_al_crear_actividad on categorias;

/*
  El `when` es lo que impide la recursión: solo las RAÍCES con
  cuentas. Las tres carpetas que crea la función cuelgan de una, así
  que tienen `padre_id`, así que no vuelven a disparar nada.
*/
create trigger papeles_al_crear_actividad
  after insert on categorias
  for each row
  when (new.padre_id is null and new.lleva_cuentas = true)
  execute function papeles_de_la_actividad();


-- ── 2 · Y las actividades que ya existen ───────────────────
/*
  Las que están creadas no pasan por el disparador nunca más, así que
  se les pone aquí. Con `not exists` delante: esto se puede ejecutar
  dos veces sin duplicar nada, que es la única manera de que un SQL
  sea seguro de correr cuando no te acuerdas de si ya lo corriste.
*/
with nuevas as (
  insert into categorias (hogar_id, padre_id, nombre, segmento_drive, icono, orden, naturaleza)
  select a.hogar_id, a.id, 'Documentos', 'DOCUMENTOS', '📄', 3, 'neutro'
  from categorias a
  where a.padre_id is null
    and a.lleva_cuentas = true
    and not exists (
      select 1 from categorias h
      where h.padre_id = a.id and h.segmento_drive = 'DOCUMENTOS'
    )
  returning id, hogar_id
)
insert into categorias (hogar_id, padre_id, nombre, segmento_drive, orden, naturaleza)
select n.hogar_id, n.id, v.nombre, v.segmento, v.orden, 'neutro'
from nuevas n
cross join (values
  ('Contratos',     'CONTRATOS', 1),
  ('Seguros',       'SEGUROS',   2),
  ('Otros papeles', 'OTROS_PAPELES', 3)
) as v(nombre, segmento, orden);

commit;


-- ── Para comprobar que ha ido bien ─────────────────────────
--
--   select a.nombre as actividad, g.nombre as dentro, g.naturaleza
--   from categorias a
--   join categorias g on g.padre_id = a.id
--   where a.padre_id is null and a.lleva_cuentas = true
--   order by a.nombre, g.orden;
--
-- Cada actividad tiene que salir con sus tres: Gastos, Ingresos y
-- Documentos.
