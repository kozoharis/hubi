'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import { Aviso } from '../piezas'
import { euros } from '@/lib/periodos'
import { nombreDelRol } from '@/lib/roles'
import { haceCuanto, type CasaEnLaMesa } from '@/lib/escritorio'
import { api, laPuertaDe } from '@/lib/api'

/*
  ═══════════════════════════════════════════════════════════════
  LA MESA
  ═══════════════════════════════════════════════════════════════

  Una fila por casa. Se toca y entras en ella.

  ─────────────────────────────────────────────────────────────
  ES UNA TABLA, Y ESO AQUÍ ESTÁ BIEN

  En el resto de HUBI no hay tablas: hay tarjetas grandes, pocas por
  pantalla, con mucho aire. Es lo correcto cuando lo que se hace es
  UNA cosa.

  Aquí lo que se hace es COMPARAR quince, y comparar es exactamente lo
  que una tabla sabe hacer y una lista de tarjetas no: la columna del
  trimestre alineada te dice cuál va mal sin leer ninguna, y la de
  «esperando» te dice a quién hay que llamar hoy.

  Poner tarjetas grandes aquí sería aplicar la regla de la casa en el
  único sitio donde no aplica.

  ─────────────────────────────────────────────────────────────
  EN EL MÓVIL SE APILA, PERO NO ES SU SITIO

  Funciona —las columnas se convierten en renglones— y así nadie se
  queda fuera si abre el enlace en el teléfono. Pero esta pantalla se
  hizo porque desde el móvil el trabajo era imposible: su sitio es el
  ordenador y la tableta.

  ─────────────────────────────────────────────────────────────
  Y EL ORDEN NO ES ALFABÉTICO

  Primero las que te esperan. Una tabla ordenada por nombre obliga a
  leerla entera todos los días para encontrar lo mismo: las tres que
  te deben algo. Ordenada por lo que falta, lo urgente está siempre
  en el mismo sitio — arriba.
*/
export default function Mesa({ casas, hoy }: { casas: CasaEnLaMesa[]; hoy: string }) {
  const router = useRouter()
  const [yendo, setYendo] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const puestas = [...casas].sort((a, b) => {
    if (a.esperando !== b.esperando) return b.esperando - a.esperando
    return a.nombre.localeCompare(b.nombre, 'es')
  })

  async function entrar(casa: string) {
    setFallo(null)
    setYendo(casa)

    const r = await fetch(api('/api/casas'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ casa, que: 'mirar' }),
    })

    const d = (await r.json().catch(() => null)) as { bien?: boolean; error?: string } | null

    /* La regla de la casa: no basta con que la respuesta sea correcta,
       tiene que DECIR que ha ido bien. Un 200 solo significa que algo
       contestó — y aquí lo que contestaría sería la página de entrar. */
    if (!r.ok || d?.bien !== true) {
      setYendo(null)
      setFallo(d?.error ?? 'No se ha podido entrar en esa casa.')
      return
    }

    /*
      A la dirección del espacio, no a `/` a secas.

      Ésta es la diferencia de todo el paso 3: la pestaña se queda
      apuntando a ESTE cliente. Puedes abrir otro en otra pestaña y no
      se pisan — antes mandaba el último que hubieras tocado.
    */
    router.push(laPuertaDe(casa))
  }

  return (
    <>
      {fallo && (
        <div className="mb-4">
          <Aviso tono="alerta" titulo={fallo} />
        </div>
      )}

      {/* Los rótulos de las columnas, solo cuando hay columnas. */}
      <div className="hidden items-end gap-4 px-4 pb-2 md:flex">
        <span className="rotulo flex-1">La casa</span>
        <span className="rotulo w-[150px]">Te espera</span>
        <span className="rotulo w-[130px]">Último papel</span>
        <span className="rotulo w-[130px] text-right">Este trimestre</span>
        <span className="w-5" />
      </div>

      <ul className="space-y-2">
        {puestas.map((c) => {
          const debe = c.esperando > 0
          return (
            <li key={c.id}>
              <button
                onClick={() => entrar(c.id)}
                disabled={yendo !== null}
                className="tocable flex w-full flex-col items-start gap-2 rounded-[20px] border border-borde bg-superficie px-4 py-3.5 text-left md:flex-row md:items-center md:gap-4"
                style={{ opacity: yendo && yendo !== c.id ? 0.5 : 1 }}
              >
                {/* ── La casa ── */}
                <span className="min-w-0 flex-1">
                  <span className="t-tarjeta block truncate">{c.nombre}</span>
                  <span className="t-apoyo mt-0.5 block truncate">
                    {nombreDelRol(c.rol)} · {c.papeles}{' '}
                    {c.papeles === 1 ? 'papel' : 'papeles'}
                  </span>
                </span>

                {/* ── Lo que te espera ──
                    En rojo solo cuando hay algo. Un cero en color de
                    alarma todos los días enseña a no mirar la columna. */}
                <span className="w-full md:w-[150px]">
                  <span className="rotulo mb-0.5 block md:hidden">Te espera</span>
                  {debe ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[14px] font-extrabold"
                      style={{
                        background: 'var(--t-atencion-velo)',
                        color: 'var(--t-atencion)',
                      }}
                    >
                      <Ico nombre="campana" tam={15} grosor={2.4} />
                      {c.esperando} {c.esperando === 1 ? 'cosa' : 'cosas'}
                    </span>
                  ) : (
                    <span className="t-apoyo">Nada</span>
                  )}
                </span>

                {/* ── Cuándo llegó el último papel ──
                    «Hace tres semanas» y no «14/08»: en quince casas
                    nadie compara fechas de un vistazo, y lo que se
                    busca es justo cuál lleva más tiempo callada. */}
                <span className="w-full md:w-[130px]">
                  <span className="rotulo mb-0.5 block md:hidden">Último papel</span>
                  <span className="t-apoyo">{haceCuanto(c.ultimoPapel, hoy)}</span>
                </span>

                {/* ── El trimestre ── */}
                <span className="w-full md:w-[130px] md:text-right">
                  <span className="rotulo mb-0.5 block md:hidden">Este trimestre</span>
                  <span
                    className="t-cifra-2"
                    style={{
                      color:
                        c.balance > 0
                          ? 'var(--t-bien)'
                          : c.balance < 0
                            ? 'var(--t-alerta)'
                            : 'var(--t-tenue)',
                    }}
                  >
                    {c.ingresos === 0 && c.gastos === 0 ? '—' : euros(c.balance, true)}
                  </span>
                </span>

                <Ico
                  nombre="flecha"
                  tam={20}
                  grosor={2.2}
                  className="hidden shrink-0 md:block"
                />
              </button>
            </li>
          )
        })}
      </ul>

      <p className="t-apoyo mt-4">
        Toca una casa para entrar en ella. Los papeles y las cuentas de cada una
        siguen dentro: aquí solo se cuentan.
      </p>
    </>
  )
}
