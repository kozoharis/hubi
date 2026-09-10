'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico } from '../iconos'
import {
  ambitoDeColor,
  AMBITO,
  Aviso,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  PastillaAmbito,
  Pildora,
  Tarjeta,
} from '../piezas'
import { enHoras } from '@/lib/dia'

/*
  ═══════════════════════════════════════════════════════════════
  LAS HORAS DE MÁS
  ═══════════════════════════════════════════════════════════════

  ─────────────────────────────────────────────────────────────
  LO NORMAL NO SE APUNTA. ESTO ES LO QUE CAMBIA TODO.

  Aquí antes se preguntaba «¿cuántas horas has estado hoy?», y estaba
  mal planteado. El horario está acordado —viene lunes, miércoles y
  viernes de nueve a una— y eso no cambia: pedirle que lo escriba cada
  día es dar trabajo a cambio de un dato que ya saben los dos.

  Lo que hay que apuntar es lo que se SALE de lo acordado: el día que
  se quedó una hora más. Eso es lo que a fin de mes hay que cuadrar, y
  es justo lo que se olvida.

  Y el efecto es el que importa: el estado normal pasa a ser NO
  ESCRIBIR NADA. Un campo que hay que rellenar todos los días se
  rellena mal a la tercera semana; uno que solo se toca los días raros
  se toca los días raros.

  ─────────────────────────────────────────────────────────────
  LO ESCRIBE ELLA. A LOS DEMÁS SE LES ENSEÑA.

  No es una cortesía de la pantalla: las políticas del SQL 41 dicen
  exactamente lo mismo, así que si aquí saliera un formulario para la
  familia, fallaría al guardar y nadie entendería por qué.

  Es lo único que hace que el número valga algo. Un parte que el
  empleador puede escribir no es el parte de ella.

  ─────────────────────────────────────────────────────────────
  Y SE DICE LO QUE ES, EN LA PANTALLA

  «Apuntes para cuadrar el mes», no un registro de jornada. Un
  registro de jornada tiene requisitos legales que HUBI no cumple, y
  dejar que alguien crea que sí los cumple sería lo peor que podemos
  hacer aquí.
*/

export default function Parte({
  deQuien,
  color,
  fecha,
  esHoy,
  mio,
  parte,
  extraDelMes,
  diasConExtra,
}: {
  deQuien: string
  color: string
  fecha: string
  esHoy: boolean
  /** ¿Es mi parte? Solo entonces se puede escribir. */
  mio: boolean
  parte: { extra: number | null; nota: string | null }
  extraDelMes: number
  diasConExtra: number
}) {
  const router = useRouter()

  const [extra, setExtra] = useState<number | null>(parte.extra)
  const [nota, setNota] = useState(parte.nota ?? '')
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const cambiado = extra !== parte.extra || nota !== (parte.nota ?? '')
  const diaNormal = parte.extra == null && !parte.nota

  /* Su color, dicho en el idioma de las piezas. */
  const suyo = ambitoDeColor(color)

  function mover(paso: number) {
    setExtra((h) => {
      const n = Math.round(((h ?? 0) + paso) * 4) / 4
      return n <= 0 ? null : Math.min(12, n)
    })
  }

  async function guardar() {
    setFallo(null)
    setOcupado(true)

    const r = await fetch('/api/dia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, extra, nota: nota.trim() || null }),
    })

    const d = (await r.json().catch(() => null)) as {
      bien?: boolean
      error?: string
      detalle?: string
    } | null

    setOcupado(false)

    if (!r.ok || d?.bien !== true) {
      setFallo(
        d
          ? [d.error ?? 'No se ha podido guardar.', d.detalle].filter(Boolean).join(' · ')
          : 'HUBI no ha llegado a intentarlo. Avisa a quien lo mantiene.'
      )
      return
    }

    setAbierto(false)
    router.refresh()
  }

  // ══ Lo que ve la familia: el parte, sin poder tocarlo ══════
  if (!mio) {
    return (
      <section className="mt-6">
        <h2 className="t-seccion">El día de {deQuien}</h2>

        {diaNormal ? (
          /* Un día sin nada apuntado NO es un día sin información: es
             un día normal, que es la mayoría. Se dice así en vez de
             dejar un hueco que parece que falta algo. */
          <div className="mt-2.5">
            <Tarjeta>
              <p className="t-cuerpo text-tenue">Un día normal. Sin horas de más.</p>
            </Tarjeta>
          </div>
        ) : (
          <div className="mt-2.5">
            <Tarjeta>
              {parte.extra != null && (
                <>
                  <p className="t-apoyo">Horas de más</p>
                  {/* La cifra va en TINTA. Antes iba del color de la
                      persona, y un número grande de color dice «esto
                      va mal» — y unas horas de más no van mal: son un
                      dato que hay que cuadrar. */}
                  <p className="t-cifra mt-0.5">+{enHoras(parte.extra)}</p>
                </>
              )}
              {parte.nota && (
                <p
                  className={`t-cuerpo whitespace-pre-wrap ${parte.extra != null ? 'mt-3' : ''}`}
                >
                  {parte.nota}
                </p>
              )}
              <p className="t-apoyo mt-3 border-t border-borde pt-2.5">
                Lo apunta {deQuien}. Tú lo ves y no lo puedes cambiar.
              </p>
            </Tarjeta>
          </div>
        )}

        <DelMes horas={extraDelMes} dias={diasConExtra} color={color} deQuien={deQuien} />
      </section>
    )
  }

  // ══ Y lo que ve ella: su parte, para escribirlo ═══════════
  return (
    <section className="mt-6">
      <h2 className="t-seccion">Tu día</h2>

      {!abierto ? (
        /*
          El tinte del 5 % (decisión D3), y aquí con motivo: un día con
          horas apuntadas es lo que hay que mirar de esta pantalla. Un
          día normal —la mayoría— se queda en papel liso.
        */
        <button
          onClick={() => setAbierto(true)}
          className="r-tarjeta mt-2.5 flex min-h-[76px] w-full items-center gap-3.5 border px-3.5 py-3 text-left"
          style={
            diaNormal
              ? { borderColor: 'var(--t-borde)', background: 'var(--t-superficie)' }
              : {
                  borderColor: `color-mix(in srgb, ${color} 38%, transparent)`,
                  background: `color-mix(in srgb, ${color} 5%, var(--t-superficie))`,
                }
          }
        >
          <PastillaAmbito icono="reloj" ambito={suyo} tam={48} />
          <span className="min-w-0 flex-1">
            {diaNormal ? (
              <>
                <span className="t-tarjeta block">¿Has hecho horas de más?</span>
                <span className="t-apoyo mt-0.5 block">
                  {esHoy ? 'Si no, no hace falta que pongas nada' : 'Si aquel día te quedaste más'}
                </span>
              </>
            ) : (
              <>
                <span className="t-tarjeta block">
                  {parte.extra != null ? `+${enHoras(parte.extra)}` : 'Sin horas de más'}
                </span>
                <span className="t-apoyo mt-0.5 block truncate">
                  {parte.nota ?? 'Toca para cambiarlo'}
                </span>
              </>
            )}
          </span>
          <Ico nombre="lapiz" tam={20} grosor={2.2} className="shrink-0 text-tinta-suave" />
        </button>
      ) : (
        <div className="r-tarjeta mt-2.5 border border-borde bg-superficie px-4 py-4">
          <p className="t-tarjeta">
            {esHoy ? '¿Cuántas horas de más hoy?' : '¿Cuántas horas de más aquel día?'}
          </p>
          <p className="t-apoyo mt-1">
            Solo lo que se salga de tu horario. Un día normal se deja en blanco.
          </p>

          {/*
            Los de siempre, de un toque. Media hora, una y dos cubren
            casi todos los casos reales; para lo demás están los
            botones de arriba y abajo.
          */}
          {/* Eran tres botones que al elegirse se rellenaban del color
              de la persona con la letra en blanco — y sobre un color
              apagado, blanco no se lee. Son la misma píldora que
              Semana/Mes/Día y ahora se pintan como ella: la elegida en
              tinta. */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[0.5, 1, 2].map((h) => (
              <Pildora
                key={h}
                puesta={extra === h}
                onClick={() => setExtra(extra === h ? null : h)}
                className="w-full"
              >
                +{enHoras(h)}
              </Pildora>
            ))}
          </div>

          {/* Media hora arriba y media abajo. Sin teclado: en un móvil,
              con el teclado tapando media pantalla, escribir «1,5» es
              donde se cuelan los errores. */}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => mover(-0.5)}
              disabled={ocupado || extra == null}
              aria-label="Media hora menos"
              className="r-campo flex h-[56px] w-[56px] shrink-0 items-center justify-center border border-borde text-[26px] font-light leading-none text-tinta-suave disabled:opacity-40"
            >
              −
            </button>
            <span className="r-campo flex h-[56px] flex-1 items-center justify-center border border-borde">
              {extra == null ? (
                <span className="t-cuerpo text-tenue">Ninguna</span>
              ) : (
                <span className="t-cifra-2">+{enHoras(extra)}</span>
              )}
            </span>
            <button
              onClick={() => mover(0.5)}
              disabled={ocupado}
              aria-label="Media hora más"
              className="r-campo flex h-[56px] w-[56px] shrink-0 items-center justify-center border border-borde text-[26px] font-light leading-none text-tinta-suave disabled:opacity-40"
            >
              +
            </button>
          </div>

          <div className="mt-5">
            <Campo etiqueta="¿Algo que contar? · si quieres" htmlFor="nota">
              <textarea
                id="nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                maxLength={600}
                placeholder="No pude planchar, no había plancha."
                className="entrada min-h-[92px] py-3 leading-snug"
              />
            </Campo>
          </div>

          {fallo && (
            <div className="mt-3">
              <Aviso titulo="No se ha podido guardar" explicacion={fallo} />
            </div>
          )}

          <div className="mt-3 flex gap-2.5">
            <BotonPrincipal
              onClick={guardar}
              desactivado={ocupado || !cambiado}
              porQue={!cambiado ? 'No has cambiado nada todavía' : undefined}
              icono="check"
              ancho="completo"
            >
              {ocupado ? 'Guardando…' : 'Guardar'}
            </BotonPrincipal>
            <BotonSecundario
              onClick={() => {
                setExtra(parte.extra)
                setNota(parte.nota ?? '')
                setAbierto(false)
              }}
              desactivado={ocupado}
              ancho="completo"
            >
              Dejarlo
            </BotonSecundario>
          </div>
        </div>
      )}

      <DelMes horas={extraDelMes} dias={diasConExtra} color={color} />

      <p className="t-apoyo r-campo mt-3 border border-borde px-4 py-3">
        Esto son apuntes para cuadrar el mes entre vosotros, no un registro de jornada
        oficial. Los escribes tú y nadie más los puede cambiar.
      </p>
    </section>
  )
}

/*
  Lo que lleva de horas de más este mes.

  Es el número por el que existe todo esto: nadie apunta horas por
  gusto, se apuntan para que a fin de mes los dos miren lo mismo.

  Con cero NO se enseña un cero grande: un mes sin horas de más es un
  mes normal, no un resultado. Se dice en una línea y ya.
*/
function DelMes({
  horas,
  dias,
  color,
  deQuien,
}: {
  horas: number
  dias: number
  color: string
  deQuien?: string
}) {
  if (horas <= 0) {
    return (
      <p className="t-apoyo mt-2.5 px-1">
        Este mes no hay horas de más apuntadas
        {deQuien ? ` por ${deQuien}` : ''}.
      </p>
    )
  }

  /*
    Aquí SÍ se tiñe (decisión D3): es el número por el que existe esta
    pantalla, y es uno solo. Al 5 %, no al 9 % de antes.
  */
  return (
    <div
      className="r-tarjeta mt-2.5 flex items-center gap-3.5 border px-4 py-3.5"
      style={{
        borderColor: `color-mix(in srgb, ${AMBITO[ambitoDeColor(color)]} 34%, transparent)`,
        background: `color-mix(in srgb, ${AMBITO[ambitoDeColor(color)]} 5%, var(--t-superficie))`,
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="t-apoyo block">Horas de más este mes</span>
        <span className="t-cifra-2 mt-0.5 block">+{enHoras(horas)}</span>
      </span>
      <span className="t-apoyo shrink-0">{dias === 1 ? '1 día' : `${dias} días`}</span>
    </div>
  )
}
