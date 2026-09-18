import type { ReactNode } from 'react'
import { laPared } from '@/lib/pared'
import Reloj from './reloj'
import Pestanas from './pestanas'
import VuelveAHoy from './vuelve-a-hoy'
import Microfono from './microfono'
import Descanso from './descanso'
import Despierta from './despierta'
import Noche from './noche'
import Tiempo from './tiempo'
import PantallaCompleta from './pantalla-completa'
import AltoDeVerdad from './alto-de-verdad'

export const dynamic = 'force-dynamic'

/*
  ── EL MANIFIESTO DE LA PARED, Y NO EL DE LA APLICACIÓN ──

  La aplicación normal se instala en `standalone`: con la barra de
  estado de Android puesta, que en un teléfono es lo correcto — la
  hora y la batería hacen falta.

  Una tableta colgada en una cocina es lo contrario. Aquí esas dos
  franjas negras no sirven para nada, estropean la banda de arriba y
  ponen un botón de atrás al alcance de cualquiera que pase.

  Éste declara `display: "fullscreen"`, y como el navegador se queda
  con el manifiesto de la página DESDE LA QUE se instala, una tableta
  instalada desde la pared se abre sin barras y la instalada desde el
  Inicio sigue con las suyas. Dos comportamientos, sin ningún ajuste
  que nadie tenga que encontrar.

  Lleva además `orientation: "landscape"` y su propio `id`, para que
  Android la trate como lo que es: otra cosa, no la misma aplicación.
*/
export const metadata = {
  manifest: '/pared.webmanifest',
}

/*
  ═══════════════════════════════════════════════════════════════
  MAPPEL CASA · el armazón de la pared
  ═══════════════════════════════════════════════════════════════

  La pregunta que contesta la pared: **¿qué pasa en esta casa?**
  Lo que NO es: el MAPPEL de una persona puesto en horizontal.

  ─────────────────────────────────────────────────────────────
  LA LECCIÓN QUE PAGÓ ESTA PANTALLA, Y HAY QUE DEJARLA ESCRITA

  La primera versión no hablaba el idioma de MAPPEL: texto suelto sobre
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

  **La hora, grande pero no lo más grande.** 132 → 104 → 42 → 56. El
  viaje entero está contado en `reloj.tsx`, y el final es 56 porque a
  42 se había pasado de frenada: la hora dejó de mandar, que era lo
  que se buscaba, pero también dejó de ser el ancla de la banda.

  **Las cinco pestañas.** Hoy, Calendario, Menú, Compra y Notas. A 72
  px, bastante por encima del suelo de MAPPEL: esto se toca de pie, de
  lado y con las manos ocupadas.

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
    <>
    {/*
      ── LA PARED MIDE LA PANTALLA, NI UN PÍXEL MÁS ──

      Era `min-h-screen`: la pared medía lo que midiera su contenido y
      crecía hacia abajo. Con nueve bloques en Hoy eso significaba
      desplazarse, y una pared colgada no se desplaza — nadie va a
      arrastrar una lista para ver si hay algo debajo.

      Ahora mide exactamente la pantalla y el sobrante se recorta. La
      diferencia no es que ya no HAGA FALTA desplazar: es que **no se
      puede**. Si algo no cabe se verá que no cabe, en vez de esconderse
      bajo el borde durante meses sin que nadie lo eche en falta.

      El armazón es una columna: cabecera arriba con su alto, y debajo
      el hueco que sobre. Las cinco pantallas reciben ese hueco y cada
      una decide qué hacer con él — Hoy lo llena sin desbordar, y las
      otras cuatro se desplazan dentro, que ahí sí tiene sentido porque
      son listas que se van a mirar de cerca.

      ── Y ES `h-dvh`, NO `h-screen` ──

      `h-screen` es `100vh`, y `100vh` en Android es **la ventana sin
      las barras del sistema**: Chrome la calcula como si la barra de
      direcciones estuviera escondida, siempre. En la tableta de la
      cocina, que no esconde nada porque nadie se desplaza, eso son
      unos 56 px de pared que caen por debajo del borde de abajo — y
      como aquí hay `overflow-hidden`, no se pueden recuperar
      desplazando. Se pierden y ya está.

      Lo que se perdía era justo lo de abajo del todo: el micrófono.
      El botón que el punto 20 del planteamiento manda tener SIEMPRE.

      En un iPad no se nota, porque Safari en horizontal y a pantalla
      completa hace que `100vh` y la pantalla coincidan. La pared es
      justamente la que nunca es un iPad.

      `h-dvh` es `100dvh`: el alto que hay AHORA MISMO, barras
      incluidas. Lo entienden todos los navegadores desde 2022.
    */}
    <div
      className="flex flex-col overflow-hidden bg-fondo px-10 py-8 xl:px-14 xl:py-10"
      /*
        ── Y NI SIQUIERA `100dvh` ES SIEMPRE LO QUE SE VE ──

        Era `h-dvh`. `100dvh` arregló lo de `100vh` y sigue siendo el
        suelo de esto, pero en Android la barra de gestos se pinta
        ENCIMA de la página y la ventana se declara como si no
        estuviera: la pared mide unos 40 px de más y lo que sobra sale
        por abajo, que es donde están la foto y la compra.

        `--alto-pared` lo pone `alto-de-verdad.tsx` desde
        `visualViewport`, que es lo que el navegador enseña de verdad.
        Y mientras no llegue, `100dvh`: nunca se queda sin alto.
      */
      style={{ height: 'var(--alto-pared, 100dvh)' }}
      id="la-pared"
    >
      {/*
        No pinta nada: le pide a la tableta que no apague la pantalla.
        Sin esto, la pared estaba negra casi siempre y el descanso de
        las fotos —que entra a los tres minutos— no llegó a verse
        nunca, porque Android apagaba a los dos.
      */}
      <Despierta />

      {/* Tampoco pinta nada: esconde las barras de Android al primer
          toque. El porqué —y por qué hace falta un toque— está en
          `pantalla-completa.tsx`. */}
      <PantallaCompleta />

      {/* Tampoco pinta: apunta el alto que de verdad se ve. */}
      <AltoDeVerdad />

      <VuelveAHoy />

      {/*
        ═══════════════════════════════════════════════════════════
        LA BANDA, EN DOS RENGLONES Y CON UN SUELO COMÚN
        ═══════════════════════════════════════════════════════════

        Haris, con la pared delante: *«veo que la parte de arriba está
        desalineada… estaría bien que esté todo en la misma línea, por
        lo menos la parte baja»*.

        Tenía razón y el motivo era de bulto. Era un `flex` con
        `items-center`, y las dos mitades no miden lo mismo: a la
        izquierda la hora y el tiempo, unos 70 px; a la derecha la
        marca, un hueco y las pestañas, unos 120. Centrar la pequeña
        dentro de la grande deja la hora flotando a media altura y
        cada cosa acabando donde le toca. Cuatro renglones de texto a
        cuatro alturas distintas, en la única banda que se lee de un
        vistazo desde la puerta.

        Ahora es una rejilla de dos renglones:

            ·                                          marca
            hora · el tiempo · tres días               pestañas

        Con `items-end`, todo lo del segundo renglón **acaba en la
        misma línea**: la fecha, «Despejado», los grados de los tres
        días y el borde de abajo de las pestañas. Es un suelo común, y
        es lo que hace que una banda parezca una banda.

        Y encima de ese suelo cada cosa puede medir lo que necesite —
        la hora vuelve a ser grande sin descolocar nada, que es lo
        otro que pedía.
      */}
      <header className="grid shrink-0 grid-cols-[1fr_auto] items-end gap-x-10 gap-y-4">
        {/* ── Renglón 1 · sólo la marca, arriba a la derecha ── */}
        <div aria-hidden />

        {/*
          La marca arriba del todo. Estaba encima del reloj y Haris lo
          vio a la primera: «veo eso muy apretado». La marca dice de
          quién es esto, el reloj dice qué hora es: no tienen por qué
          tocarse.

          Arriba a la derecha es además donde una marca no estorba: se
          ve al entrar y deja de verse enseguida. Identifica, no
          reclama.
        */}
        <p className="flex items-center justify-end gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mappel.png" alt="mappel" className="block h-[30px] w-auto" />
          <span className="truncate text-[19px] font-extrabold uppercase tracking-[0.22em] text-tenue">
            {nombre}
          </span>
        </p>

        {/* ── Renglón 2 · cómo está el mundo, y adónde se va ── */}
        {/*
          La hora, la fecha y el tiempo contestan la MISMA pregunta
          —cómo está el mundo ahí fuera— y por eso van juntos.
          Separados, cada uno pedía su propio rótulo y su propio sitio,
          y el tiempo acababa en la tercera columna, abajo a la
          derecha, que es el último sitio al que llega la vista.

          El tiempo se pinta en las cinco pestañas, no sólo en Hoy. No
          es un descuido: si hay que decidir si se tiende, da igual en
          qué pestaña se esté mirando — y una cosa que aparece y
          desaparece según la pestaña obliga a acordarse de dónde
          estaba.
        */}
        <div className="flex min-w-0 items-end gap-9">
          <Reloj />
          <Tiempo banda />
        </div>

        {/*
          Las pestañas van arriba y no abajo como en el teléfono. En un
          móvil la barra va abajo porque ahí llega el pulgar; en una
          pared de 27 pulgadas, abajo es la esquina que hay que
          agacharse a mirar.
        */}
        <Pestanas />
      </header>

      {/* El hueco que queda. `min-h-0` es imprescindible: sin él, un
          hijo de flex no encoge por debajo de su contenido y el recorte
          de arriba no sirve de nada. */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

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

    {/*
      ── EL REGULADOR DE NOCHE, Y EL DESCANSO, LOS DOS FUERA ──

      A propósito, y el orden importa. `noche.tsx` pone un velo negro
      por encima de la pared a partir de las once (y lo quita en cuanto
      alguien la toca); el descanso ya se apaga por su cuenta al 28 %.

      Si el velo cubriera también al descanso, las dos cosas se
      sumarían y las fotos de la familia quedarían casi negras. Por eso
      el velo es `z-55` y el descanso `z-60`: cada uno apaga lo suyo, y
      el de las fotos sabe mejor cuánto necesita — es lo único que
      ocupa la pantalla entera.
    */}
    <Noche />
    <Descanso />
    </>
  )
}
