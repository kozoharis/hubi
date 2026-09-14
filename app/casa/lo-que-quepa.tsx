'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
  ═══════════════════════════════════════════════════════════════
  LO QUE QUEPA, Y NI UNO MÁS
  ═══════════════════════════════════════════════════════════════

  Haris: *«que sea adaptable… mínimo ésa, pero fácil: todas las
  tabletas son de 1920, 2K o incluso algunas 3K o 4K»*.

  Y tenía razón en tirar lo anterior. La primera propuesta traía TOPES
  FIJOS —tres recados, tres rutinas, ocho de la compra— calculados para
  una pantalla de 800 px de alto. Eso resuelve la pantalla pequeña
  estropeando la grande: en una pared de 1920 se quedarían dos tercios
  del cristal en blanco mientras abajo pone «y 7 más».

  Un tope escrito a mano es una pantalla concreta escrita en el código.

  ─────────────────────────────────────────────────────────────
  CÓMO FUNCIONA

  Se pintan TODOS los renglones, se mide cuánto ocupa cada uno, y se
  esconden los que se salen. Se vuelve a medir cuando la ventana cambia
  de tamaño o cuando cambia lo que hay dentro.

  No se estima por altura media ni se calcula: se MIDE. Un recado de
  dos renglones mide el doble que uno de uno, y cualquier cuenta hecha
  con un número medio se equivoca justo el día que hay mucho — que es
  el día en que esta pantalla importa.

  ─────────────────────────────────────────────────────────────
  LOS DOS PASOS, Y POR QUÉ NO PARPADEA

  Entre pintar y medir hay un instante en que están todos. Si eso se
  pintara, en una pared de 800 px se vería la lista entera un
  fotograma y luego encogería de golpe.

  Por eso lo que sobra no se BORRA: se pone invisible con `hidden`, y
  el contenedor recorta. El navegador nunca llega a enseñar el
  sobrante porque el recorte ya está puesto desde el primer pintado.

  ─────────────────────────────────────────────────────────────
  Y SI NO CABE NI UNO

  Se enseña el primero igualmente, recortado. Una columna vacía con
  «y 5 más» debajo sería una pantalla que dice que tiene cosas y no
  enseña ninguna — peor que un renglón partido, que al menos se ve que
  hay algo y que la pantalla se queda corta.
*/

export default function LoQueQuepa({
  children,
  /** Cómo se dice lo que no cabe. Recibe cuántos se han quedado fuera. */
  elResto = (n) => `y ${n} más`,
  /** Separación entre renglones, en píxeles. La misma que use la lista. */
  hueco = 10,
  /*
    Cuánto del hueco sobrante le toca cuando hay dos listas en la misma
    columna. En «Hoy» conviven lo apuntado y lo de cada día: a partes
    iguales, un día con dos recados y siete rutinas dejaría medio
    cristal en blanco arriba y recortaría abajo.
  */
  peso = 1,
}: {
  children: ReactNode[]
  elResto?: (cuantos: number) => string
  hueco?: number
  peso?: number
}) {
  const caja = useRef<HTMLDivElement | null>(null)
  const [caben, setCaben] = useState<number | null>(null)

  const total = children.length

  useEffect(() => {
    const c = caja.current
    if (!c) return

    function medir() {
      const c = caja.current
      if (!c) return

      const alto = c.clientHeight
      /* Sin alto todavía —el padre aún no se ha colocado— no se decide
         nada. Decidir con cero daría «no cabe ninguno» y se quedaría
         así hasta el siguiente cambio de tamaño. */
      if (alto <= 0) return

      const hijos = Array.from(c.children) as HTMLElement[]
      /* El último hijo es el renglón del «y N más», que no cuenta como
         contenido pero sí ocupa cuando aparece. */
      const renglones = hijos.slice(0, total)

      let usado = 0
      let cuantos = 0

      for (const r of renglones) {
        /* `offsetHeight` de un hijo escondido es 0, así que se mide
           sobre la altura que ya tenía: se quita el `hidden` para
           medir y se vuelve a poner al final. */
        r.hidden = false
      }

      for (let i = 0; i < renglones.length; i++) {
        const suyo = renglones[i].offsetHeight + (i === 0 ? 0 : hueco)
        /* Se reserva sitio para el «y N más» solo si de verdad va a
           hacer falta, o sea si aún queda algo detrás. */
        const reserva = i < renglones.length - 1 ? ALTO_DEL_RESTO + hueco : 0
        if (usado + suyo + reserva > alto) break
        usado += suyo
        cuantos += 1
      }

      const buenos = Math.max(1, cuantos)

      /*
        Y SE VUELVEN A ESCONDER A MANO.

        Aquí había un fallo silencioso: si el número no cambia —una
        ventana que se estira veinte píxeles— React no vuelve a pintar,
        y los renglones que se destaparon para medir se quedaban
        destapados hasta el siguiente cambio de verdad. O sea que la
        lista crecía sola por debajo del recorte.
      */
      for (let i = 0; i < renglones.length; i++) renglones[i].hidden = i >= buenos

      setCaben(buenos)
    }

    medir()

    const ojo = new ResizeObserver(medir)
    ojo.observe(c)
    /* Y la ventana también: en una tableta, girarla cambia el alto sin
       que este elemento cambie de tamaño en el mismo momento. */
    window.addEventListener('resize', medir)

    return () => {
      ojo.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [total, hueco])

  const cortados = caben === null ? 0 : Math.max(0, total - caben)

  return (
    <div ref={caja} className="min-h-0 overflow-hidden" style={{ flex: `${peso} 1 0%` }}>
      {children.map((hijo, i) => (
        <div
          key={i}
          hidden={caben !== null && i >= caben}
          style={{ marginTop: i === 0 ? 0 : hueco }}
        >
          {hijo}
        </div>
      ))}

      {cortados > 0 && (
        <p
          className="text-[19px] font-bold text-tenue"
          style={{ marginTop: hueco, height: ALTO_DEL_RESTO, lineHeight: `${ALTO_DEL_RESTO}px` }}
        >
          {elResto(cortados)}
        </p>
      )}
    </div>
  )
}

/* Lo que mide el renglón del final. Fijo y no medido: se necesita
   SABERLO antes de decidir cuántos caben, y medir algo que todavía no
   se ha pintado es una vuelta más para ahorrar tres píxeles. */
const ALTO_DEL_RESTO = 26
