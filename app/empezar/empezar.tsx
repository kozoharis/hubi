'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico, Logo } from '../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  CREAR TU CASA · dos preguntas, una por pantalla
  ═══════════════════════════════════════════════════════════════

  Es lo primero que ve alguien que acaba de entrar en HUBI por primera
  vez, y por tanto lo que decide si se queda. Dos reglas del
  planteamiento mandan aquí más que en ningún otro sitio:

  · Punto 5 — pocas decisiones por pantalla. Las dos preguntas van
    SEPARADAS aunque cupieran juntas. Un formulario con dos campos y
    cuatro botones delante de alguien que aún no sabe qué es esto es
    un formulario que se abandona.

  · Punto 29 — la complejidad la pone el sistema. No se le pregunta
    por categorías, ni por carpetas, ni por Drive. Se le pregunta cómo
    se llama su casa y si lleva cuentas de algo; de ahí sale un árbol
    entero de carpetas y partidas que él no ha tenido que pensar.

  ─────────────────────────────────────────────────────────────
  LO QUE NO SE PREGUNTA AQUÍ: GOOGLE

  A propósito. Pedirle permiso para entrar en su Drive a los treinta
  segundos de conocerte es donde la gente cierra la pestaña. Se le
  ofrece cuando vaya a guardar su primer papel, que es cuando la
  pregunta se explica sola.
*/

type Actividad = 'finca' | 'obra' | 'alquileres' | 'ninguna'

const ACTIVIDADES: { id: Actividad; emoji: string; titulo: string; pie: string }[] = [
  {
    id: 'finca',
    emoji: '🌿',
    titulo: 'Una finca o huerta',
    pie: 'Agua, luz, productos, maquinaria… y lo que se venda.',
  },
  {
    id: 'obra',
    emoji: '🧱',
    titulo: 'Obras o reformas',
    pie: 'Cada obra por separado, con albañilería, carpintería…',
  },
  {
    id: 'alquileres',
    emoji: '🔑',
    titulo: 'Pisos en alquiler',
    pie: 'Cada piso por separado, y lo común repartido.',
  },
  {
    id: 'ninguna',
    emoji: '🏡',
    titulo: 'Nada de eso, solo mi casa',
    pie: 'Papeles, citas, recados y compra. Siempre puedes añadirlo después.',
  },
]

export default function Empezar({ nombre }: { nombre: string }) {
  const router = useRouter()

  const [paso, setPaso] = useState<'nombre' | 'actividad'>('nombre')
  const [comoSeLlama, setComoSeLlama] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function crear(actividad: Actividad) {
    setFallo(null)
    setOcupado(true)

    const r = await fetch('/api/casa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: comoSeLlama.trim(),
        actividad: actividad === 'ninguna' ? null : actividad,
      }),
    })

    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setOcupado(false)
      setFallo(d.error ?? 'No se ha podido crear tu casa.')
      return
    }

    /* `refresh` antes de moverse: el inicio se pinta en el servidor y
       tiene que volver a leer que ahora sí hay casa. Sin esto se
       entraría a un HUBI que todavía cree que no existe. */
    router.refresh()
    router.push('/')
  }

  return (
    <main className="techo-holgado min-h-screen px-6 pb-16">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-center pt-4">
          <Logo tam={54} />
        </div>

        {paso === 'nombre' ? (
          <>
            <h1 className="mt-7 text-[30px] font-extrabold leading-tight tracking-tight">
              Hola, {nombre}
            </h1>
            <p className="mt-2 text-[17px] font-semibold leading-snug text-tenue">
              Vamos a crear tu espacio en HUBI. Son dos preguntas y ya está.
            </p>

            <label htmlFor="casa" className="mt-8 block text-[19px] font-extrabold leading-snug">
              ¿Cómo quieres llamarlo?
            </label>
            <p className="mt-1 text-[16px] font-semibold leading-snug text-tenue">
              Lo que os digáis en casa. «Casa de Marta y Luis», «La finca», «Mi
              despacho».
            </p>

            <input
              id="casa"
              value={comoSeLlama}
              onChange={(e) => setComoSeLlama(e.target.value)}
              placeholder="Casa de Marta y Luis"
              className="entrada mt-4"
              autoFocus
              maxLength={60}
            />

            <button
              onClick={() => {
                setFallo(null)
                setPaso('actividad')
              }}
              disabled={comoSeLlama.trim().length < 2}
              className="mt-5 flex h-[62px] w-full items-center justify-center gap-2 rounded-[16px] bg-boton text-[18px] font-extrabold text-boton-texto disabled:opacity-40"
            >
              Continuar
              <Ico nombre="flecha" tam={20} grosor={2.4} />
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-7 text-[30px] font-extrabold leading-tight tracking-tight">
              ¿Llevas cuentas de algo?
            </h1>
            <p className="mt-2 text-[17px] font-semibold leading-snug text-tenue">
              Si tienes gastos e ingresos de algo concreto, HUBI te lleva las cuentas
              solo con fotografiar las facturas.
            </p>

            <div className="mt-6 space-y-3">
              {ACTIVIDADES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => crear(a.id)}
                  disabled={ocupado}
                  className="flex w-full items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-4 py-4 text-left disabled:opacity-50"
                >
                  <span className="text-[30px] leading-none">{a.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[18px] font-extrabold leading-snug">
                      {a.titulo}
                    </span>
                    <span className="mt-0.5 block text-[15px] font-semibold leading-snug text-tenue">
                      {a.pie}
                    </span>
                  </span>
                  <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0 text-borde" />
                </button>
              ))}
            </div>

            <p className="mt-5 text-center text-[15.5px] font-semibold leading-snug text-tenue">
              Elijas lo que elijas, se puede cambiar después.
            </p>

            <button
              onClick={() => {
                setFallo(null)
                setPaso('nombre')
              }}
              disabled={ocupado}
              className="mt-3 w-full py-3 text-[16px] font-bold text-tinta-suave underline underline-offset-4 disabled:opacity-50"
            >
              Volver
            </button>
          </>
        )}

        {ocupado && (
          <p className="mt-5 text-center text-[16px] font-bold text-tenue">
            Creando tu espacio…
          </p>
        )}

        {fallo && (
          <p className="mt-5 rounded-[16px] bg-coral-suave px-4 py-3.5 text-[16px] font-semibold leading-snug text-coral">
            {fallo}
          </p>
        )}
      </div>
    </main>
  )
}
