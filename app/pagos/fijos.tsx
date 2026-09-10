'use client'

import { useEffect, useState } from 'react'
import { Aviso, BotonPrincipal, BotonSecundario, Vacio } from '../piezas'
import { CADAS, comoSeDice, type Cada, type PagoFijo } from '@/lib/pagos-fijos'
import { TIPOS, comoSeLlama, tipoHabitual, desglose, type Impuesto } from '@/lib/impuesto'

/*
  ═══════════════════════════════════════════════════════════════
  LO QUE SE PAGA TODOS LOS MESES
  ═══════════════════════════════════════════════════════════════

  Dos cosas en una pantalla, y el orden no es negociable:

   1. LO QUE FALTA. Arriba del todo, en rojo. Es lo único que pide
      hacer algo hoy.
   2. Lo que está programado. Debajo, tranquilo.

  Al revés —la lista primero y los avisos al final— el aviso llega
  después de que quien mira ya ha decidido que aquí no había nada que
  hacer, y para entonces ya no lo lee.
*/

/* «12 de septiembre». Una fecha con guiones en una pantalla que mira
   gente mayor es un número de serie, no un día. */
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function enDia(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} de ${MESES[Number(m) - 1]}`
}

type Partida = { id: string; nombre: string; camino: string; naturaleza: string }
type Falta = { pago_id: string; que: string; periodo: string; como: string }
type Previsto = {
  id: string
  concepto: string
  importe: number
  fecha: string
  periodo: string | null
}

export default function Fijos({
  partidas,
  impuesto,
}: {
  partidas: Partida[]
  impuesto: Impuesto
}) {
  const [pagos, setPagos] = useState<PagoFijo[] | null>(null)
  const [faltan, setFaltan] = useState<Falta[]>([])
  const [previstos, setPrevistos] = useState<Previsto[]>([])
  const [sinTabla, setSinTabla] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [poniendo, setPoniendo] = useState(false)

  // ── El formulario ──
  const [abierto, setAbierto] = useState(false)
  const [que, setQue] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [importe, setImporte] = useState('')
  const [partida, setPartida] = useState<string | null>(null)
  const [cada, setCada] = useState<Cada>('mensual')
  const [dia, setDia] = useState(1)
  const [tipoImpuesto, setTipoImpuesto] = useState<number>(tipoHabitual(impuesto) ?? 0)
  const [esperaPapel, setEsperaPapel] = useState(true)

  async function traer() {
    try {
      const r = await fetch('/api/pagos-fijos')
      const d = (await r.json()) as {
        pagos?: PagoFijo[]
        faltan?: Falta[]
        previstos?: Previsto[]
        sinTabla?: boolean
        error?: string
      }
      if (!r.ok) {
        setAviso(d.error ?? 'No se han podido cargar.')
        setPagos([])
        return
      }
      setPagos(d.pagos ?? [])
      setFaltan(d.faltan ?? [])
      setPrevistos(d.previstos ?? [])
      setSinTabla(d.sinTabla === true)
    } catch {
      setAviso('No hay conexión.')
      setPagos([])
    }
  }

  /* Se carga al entrar: traer datos de fuera al montar es justo para
     lo que existe un efecto. El linter avisa del patrón general de
     tocar estado desde uno, y aquí está pedido a propósito. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void traer()
  }, [])

  async function crear() {
    if (que.trim().length < 2 || !partida || !importe.trim()) return
    setPoniendo(true)
    setAviso(null)

    const r = await fetch('/api/pagos-fijos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        que: que.trim(),
        proveedor: proveedor.trim(),
        importe: importe.trim(),
        categoria_id: partida,
        cada,
        dia,
        espera_papel: esperaPapel,
        impuesto_tipo: impuesto === 'ninguno' ? null : tipoImpuesto,
      }),
    })

    const d = (await r.json().catch(() => ({}))) as { error?: string; detalle?: string }
    setPoniendo(false)

    if (!r.ok) {
      setAviso(d.detalle ?? d.error ?? 'No se ha podido guardar.')
      return
    }

    setQue('')
    setProveedor('')
    setImporte('')
    setPartida(null)
    setAbierto(false)
    traer()
  }

  async function responder(id: string, pagado: boolean) {
    await fetch('/api/pagos-fijos/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pagado }),
    })
    /* Se quita de la lista en el momento y luego se recarga: esperar al
       viaje entero para que desaparezca una fila hace dudar de si el
       toque ha llegado. */
    setPrevistos((x) => x.filter((p) => p.id !== id))
    traer()
  }

  async function quitar(id: string) {
    await fetch(`/api/pagos-fijos?id=${id}`, { method: 'DELETE' })
    traer()
  }

  const elDesglose =
    impuesto !== 'ninguno' && Number(importe.replace(',', '.')) > 0
      ? desglose(Number(importe.replace(',', '.')), tipoImpuesto)
      : null

  return (
    <div>
      {/* ── LO QUE FALTA ── */}
      {/*
        Un papel que no ha llegado no es un error: es algo que reclama
        atención. Iba en coral —el color de «esto está mal»— con borde
        de dos píxeles. Ahora es ámbar, que es lo que significa «mira
        esto», y el borde es de uno como todo lo demás.
      */}
      {faltan.length > 0 && (
        <section
          className="mt-4 rounded-[20px] border px-4 py-4"
          style={{
            background: 'var(--t-atencion-velo)',
            borderColor: 'color-mix(in srgb, var(--t-atencion) 45%, transparent)',
          }}
        >
          <p className="t-tarjeta" style={{ color: 'var(--t-atencion)' }}>
            {faltan.length === 1 ? 'Falta un papel' : `Faltan ${faltan.length} papeles`}
          </p>
          <p className="t-apoyo mt-1 text-tinta-suave">
            Ya tocaba y no se ha guardado ninguna factura. Puede que no haya llegado,
            o que esté en el correo sin subir.
          </p>
          <ul className="mt-3 space-y-2">
            {faltan.map((f) => (
              <li
                key={`${f.pago_id}-${f.periodo}`}
                className="rounded-[16px] border border-borde bg-superficie px-4 py-3"
              >
                <p className="t-cuerpo font-extrabold">{f.que}</p>
                <p className="t-apoyo mt-0.5">{f.como}</p>
              </li>
            ))}
          </ul>
          {/* Era un botón rojo relleno. El coral es el color de «esto
               reclama atención» y ya lo lleva la caja entera; repetirlo
               en el botón hace que el aviso grite dos veces y que la
               acción parezca peligrosa, cuando es la que resuelve. */}
          <div className="mt-3">
            <BotonPrincipal href="/guardar" icono="foto">
              Guardar una factura
            </BotonPrincipal>
          </div>
        </section>
      )}

      {/* ── LO APUNTADO SIN CONFIRMAR ── */}
      {previstos.length > 0 && (
        <section className="mt-4 rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="t-tarjeta">
            {previstos.length === 1 ? '¿Se pagó?' : `¿Se pagaron estos ${previstos.length}?`}
          </p>
          {/*
            Se dice que YA cuenta. Esconderlo haría que alguien mirara
            el balance, lo viera cuadrado, y no entendiera para qué se
            le pregunta nada.
          */}
          <p className="t-apoyo mt-1">
            Están apuntados porque tocaba, y ya cuentan en el balance. Confírmalos
            o quítalos si ese mes no se pagó.
          </p>

          <ul className="mt-3 space-y-2.5">
            {previstos.map((p) => (
              <li key={p.id} className="rounded-[20px] border border-borde bg-fondo px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="t-cuerpo block font-extrabold leading-snug">
                      {p.concepto}
                    </span>
                    <span className="t-apoyo mt-0.5 block">{enDia(p.fecha)}</span>
                  </span>
                  <span className="t-cuerpo shrink-0 font-extrabold tabular-nums">
                    {String(p.importe).replace('.', ',')} €
                  </span>
                </div>
                {/* Los dos botones a 60 px: eran de 50, por debajo del
                    suelo de 48 más el borde de dos píxeles que los
                    encogía otro poco. */}
                <div className="mt-3 flex gap-2.5">
                  <button
                    onClick={() => responder(p.id, true)}
                    className="t-cuerpo h-[60px] flex-1 rounded-[16px] font-extrabold"
                    style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
                  >
                    Sí, se pagó
                  </button>
                  <button
                    onClick={() => responder(p.id, false)}
                    className="t-cuerpo h-[60px] flex-1 rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta"
                  >
                    No se pagó
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── LO QUE ESTÁ PROGRAMADO ── */}
      <p className="rotulo mt-6">Lo que se paga siempre</p>

      {pagos === null ? (
        <p className="t-apoyo mt-3">Un momento…</p>
      ) : pagos.length === 0 ? (
        <div className="mt-3">
          <Vacio
            titulo="Todavía no hay ninguno"
            explicacion={
              sinTabla
                ? 'Los pagos fijos todavía no están disponibles en esta casa.'
                : 'El internet, el teléfono, el alquiler, un seguro. Lo apuntas una vez y HUBI lo lleva solo cada mes — y te avisa el mes que no aparezca la factura.'
            }
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {pagos.map((p) => (
            <li
              key={p.id}
              className="rounded-[20px] border border-borde bg-superficie px-4 py-3.5"
            >
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="t-tarjeta block truncate">{p.que}</span>
                  <span className="t-apoyo mt-0.5 block">
                    {comoSeDice(p.cada)} · día {p.dia}
                    {p.espera_papel ? '' : ' · sin factura'}
                  </span>
                </span>
                <span className="t-cuerpo shrink-0 font-extrabold tabular-nums">
                  {String(p.importe).replace('.', ',')} €
                </span>
              </div>
              {/* «Quitar» era texto suelto de 14,5 px: 20 px de alto en
                  una pantalla donde todo lo demás pasa de 48. */}
              <button
                onClick={() => quitar(p.id)}
                className="t-apoyo mt-1.5 flex h-12 items-center font-extrabold"
                style={{ color: 'var(--t-alerta)' }}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {aviso && (
        <div className="mt-4">
          <Aviso titulo="No se ha podido" explicacion={aviso} />
        </div>
      )}

      {/* ── AÑADIR ── */}
      {!abierto ? (
        <div className="mt-6">
          <BotonPrincipal onClick={() => setAbierto(true)} icono="mas">
            Añadir un pago fijo
          </BotonPrincipal>
        </div>
      ) : (
        <div className="mt-6 rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="t-tarjeta">Un pago nuevo</p>

          <label className="mt-4 block">
            <span className="rotulo">¿Qué es?</span>
            <input
              value={que}
              onChange={(e) => setQue(e.target.value)}
              placeholder="Internet, el alquiler, el seguro del coche…"
              maxLength={80}
              className="entrada mt-2"
            />
          </label>

          <label className="mt-4 block">
            <span className="rotulo">¿De quién? (para reconocer la factura)</span>
            <input
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Movistar, Endesa…"
              maxLength={80}
              className="entrada mt-2"
            />
          </label>

          <label className="mt-4 block">
            <span className="rotulo">¿Cuánto? (el total)</span>
            <span className="mt-2 flex items-center gap-2">
              <input
                inputMode="decimal"
                value={importe}
                onChange={(e) => setImporte(e.target.value.replace(/[^\d,.]/g, ''))}
                placeholder="0,00"
                className="entrada flex-1"
              />
              <span className="t-cifra-2 text-tenue">€</span>
            </span>
          </label>

          {impuesto !== 'ninguno' && (
            <>
              <p className="rotulo mt-4">¿Qué {comoSeLlama(impuesto)} lleva?</p>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {TIPOS[impuesto].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipoImpuesto(t)}
                    aria-pressed={tipoImpuesto === t}
                    className="t-apoyo flex h-[48px] min-w-[70px] items-center justify-center rounded-[16px] border px-3 font-extrabold"
                    style={{
                      borderColor: tipoImpuesto === t ? 'var(--color-accion)' : 'var(--t-borde)',
                      background: tipoImpuesto === t ? 'var(--t-bien-velo)' : 'var(--t-superficie)',
                      color: 'var(--t-tinta)',
                    }}
                  >
                    {String(t).replace('.', ',')}%
                  </button>
                ))}
              </div>
              {elDesglose && (
                <p className="t-apoyo mt-2.5 rounded-[16px] bg-fondo px-3 py-2.5 text-tinta-suave">
                  Base {elDesglose.base.toFixed(2).replace('.', ',')} € ·{' '}
                  {comoSeLlama(impuesto)}{' '}
                  <span className="text-tinta">
                    {elDesglose.cuota.toFixed(2).replace('.', ',')} €
                  </span>
                </p>
              )}
            </>
          )}

          <p className="rotulo mt-4">¿Cada cuánto?</p>
          <div className="mt-2 grid grid-cols-3 gap-2.5">
            {CADAS.map((c) => (
              <button
                key={c.valor}
                onClick={() => setCada(c.valor)}
                aria-pressed={cada === c.valor}
                className="t-apoyo flex h-[60px] items-center justify-center rounded-[16px] border px-2 text-center font-extrabold leading-tight"
                style={{
                  borderColor: cada === c.valor ? 'var(--color-accion)' : 'var(--t-borde)',
                  background: cada === c.valor ? 'var(--t-bien-velo)' : 'var(--t-superficie)',
                  color: 'var(--t-tinta)',
                }}
              >
                {c.texto}
              </button>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="rotulo">¿Qué día del mes?</span>
            <input
              type="number"
              min={1}
              max={28}
              value={dia}
              onChange={(e) => setDia(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
              className="entrada mt-2"
            />
          </label>
          {/* El 28 no es capricho y hay que decirlo, o parece un fallo. */}
          <p className="t-apoyo mt-1.5">
            Hasta el 28: el 30 no existe en febrero y ese mes se saltaría. Sirve
            para saber qué mes toca, no para clavar el día del cargo.
          </p>

          <p className="rotulo mt-4">¿Dónde cuenta?</p>
          <div className="mt-2 space-y-2">
            {partidas.map((p) => (
              <button
                key={p.id}
                onClick={() => setPartida(p.id)}
                aria-pressed={partida === p.id}
                className="flex min-h-[60px] w-full items-center rounded-[16px] border px-4 py-3 text-left"
                style={{
                  borderColor: partida === p.id ? 'var(--color-accion)' : 'var(--t-borde)',
                  background: partida === p.id ? 'var(--t-bien-velo)' : 'var(--t-superficie)',
                }}
              >
                <span className="t-cuerpo min-w-0 flex-1 font-extrabold leading-snug">
                  {p.camino}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setEsperaPapel((x) => !x)}
            role="switch"
            aria-checked={esperaPapel}
            className="mt-4 flex min-h-[64px] w-full items-center gap-3 rounded-[16px] border border-borde bg-superficie px-4 py-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="t-cuerpo block font-extrabold">¿Llega una factura?</span>
              <span className="t-apoyo mt-0.5 block">
                {esperaPapel
                  ? 'Te aviso el mes que no aparezca'
                  : 'No espero papel de esto'}
              </span>
            </span>
            {/* El interruptor del sistema: 34×58 con perilla de 28.
                Había tres medidas distintas de interruptor en la
                aplicación; ésta era la mediana. */}
            <span
              className="relative h-[34px] w-[58px] shrink-0 rounded-full transition-colors"
              style={{ background: esperaPapel ? 'var(--color-accion)' : 'var(--t-borde)' }}
            >
              <span
                className="absolute top-[3px] h-[28px] w-[28px] rounded-full bg-white transition-all"
                style={{ left: esperaPapel ? 27 : 3 }}
              />
            </span>
          </button>

          {/* Eran `bg-verde` con texto blanco a 58 px, uno al lado del
              otro. Ahora el principal y el secundario del sistema, uno
              debajo del otro: a 360 px, dos botones de 60 px en fila
              dejan 150 px cada uno y «Guardando…» se corta. Y el que
              apaga dice por qué. */}
          <div className="mt-5 space-y-2.5">
            <BotonPrincipal
              onClick={crear}
              desactivado={poniendo || que.trim().length < 2 || !partida || !importe.trim()}
              porQue={
                que.trim().length < 2
                  ? 'Dile qué es.'
                  : !importe.trim()
                    ? 'Falta cuánto es.'
                    : !partida
                      ? 'Elige dónde cuenta.'
                      : undefined
              }
            >
              {poniendo ? 'Guardando…' : 'Guardar'}
            </BotonPrincipal>
            <BotonSecundario onClick={() => setAbierto(false)}>Dejarlo</BotonSecundario>
          </div>
        </div>
      )}
    </div>
  )
}
