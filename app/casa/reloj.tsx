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

  **La hora, y del reloj de la casa.** El resto de MAPPEL calcula las
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

  **Y de noche bajaba desde aquí.** Ya no: lo hace `noche.tsx`, que es
  donde tenía que estar. El porqué está más abajo, y merece leerse —
  era el fallo del «velo blanco».
*/
/** «domingo 13 de septiembre» → «Domingo 13 de septiembre». Solo la primera. */
function enMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

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
    /* En un microtiempo, no en el cuerpo del efecto: llamar a
       `setAhora` directamente encadena un repintado de más y lo avisa
       el propio linter de React. */
    const arranque = setTimeout(() => setAhora(new Date()), 0)

    const elReloj = setInterval(() => setAhora(new Date()), 20_000)
    const laVuelta = setInterval(() => router.refresh(), 5 * 60_000)

    return () => {
      clearTimeout(arranque)
      clearInterval(elReloj)
      clearInterval(laVuelta)
    }
  }, [router])

  /*
    ── Y LO DE BAJAR EL BRILLO YA NO SE HACE AQUÍ ──

    Aquí ponía:

        pared.style.opacity = deNoche ? '0.45' : '1'

    Y era el fallo del «velo blanco»: `opacity` no apaga, MEZCLA con lo
    que hay detrás — y detrás de la pared está el papel claro de MAPPEL.
    A las once de la noche la pantalla no se oscurecía, se desteñía.

    Ahora lo hace `noche.tsx`, con un velo negro delante, que es lo que
    hace un regulador de luz de verdad. Y de paso se despierta al
    tocarla, que es lo que esto nunca hizo.
  */

  if (!ahora) {
    /* El hueco mide lo mismo que la hora Y la fecha juntas, para que al
       llegar no empuje nada hacia abajo. Medía 104 cuando ya ocupaban
       más: la pantalla daba un salto al segundo de encenderse. */
    return <div className="h-[134px] xl:h-[156px]" aria-hidden />
  }

  const hh = String(ahora.getHours()).padStart(2, '0')
  const mm = String(ahora.getMinutes()).padStart(2, '0')

  return (
    <div>
      {/*
        La hora es el número grande de esta pantalla, pero a 132 px era
        lo ÚNICO que se veía: se comía la pantalla y dejaba las listas
        de acompañamiento. En una cocina lo que hace falta saber es qué
        pasa hoy — la hora ya la dice un reloj de pared desde hace
        doscientos años.

        104 en grande, 84 en pequeño. Sigue leyéndose desde la puerta y
        deja de mandar.

        ── Y BAJA OTRA VEZ, A 46 ──

        El mismo razonamiento llevado hasta el final. La hora seguía
        siendo el número más grande de la pared y es el dato que menos
        falta hace en una cocina: la dan el horno, el microondas, el
        móvil y probablemente un reloj colgado ahí mismo.

        A 46 se sigue leyendo perfectamente desde la puerta —es más
        grande que cualquier título de esta pantalla— y deja de ser lo
        primero que se mira. Lo primero pasa a ser lo de hoy, que es lo
        único que sólo da esta pared.

        Y en tinta suave, no en tinta: es contexto, no contenido.
      */}
      <p className="text-[42px] font-extrabold leading-none tabular-nums tracking-tight text-tinta-suave xl:text-[46px]">
        {hh}:{mm}
      </p>
      {/*
        `capitalize` de Tailwind pone en mayúscula CADA palabra, y salía
        «Domingo 13 De Septiembre». En español la mayúscula es solo la
        primera, y ni los días ni los meses la llevan.
      */}
      <p className="mt-1 text-[19px] font-extrabold text-tenue xl:text-[20px]">
        {enMayuscula(
          `${DIAS[ahora.getDay()]} ${ahora.getDate()} de ${MESES[ahora.getMonth()]}`
        )}
      </p>
    </div>
  )
}
