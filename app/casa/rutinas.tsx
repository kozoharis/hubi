'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAlDia } from '@/lib/al-dia'
import { Ico } from '../iconos'
import { AMBITO } from '../piezas'
import LoQueQuepa from './lo-que-quepa'

/*
  ═══════════════════════════════════════════════════════════════
  LO QUE TOCA HOY · y la pared SÍ puede tacharlo
  ═══════════════════════════════════════════════════════════════

  Regar, sacar la basura, las pastillas de la mañana. Lo que se repite
  cada semana y no hace falta apuntar porque ya está apuntado.

  Esto ya existía en mappel —las tablas `rutinas` y `rutinas_hechas`, con
  su plan semanal— y no salía en la pared. Era de lo que más falta hacía
  ahí: es exactamente lo que se mira al pasar por la cocina.

  ─────────────────────────────────────────────────────────────
  ⚠️  Y ES LA PRIMERA VEZ QUE LA PARED MARCA ALGO COMO HECHO

  Sin tocar un solo permiso. Estaba dado desde el paso 61 y nadie lo
  había usado:

      nivel_por_rol('casa', 'dia')  =  'anadir'

  Y `hechas_marcar` pide `puede(casa,'dia',null,'anadir')`, que para un
  aparato es cierto. O sea que una pantalla de cocina puede marcar y
  desmarcar rutinas, y siempre pudo.

  Conviene entender por qué esto sí y las tareas no. Una rutina **ya
  existe**: marcarla hecha no crea nada, solo dice que hoy se hizo. La
  agenda es otra cosa: darle `anadir` a la pared para que tache le
  permitiría además INVENTAR tareas, y una pared que se saca recados de
  la manga no la quiere nadie. Eso se resolverá por columna, como el
  paso 67.

  ─────────────────────────────────────────────────────────────
  QUIÉN LA MARCÓ NO SE DICE · DE QUIÉN ES, SÍ

  Son dos cosas distintas y la pared solo enseña una.

  **Quién la marcó** no se dice. La base guarda `quien`, y aquí es «la
  pantalla de la cocina», que no es nadie: enseñarlo sería enseñar una
  mentira. Y además, lo que importa en una casa es que la basura está
  sacada, no quién la sacó.

  **De quién es** sí, y faltaba. En una casa de dos personas da igual;
  en una con niños, «17:00 · Inglés» sin decir de quién no sirve de
  nada. Va delante y en pequeño, como el remite de una nota.

  Solo el nombre de pila, y nada cuando es de la casa: «Sacar la
  basura» no es de nadie en concreto, y ponerle una etiqueta «CASA»
  sería ruido en todas las filas para no decir nada.
*/

export type RutinaEnLaPared = {
  id: string
  que: string
  hora: string | null
  hecha: boolean
  /** El nombre de pila de quien la tiene. Vacío = es de la casa. */
  dequien: string | null
}

export default function Rutinas({ rutinas }: { rutinas: RutinaEnLaPared[] }) {
  const router = useRouter()
  /* Igual que en la compra: la copia local se pinta al instante, pero
     vuelve a mirar al servidor cuando llega algo distinto. Si no, una
     rutina tachada desde el móvil no se enteraría aquí jamás — la
     pared se refresca sola sin recargar. Ver `lib/al-dia.ts`. */
  const [locales, setLocales] = useAlDia(
    rutinas,
    rutinas.map((r) => `${r.id}${r.hecha ? '1' : '0'}`).join('|')
  )
  const [fallo, setFallo] = useState<string | null>(null)

  async function tachar(r: RutinaEnLaPared) {
    const antes = r.hecha

    /* Se pinta ya. En una pared, un toque que tarda medio segundo en
       responder se vuelve a dar. */
    setLocales((l) => l.map((x) => (x.id === r.id ? { ...x, hecha: !antes } : x)))
    setFallo(null)

    try {
      const p = await fetch(api('/api/rutinas'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, hecha: !antes }),
      })
      if (!p.ok) throw new Error()
      router.refresh()
    } catch {
      setLocales((l) => l.map((x) => (x.id === r.id ? { ...x, hecha: antes } : x)))
      setFallo('No se ha podido cambiar. Inténtalo otra vez.')
    }
  }

  if (locales.length === 0) return null

  const quedan = locales.filter((r) => !r.hecha).length

  return (
    /*
      Una columna de flex, y no un fragmento suelto.

      Desde que la pared cabe en una pantalla (`layout.tsx`), esta lista
      convive con la de Hoy dentro de la misma columna y las dos se
      reparten el hueco que sobre. Para eso tiene que haber un elemento
      que pueda encoger: `min-h-0` es lo que se lo permite, y sin él un
      hijo de flex no baja de lo que mida su contenido — o sea que el
      recorte de arriba no serviría de nada.
    */
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-baseline gap-4">
        <h2 className="text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">
          Lo de cada día
        </h2>
        <p className="text-[19px] font-extrabold text-tinta-suave">
          {quedan === 0 ? 'Todo hecho' : quedan === 1 ? 'Queda 1' : `Quedan ${quedan}`}
        </p>
      </div>

      {fallo && (
        <p className="mt-3 shrink-0 text-[18px] font-bold" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}

      <div className="h-3 shrink-0" />

      <LoQueQuepa elResto="y {n} más de cada día">
        {locales.map((r) => (
          <div key={r.id}>
            {/*
              Se toca la fila entera, no una casilla. Se hace de pie y
              muchas veces con una mano ocupada: el sitio donde hay que
              dar es el sitio donde está la palabra.
            */}
            <button
              type="button"
              onClick={() => tachar(r)}
              className={`tocable flex w-full items-center gap-5 rounded-[28px] border bg-superficie px-6 py-4 text-left ${
                r.hecha ? 'opacity-45' : ''
              }`}
              style={{
                borderColor: 'var(--t-borde)',
                borderLeft: `6px solid ${r.hecha ? 'var(--t-borde)' : AMBITO.verde}`,
              }}
            >
              <span
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] border-2"
                style={{
                  borderColor: r.hecha ? 'transparent' : 'var(--t-borde)',
                  background: r.hecha ? AMBITO.verde : 'transparent',
                  color: '#FFFFFF',
                }}
              >
                {r.hecha && <Ico nombre="check" tam={26} grosor={2.6} />}
              </span>

              <span className="min-w-0 flex-1">
                {(r.hora || r.dequien) && (
                  <span className="block text-[15px] font-extrabold uppercase tracking-wider text-tenue">
                    {r.hora && <span className="tabular-nums normal-case">{r.hora.slice(0, 5)}</span>}
                    {r.hora && r.dequien && <span className="mx-2">·</span>}
                    {r.dequien}
                  </span>
                )}
                <span
                  className={`block text-[24px] font-extrabold leading-tight text-tinta ${
                    r.hecha ? 'line-through' : ''
                  }`}
                >
                  {r.que}
                </span>
              </span>
            </button>
          </div>
        ))}
      </LoQueQuepa>
    </div>
  )
}
