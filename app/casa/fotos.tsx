'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Ico } from '../iconos'
import SubirFoto from './subir-foto'

/*
  ═══════════════════════════════════════════════════════════════
  EL TABLÓN DE FOTOS · lo que hace que esta pantalla se mire
  ═══════════════════════════════════════════════════════════════

  Una pantalla que solo informa se vuelve mobiliario. Una que además
  enseña a la familia se mira, y una pantalla que se mira es una
  pantalla que sirve para lo demás.

  ─────────────────────────────────────────────────────────────
  CADA VEINTE SEGUNDOS, Y SIN CONTROLES

  Ni flechas, ni puntitos, ni pausa. Una pared no se pasa a mano: eso es
  un álbum, y para eso está el teléfono. Aquí la foto cambia sola y la
  única decisión que hay delante es mirarla o no.

  Veinte segundos: lo bastante para verla de verdad al pasar por la
  cocina, y lo bastante poco para que quien esté fregando vea tres o
  cuatro.

  ─────────────────────────────────────────────────────────────
  ⚠️  DE NOCHE NO PASA

  A partir de las once la pared entera se atenúa (`reloj.tsx`). Un
  carrusel cambiando en una cocina a oscuras no es una foto: es una luz
  que parpadea, y de las que se ven desde el pasillo.

  Así que de noche se queda quieto en la que esté. No se apaga —una
  pared en negro parece estropeada— : se queda.

  ─────────────────────────────────────────────────────────────
  Y EL FUNDIDO ES DE VERDAD, CON DOS CAPAS

  Se pintan las dos fotos, una encima de otra, y se cruza la opacidad.
  Cambiar el `src` de una sola imagen hace un parpadeo en blanco
  mientras carga la siguiente — pequeño en un móvil, imposible de no ver
  en una pared de 27 pulgadas.
*/

type Foto = { id: string; url: string; pie: string | null }

const CADA = 20_000

export default function Fotos({ puedeSubir = false }: { puedeSubir?: boolean }) {
  const [fotos, setFotos] = useState<Foto[] | null>(null)
  const [cual, setCual] = useState(0)
  const [encima, setEncima] = useState(true)

  /* Para no montar dos veces el mismo temporizador en desarrollo. */
  const vivo = useRef(true)

  async function traer() {
    try {
      const r = await fetch(api('/api/fotos'))
      const d = (await r.json()) as { fotos?: Foto[] }
      if (!vivo.current) return
      setFotos((d.fotos ?? []).filter((f) => f.url))
    } catch {
      if (vivo.current) setFotos([])
    }
  }

  useEffect(() => {
    vivo.current = true
    traer()

    /* Las direcciones firmadas caducan a las dos horas, así que se
       vuelven a pedir cada hora. Y de paso entran las nuevas. */
    const refresco = setInterval(traer, 60 * 60_000)

    return () => {
      vivo.current = false
      clearInterval(refresco)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!fotos || fotos.length < 2) return

    const paso = setInterval(() => {
      const h = new Date().getHours()
      /* De noche, quieta. La misma hora que usa `reloj.tsx` para bajar
         el brillo — están en dos sitios y tienen que decir lo mismo. */
      if (h >= 23 || h < 7) return

      setEncima((e) => !e)
      setCual((c) => (c + 1) % fotos.length)
    }, CADA)

    return () => clearInterval(paso)
  }, [fotos])

  /* Mientras no se sabe, no se pinta nada: un hueco gris esperando en
     una pared es peor que no tener tablón. */
  if (fotos === null) return null

  if (fotos.length === 0) {
    /* Sin fotos, solo tiene sentido enseñar algo si desde aquí se puede
       poner la primera. Si no, esta esquina no existe. */
    if (!puedeSubir) return null

    return (
      <div className="rounded-[28px] border border-borde bg-superficie px-8 py-10 text-center">
        <span className="inline-flex text-apagado">
          <Ico nombre="foto" tam={40} grosor={1.9} />
        </span>
        <p className="mt-4 text-[22px] font-extrabold leading-snug text-tinta-suave">
          Aquí pueden ir fotos de la familia.
        </p>
        <div className="mt-6 flex justify-center">
          <SubirFoto alTerminar={traer} />
        </div>
      </div>
    )
  }

  const anterior = fotos[(cual - 1 + fotos.length) % fotos.length]
  const actual = fotos[cual]

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-borde bg-superficie">
      {/*
        16 por 10 y no libre: siete fotos de alturas distintas harían
        saltar media pantalla cada veinte segundos. El marco manda y la
        foto se recorta desde el centro, que es donde está la gente.
      */}
      <div className="relative aspect-[16/10] w-full">
        {[anterior, actual].map((f, i) => {
          /* La de abajo y la de encima se turnan para que el fundido
             cruce siempre en el mismo sentido. */
          const visible = i === 1 ? encima : !encima
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${f.id}-${i}`}
              src={f.url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms]"
              style={{ opacity: visible ? 1 : 0 }}
            />
          )
        })}

        {actual.pie && (
          /* El pie, sobre un degradado y no sobre la foto a pelo: en una
             foto de playa el texto blanco desaparece. */
          <div
            className="absolute inset-x-0 bottom-0 px-7 pb-5 pt-16"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,.62), transparent)' }}
          >
            <p className="text-[22px] font-extrabold leading-snug text-white">{actual.pie}</p>
          </div>
        )}
      </div>

      {puedeSubir && (
        <div className="flex justify-end px-5 py-4">
          <SubirFoto alTerminar={traer} />
        </div>
      )}
    </div>
  )
}
