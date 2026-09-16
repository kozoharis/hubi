'use client'

import { useEffect, type ReactNode } from 'react'

/*
  ═══════════════════════════════════════════════════════════════
  DOS ZONAS · el contenido, y lo elegido al lado
  ═══════════════════════════════════════════════════════════════

  La pieza de la que cuelga casi todo el escritorio de MAPPEL.

  El diagnóstico de todo esto cabía en una frase: *en escritorio MAPPEL
  todavía navega en vez de seleccionar*. Todo era una puerta — una
  carpeta, un papel, una tarea—: la pulsas y la pantalla entera se
  sustituye. Es el modelo del móvil, donde no cabe otra cosa. En un
  ordenador, la pantalla debería quedarse y lo elegido debería rellenar
  una zona.

  Esto es esa zona.

      ┌──────────────┬──────────────────────────┬────────────┐
      │     rail     │       el contenido       │  lo elegido│
      │     248      │         fluido           │   340–420  │
      └──────────────┴──────────────────────────┴────────────┘

  ─────────────────────────────────────────────────────────────
  POR QUÉ DOS Y NO TRES

  Porque 1440 da para dos. Descontados el rail (248) y los márgenes
  (64), quedan 1128 útiles, y ahí una tabla necesita 520 para no
  recortar el concepto y un contexto necesita 300 para que quepa la
  foto de un papel. Tres zonas sólo caben cuando una de ellas es una
  lista de nombres que se apaña con 220 —las carpetas de Papeles— o
  cuando ninguna es una tabla.

  Así que ésta es la versión que verá casi todo el mundo, y es la que
  hay que hacer bien. La tercera zona se enchufa después, a 1680, y no
  obliga a rehacer nada.

  ─────────────────────────────────────────────────────────────
  EN EL MÓVIL ESTO NO EXISTE

  Por debajo de `lg` el panel no se pinta siquiera, y el contenido
  ocupa el ancho entero: en un teléfono, elegir SÍ es navegar, porque
  no hay sitio para otra cosa. La regla del sistema, entera:

      si hay sitio para enseñar lo elegido, elegir lo enseña
      si no lo hay, elegir lleva

  Es lo mismo que hacen Cuentas y el Escritorio, y por eso el mismo
  clic hace dos cosas distintas según el tamaño sin que sea una
  inconsistencia.

  ─────────────────────────────────────────────────────────────
  PEGADO, NO CON SCROLL PROPIO

  El panel se queda quieto al desplazar (`sticky`) en vez de tener su
  propia barra. Dos barras de desplazamiento en una pantalla es una de
  las cosas que más rápido convierten esto en software de trabajo, y
  aquí no hacen falta: el scroll independiente por zona se gana su
  sitio cuando hay TRES, no cuando hay dos.

  ─────────────────────────────────────────────────────────────
  NUNCA TAPA LA LISTA

  Ni modal, ni cajón que se desliza por encima, ni fondo oscurecido. Se
  pone al lado y empuja. Si tapara, sería una pantalla nueva con otro
  nombre — y entonces no habríamos arreglado nada.
*/
export default function DosZonas({
  children,
  contexto,
  rotulo,
  ancho = 380,
  arriba = 0,
  alCerrar,
}: {
  /** El contenido de la pantalla: la tabla, la lista, la rejilla. */
  children: ReactNode
  /*
    Lo elegido. Si es `null` no se pinta nada y el contenido se queda
    con el ancho entero: una lista sin nada elegido no tiene por qué
    dejar un hueco reservado esperando.
  */
  contexto?: ReactNode
  /** El rótulo pequeño de encima del panel: «El papel», «La cuenta». */
  rotulo?: string
  /*
    340 en Papeles a 1440, 380 en Cuentas, 420 cuando lo que va dentro
    es una foto que hay que poder leer. Por debajo de 300 no se pone
    nada: no cabe ni una ficha legible.
  */
  ancho?: number
  /*
    A qué altura se queda pegado. Cero en una pantalla normal; el alto
    de la cabecera en las que la llevan pegajosa, para que no se monten
    una encima de otra.
  */
  arriba?: number
  /** La × y la tecla de escape. */
  alCerrar?: () => void
}) {
  /*
    ── ESCAPE CIERRA ──

    Es la tecla que todo el mundo prueba, y la única de las cuatro del
    sistema que pertenece al panel y no a la lista: ↑↓ y Enter son de
    quien tiene las filas y sabe en qué orden van.

    Se engancha sólo cuando hay algo abierto. Un escuchador de teclado
    permanente en una pantalla donde no hay nada que cerrar es una
    manera silenciosa de romper otra cosa más adelante.
  */
  useEffect(() => {
    if (!contexto || !alCerrar) return
    const cerrar = alCerrar
    function alPulsar(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [contexto, alCerrar])

  return (
    <div className="lg:flex lg:items-start lg:gap-5">
      {/* `min-w-0` otra vez, y por lo de siempre: sin él, una tabla
          ancha o un título largo se niegan a encoger y sacan la
          pantalla de madre en vez de quedarse dentro. */}
      <div className="min-w-0 lg:flex-1">{children}</div>

      {contexto && (
        <aside
          aria-label={rotulo ?? 'Lo elegido'}
          className="hidden shrink-0 self-start lg:sticky lg:block"
          style={{ width: ancho, top: arriba }}
        >
          {(rotulo || alCerrar) && (
            <div className="mb-2.5 flex items-center justify-between">
              {rotulo ? <span className="rotulo">{rotulo}</span> : <span />}
              {alCerrar && (
                <button
                  type="button"
                  onClick={alCerrar}
                  aria-label="Cerrar"
                  /* `objetivo` es la variable de densidad: 44 px con
                     ratón, 48 con el dedo. Nunca menos, por muy pequeña
                     que sea la equis. */
                  className="tocable objetivo -mr-2 flex items-center justify-center rounded-full text-[22px] leading-none text-tenue hover:velo-chip"
                >
                  ×
                </button>
              )}
            </div>
          )}
          {contexto}
        </aside>
      )}
    </div>
  )
}
