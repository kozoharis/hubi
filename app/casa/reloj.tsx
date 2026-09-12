'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/*
  ═══════════════════════════════════════════════════════════════
  LO ÚNICO DE NAVEGADOR QUE TIENE LA PARED
  ═══════════════════════════════════════════════════════════════

  Tres cosas que nadie prevé hasta que la pantalla está colgada:

  **La hora, y del reloj de la casa.** El resto de HUBI calcula las
  fechas en el servidor con `hoyAqui()`, porque el servidor de Vercel
  va en hora de Londres y a última hora de la tarde ya ha cambiado de
  día. Una hora no se puede pintar así: tiene que ser la del sitio
  donde está el aparato, y eso solo lo sabe el aparato.

  **Se refresca sola.** Cada cinco minutos pide la pantalla otra vez.
  Con `router.refresh()` y no recargando la página: recargar apaga y
  enciende: parpadea, y en una pared eso se ve desde la otra punta de
  la cocina. Así solo cambia lo que ha cambiado.

  Y sin ruedas girando. Una pantalla que se pasa el día diciendo que
  está trabajando es una pantalla que la gente deja de mirar.

  **Y de noche baja.** A partir de las once, la pantalla entera se
  atenúa. Una tableta a brillo de día en una cocina a oscuras es una
  farola.
*/
export default function Reloj() {
  const router = useRouter()
  const [ahora, setAhora] = useState<Date | null>(null)

  useEffect(() => {
    /*
      La primera hora se pone AQUÍ y no en el estado inicial. Si se
      pintara ya en el servidor, saldría la de Londres durante un
      instante y cambiaría sola delante de quien la esté mirando —que
      es justo la clase de cosa que hace dudar de si el aparato va
      bien—. Un hueco de medio segundo es mejor que una hora falsa.
    */
    setAhora(new Date())

    const elReloj = setInterval(() => setAhora(new Date()), 20_000)
    const laVuelta = setInterval(() => router.refresh(), 5 * 60_000)

    return () => {
      clearInterval(elReloj)
      clearInterval(laVuelta)
    }
  }, [router])

  /* De noche, más apagada. Se pinta sobre el `<main>` entero desde
     aquí, que es el único sitio de esta pantalla que sabe qué hora es
     de verdad. */
  useEffect(() => {
    if (!ahora) return
    const h = ahora.getHours()
    const deNoche = h >= 23 || h < 7
    const pared = document.getElementById('la-pared')
    if (pared) pared.style.opacity = deNoche ? '0.45' : '1'
  }, [ahora])

  if (!ahora) {
    /* El hueco mide lo mismo que la hora, para que al llegar no empuje
       nada hacia abajo. */
    return <div className="h-[104px]" aria-hidden />
  }

  const hh = String(ahora.getHours()).padStart(2, '0')
  const mm = String(ahora.getMinutes()).padStart(2, '0')

  return (
    <div>
      <p className="mt-1 text-[84px] font-extrabold leading-none tabular-nums tracking-tight text-tinta">
        {hh}:{mm}
      </p>
      <p className="mt-2 text-[26px] font-extrabold capitalize text-tinta-suave">
        {DIAS[ahora.getDay()]} {ahora.getDate()} de {MESES[ahora.getMonth()]}
      </p>
    </div>
  )
}
