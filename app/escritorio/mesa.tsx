'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import { Aviso } from '../piezas'
import { Tabla } from '../tabla'
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

  En el resto de MAPPEL no hay tablas: hay tarjetas grandes, pocas por
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

  /*
    ═══════════════════════════════════════════════════════════════
    ORDENAR POR COLUMNA · AQUÍ SÍ, Y AQUÍ SOLO
    ═══════════════════════════════════════════════════════════════

    En ninguna otra pantalla de MAPPEL se puede ordenar una lista, y
    está bien que así sea: en Papeles o en Cuentas el orden correcto
    es uno —lo último arriba— y ofrecer cinco maneras de ordenarlo
    sería cinco decisiones a cambio de nada.

    Aquí es distinto porque aquí hay una pregunta que el orden por
    defecto no contesta: **¿cuál lleva más tiempo callada?** Esa es la
    casa que se está perdiendo, y con quince filas ordenadas por lo
    que te esperan no hay manera de verla.

    Tres columnas ordenables y ninguna más. El nombre no lo es: para
    buscar una casa por su nombre están las quince delante.
  */
  const [porDonde, setPorDonde] = useState<'espera' | 'ultimo' | 'balance'>('espera')

  const puestas = [...casas].sort((a, b) => {
    if (porDonde === 'ultimo') {
      /* Sin papeles nunca va PRIMERA, no última: es el caso más
         llamativo de «lleva tiempo callada», no el menos. */
      const ta = a.ultimoPapel ?? ''
      const tb = b.ultimoPapel ?? ''
      if (ta !== tb) return ta.localeCompare(tb)
      return a.nombre.localeCompare(b.nombre, 'es')
    }
    if (porDonde === 'balance') {
      if (a.balance !== b.balance) return a.balance - b.balance
      return a.nombre.localeCompare(b.nombre, 'es')
    }
    if (a.esperando !== b.esperando) return b.esperando - a.esperando
    return a.nombre.localeCompare(b.nombre, 'es')
  })

  return (
    <>
      {fallo && (
        <div className="mb-4">
          <Aviso tono="alerta" titulo={fallo} />
        </div>
      )}

      {/*
        ═══════════════════════════════════════════════════════════
        EN GRANDE, LA TABLA DEL SISTEMA
        ═══════════════════════════════════════════════════════════

        La misma pieza que Papeles y Cuentas, y por el mismo motivo:
        aquí se viene a COMPARAR quince casas, y comparar exige que las
        cosas estén alineadas.

        Lo que cambia respecto a lo que había: las columnas se separan
        de verdad. «Tu papel» y «Papeles» estaban metidos en la segunda
        línea del nombre —«Asesor · 34 papeles»— y así no se pueden
        comparar: hay que leer quince frases para saber en cuáles eres
        asesor.

        Y es la ÚNICA pantalla del producto con densidad de trabajo:
        filas de 48 y hueco de 8. Aun así el nombre de la casa va a 16
        px y los objetivos siguen en 44 — la densidad quita aire, nunca
        tamaño de letra.
      */}
      <div className="denso-trabajo">
        <Tabla
          columnas="minmax(0,1fr) 110px 90px 140px 130px 120px"
          cabecera={[
            'La casa',
            'Tu papel',
            <span key="p" className="block text-right">Papeles</span>,
            <Ordenar
              key="u"
              texto="Último papel"
              puesta={porDonde === 'ultimo'}
              alPulsar={() => setPorDonde('ultimo')}
            />,
            <Ordenar
              key="e"
              texto="Te espera"
              puesta={porDonde === 'espera'}
              alPulsar={() => setPorDonde('espera')}
            />,
            <Ordenar
              key="b"
              texto="Este trimestre"
              derecha
              puesta={porDonde === 'balance'}
              alPulsar={() => setPorDonde('balance')}
            />,
          ]}
          pie="Pulsa una casa para entrar en ella. Sus papeles y sus cuentas siguen dentro: aquí solo se cuentan."
        >
          {puestas.map((c) => {
            const debe = c.esperando > 0
            return (
              /*
                ── LA ANATOMÍA DE UNA FILA ──

                En reposo  blanco, una línea casi invisible debajo.
                           Nada dice que sea pulsable hasta acercarse.
                Al pasar   fondo de papel y el puntero en mano. Con el
                           dedo este estado no existe: `.roza` va
                           dentro de `(pointer: fine)`.
                Al pulsar  ENTRA en la casa. La pantalla cambia a la
                           suya y el rail se enciende entero.

                Y ningún control más: ni casillas, ni botones que
                aparecen al pasar, ni tres puntitos. Una fila es una
                casa y pulsarla es entrar en ella.
              */
              <button
                key={c.id}
                onClick={() => entrar(c.id)}
                disabled={yendo !== null}
                className="fila-lista roza grid w-full items-center gap-x-7 border-b border-borde/60 px-4 py-2 text-left text-[15px] transition-colors last:border-b-0"
                style={{
                  gridTemplateColumns: 'var(--columnas)',
                  opacity: yendo && yendo !== c.id ? 0.5 : 1,
                }}
              >
                <span className="min-w-0 truncate text-[16px] font-semibold">{c.nombre}</span>
                <span className="truncate text-[13px] text-tenue">{nombreDelRol(c.rol)}</span>
                <span className="truncate text-right text-[13px] tabular-nums text-tenue">
                  {c.papeles === 0 ? '—' : c.papeles}
                </span>
                {/* «Hace tres semanas» y no «14/08»: en quince casas
                    nadie compara fechas de un vistazo, y lo que se
                    busca es cuál lleva más tiempo callada. */}
                <span className="truncate text-[13px] text-tenue">
                  {haceCuanto(c.ultimoPapel, hoy)}
                </span>
                {/* La única columna en ámbar, y solo cuando hay algo.
                    Un cero en color de aviso todos los días enseña a no
                    mirar la columna. */}
                <span className="truncate text-[13px] font-bold">
                  {debe ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                      style={{
                        background: 'var(--t-atencion-velo)',
                        color: 'var(--t-atencion)',
                      }}
                    >
                      <Ico nombre="campana" tam={13} grosor={2.4} />
                      {c.esperando} {c.esperando === 1 ? 'cosa' : 'cosas'}
                    </span>
                  ) : (
                    <span className="text-apagado">Nada</span>
                  )}
                </span>
                <span
                  className="truncate text-right font-bold tabular-nums"
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
              </button>
            )
          })}
        </Tabla>
      </div>

      {/* ── Y en el móvil, la lista de siempre ── */}
      <ul className="space-y-2 lg:hidden">
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
                <span className="min-w-0 flex-1">
                  <span className="t-tarjeta block truncate">{c.nombre}</span>
                  <span className="t-apoyo mt-0.5 block truncate">
                    {nombreDelRol(c.rol)} · {c.papeles}{' '}
                    {c.papeles === 1 ? 'papel' : 'papeles'}
                  </span>
                </span>

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

                <span className="w-full md:w-[130px]">
                  <span className="rotulo mb-0.5 block md:hidden">Último papel</span>
                  <span className="t-apoyo">{haceCuanto(c.ultimoPapel, hoy)}</span>
                </span>

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

      <p className="t-apoyo mt-4 lg:hidden">
        Toca una casa para entrar en ella. Los papeles y las cuentas de cada una
        siguen dentro: aquí solo se cuentan.
      </p>
    </>
  )
}

/*
  UN RÓTULO DE COLUMNA QUE ADEMÁS ORDENA.

  Del mismo tamaño y el mismo gris que los que no ordenan: la
  diferencia la marca la flecha, que aparece sólo en la columna por la
  que está ordenado. Tres rótulos subrayados y con flechita gris en
  una cabecera de seis columnas convertirían la tabla en una hoja de
  cálculo, que es de lo que esta pantalla huye.
*/
function Ordenar({
  texto,
  puesta,
  alPulsar,
  derecha = false,
}: {
  texto: string
  puesta: boolean
  alPulsar: () => void
  derecha?: boolean
}) {
  return (
    <button
      onClick={alPulsar}
      aria-pressed={puesta}
      className={
        'flex w-full items-center gap-1 text-[10px] font-bold uppercase leading-none tracking-[0.14em] ' +
        (derecha ? 'justify-end ' : '') +
        (puesta ? 'text-tinta' : 'text-apagado')
      }
    >
      {texto}
      {puesta && <span aria-hidden>↓</span>}
    </button>
  )
}
