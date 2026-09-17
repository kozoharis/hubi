'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Ico } from '../../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  GUARDAR UNA RECETA DESDE LA PARED
  ═══════════════════════════════════════════════════════════════

  Haris: *«tampoco me deja las recetas… y es algo importante»*.

  Y es el mismo error que con el menú, por tercera vez en esta
  pantalla: la pared ENSEÑABA el cajón de recetas, lo abría en una
  ventana, mandaba sus ingredientes a la compra — y no dejaba meter
  ninguna. Hasta el cartel de vacío lo decía: *«se guardan desde el
  móvil»*.

  Que es justo al revés de donde pasa la cosa. Una receta se apunta
  **en la cocina**, que es donde alguien acaba de hacerla y donde está
  la libreta de la abuela encima de la encimera.

  ─────────────────────────────────────────────────────────────
  CUATRO CASILLAS Y SOLO UNA OBLIGATORIA

      Nombre        obligatorio, y nada más.
      Enlace        para el vídeo o la página.
      Cómo se hace  para las que no tienen enlace.
      Lo que lleva  una por renglón.

  Las tres últimas se pueden dejar en blanco y no pasa nada: una receta
  que solo tiene nombre ya sirve para poner la cena del jueves con un
  toque, que es el 90 % de para lo que existe el cajón.

  «Lo que lleva» se escribe una por renglón y se guarda tal cual —
  «medio kilo de harina»— porque de ahí sale el «¿tienes lo que lleva?»
  y el botón de mandarlo a la compra. Partirlo o limpiarlo sería
  inventarse lo que alguien escribió.

  ─────────────────────────────────────────────────────────────
  Y QUITAR RECETAS NO SE PUEDE DESDE AQUÍ, A PROPÓSITO

  Guardar de más no rompe nada: sobra una receta en una lista. Borrar
  en una pantalla que toca cualquiera que entre en la casa sí, y no hay
  manera de deshacerlo. Se quita desde el móvil, que es donde se sabe
  quién está tocando.

  Ninguna ruta nueva: es el mismo `POST /api/menus` que usa el móvil.
*/

export default function GuardarReceta({ cerrar }: { cerrar: () => void }) {
  const router = useRouter()
  const [titulo, setTitulo] = useState('')
  const [url, setUrl] = useState('')
  const [nota, setNota] = useState('')
  const [lleva, setLleva] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function guardar() {
    const nombre = titulo.trim()
    if (nombre.length < 2) return

    setFallo(null)
    setTrabajando(true)

    try {
      const r = await fetch(api('/api/menus'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: nombre,
          url: url.trim(),
          nota: nota.trim(),
          /* Una por renglón. El recorte y los repetidos los quita la
             ruta, que es donde tiene que estar. */
          ingredientes: lleva
            .split('\n')
            .map((i) => i.trim())
            .filter((i) => i.length > 1),
        }),
      })
      const d = (await r.json().catch(() => null)) as { error?: string } | null

      if (!r.ok) {
        setFallo(d?.error ?? 'No se ha podido guardar. Inténtalo otra vez.')
        setTrabajando(false)
        return
      }

      router.refresh()
      cerrar()
    } catch {
      setFallo('No se ha podido guardar. Inténtalo otra vez.')
      setTrabajando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-12 py-12"
      style={{ background: 'rgba(26,23,20,.55)' }}
      onClick={cerrar}
    >
      <div
        className="max-h-full w-full max-w-[880px] overflow-y-auto rounded-[36px] border border-borde bg-fondo px-12 py-10"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">
          Una receta más
        </p>
        <p className="mt-1 text-[36px] font-extrabold leading-tight text-tinta">
          Guardarla en la casa
        </p>

        <Casilla
          id="receta-nombre"
          rotulo="Cómo se llama"
          valor={titulo}
          cambia={setTitulo}
          pista="Lentejas de la abuela"
          tope={120}
          alEntrar={guardar}
        />

        <Casilla
          id="receta-enlace"
          rotulo="Enlace, si lo tiene"
          valor={url}
          cambia={setUrl}
          pista="https://…"
          tope={500}
        />

        <Larga
          id="receta-nota"
          rotulo="Cómo se hace, si no hay enlace"
          valor={nota}
          cambia={setNota}
          filas={4}
          pista="Se ponen a remojo la noche antes…"
        />

        <Larga
          id="receta-lleva"
          rotulo="Lo que lleva · una cosa en cada renglón"
          valor={lleva}
          cambia={setLleva}
          filas={5}
          pista={'Medio kilo de lentejas\nUn chorizo\nDos zanahorias'}
        />

        {fallo && (
          <p className="mt-5 text-[22px] font-bold" style={{ color: 'var(--t-alerta)' }}>
            {fallo}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Boton principal onClick={guardar} desactivado={trabajando || titulo.trim().length < 2}>
            <Ico nombre="check" tam={26} grosor={2.6} />
            {trabajando ? 'Un momento…' : 'Guardarla'}
          </Boton>
          <Boton onClick={cerrar} desactivado={trabajando}>
            Ahora no
          </Boton>
        </div>
      </div>
    </div>
  )
}

/* ── Las piezas, a la talla de la pared ───────────────────── */

function Rotulo({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={id}
      className="mt-7 block text-[19px] font-extrabold uppercase tracking-[0.14em] text-tenue"
    >
      {children}
    </label>
  )
}

function Casilla({
  id,
  rotulo,
  valor,
  cambia,
  pista,
  tope,
  alEntrar,
}: {
  id: string
  rotulo: string
  valor: string
  cambia: (v: string) => void
  pista: string
  tope: number
  alEntrar?: () => void
}) {
  return (
    <>
      <Rotulo id={id}>{rotulo}</Rotulo>
      <input
        id={id}
        value={valor}
        onChange={(e) => cambia(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && alEntrar) alEntrar()
        }}
        maxLength={tope}
        placeholder={pista}
        autoComplete="off"
        className="entrada mt-3 h-[80px] w-full text-[27px] font-extrabold"
      />
    </>
  )
}

function Larga({
  id,
  rotulo,
  valor,
  cambia,
  filas,
  pista,
}: {
  id: string
  rotulo: string
  valor: string
  cambia: (v: string) => void
  filas: number
  pista: string
}) {
  return (
    <>
      <Rotulo id={id}>{rotulo}</Rotulo>
      <textarea
        id={id}
        value={valor}
        onChange={(e) => cambia(e.target.value)}
        rows={filas}
        placeholder={pista}
        className="entrada mt-3 w-full resize-none py-5 text-[23px] font-extrabold leading-snug"
        style={{ height: 'auto' }}
      />
    </>
  )
}

function Boton({
  children,
  onClick,
  principal = false,
  desactivado = false,
}: {
  children: React.ReactNode
  onClick: () => void
  principal?: boolean
  desactivado?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      className="tocable flex items-center justify-center gap-3 rounded-full border px-9 text-[22px] font-extrabold disabled:opacity-45"
      style={{
        minHeight: 72,
        background: principal ? 'var(--t-boton)' : 'var(--t-superficie)',
        color: principal ? 'var(--t-boton-texto)' : 'var(--t-tinta)',
        borderColor: principal ? 'transparent' : 'var(--t-borde)',
      }}
    >
      {children}
    </button>
  )
}
