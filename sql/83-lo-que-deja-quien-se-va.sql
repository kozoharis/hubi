-- ═══════════════════════════════════════════════════════════════
-- 83 · LO QUE DEJA QUIEN SE VA · PASO 1 · MIRAR
-- ═══════════════════════════════════════════════════════════════
--
-- ESTE ARCHIVO NO CAMBIA NADA. Son cuatro `select`. Se puede
-- ejecutar entero, las veces que haga falta, sin ningún riesgo.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ PASA Y POR QUÉ
--
-- Quitarle el rol a alguien —o sacarlo de la casa— le cierra la
-- puerta, y eso funciona: deja de entrar y deja de ver nada. Pero
-- LO QUE SE LE HABÍA ASIGNADO SIGUE APUNTANDO A ELLA.
--
-- Tres tablas guardan a quién le toca algo:
--
--     rutinas.para            el plan de la casa: «los lunes, sábanas»
--     recordatorios.asignado_a  las tareas con fecha
--     notas.para              los recados del corcho
--
-- Las tres son `references perfiles(id) on delete set null`. O sea
-- que si se BORRA el perfil entero, la base se limpia sola. Pero
-- quitarle el rol no borra el perfil —ni debe—, así que lo suyo se
-- queda huérfano: una rutina de alguien que ya no está en la casa.
--
-- Y no da error. Simplemente aparece en la pantalla asignada a un
-- nombre que ya no sale en ninguna lista, o sin nombre ninguno.
--
-- ─────────────────────────────────────────────────────────────
-- CÓMO SE RECONOCE UNA HUÉRFANA
--
-- `es_persona_de_la_casa(hogar_id, quien)` —del SQL 76— contesta si
-- esa persona sigue siendo miembro de esa casa, aceptada y como
-- persona (no como pantalla de cocina). Es la MISMA función que usan
-- las políticas de seguridad, así que esto pregunta exactamente lo
-- que pregunta el resto del sistema. No inventa un criterio nuevo.
--
-- ─────────────────────────────────────────────────────────────
-- QUÉ HACER DESPUÉS
--
-- Nada todavía. Mira lo que sale, dime qué ves, y te paso el paso 2
-- con la decisión ya tomada. El paso 2 sí toca datos, y por eso va
-- aparte.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · LAS RUTINAS HUÉRFANAS ──────────────────────────────
-- El plan de la casa asignado a alguien que ya no está.
select
  'rutina'                            as que_es,
  h.nombre                            as casa,
  r.que                               as trabajo,
  case r.dia
    when 1 then 'lunes'   when 2 then 'martes'  when 3 then 'miércoles'
    when 4 then 'jueves'  when 5 then 'viernes' when 6 then 'sábado'
    else 'domingo' end                as dia,
  coalesce(p.nombre, '(perfil borrado)') as asignada_a,
  r.activa
from rutinas r
join hogares h on h.id = r.hogar_id
left join perfiles p on p.id = r.para
where r.para is not null
  and not es_persona_de_la_casa(r.hogar_id, r.para)
order by h.nombre, r.dia, r.orden;


-- ── 2 · LAS TAREAS HUÉRFANAS, SIN HACER ────────────────────
-- Éstas son las que estorban: salen en rojo y no son de nadie.
select
  'tarea pendiente'                   as que_es,
  h.nombre                            as casa,
  t.titulo,
  t.fecha,
  coalesce(p.nombre, '(perfil borrado)') as asignada_a
from recordatorios t
join hogares h on h.id = t.hogar_id
left join perfiles p on p.id = t.asignado_a
where t.asignado_a is not null
  and t.estado = 'pendiente'
  and not es_persona_de_la_casa(t.hogar_id, t.asignado_a)
order by h.nombre, t.fecha nulls last;


-- ── 3 · LAS TAREAS HUÉRFANAS YA HECHAS ─────────────────────
/*
  Aparte a propósito, y es la parte que me importa que veas.

  Esto NO estorba: es el historial. «El 14 de agosto Rosana cambió las
  sábanas» pasó, y sigue siendo verdad aunque Rosana ya no esté. Si se
  borra, la casa pierde el registro de lo que se hizo — y eso no se
  recupera.

  Lo cuento para que sepas cuánto hay, no para proponerte quitarlo.
*/
select
  'tarea hecha'                       as que_es,
  h.nombre                            as casa,
  count(*)                            as cuantas
from recordatorios t
join hogares h on h.id = t.hogar_id
where t.asignado_a is not null
  and t.estado = 'hecho'
  and not es_persona_de_la_casa(t.hogar_id, t.asignado_a)
group by h.nombre
order by h.nombre;


-- ── 4 · LAS NOTAS HUÉRFANAS ────────────────────────────────
-- Recados dejados a alguien que ya no está. Las notas «para la casa»
-- (`para is null`) no entran: ésas no son de nadie a propósito.
select
  'nota'                              as que_es,
  h.nombre                            as casa,
  left(n.texto, 80)                   as texto,
  coalesce(p.nombre, '(perfil borrado)') as para_quien,
  n.guardada_en is not null           as ya_guardada
from notas n
join hogares h on h.id = n.hogar_id
left join perfiles p on p.id = n.para
where n.para is not null
  and not es_persona_de_la_casa(n.hogar_id, n.para)
order by h.nombre, n.creada_en desc;
