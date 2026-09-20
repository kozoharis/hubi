'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { refrescar } from '@/lib/refrescar'

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
  Refrescando y no recargando la página: recargar apaga y
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
    const laVuelta = setInterval(() => refrescar(router), 5 * 60_000)

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
    /*
      El hueco mide lo mismo que la hora Y la fecha juntas, para que al
      llegar no empuje nada hacia abajo.

      ⚠️  Y llevaba mal desde que la hora bajó de tamaño: seguía
      reservando 134 px para algo que mide 86. Medio segundo con la
      banda hinchada y un salto al aparecer la hora — pequeño, pero en
      una pared que se enciende sola cada mañana se ve todos los días.

      88 = 56 de hora + 12 + 20 de fecha. Lo mismo que una pestaña.
    */
    return <div className="h-[88px]" aria-hidden />
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

        ── BAJÓ A 46, Y SE PASÓ DE FRENADA ──

        El razonamiento era bueno: la hora seguía siendo el número más
        grande de la pared y es el dato que menos falta hace en una
        cocina — la dan el horno, el microondas, el móvil y
        probablemente un reloj colgado ahí mismo.

        Pero a 42 dejó de mandar Y dejó de anclar. Una banda necesita
        una pieza que la sujete, y ésta es la única candidata: es lo
        que se mira desde la puerta antes de acercarse.

        ── 56, QUE ES EL SITIO ──

        Haris, viendo la pared: *«la hora, si quieres, puede ser más
        grande»*. 56 es la mitad justa de los 104 de antes y sigue
        siendo más pequeña que cualquier cifra de las listas. Manda en
        su banda y no manda en la pantalla.

        Y en tinta suave, no en tinta: es contexto, no contenido.
      */}
      <p className="text-[56px] font-extrabold leading-none tabular-nums tracking-tight text-tinta-suave">
        {hh}:{mm}
      </p>
      {/*
        `capitalize` de Tailwind pone en mayúscula CADA palabra, y salía
        «Domingo 13 De Septiembre». En español la mayúscula es solo la
        primera, y ni los días ni los meses la llevan.
      */}
      {/*
        ── `leading-none`, Y ES LO QUE FALTABA PARA QUE SE VIERA RECTO ──

        Haris, con una raya pintada encima de la captura: *«hay que
        bajar la hora y lo del jueves 17 de septiembre… colócalas
        alineadas por la parte baja»*.

        Y la caja YA estaba alineada — el problema es que una caja de
        texto no acaba donde acaba el texto. Sin `leading`, esta línea
        heredaba el 1,5 del sistema: una caja de 30 px para una letra
        de 20, con 9 px de aire por debajo de la última letra. La caja
        tocaba la línea de las pestañas; la palabra se quedaba 9 px por
        encima, y eso es lo que se ve.

        Es el fallo de alineación más común que hay y no se arregla
        moviendo nada: se arregla haciendo que la caja mida lo que mide
        la letra. `leading-none` deja la caja en 20 px y entonces la
        línea de base cae justo donde acaban las pestañas.

        Los 12 px de separación con la hora no son decorativos:
        56 + 12 + 20 = 88, que es exactamente lo que miden las
        pestañas. La banda es un rectángulo por los cuatro lados.

        Y `whitespace-nowrap`: si la banda se estrecha, «Jueves 17 de
        septiembre» se parte en dos renglones y se lleva por delante la
        línea común. Antes de partirse, que empuje.
      */}
      <p className="mt-3 whitespace-nowrap text-[19px] font-extrabold leading-none text-tenue xl:text-[20px]">
        {enMayuscula(
          `${DIAS[ahora.getDay()]} ${ahora.getDate()} de ${MESES[ahora.getMonth()]}`
        )}
      </p>
    </div>
  )
}
