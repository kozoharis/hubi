import type { ReactNode } from 'react'
import { laPared } from '@/lib/pared'
import Reloj from './reloj'
import Pestanas from './pestanas'
import VuelveAHoy from './vuelve-a-hoy'
import Microfono from './microfono'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  HUBI CASA · el armazón de la pared
  ═══════════════════════════════════════════════════════════════

  La pregunta que contesta la pared: **¿qué pasa en esta casa?**
  Lo que NO es: el HUBI de una persona puesto en horizontal.

  ─────────────────────────────────────────────────────────────
  LA LECCIÓN QUE PAGÓ ESTA PANTALLA, Y HAY QUE DEJARLA ESCRITA

  La primera versión no hablaba el idioma de HUBI: texto suelto sobre
  fondo liso, emojis por iconos, fondo negro heredado del sistema. Un
  panel de administrador, que es exactamente lo que descarta el punto
  28 del planteamiento.

  Pasó por una frase que sonaba razonable: «una pared es otra cosa, no
  le sirven las piezas del móvil». Es falsa, y lleva siempre al mismo
  sitio: en cuanto una pantalla se declara distinta, deja de heredar el
  sistema y se inventa uno.

      UNA PARED ES LA MISMA CASA VISTA DESDE MÁS LEJOS.
      LA PANTALLA NUEVA NO INVENTA UN LENGUAJE: USA EL QUE HAY,
      MÁS GRANDE.

  Lo legítimamente distinto en una pared es el TAMAÑO y lo que NO
  lleva. Nada más. Todo lo que se ve aquí sale de las mismas piezas que
  las cuarenta y cuatro pantallas del teléfono: el papel cálido, las
  tarjetas de `superficie`, `PastillaAmbito`, y `pintaDe()` —la misma
  función que decide el icono y el color de una tarea en el tablón y en
  la agenda—.

  ─────────────────────────────────────────────────────────────
  QUÉ LLEVA ESTA BANDA DE ARRIBA, Y POR QUÉ CADA COSA

  **El logotipo y el nombre de la casa, ARRIBA A LA DERECHA.** Estaban
  encima del reloj, y Haris lo vio a la primera: «veo eso muy
  apretado». Tenía razón, y el motivo no es el espacio — es que eran
  tres cosas distintas apiladas en la misma esquina. La marca dice de
  quién es esto, el reloj dice qué hora es: no tienen por qué tocarse.

  Arriba a la derecha es además donde una marca no estorba: se ve al
  entrar y deja de verse enseguida. Identifica, no reclama.

  **El nombre de la casa, y no el de nadie.** «SOLETES», no «Buenas
  tardes, Juan Miguel». La tableta no es de nadie, y saludar por su
  nombre a la cuenta del aparato sería además mentira — se llama «La
  cocina».

  **La hora, grande pero menos.** Bajó de 132 px a 104. A 132 era lo
  único que se veía: el número se comía la pantalla y las listas
  quedaban de acompañamiento, cuando lo que hace falta saber en una
  cocina es qué pasa hoy, no qué hora es — para eso hay un reloj en
  todas las paredes desde hace doscientos años.

  **Las cinco pestañas.** Hoy, Semana, Menú, Tareas y Notas. A 88 px,
  casi el doble del suelo de HUBI: esto se toca de pie, de lado y con
  las manos ocupadas.

  ─────────────────────────────────────────────────────────────
  Y LO QUE SIGUE SIN LLEVAR

  Ni rail ni barra de pestañas de la aplicación: los dos se apagan
  solos cuando quien mira es un `dispositivo` (`app/rail.tsx`,
  `app/barra.tsx`). Y va siempre en claro — el tema se fija en el
  `<html>` desde `layout.tsx`, porque en una tableta colgada de una
  pared no hay nadie que vaya a entrar en Ajustes a cambiarlo.
*/

export default async function ArmazonDeLaPared({ children }: { children: ReactNode }) {
  /* La comprobación de sitio, una vez y para las cinco pantallas. */
  const { nombre } = await laPared()

  return (
    <div className="min-h-screen bg-fondo px-10 py-8 xl:px-14 xl:py-10" id="la-pared">
      <VuelveAHoy />

      <header className="flex items-end justify-between gap-10">
        {/* Izquierda: la hora y la fecha, y nada más. */}
        <div className="min-w-0">
          <Reloj />
        </div>

        {/*
          Derecha: la marca arriba del todo y las pestañas debajo.

          Las pestañas van arriba y no abajo como en el teléfono. En un
          móvil la barra va abajo porque ahí llega el pulgar; en una
          pared de 27 pulgadas, abajo es la esquina que hay que
          agacharse a mirar.
        */}
        <div className="flex shrink-0 flex-col items-end gap-5">
          <p className="flex items-center gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-hubi.png" alt="HUBI" className="block h-[30px] w-auto" />
            <span className="truncate text-[19px] font-extrabold uppercase tracking-[0.22em] text-tenue">
              {nombre}
            </span>
          </p>
          <Pestanas />
        </div>
      </header>

      {children}

      {/*
        ── EL MICRÓFONO, EN EL ARMAZÓN Y NO EN CADA PANTALLA ──

        Aquí abajo porque tiene que estar en las CINCO pestañas y en el
        mismo sitio en todas. El punto 20 del planteamiento: «debe
        existir SIEMPRE un botón: 🎙️ HABLAR».

        Llegó a haber tres micrófonos distintos metidos dentro de tres
        pantallas, y ninguno en las otras dos. Eso obligaba a aprender
        dónde se puede hablar — que es justo lo que esta aplicación no
        debe pedirle a nadie.
      */}
      <Microfono />
    </div>
  )
}
