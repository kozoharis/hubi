'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../../../iconos'
import { Aviso } from '../../../piezas'
import { api } from '@/lib/api'

/*
  ═══════════════════════════════════════════════════════════════
  ¿ESTA ACTIVIDAD SE LLEVA POR PARTES?
  ═══════════════════════════════════════════════════════════════

  La finca de Juan Miguel es una sola. La de otro tiene la huerta, la
  viña y el invernadero, y quiere saber cuál le da dinero y cuál se lo
  come. Un reformista tiene ocho obras.

  Hasta hoy este interruptor solo existía en SQL: para decir «mi finca
  la llevo por parcelas» había que llamar a un programador.

  ─────────────────────────────────────────────────────────────
  TRES PREGUNTAS, Y LA TERCERA SOLO CUANDO IMPORTA

  1 · ¿Se divide?
  2 · ¿Cómo llamas a cada una?  → «obra», «parcela», «piso»
  3 · ¿Se reparten los gastos comunes?

  La tercera no sale hasta que la primera está encendida, porque antes
  de eso no significa nada. Y es una pregunta de verdad, no un detalle
  técnico: en Los Helechos repartir la luz entre tres es lo honesto
  —los tres se alquilan igual—; entre una reforma de 40.000 € y un
  baño de 3.000 sería mentir.

  ─────────────────────────────────────────────────────────────
  Y SE DICE QUE APAGARLO NO BORRA NADA

  Ése es el miedo que frena a cualquiera delante de un interruptor
  así. Se dice antes de que lo toque, no después.
*/

export default function Dividir({
  seccionId,
  seccionNombre,
  seDivide,
  palabra,
  reparte,
  cuantas,
}: {
  seccionId: string
  seccionNombre: string
  seDivide: boolean
  /** «el apartamento», «la obra». Con artículo, o vacío. */
  palabra: string | null
  reparte: boolean
  /** Cuántas partes tiene ya, para avisar al apagar. */
  cuantas: number
}) {
  const router = useRouter()

  const [ocupado, setOcupado] = useState(false)
  /* Si se está preguntando por dejar de dividir. Antes lo llevaba el
     diálogo del navegador y no hacía falta guardarlo. */
  const [preguntando, setPreguntando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [editandoPalabra, setEditandoPalabra] = useState(false)
  const [comoSeLlama, setComoSeLlama] = useState(sinArticulo(palabra ?? ''))

  async function guardar(cambios: Record<string, unknown>) {
    setFallo(null)
    setOcupado(true)

    const r = await fetch(api('/api/actividades'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: seccionId, ...cambios }),
    })

    setOcupado(false)
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setFallo(d.error ?? 'No se ha podido guardar.')
      return false
    }
    router.refresh()
    return true
  }

  /*
    Aquí había un `window.confirm()`. La pregunta era buena —decía que
    no se borra nada, que es el miedo real— pero salía en el diálogo
    gris del navegador, con los saltos de línea escritos a mano.

    Ahora se pregunta dentro, debajo del propio botón, y la respuesta
    está donde está la pregunta.
  */
  async function cambiarDivision(nuevo: boolean) {
    if (!nuevo && cuantas > 0) {
      setPreguntando(true)
      return
    }
    await guardar({ usa_unidades: nuevo })
  }

  async function confirmarNoDividir() {
    setPreguntando(false)
    await guardar({ usa_unidades: false })
  }

  async function guardarPalabra() {
    if (comoSeLlama.trim().length < 3) return
    if (await guardar({ palabra_unidad: comoSeLlama.trim() })) setEditandoPalabra(false)
  }

  return (
    <section className="mt-5">
      <h2 className="rotulo">Cómo la llevas</h2>

      {/* ── ¿Se divide? ── */}
      <div className="mt-3 rounded-[20px] border border-borde bg-superficie px-4 py-4">
        <p className="t-tarjeta">¿Llevas {seccionNombre} por partes?</p>
        <p className="t-apoyo mt-1">
          Como una finca con la huerta y la viña, o un reformista con sus obras. Si es
          una sola cosa, déjalo en «No».
        </p>

        <div className="mt-3 flex gap-2">
          <Opcion
            texto="Sí"
            puesta={seDivide}
            alPulsar={() => cambiarDivision(true)}
            ocupado={ocupado}
          />
          <Opcion
            texto="No, es una sola"
            puesta={!seDivide}
            alPulsar={() => cambiarDivision(false)}
            ocupado={ocupado}
          />
        </div>

        {preguntando && (
          <div
            className="mt-3 rounded-[16px] border px-4 py-3.5"
            style={{
              background: 'var(--t-atencion-velo)',
              borderColor: 'color-mix(in srgb, var(--t-atencion) 45%, transparent)',
            }}
          >
            <p className="t-cuerpo font-extrabold" style={{ color: 'var(--t-atencion)' }}>
              ¿Dejar de llevar {seccionNombre} por partes?
            </p>
            <p className="t-apoyo mt-1.5 text-tinta-suave">
              Las {cuantas} que tienes no se borran, y lo apuntado en cada una tampoco.
              Solo dejan de enseñarse — y si vuelves a encenderlo, aparecen igual que
              estaban.
            </p>
            <div className="mt-3 space-y-2">
              <button
                onClick={confirmarNoDividir}
                disabled={ocupado}
                className="t-cuerpo h-[60px] w-full rounded-[16px] font-extrabold disabled:opacity-50"
                style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
              >
                Sí, es una sola
              </button>
              <button
                onClick={() => setPreguntando(false)}
                disabled={ocupado}
                className="t-cuerpo h-[60px] w-full rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta disabled:opacity-50"
              >
                Dejarlo como está
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cómo se llama cada una ── */}
      {seDivide && (
        <div className="mt-2.5 rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="t-tarjeta">¿Cómo llamas a cada una?</p>

          {editandoPalabra ? (
            <>
              <input
                value={comoSeLlama}
                onChange={(e) => setComoSeLlama(e.target.value)}
                placeholder="obra"
                className="entrada mt-2"
                autoFocus
                maxLength={30}
              />
              <p className="t-apoyo mt-2">
                En singular y sin artículo: «obra», «parcela», «piso», «coche». HUBI
                escribe el resto.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={guardarPalabra}
                  disabled={ocupado || comoSeLlama.trim().length < 3}
                  className="t-cuerpo h-[60px] flex-1 rounded-[16px] font-extrabold disabled:opacity-50"
                  style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
                >
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setEditandoPalabra(false)
                    setComoSeLlama(sinArticulo(palabra ?? ''))
                  }}
                  className="t-cuerpo h-[60px] flex-1 rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta"
                >
                  Dejarlo
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="t-apoyo mt-1">
                Aparecerá como <strong className="text-tinta">«+ {nueva(palabra)} {sinArticulo(palabra ?? 'parte')}»</strong> y{' '}
                <strong className="text-tinta">«Cada {sinArticulo(palabra ?? 'parte')}»</strong>.
              </p>
              <button
                onClick={() => setEditandoPalabra(true)}
                className="t-cuerpo mt-3 flex h-[60px] w-full items-center justify-center gap-2 rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta"
              >
                <Ico nombre="lapiz" tam={20} grosor={2.2} />
                Cambiar la palabra
              </button>
            </>
          )}
        </div>
      )}

      {/* ── ¿Se reparte lo común? ── */}
      {seDivide && (
        <div className="mt-2.5 rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="text-[17px] font-extrabold leading-snug">
            Los gastos que no son de ninguna, ¿se reparten?
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-tenue">
            La luz, el seguro, la gestoría. Repartirlos tiene sentido si todas son
            parecidas. Si unas son mucho más grandes que otras, repartir engaña más
            que ayuda.
          </p>

          <div className="mt-3 flex gap-2">
            <Opcion
              texto="Sí, a partes iguales"
              puesta={reparte}
              alPulsar={() => guardar({ reparte_comunes: true })}
              ocupado={ocupado}
            />
            <Opcion
              texto="No"
              puesta={!reparte}
              alPulsar={() => guardar({ reparte_comunes: false })}
              ocupado={ocupado}
            />
          </div>
        </div>
      )}

      {fallo && (
        <div className="mt-3">
          <Aviso titulo="No se ha podido guardar" explicacion={fallo} />
        </div>
      )}
    </section>
  )
}

function Opcion({
  texto,
  puesta,
  alPulsar,
  ocupado,
}: {
  texto: string
  puesta: boolean
  alPulsar: () => void
  ocupado: boolean
}) {
  return (
    <button
      onClick={alPulsar}
      disabled={ocupado}
      aria-pressed={puesta}
      className="flex min-h-[52px] flex-1 items-center justify-center rounded-[14px] px-3 text-center text-[16px] font-extrabold leading-tight disabled:opacity-50"
      style={
        puesta
          ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
          : {
              background: 'var(--t-fondo)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      {texto}
    </button>
  )
}

/** «el apartamento» → «apartamento». */
function sinArticulo(palabra: string): string {
  return palabra.replace(/^(el|la|los|las)\s+/i, '').trim()
}

/** El «Nuevo» o «Nueva» que le toca según su artículo. */
function nueva(palabra: string | null): string {
  return /^el\s/i.test(palabra ?? '') ? 'Nuevo' : 'Nueva'
}
