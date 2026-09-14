'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { encoger } from '@/lib/encoger'
import { Ico } from '../../iconos'
import { Aviso, BotonPrincipal } from '../../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  LAS FOTOS DE LA PARED, DESDE EL MÓVIL
  ═══════════════════════════════════════════════════════════════

  La otra mitad de lo que se pidió: que cualquiera de la familia pueda
  mandar una foto a la pantalla de la cocina desde su teléfono.

  Va aquí, en Ajustes → La cocina, junto a lo demás que se decide sobre
  esa pantalla. No en una sección nueva: quien quiere cambiar lo que se
  ve en la cocina ya sabe venir a este sitio.

  ─────────────────────────────────────────────────────────────
  AQUÍ SÍ SE PUEDEN QUITAR, Y EN LA PARED NO

  No es una asimetría por descuido: es la decisión del paso 73. Una
  pantalla colgada, a la que llega cualquiera que entre en la casa, no
  puede hacer desaparecer una foto de la familia a un toque de
  distancia. Desde el móvil de alguien que vive aquí, sí.

  ─────────────────────────────────────────────────────────────
  Y NO SE VE SI LA CASA NO TIENE PANTALLA

  Lo decide la página de arriba, que es la que sabe si hay algún miembro
  con `clase = 'dispositivo'`. Subir fotos para una pared que no existe
  es una sección que no significa nada.
*/

type Foto = { id: string; url: string; pie: string | null }

export default function Fotos() {
  const campo = useRef<HTMLInputElement>(null)
  const [fotos, setFotos] = useState<Foto[] | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function traer() {
    try {
      const r = await fetch(api('/api/fotos'))
      const d = (await r.json()) as { fotos?: Foto[] }
      setFotos(d.fotos ?? [])
    } catch {
      setFotos([])
    }
  }

  useEffect(() => {
    traer()
  }, [])

  async function elegida(e: React.ChangeEvent<HTMLInputElement>) {
    const fichero = e.target.files?.[0]
    /* Se vacía enseguida: sin esto, elegir la MISMA foto dos veces
       seguidas no dispara el evento y parece que no ha hecho nada. */
    e.target.value = ''
    if (!fichero) return

    setFallo(null)
    setOcupado(true)

    try {
      const lista = await encoger(fichero)
      const paquete = new FormData()
      paquete.append('foto', lista)

      const r = await fetch(api('/api/fotos'), { method: 'POST', body: paquete })
      const d = (await r.json().catch(() => null)) as { error?: string; detalle?: string } | null

      if (!r.ok) {
        setFallo([d?.error ?? 'No se ha podido guardar.', d?.detalle].filter(Boolean).join(' · '))
      } else {
        await traer()
      }
    } catch {
      setFallo('No se ha podido guardar la foto.')
    } finally {
      setOcupado(false)
    }
  }

  async function quitar(id: string) {
    setFallo(null)
    /* Se quita de la pantalla ya. Si falla, vuelve — y se dice. */
    setFotos((f) => (f ?? []).filter((x) => x.id !== id))

    try {
      const r = await fetch(api('/api/fotos'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!r.ok) throw new Error()
    } catch {
      setFallo('No se ha podido quitar. Inténtalo otra vez.')
      await traer()
    }
  }

  return (
    <section className="mt-8">
      <h2 className="rotulo">Fotos en la cocina</h2>
      <p className="mt-1 text-[14.5px] font-semibold leading-snug text-tenue">
        Van pasando en la pantalla. Las ve quien vive aquí y la propia pantalla — no la ayuda
        ni el asesor.
      </p>

      <input
        ref={campo}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={elegida}
        className="hidden"
      />

      <div className="mt-3.5">
        <BotonPrincipal
          onClick={() => campo.current?.click()}
          desactivado={ocupado}
          icono="foto"
          ancho="completo"
        >
          {ocupado ? 'Guardando…' : 'Añadir una foto'}
        </BotonPrincipal>
      </div>

      {fallo && (
        <div className="mt-3">
          <Aviso titulo="No se ha podido" explicacion={fallo} />
        </div>
      )}

      {fotos && fotos.length > 0 && (
        /*
          Cuadrículas de tres en el móvil. Una foto por fila sería una
          lista larguísima de deslizar para algo que se reconoce con un
          vistazo.
        */
        <ul className="mt-4 grid grid-cols-3 gap-2.5">
          {fotos.map((f) => (
            <li key={f.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url}
                alt={f.pie ?? ''}
                className="aspect-square w-full rounded-[16px] border border-borde object-cover"
              />
              {/*
                El botón de quitar, encima y arriba a la derecha. 44 px,
                que es lo que pide el suelo de MAPPEL, aunque el dibujo sea
                pequeño: lo que importa es el sitio donde se puede dar,
                no el tamaño de la cruz.
              */}
              <button
                type="button"
                onClick={() => quitar(f.id)}
                aria-label="Quitar esta foto"
                className="absolute right-1 top-1 flex h-[44px] w-[44px] items-center justify-center"
              >
                <span
                  className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-white"
                  style={{ background: 'rgba(0,0,0,.55)' }}
                >
                  <Ico nombre="mas" tam={18} grosor={2.6} className="rotate-45" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {fotos && fotos.length === 0 && (
        <p className="mt-3.5 text-[15px] font-semibold text-tenue">
          Todavía no hay ninguna.
        </p>
      )}
    </section>
  )
}
