'use client'

import Link from '@/app/enlace'
import { useEffect, useState } from 'react'
import { Ico } from './iconos'
import { AMBITO } from '@/lib/ambitos'
import type { Accion } from '@/lib/guia'

/*
  ═══════════════════════════════════════════════════════════════
  PRIMEROS PASOS · la nota del Inicio
  ═══════════════════════════════════════════════════════════════

  Alguien entra en HUBI por primera vez y se encuentra una casa
  vacía: el balance a cero, la lista de la compra vacía, «todavía no
  hay nada apuntado». La aplicación que promete tenerlo todo en un
  mismo lugar se abre enseñando ninguna cosa, y quien no sabe por
  dónde empezar no empieza.

  ─────────────────────────────────────────────────────────────
  NO ES UNA LISTA DE VÍDEOS. ES UNA LISTA DE COSAS POR HACER

  Y la diferencia no es de forma. Una lista de vídeos son deberes:
  hay que verlos todos y al terminar no has hecho nada. Una lista de
  cosas hechas se completa USANDO HUBI, que es exactamente lo que se
  quiere que pase. El vídeo deja de ser el objetivo y pasa a ser lo
  que hay al lado por si te atascas.

  De paso resuelve sola la pregunta más difícil de todas: cuándo se
  quita. No hay «no volver a mostrar» ni contador de vídeos vistos.
  Cuando las cuatro están hechas, la tarjeta se va y no vuelve —
  porque ya no tiene nada que decir.

  Y está escrita en el idioma que ya se habla aquí: en HUBI se tacha
  la compra, se marcan las rutinas, las tareas son pendiente o hecho.
  Una lista que se tacha no hay que explicarla.

  ─────────────────────────────────────────────────────────────
  SE PUEDE APARTAR, Y VUELVE

  Igual que el aviso de los avisos (`sin-avisos.tsx`), y por el mismo
  motivo: sin poder quitarlo sería un cartel fijo en la puerta, y un
  cartel fijo se deja de leer en tres días. Se aparta y vuelve a la
  semana. Quien de verdad no lo quiere lo aparta un par de veces; a
  quien se le olvidó, se le recuerda.

  ─────────────────────────────────────────────────────────────
  Y NO ES UN POPUP

  A propósito. Un modal encima del Inicio el primer día es una pared
  que hay que quitar antes de llegar a lo tuyo, con un botón de
  cerrar pequeño por definición. Esto no bloquea nada: quien quiere
  usar HUBI baja y lo ignora; quien no sabe por dónde empezar lo
  encuentra en el primer sitio donde mira.
*/

const APARTADA = 'hubi.primeros-pasos.apartada'
const UNA_SEMANA = 7 * 24 * 60 * 60 * 1000

export default function PrimerosPasos({
  pasos,
  hechos,
  cuantasMas,
}: {
  pasos: Accion[]
  /** Las claves ya hechas. Vienen del servidor: son datos, no memoria. */
  hechos: string[]
  /** Cuántas acciones más hay en la guía además de estas cuatro. */
  cuantasMas: number
}) {
  const [apartada, setApartada] = useState(true)

  /*
    Empieza apartada y se enseña al comprobar: así no parpadea en
    pantalla un instante para quien la apartó ayer.

    La comprobación va en un microtask y no directamente en el efecto
    porque cambiar el estado ahí mismo encadena dos dibujados —React
    avisa de ello— y en el Inicio, que es la pantalla que más veces se
    abre, eso se paga en cada visita.
  */
  useEffect(() => {
    let vivo = true
    queueMicrotask(() => {
      if (!vivo) return
      try {
        const cuando = Number(localStorage.getItem(APARTADA) || 0)
        setApartada(Boolean(cuando) && Date.now() - cuando < UNA_SEMANA)
      } catch {
        /* Navegador con el almacenamiento cerrado: se enseña. */
        setApartada(false)
      }
    })
    return () => {
      vivo = false
    }
  }, [])

  const hecho = new Set(hechos)
  const cuantos = pasos.filter((p) => hecho.has(p.clave)).length

  /* Todo hecho: se va para siempre, sin felicitación y sin confeti.
     HUBI no es esa clase de aplicación. */
  if (cuantos >= pasos.length) return null
  if (apartada) return null

  function apartar() {
    try {
      localStorage.setItem(APARTADA, String(Date.now()))
    } catch {
      /* Sin almacenamiento se aparta solo hasta recargar, y es lo
         mejor que se puede hacer. */
    }
    setApartada(true)
  }

  return (
    <div className="mt-5 rounded-[20px] border border-borde bg-superficie p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="rotulo">Primeros pasos</span>
        <span className="t-apoyo shrink-0 tabular-nums">
          {cuantos} de {pasos.length}
        </span>
      </div>

      <ul className="mt-3 space-y-1">
        {pasos.map((paso) => {
          const ya = hecho.has(paso.clave)
          return (
            <li key={paso.clave}>
              <Link
                href={`/como-se-hace?ver=${paso.clave}`}
                className="tocable flex min-h-[56px] items-center gap-3 rounded-[14px] px-1 py-1"
              >
                {/*
                  La casilla no se puede tocar para marcarla, y eso es
                  intencionado: se marca haciendo la cosa, no diciendo
                  que la has hecho. Una casilla que se marca sola la
                  primera vez que guardas un papel enseña más que
                  cualquier texto.
                */}
                <span
                  aria-hidden
                  className="casilla flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: ya ? 'var(--t-bien)' : 'var(--t-borde)',
                    background: ya ? 'var(--t-bien)' : 'transparent',
                    color: 'var(--t-superficie)',
                  }}
                >
                  {ya && (
                    <span className="tic flex">
                      <Ico nombre="check" tam={17} grosor={3} />
                    </span>
                  )}
                </span>

                <span
                  className={`tachable t-cuerpo min-w-0 flex-1 truncate ${
                    ya ? 'tachable-puesto text-tenue' : ''
                  }`}
                >
                  {paso.titulo}
                </span>

                {!ya && (
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold"
                    /* El velo del ámbito al 16%, igual que la
                       pastilla del icono en el resto de HUBI. */
                    style={{
                      background: `${AMBITO[paso.ambito]}29`,
                      color: AMBITO[paso.ambito],
                    }}
                  >
                    Ver cómo
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {/*
        Y la insinuación de que hay más.

        Sin esto, alguien podría creer que HUBI hace cuatro cosas.
        Con una lista de nueve, nadie lee ninguna. Cuatro delante y el
        resto a un toque es el reparto que funciona.
      */}
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-borde pt-3">
        <Link href="/como-se-hace" className="tocable t-apoyo font-bold text-tinta-suave">
          Y {cuantasMas} cosas más que sabe hacer →
        </Link>
        <button onClick={apartar} className="tocable t-apoyo shrink-0 px-2 py-1 text-tenue">
          Ahora no
        </button>
      </div>
    </div>
  )
}
