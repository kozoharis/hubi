import { laPared } from '@/lib/pared'
import { Rotulo } from '../rotulo'
import Lista, { type Cosa } from './lista'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LA COMPRA · la razón de que haya una tableta en una cocina
  ═══════════════════════════════════════════════════════════════

  Se acaba la leche, se apunta la leche. Dos pasos hasta la pared y ya
  está — sin buscar el móvil, sin desbloquearlo, sin abrir nada.

  ─────────────────────────────────────────────────────────────
  ESTA PESTAÑA OCUPA EL SITIO QUE TENÍA «TAREAS»

  Lo dijo Haris y tiene toda la razón: *«tareas y calendario para mí es
  lo mismo»*. Y no es solo su opinión — es el punto 18 del planteamiento
  del proyecto, escrito al principio de todo:

      «Para Juan Miguel y Conchita no quiero que exista una diferencia
       conceptual complicada entre evento, tarea, recordatorio y
       deadline. Para ellos todo debe ser: COSAS QUE TENGO QUE
       RECORDAR.»

  Una pestaña «Tareas» al lado de una pestaña «Calendario» obligaba
  justamente a esa distinción: ¿lo del médico del martes es una tarea o
  es calendario? Se busca en las dos.

  Así que lo pendiente vive donde vive el tiempo —en el Calendario— y
  este sitio es para lo único que la pared puede escribir de verdad.

  ─────────────────────────────────────────────────────────────
  SIN SECCIÓN Y SIN LISTA

  La compra de HUBI sabe de secciones —la casa, la finca, Los
  Helechos— y de listas por semana. Aquí no se pregunta nada de eso: se
  apunta en la lista de siempre de la casa, que es donde va la leche.

  Quien necesite apuntar cinco kilos de abono para la finca lo hará
  desde el móvil, que es donde hay sitio para elegir. Una pared con un
  desplegable de secciones es una pared que nadie usa.
*/

export default async function Compra() {
  const { supabase, casa } = await laPared()

  const { data } = await supabase
    .from('compra')
    .select('id, que, comprado')
    .eq('hogar_id', casa)
    .is('archivado_en', null)
    .order('comprado', { ascending: true })
    .order('creado_en', { ascending: true })
    .limit(60)

  const cosas = (data ?? []) as Cosa[]
  const faltan = cosas.filter((c) => !c.comprado).length

  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-5">
        <Rotulo>La compra</Rotulo>
        <p className="text-[20px] font-extrabold text-tinta-suave">
          {faltan === 0 ? 'No falta nada' : faltan === 1 ? 'Falta 1 cosa' : `Faltan ${faltan} cosas`}
        </p>
      </div>

      <Lista cosas={cosas} />
    </section>
  )
}
