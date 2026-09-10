'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Ico } from '../iconos'
import { BotonPrincipal, BotonSecundario, Fila, PastillaAmbito } from '../piezas'
import { videoDe, type Accion } from '@/lib/guia'

/*
  ═══════════════════════════════════════════════════════════════
  CÓMO SE HACE
  ═══════════════════════════════════════════════════════════════

  Un menú plano y un vídeo. Sin secciones, sin índice y sin buscador:
  con nueve cosas, un buscador es una manera elegante de esconderlas.

  ─────────────────────────────────────────────────────────────
  EL BOTÓN QUE HACE QUE ESTO SIRVA DE ALGO

  Debajo de cada vídeo hay un «Hacerlo ahora» que deja a la persona
  en la pantalla de verdad.

  Sin él, alguien mira el vídeo, dice «ah, vale», y después tiene que
  encontrar el sitio por su cuenta — que es exactamente el paso en el
  que se pierde, y el motivo por el que estaba mirando el vídeo. Con
  él, mirar y hacer son el mismo gesto.

  ─────────────────────────────────────────────────────────────
  LOS VÍDEOS NO LLEVAN UNA PALABRA DENTRO

  A propósito. El título y la línea los pone esta pantalla, así que
  se corrigen —y algún día se traducen— sin volver a renderizar
  nada. Un rótulo quemado en un vídeo es una decisión que ya no se
  puede cambiar.

  Van en bucle y sin sonido: se pueden ver tres veces seguidas sin
  tocar nada, y no molestan en un salón a las diez de la noche.
*/

export default function Guia({
  acciones,
  abrir,
}: {
  acciones: Accion[]
  /** La que llega abierta desde la nota del Inicio, si viene alguna. */
  abrir: string | null
}) {
  const [viendo, setViendo] = useState<string | null>(abrir)
  const elegida = acciones.find((a) => a.clave === viendo) ?? null

  if (elegida) {
    return (
      <Reproductor
        accion={elegida}
        alCerrar={() => setViendo(null)}
        /* Para poder ir a la siguiente sin volver a la lista: quien
           está aprendiendo suele querer ver dos o tres seguidas. */
        siguiente={
          acciones[acciones.findIndex((a) => a.clave === elegida.clave) + 1] ?? null
        }
        alSiguiente={(c) => setViendo(c)}
      />
    )
  }

  return (
    <ul className="space-y-2.5">
      {acciones.map((a) => (
        <li key={a.clave}>
          <Fila onClick={() => setViendo(a.clave)} alto="alta" ambito={a.ambito}>
            <PastillaAmbito icono={a.icono} ambito={a.ambito} tam={48} />
            <span className="min-w-0 flex-1">
              <span className="t-tarjeta block">{a.titulo}</span>
              <span className="t-apoyo mt-0.5 block line-clamp-2">{a.linea}</span>
            </span>
            <Ico nombre="flecha" tam={21} grosor={2.3} className="shrink-0" />
          </Fila>
        </li>
      ))}
    </ul>
  )
}

function Reproductor({
  accion,
  alCerrar,
  siguiente,
  alSiguiente,
}: {
  accion: Accion
  alCerrar: () => void
  siguiente: Accion | null
  alSiguiente: (clave: string) => void
}) {
  const video = videoDe(accion.clave)
  const ref = useRef<HTMLVideoElement>(null)

  /* Al cambiar de acción hay que volver a arrancar: el navegador no
     reinicia un `<video>` solo porque le cambie el `src`. */
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.currentTime = 0
    v.play().catch(() => {
      /* Si el navegador se niega a reproducir solo, se queda el
         primer fotograma y sus controles. No es un fallo. */
    })
  }, [accion.clave])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <PastillaAmbito icono={accion.icono} ambito={accion.ambito} tam={48} />
        <h2 className="t-seccion min-w-0 flex-1">{accion.titulo}</h2>
      </div>

      {video ? (
        <video
          ref={ref}
          src={video}
          muted
          loop
          playsInline
          controls
          preload="auto"
          aria-label={accion.titulo}
          className="w-full rounded-[20px] border border-borde bg-fondo"
        />
      ) : (
        /* Una acción sin vídeo grabado. Se dice, y no se deja un
           rectángulo negro: un hueco negro en una guía es peor que
           no tener guía. */
        <div className="rounded-[20px] border border-borde bg-superficie p-5">
          <p className="t-cuerpo text-tinta-suave">
            Esta todavía no tiene vídeo. Está explicada aquí abajo.
          </p>
        </div>
      )}

      <p className="t-cuerpo text-tinta-suave">{accion.linea}</p>

      <div className="space-y-2.5">
        <BotonPrincipal href={accion.href} icono="flecha">
          Hacerlo ahora
        </BotonPrincipal>

        {siguiente && (
          <BotonSecundario onClick={() => alSiguiente(siguiente.clave)}>
            Siguiente · {siguiente.titulo}
          </BotonSecundario>
        )}

        <BotonSecundario onClick={alCerrar} icono="atras">
          Ver todas
        </BotonSecundario>
      </div>

      <p className="t-apoyo">
        <Link href="/" className="tocable font-bold text-tinta-suave">
          Volver al inicio
        </Link>
      </p>
    </div>
  )
}
