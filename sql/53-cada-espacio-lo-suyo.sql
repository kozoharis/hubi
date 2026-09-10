-- ═══════════════════════════════════════════════════════════════
-- 53 · CADA ESPACIO, LO SUYO
-- ═══════════════════════════════════════════════════════════════
--
-- Dos funciones. Dos condiciones. Y cierra una puerta que hoy está
-- abierta.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ ESTÁ MAL
--
-- `puedo_ver_carpeta()` decide si te saltas los permisos por carpeta
-- del SQL 33 mirando si eres `ve_todo`. Y lo mira así:
--
--     select ve_todo from miembros
--      where perfil_id = auth.uid()
--      order by unido_en limit 1        ← NO filtra por espacio
--
-- Tu PRIMERA pertenencia por antigüedad, sea del espacio que sea.
--
-- O sea: eres `ve_todo` en tu casa —que lo eres, es tu casa, entraste
-- el primero—. Te invitan como asesor limitado a otra. Esta función
-- lee el `ve_todo` de TU casa, devuelve `true`, y los permisos por
-- carpeta de la otra ni se llegan a mirar.
--
-- `puedo_guardar_en()` hace lo mismo con `escribe_todo`.
--
-- Es exactamente lo que advertía la nota del 33: **un fallo aquí no da
-- error, enseña lo que no debía**. Y no lo introduce ningún cambio
-- nuestro: lleva ahí desde que se escribió.
--
-- ─────────────────────────────────────────────────────────────
-- CUÁNTO HAY EXPUESTO AHORA MISMO
--
-- Hace falta una persona en DOS O MÁS espacios donde el más antiguo
-- conceda `ve_todo`. Con una casa, esto no puede pasar: la primera
-- pertenencia por antigüedad ES la única que hay, y la respuesta es la
-- correcta por casualidad.
--
-- Así que hoy, probablemente, cero. La puerta se abre sola el primer
-- día que se invite a un asesor, o el día que alguien entre en la casa
-- de sus padres teniendo la suya.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ ESTO VA APARTE DE LA MIGRACIÓN
--
-- La migración grande —sacar el espacio del estado global y llevarlo a
-- la ruta— resuelve esto de paso y mucho mejor: las funciones pasarán a
-- RECIBIR el espacio en vez de adivinarlo. Pero esa migración toca 63
-- políticas, necesita entorno de pruebas y se despliega en tres pasos.
--
-- Esto son dos condiciones. No se espera a nada.
--
-- Lo que NO arregla, y conviene tenerlo claro: sigue dependiendo de
-- `mi_hogar()`, o sea del estado global. Dos pestañas con dos espacios
-- se siguen pisando. Lo que deja de pasar es que un espacio conteste
-- por otro, que es lo grave.

-- ── El arreglo ────────────────────────────────────────────────

create or replace function puedo_ver_carpeta(cat uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when cat is null then true
    /* `ve_todo` DEL ESPACIO QUE SE ESTÁ MIRANDO, y de ningún otro.
       `miembros` tiene clave primaria (hogar_id, perfil_id), así que
       esto devuelve una fila o ninguna: nunca hace falta un `limit`.

       El `coalesce(..., true)` se queda tal cual: es lo que hace que a
       quien ya estaba dentro antes del SQL 33 —con la columna vacía—
       no le cambie nada. */
    when coalesce(
      (select ve_todo from miembros
        where perfil_id = auth.uid() and hogar_id = mi_hogar()),
      true
    ) then true
    else exists (
      select 1 from permisos_carpeta p
      where p.perfil_id = auth.uid()
        /* Y el permiso, también del espacio que se mira. Hoy no hace
           falta —`categoria_id` ya es de un solo espacio— pero dejarlo
           implícito es confiar en que nadie mueva una categoría de
           sitio. Se escribe. */
        and p.hogar_id = mi_hogar()
        and p.categoria_id = raiz_de(cat)
        and p.ver
    )
  end
$$;


create or replace function puedo_guardar_en(cat uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    /* Primero lo global: un lector no escribe en ninguna parte, tenga
       la carpeta que tenga concedida. */
    puedo_escribir()
    and puedo_ver_carpeta(cat)
    and case
      when cat is null then true
      when coalesce(
        (select escribe_todo from miembros
          where perfil_id = auth.uid() and hogar_id = mi_hogar()),
        true
      ) then true
      else exists (
        select 1 from permisos_carpeta p
        where p.perfil_id = auth.uid()
          and p.hogar_id = mi_hogar()
          and p.categoria_id = raiz_de(cat)
          and p.escribir
      )
    end
$$;

/* Los permisos de ejecución no cambian —la firma es la misma— pero se
   repiten porque `create or replace` no los toca y así este archivo
   deja el estado completo escrito, sin depender de que el 33 se haya
   ejecutado antes. */
revoke all on function puedo_ver_carpeta(uuid)  from public;
revoke all on function puedo_guardar_en(uuid)   from public;
grant execute on function puedo_ver_carpeta(uuid) to authenticated;
grant execute on function puedo_guardar_en(uuid)  to authenticated;


-- ── Comprobación ──────────────────────────────────────────────
/*
  Devuelve una fila por persona que tenga MÁS DE UN espacio, diciendo
  si su `ve_todo` cambia según cuál mire.

  Con una sola casa en la base de datos, sale VACÍA — y eso es la
  respuesta correcta: no había nadie expuesto.

  Si sale alguna fila con `cruzaba` en true, esa persona estaba viendo
  de más en alguno de sus espacios hasta este archivo.
*/
select
  m.perfil_id,
  count(*)                                   as espacios,
  bool_or(coalesce(m.ve_todo, true))         as ve_todo_en_alguno,
  bool_and(coalesce(m.ve_todo, true))        as ve_todo_en_todos,
  bool_or(coalesce(m.ve_todo, true))
    and not bool_and(coalesce(m.ve_todo, true)) as cruzaba
from miembros m
where m.aceptado_en is not null
group by m.perfil_id
having count(*) > 1;
