'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../../iconos'

/*
  ¿ESTO SE VE EN LA PANTALLA DE LA COCINA?

  Va aquí, en la ficha de la tarea, y NO en el formulario de crearla.
  Dos reglas del proyecto lo piden: «formularios mínimos» y «pocas
  decisiones por pantalla». Preguntarlo al apuntar cada recado convierte
  una decisión rara en un peaje diario.

  Aquí, en cambio, se decide MIRANDO la cosa —con su título, su fecha y
  su nota delante—, que es cuando se puede decidir bien.

  Y esto no lo pinta nadie si la casa no tiene una pantalla común: lo
  decide la página, que es la que sabe si hay algún miembro con
  `clase = 'dispositivo'`.
*/
export default function EnLaCocina({
  id,
  inicial,
}: {
  id: string
  /** `null` es «no se ha decidido», y se lee como que NO se enseña. */
  inicial: boolean | null
}) {
  const [valor, setValor] = useState<boolean | null>(inicial)
  const [fallo, setFallo] = useState<string | null>(null)
  const [enCurso, empezar] = useTransition()
  const router = useRouter()

  const seVe = valor === true

  function cambiar() {
    const antes = valor
    const nuevo = !seVe

    /* Se pinta ya. Si falla, se vuelve — y se dice. Una pantalla que
       miente sobre lo que ha guardado es peor que una lenta. */
    setValor(nuevo)
    setFallo(null)

    empezar(async () => {
      try {
        const r = await fetch(`/api/recordatorios/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visible_en_casa: nuevo }),
        })
        if (!r.ok) throw new Error(String(r.status))
        router.refresh()
      } catch {
        setValor(antes)
        setFallo('No se ha podido cambiar. Inténtalo otra vez.')
      }
    })
  }

  return (
    <section className="mt-6 rounded-[24px] bg-superficie p-7">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-tenue">
        La pantalla de la casa
      </h2>

      <p className="mt-3 text-xl leading-relaxed text-tinta">
        {seVe
          ? 'Esto se ve en la pantalla de la cocina.'
          : 'Esto no se ve en la pantalla de la cocina.'}
      </p>

      <button
        type="button"
        onClick={cambiar}
        disabled={enCurso}
        aria-pressed={seVe}
        className="mt-5 flex w-full items-center justify-center gap-3 rounded-[18px] border-2 border-borde bg-fondo px-6 py-5 text-lg font-extrabold text-tinta disabled:opacity-60"
      >
        <Ico nombre={seVe ? 'candado' : 'gente'} tam={22} grosor={2.2} />
        {seVe ? 'Dejar de verse ahí' : 'Que se vea ahí'}
      </button>

      {fallo && (
        <p className="mt-4 text-base" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}
    </section>
  )
}
