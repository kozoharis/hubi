'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { esDeNoche } from '@/lib/noche'
import { Ico } from '../iconos'
import SubirFoto from './subir-foto'
import type { QuienPinta } from './pizarra'

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

  A partir de las once la pared entera se atenúa (`noche.tsx`). Un
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

export default function Fotos({
  puedeSubir = false,
  /*
    ── A PANTALLA COMPLETA ──

    El descanso de la pared (`descanso.tsx`). Misma pieza y no una
    copia: el carrusel, el fundido de dos capas, el refresco de las
    direcciones firmadas y la regla de que de noche no cambia son
    exactamente los mismos. Dos copias de esto serían dos sitios donde
    arreglar el parpadeo la próxima vez.

    Lo único que cambia es el marco: sin tarjeta, sin borde, sin
    proporción fija — la foto llena lo que haya.
  */
  pantallaCompleta = false,
  /*
    ── LLENANDO EL HUECO QUE LE DEN ──

    En la pared, las fotos van abajo del todo de la primera columna, y
    ahí el alto NO lo decide la foto: lo decide lo que sobre.

    Con la proporción fija de 16 por 10, en una tableta ancha la caja
    salía de más de 550 px de alto, y bastaba con que Android pusiera
    sus dos barras —unos 100 px menos de pantalla— para que la foto no
    cupiera y se cortara contra el borde de abajo. Una foto cortada por
    el borde no parece una decisión: parece una avería.

    Con `alto`, la caja mide lo que le den y la foto se recorta desde
    el centro, que es donde está la gente.
  */
  alto = false,
  /* Los de la casa. Sólo se usan para la pizarra —para preguntar de
     quién es el dibujo—, así que sin ellos el botón sigue estando y el
     dibujo sale sin nombre. */
  gente = [],
}: {
  puedeSubir?: boolean
  pantallaCompleta?: boolean
  alto?: boolean
  gente?: QuienPinta[]
}) {
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
      /* De noche, quieta. La hora la decide `lib/noche.ts`, que es el
         único sitio donde está escrita: antes lo calculaban esta pieza,
         el descanso y el reloj cada uno por su cuenta. */
      if (esDeNoche()) return

      setEncima((e) => !e)
      setCual((c) => (c + 1) % fotos.length)
    }, CADA)

    return () => clearInterval(paso)
  }, [fotos])

  /* Mientras no se sabe, no se pinta nada: un hueco gris esperando en
     una pared es peor que no tener tablón. */
  if (fotos === null) return null

  /* A pantalla completa y sin fotos no se pinta NADA, ni siquiera la
     invitación a poner la primera: el descanso decide por su cuenta si
     tiene sentido aparecer, y sin fotos no lo tiene. */
  if (fotos.length === 0 && pantallaCompleta) return null

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
          <SubirFoto alTerminar={traer} gente={gente} />
        </div>
      </div>
    )
  }

  const anterior = fotos[(cual - 1 + fotos.length) % fotos.length]
  const actual = fotos[cual]

  return (
    <div
      className={
        pantallaCompleta
          ? 'relative h-full w-full overflow-hidden bg-black'
          : `relative overflow-hidden rounded-[28px] border border-borde bg-superficie${
              alto ? ' h-full' : ''
            }`
      }
    >
      {/*
        16 por 10 y no libre: siete fotos de alturas distintas harían
        saltar media pantalla cada veinte segundos. El marco manda y la
        foto se recorta desde el centro, que es donde está la gente.

        A pantalla completa manda la pantalla, que ya tiene su forma.
      */}
      <div
        className={
          pantallaCompleta || alto
            ? 'relative h-full w-full'
            : 'relative aspect-[16/10] w-full'
        }
      >
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
            className={
              pantallaCompleta
                ? 'absolute inset-x-0 bottom-0 px-14 pb-12 pt-32'
                : 'absolute inset-x-0 bottom-0 px-7 pb-5 pt-16'
            }
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,.62), transparent)' }}
          >
            <p
              className={`font-extrabold leading-snug text-white ${
                pantallaCompleta ? 'text-[32px]' : 'text-[22px]'
              }`}
            >
              {actual.pie}
            </p>
          </div>
        )}
      </div>

      {puedeSubir && !pantallaCompleta && (
        <div className="flex flex-wrap justify-end gap-3 px-5 py-4">
          <SubirFoto alTerminar={traer} gente={gente} />
        </div>
      )}
    </div>
  )
}
