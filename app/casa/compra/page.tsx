import { laPared } from '@/lib/pared'
import { loQueSeOfrece } from '@/lib/lo-de-siempre'
import { Rotulo } from '../rotulo'
import Lista, { type Cosa, type Grupo } from './lista'

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

  const [{ data }, lasListas, historia] = await Promise.all([
    supabase
      .from('compra')
      .select('id, que, comprado, lista_id')
      .eq('hogar_id', casa)
      .is('archivado_en', null)
      .order('comprado', { ascending: true })
      .order('creado_en', { ascending: true })
      .limit(120),
    /*
      Las listas que alguien ha querido que se vean aquí (paso 77).
      Envuelto: sin ese paso la columna no existe y Postgres rechaza la
      consulta ENTERA — la pared se quedaría sin compra por una casilla
      que todavía no está.
    */
    (async () => {
      try {
        const { data, error } = await supabase
          .from('listas_compra')
          .select('id, nombre')
          .eq('hogar_id', casa)
          .is('archivada_en', null)
          .eq('visible_en_casa', true)
          .order('fecha', { ascending: true, nullsFirst: false })
        if (error) return []
        return (data ?? []) as { id: string; nombre: string | null }[]
      } catch {
        return []
      }
    })(),
    /*
      Lo ya comprado en esta casa, para poder ofrecerlo sin escribirlo.
      Es la misma fuente que en el móvil: la compra archivada. Si falla,
      se ofrece solo lo corriente — que es exactamente lo que pasa en
      una casa recién empezada.
    */
    (async () => {
      try {
        const { data, error } = await supabase
          .from('compra')
          .select('que')
          .eq('hogar_id', casa)
          .not('archivado_en', 'is', null)
          .limit(600)
        if (error) return [] as string[]
        return ((data ?? []) as { que: string }[]).map((c) => c.que)
      } catch {
        return [] as string[]
      }
    })(),
  ])

  const cosas = (data ?? []) as Cosa[]

  /*
    La compra corriente de la casa va primero y va SIEMPRE. Detrás, las
    listas marcadas, cada una con lo suyo. Lo que esté en una lista que
    nadie ha querido enseñar aquí, no sale — y no es una cerradura: es
    una decisión de pantalla. Está explicado en el sql/77.
  */
  const grupos: Grupo[] = [
    { id: null, nombre: null, cosas: cosas.filter((c) => !c.lista_id) },
    ...lasListas.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      cosas: cosas.filter((c) => c.lista_id === l.id),
    })),
  ]

  const visibles = grupos.flatMap((g) => g.cosas)
  const faltan = visibles.filter((c) => !c.comprado).length

  /*
    Los botones de apuntar sin escribir. Se calculan con TODA la compra
    abierta —no solo con la que se ve— para no ofrecer algo que ya está
    apuntado en una lista que aquí no sale: alguien lo tocaría, se
    apuntaría una segunda leche y en el súper acabarían dos.
  */
  const sugerencias = loQueSeOfrece(historia, cosas.map((c) => c.que))

  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-5">
        <Rotulo>La compra</Rotulo>
        <p className="text-[20px] font-extrabold text-tinta-suave">
          {faltan === 0 ? 'No falta nada' : faltan === 1 ? 'Falta 1 cosa' : `Faltan ${faltan} cosas`}
        </p>
      </div>

      <Lista grupos={grupos} sugerencias={sugerencias} />
    </section>
  )
}
