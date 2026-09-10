-- ═══════════════════════════════════════════════════════════════
-- 54 · QUIÉN ESCRIBE, Y DÓNDE
-- ═══════════════════════════════════════════════════════════════
--
-- Una función. Una condición. Y es la hermana gemela del SQL 53.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ ESTÁ MAL
--
-- `puedo_escribir()` decide si alguien puede apuntar algo o solo mirar.
-- Está en las políticas de escritura de todas las tablas donde se
-- guarda algo, desde el SQL 31. Y lo decide así:
--
--     select papel <> 'lector' from miembros
--      where perfil_id = auth.uid()
--      order by unido_en limit 1        ← NO filtra por espacio
--
-- Tu PRIMERA pertenencia por antigüedad, sea del espacio que sea.
--
-- O sea: eres propietario de tu casa —lo eres, es tu casa, entraste el
-- primero—. Te invitan a otra como LECTOR, «solo mirar». Esta función
-- lee el papel de TU casa, contesta «sí, escribe», y en la casa ajena
-- puedes crear, cambiar y borrar.
--
-- Es el mismo fallo que el 53 cerró para `ve_todo` y `escribe_todo`,
-- en la función de al lado. Se me pasó: fui a mirar `puedo_ver_carpeta`
-- porque era la del SQL 33, y ésta es del 31.
--
-- Y arrastra a `puedo_en_agenda()`, que la llama: quien no debería
-- escribir tampoco debería poder ponerle tareas a nadie.
--
-- ─────────────────────────────────────────────────────────────
-- CUÁNTO HAY EXPUESTO AHORA MISMO
--
-- Hace falta alguien en DOS O MÁS espacios donde el más antiguo NO sea
-- de lector y otro SÍ. Con una casa no puede pasar: la primera
-- pertenencia por antigüedad es la única que hay.
--
-- Hoy, probablemente, cero: no hay ningún lector todavía. La puerta se
-- abre sola el día que se invite a alguien a «solo mirar» teniendo su
-- propia casa. La comprobación de abajo lo dice con números.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ VA APARTE, OTRA VEZ
--
-- La migración grande hará que estas funciones RECIBAN el espacio en
-- vez de adivinarlo, y esto se arregla de paso y mejor. Pero esa
-- migración toca 52 políticas y hay que ensayarla entera antes.
--
-- Esto es una condición. No espera a nada.
--
-- Lo que NO arregla: sigue dependiendo de `mi_hogar()`, o sea del
-- estado global. Dos pestañas con dos espacios se siguen pisando. Lo
-- que deja de pasar es que un espacio conteste por otro.

-- ── El arreglo ────────────────────────────────────────────────

create or replace function puedo_escribir() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    /* El papel EN EL ESPACIO QUE SE ESTÁ MIRANDO, y en ningún otro.
       `miembros` tiene clave primaria (hogar_id, perfil_id), así que
       esto devuelve una fila o ninguna: no hace falta ningún `limit`.

       El `coalesce(..., true)` se queda tal cual, y por el motivo de
       siempre: si algo fallara, falla hacia el lado que no rompe. Quien
       de verdad no puede escribir se topa además con las políticas de
       su tabla, que no fallan nunca. Al revés —quedarse en `false`—
       alguien con todo el derecho a apuntar vería una pantalla sin
       botones y pensaría que HUBI está roto. */
    (select papel <> 'lector' from miembros
      where perfil_id = auth.uid() and hogar_id = mi_hogar()),
    true
  )
$$;

/* `puedo_en_agenda()` no se toca: llama a ésta y a `mi_rol()`, y las
   dos miran ya el espacio correcto. Se queda escrito aquí para que
   quien lea esto no vaya a buscarla. */

revoke all on function puedo_escribir() from public;
grant execute on function puedo_escribir() to authenticated;


-- ── Comprobación ──────────────────────────────────────────────
/*
  Una fila por persona con MÁS DE UN espacio, diciendo si su permiso de
  escritura cambia según cuál mire.

  Con una sola casa sale VACÍA, y ésa es la respuesta correcta: no
  había nadie expuesto.

  Si sale alguna fila con `cruzaba` en true, esa persona podía escribir
  en un espacio donde solo debía mirar, hasta este archivo.
*/
select
  m.perfil_id,
  count(*)                                        as espacios,
  bool_or(m.papel <> 'lector')                    as escribe_en_alguno,
  bool_and(m.papel <> 'lector')                   as escribe_en_todos,
  bool_or(m.papel <> 'lector')
    and not bool_and(m.papel <> 'lector')         as cruzaba
from miembros m
where m.aceptado_en is not null
group by m.perfil_id
having count(*) > 1;
