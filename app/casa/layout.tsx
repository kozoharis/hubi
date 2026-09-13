import type { ReactNode } from 'react'
import { laPared } from '@/lib/pared'
import Reloj from './reloj'
import Pestanas from './pestanas'
import VuelveAHoy from './vuelve-a-hoy'

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

  **El logotipo.** Porque esto se cuelga en una cocina y lo va a ver
  gente que no sabe qué es. Un reloj con listas no dice de dónde sale;
  con la marca delante, sí. Va a la izquierda y pequeño: identifica, no
  reclama.

  **El nombre de la casa, y no el de nadie.** «SOLETES», no «Buenas
  tardes, Juan Miguel». La tableta no es de nadie, y saludar por su
  nombre a la cuenta del aparato sería además mentira — se llama «La
  cocina».

  **La hora, grande.** Es el número grande de esta pantalla y lo que se
  mira desde la puerta cuarenta veces al día.

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
        <div className="min-w-0">
          <p className="flex items-center gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-hubi.png" alt="HUBI" className="block h-[38px] w-auto" />
            <span className="truncate text-[22px] font-extrabold uppercase tracking-[0.2em] text-tenue xl:text-[24px]">
              {nombre}
            </span>
          </p>
          <Reloj />
        </div>

        {/*
          Las pestañas van arriba a la derecha, a la altura de la hora,
          y no abajo como en el teléfono. En un móvil la barra va abajo
          porque ahí llega el pulgar; en una pared de 27 pulgadas, abajo
          es la esquina que hay que agacharse a mirar.
        */}
        <div className="shrink-0 pb-1">
          <Pestanas />
        </div>
      </header>

      {children}
    </div>
  )
}
