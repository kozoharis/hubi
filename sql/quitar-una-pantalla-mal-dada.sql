-- ═══════════════════════════════════════════════════════════════
-- QUITAR UNA PANTALLA DADA DE ALTA CON UN CORREO QUE NO ES
-- ═══════════════════════════════════════════════════════════════
--
-- **Esto no es un paso de la migración.** Es un arreglo de una vez,
-- para deshacer una pantalla que se dio de alta con una dirección de
-- ejemplo (`tunombre+cocina@gmail.com`) en vez de con una de verdad.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ HAY QUE QUITARLA, Y NO SOLO IGNORARLA
--
-- Esa cuenta existe, está aceptada en la casa y tiene `clase =
-- 'dispositivo'`. Quien pueda recibir correo en esa dirección puede
-- pedir un código y entrar: se encontraría la Agenda con lo que esté
-- marcado para la cocina, la lista de la compra y el día a día.
--
-- No es un desastre —no ve papeles, ni cuentas, ni salud— pero es una
-- puerta a una casa a nombre de una dirección que no controla nadie de
-- ella. Y `tunombre@gmail.com` puede ser de alguien.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ SE LLEVA POR DELANTE · nada, y se comprueba antes
--
-- Al borrar el perfil, Postgres arrastra en cascada lo que cuelgue de
-- él. En una pantalla recién creada eso es exactamente cero filas,
-- pero **no se da por hecho**: el bloque de abajo las cuenta y se
-- niega a seguir si hay una sola.
--
-- Merece la pena saber lo que hay ahí, porque es una sorpresa fea:
--
--     recordatorios.creado_por  →  CASCADA
--
-- O sea que borrar a una persona **borra las tareas que escribió**.
-- Para una pantalla nueva da igual; para el paso 70 —sacar a alguien
-- de la casa— es justo la razón por la que sacar no puede ser borrar.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE USA
--
-- Cambia el correo de la primera línea si pusiste otro, y ejecuta
-- entero. Si algo no cuadra, no borra nada y dice por qué.

begin;

do $$
declare
  /* ⬇️  EL CORREO QUE SE DIO DE ALTA POR ERROR ⬇️ */
  el_correo text := 'tunombre+cocina@gmail.com';

  quien uuid;
  su_clase text;
  escritas int;
begin
  select u.id into quien from auth.users u where lower(u.email) = lower(el_correo);

  if quien is null then
    raise exception 'No hay ninguna cuenta con ese correo. Comprueba como lo escribiste.';
  end if;

  /* ── 1 · QUE SEA UNA PANTALLA, Y NO UNA PERSONA ──
     La comprobación que hace que este archivo sea seguro de ejecutar.
     Si el correo fuera por error el de Juan Miguel, esto se para. */
  select m.clase into su_clase from miembros m where m.perfil_id = quien;

  if su_clase is distinct from 'dispositivo' then
    raise exception
      'ABORTADO: esa cuenta no es una pantalla (clase = %). Este archivo solo quita '
      'pantallas. Si de verdad hay que sacar a una persona, eso es otra cosa y no se '
      'hace borrando.', coalesce(su_clase, 'sin fila de miembro');
  end if;

  /* ── 2 · QUE NO HAYA ESCRITO NADA ──
     Una pantalla recién dada de alta no ha escrito nada. Si hubiera
     escrito algo, borrarla se lo llevaría por delante. */
  select
    (select count(*) from recordatorios where creado_por = quien or asignado_a = quien)
  + (select count(*) from notas         where escrita_por = quien or para = quien)
  + (select count(*) from documentos    where subido_por = quien)
  + (select count(*) from movimientos   where creado_por = quien)
    into escritas;

  if escritas > 0 then
    raise exception
      'ABORTADO: esa pantalla tiene % cosas escritas a su nombre. Borrarla se las '
      'llevaria por delante. Dimelo antes de seguir.', escritas;
  end if;

  /* ── 3 · Y FUERA ──
     Se borra la cuenta de `auth.users` y el resto cae solo:
     `perfiles` va en cascada desde ahi, y `miembros` desde `perfiles`. */
  delete from auth.users where id = quien;

  raise notice 'Quitada la pantalla «%». La cuenta ya no existe.', el_correo;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- EL PARTE
-- ═══════════════════════════════════════════════════════════════

-- Las pantallas que quedan dadas de alta. Tiene que salir vacío, o
-- solo las que hayas puesto tú a propósito.
select
  p.nombre        as la_pantalla,
  u.email         as su_correo,
  h.nombre        as en_la_casa,
  m.aceptado_en   as desde
from miembros m
join perfiles p  on p.id = m.perfil_id
join auth.users u on u.id = m.perfil_id
join hogares h   on h.id = m.hogar_id
where m.clase = 'dispositivo'
order by 3, 1;

commit;
