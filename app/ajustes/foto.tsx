'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Avatar from '../avatar'
import { Ico } from '../iconos'

/*
  Quién eres: tu foto y tu nombre.

  EL NOMBRE NO SE PODÍA CAMBIAR, Y ESO ERA UN PROBLEMA DE VERDAD.

  Se pone solo al crear la cuenta, sacándolo del correo: de
  "jmnazco@gmail.com" salía "Jmnazco". Y ese nombre está por todas
  partes — el saludo de Inicio, las tarjetas del Tablón, los avisos al
  móvil— y, lo que es peor, es con el que la voz busca a quién va
  dirigida una tarea. Con el nombre mal puesto, "recuérdale a Juan
  Miguel que…" no encontraba a nadie.

  La foto se recorta y se reduce EN EL PROPIO MÓVIL antes de enviarse:
  un cuadrado de 256 px. Una foto del carrete pesa varios megas y aquí
  se ve a 44 px; mandarla entera sería tirar los datos del móvil de
  alguien por la ventana.
*/

const LADO = 256

export default function TuPerfil({
  nombre,
  foto,
}: {
  nombre: string
  foto: string | null
}) {
  const router = useRouter()
  const carrete = useRef<HTMLInputElement>(null)

  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  /* El editor del nombre está cerrado hasta que se pide. Un campo de
     texto siempre abierto invita a tocarlo sin querer, y el nombre es
     de las pocas cosas que casi nunca hay que cambiar. */
  const [editando, setEditando] = useState(false)
  const [escrito, setEscrito] = useState(nombre)

  async function elegida(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return

    setAviso(null)
    setOcupado(true)
    try {
      const pequena = await encoger(archivo)
      await mandarFoto(pequena)
    } catch {
      setAviso('No se ha podido usar esa foto. Prueba con otra.')
    }
    setOcupado(false)
  }

  async function mandarFoto(dato: string | null) {
    const r = await fetch('/api/perfil/foto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foto: dato }),
    })
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setAviso(d.error ?? 'No se ha podido guardar la foto.')
      return
    }
    router.refresh()
  }

  async function quitarFoto() {
    setAviso(null)
    setOcupado(true)
    await mandarFoto(null)
    setOcupado(false)
  }

  async function guardarNombre() {
    const limpio = escrito.trim()
    if (limpio.length < 2) {
      setAviso('Escribe al menos dos letras.')
      return
    }
    if (limpio === nombre) {
      setEditando(false)
      return
    }

    setAviso(null)
    setOcupado(true)

    const r = await fetch('/api/perfil/nombre', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: limpio }),
    })

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setAviso(d.error ?? 'No se ha podido guardar el nombre.')
      setOcupado(false)
      return
    }

    setEditando(false)
    setOcupado(false)
    router.refresh()
  }

  // ── Cambiando el nombre ────────────────────────────────────
  if (editando) {
    return (
      <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
        <label
          htmlFor="tu-nombre"
          className="block text-[15px] font-extrabold tracking-tight"
        >
          ¿Cómo te llamas?
        </label>
        <p className="mt-1 text-[14.5px] font-semibold leading-snug text-tenue">
          Así te saluda HUBI y así te nombra el otro cuando te deja algo.
        </p>

        <input
          id="tu-nombre"
          type="text"
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
          maxLength={40}
          autoFocus
          autoComplete="name"
          autoCapitalize="words"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter') guardarNombre()
          }}
          className="mt-3 h-[58px] w-full rounded-[16px] border border-borde bg-fondo px-4 text-[19px] font-bold text-tinta outline-none focus:border-boton"
        />

        {aviso && (
          <p className="mt-2.5 rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold text-coral">
            {aviso}
          </p>
        )}

        <div className="mt-3 flex gap-2.5">
          <button
            onClick={guardarNombre}
            disabled={ocupado}
            className="h-[56px] flex-1 rounded-[16px] bg-boton text-[17.5px] font-extrabold text-boton-texto disabled:opacity-50"
          >
            {ocupado ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={() => {
              setEscrito(nombre)
              setAviso(null)
              setEditando(false)
            }}
            disabled={ocupado}
            className="h-[56px] flex-1 rounded-[16px] border border-borde text-[17.5px] font-extrabold text-tinta-suave disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // ── Como está ahora ────────────────────────────────────────
  return (
    <div>
      <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar nombre={nombre} foto={foto} tam={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-extrabold">{nombre || 'Tu perfil'}</p>
            <p className="text-[14.5px] font-semibold text-tenue">
              {nombre ? 'Estás usando HUBI' : 'Pon tu nombre y tu foto'}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2.5">
          <button
            onClick={() => {
              setEscrito(nombre)
              setAviso(null)
              setEditando(true)
            }}
            disabled={ocupado}
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[16px] border border-borde text-[15.5px] font-extrabold text-tinta disabled:opacity-50"
          >
            <Ico nombre="lapiz" tam={19} grosor={2.2} />
            Tu nombre
          </button>
          <button
            onClick={() => carrete.current?.click()}
            disabled={ocupado}
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[16px] border border-borde text-[15.5px] font-extrabold text-tinta disabled:opacity-50"
          >
            <Ico nombre="foto" tam={19} grosor={2.2} />
            {ocupado ? '…' : 'Tu foto'}
          </button>
        </div>
      </div>

      {foto && !ocupado && (
        <button onClick={quitarFoto} className="mt-2 h-11 px-1 text-[15px] font-bold text-tenue">
          Quitar la foto
        </button>
      )}

      {aviso && (
        <p className="mt-2 rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold text-coral">
          {aviso}
        </p>
      )}

      <input
        ref={carrete}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={elegida}
        className="hidden"
      />
    </div>
  )
}

/** Recorta el centro en cuadrado y lo deja en 256 px. */
async function encoger(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error('imagen ilegible'))
      i.src = url
    })

    const lado = Math.min(img.naturalWidth, img.naturalHeight)
    const x = (img.naturalWidth - lado) / 2
    const y = (img.naturalHeight - lado) / 2

    const lienzo = document.createElement('canvas')
    lienzo.width = LADO
    lienzo.height = LADO
    const pincel = lienzo.getContext('2d')
    if (!pincel) throw new Error('sin lienzo')
    pincel.drawImage(img, x, y, lado, lado, 0, 0, LADO, LADO)

    return lienzo.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}
