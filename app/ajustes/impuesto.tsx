'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { comoSeLlama, tipoHabitual, type Impuesto } from '@/lib/impuesto'
import { api } from '@/lib/api'

/*
  ¿Esta casa lleva IGIC o IVA?

  APAGADO DE SERIE, Y ESO NO ES PRUDENCIA: ES EL DISEÑO.

  Juan Miguel y Conchita no facturan a nadie. Para ellos este apartado
  no puede existir — ni una palabra nueva en la pantalla de apuntar, ni
  una línea más en el balance, ni un botón que no sepan para qué es.
  Mientras esté en «ninguno», HUBI se comporta exactamente igual que
  antes de que esto existiera.

  Quien factura lo enciende una vez, y a partir de ahí cada apunte se
  desglosa solo.

  ─────────────────────────────────────────────────────────────
  TRES OPCIONES Y NO UN SÍ/NO

  Porque no es lo mismo. En Canarias es IGIC —general del 7%— y en la
  península IVA —general del 21%—. Un interruptor obligaría a HUBI a
  adivinar cuál, y adivinar el impuesto de alguien es de las cosas que
  no se hacen.
*/
export default function ImpuestoDeLaCasa({ puesto }: { puesto: Impuesto }) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState<Impuesto | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  async function elegir(cual: Impuesto) {
    if (cual === puesto) return
    setFallo(null)
    setOcupado(cual)

    const r = await fetch(api('/api/casa'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ impuesto: cual }),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      error?: string
      detalle?: string
    } | null
    setOcupado(null)

    if (!r.ok || d?.bien !== true) {
      setFallo(d?.detalle ?? d?.error ?? 'No se ha podido cambiar.')
      return
    }
    router.refresh()
  }

  return (
    <>
      <div className="rounded-[20px] border border-borde bg-superficie px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="text-[24px] leading-none">🧾</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-extrabold tracking-tight">
              IGIC o IVA en las facturas
            </span>
            <span className="mt-0.5 block text-[14.5px] font-bold text-tenue">
              {puesto === 'ninguno'
                ? 'Apagado · los apuntes son un solo importe'
                : `${comoSeLlama(puesto)} · general del ${tipoHabitual(puesto)}%`}
            </span>
          </span>
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-2.5">
          {(
            [
              ['ninguno', 'No llevo'],
              ['igic', 'IGIC'],
              ['iva', 'IVA'],
            ] as [Impuesto, string][]
          ).map(([valor, texto]) => {
            const esta = puesto === valor
            return (
              <button
                key={valor}
                onClick={() => elegir(valor)}
                disabled={ocupado !== null}
                aria-pressed={esta}
                className={`flex h-[52px] items-center justify-center rounded-[14px] border-2 px-2 text-[15.5px] font-extrabold leading-tight disabled:opacity-50 ${
                  esta
                    ? 'border-[color:var(--color-accion)] bg-[color:var(--t-bien-velo)] text-tinta'
                    : 'border-borde bg-fondo text-tinta-suave'
                }`}
              >
                {ocupado === valor ? '…' : texto}
              </button>
            )
          })}
        </div>

        {/*
          La frase que evita el susto. Encender esto cambia lo que se ve
          en el balance, y alguien podría temer que le toque los apuntes
          de años anteriores. No se los toca: lo que ya está guardado
          sigue valiendo lo que valía.
        */}
        <p className="mt-3 text-[14.5px] font-semibold leading-snug text-tenue">
          {puesto === 'ninguno'
            ? 'Enciéndelo solo si facturas. Los importes que apuntes seguirán siendo el total; HUBI saca la base y la cuota por su cuenta.'
            : 'Se sigue tecleando el TOTAL de la factura. Lo que ya estaba apuntado no se toca, y cada apunte se puede corregir uno a uno.'}
        </p>
      </div>

      {fallo && (
        <p className="mt-2.5 t-apoyo rounded-[16px] border px-4 py-3"
          style={{ background: 'var(--t-alerta-velo)', borderColor: 'color-mix(in srgb, var(--t-alerta) 45%, transparent)', color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}
    </>
  )
}
