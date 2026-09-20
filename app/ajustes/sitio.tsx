'use client'

import { useState } from 'react'
import { Ico } from '../iconos'
import { Aviso } from '../piezas'
import { api } from '@/lib/api'

/*
  ═══════════════════════════════════════════════════════════════
  DÓNDE ESTÁ LA CASA
  ═══════════════════════════════════════════════════════════════

  Salió del tiempo de la cocina, que enseñaba el de Tenerife porque
  estaba escrito a mano en el código. Haris propuso pedir la
  geolocalización; lo que se ha hecho es lo que pidió y una cosa más,
  y conviene entender por qué son distintas.

  ─────────────────────────────────────────────────────────────
  EL DATO ES DE LA CASA · EL APARATO SÓLO AYUDA A ESCRIBIRLO

  Una casa no se mueve. Preguntarle a un sensor por un dato constante
  es aceptar que un día conteste otra cosa — y sin GPS, en una tablet
  de cocina en un wifi, la posición sale de triangular redes y coloca
  a cualquiera en el pueblo de al lado.

  Y en el móvil haría lo contrario de lo que se quiere: Julia en
  Madrid por trabajo vería el tiempo de Madrid, cuando lo que quiere
  saber es si en casa está lloviendo.

  Así que el botón del aparato está —es cómodo y evita escribir— pero
  RELLENA la casilla, no la sustituye. Un atajo para escribir un dato,
  no la fuente del dato.

  ─────────────────────────────────────────────────────────────
  Y EL APARATO SABE SU HUSO HORARIO SIN PREGUNTARLE A NADIE

  `Intl.DateTimeFormat().resolvedOptions().timeZone` lo dice. Por eso
  el botón del aparato no necesita un tercer servicio para traducir
  unas coordenadas a un huso: coge las coordenadas del sensor y el
  huso del propio navegador, y lo único que no sabe es cómo se llama
  el sitio — que lo escribe quien está delante, que se lo sabe.
*/

type Encontrado = {
  nombre: string
  donde: string
  lat: number
  lon: number
  zona: string
}

export default function Sitio({
  puesto,
  puedo,
}: {
  /** Lo que hay guardado, si hay algo. */
  puesto: { nombre: string; lat: number; lon: number; zona: string } | null
  /** Sólo quien manda en la casa lo cambia. */
  puedo: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [encontrados, setEncontrados] = useState<Encontrado[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  /* Lo que ha dicho el aparato, esperando un nombre. El sensor da
     coordenadas y el navegador da el huso; el nombre lo pone quien
     está delante. */
  const [delAparato, setDelAparato] = useState<{ lat: number; lon: number; zona: string } | null>(
    null
  )
  const [comoSeLlama, setComoSeLlama] = useState('')

  async function buscar() {
    const q = texto.trim()
    if (q.length < 2) return
    setFallo(null)
    setBuscando(true)
    try {
      const r = await fetch(api(`/api/sitio?q=${encodeURIComponent(q)}`))
      const d = (await r.json()) as { sitios?: Encontrado[]; fallo?: boolean }
      if (d.fallo) {
        setFallo('El buscador de pueblos no contesta ahora mismo. Inténtalo en un rato.')
        setEncontrados(null)
      } else {
        setEncontrados(d.sitios ?? [])
      }
    } catch {
      setFallo('No se ha podido buscar. Inténtalo otra vez en un momento.')
    }
    setBuscando(false)
  }

  /*
    ── EL APARATO ──

    Tres cosas que pueden salir mal y las tres se dicen con palabras,
    no con un código de error: que el navegador no lo tenga, que digan
    que no, y que tarde tanto que no vale la pena seguir esperando.

    Diez segundos de espera y `enableHighAccuracy` apagado: no hace
    falta acertar el portal, hace falta acertar el pueblo, y el GPS
    fino tarda mucho más y gasta batería en una tablet enchufada a la
    pared.
  */
  function preguntarAlAparato() {
    setFallo(null)
    setHecho(null)

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setFallo('Este navegador no sabe decir dónde está. Busca tu pueblo aquí arriba.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (p) => {
        let zona = 'Europe/Madrid'
        try {
          zona = Intl.DateTimeFormat().resolvedOptions().timeZone || zona
        } catch {
          /* Sin huso del navegador, el de siempre. */
        }
        setDelAparato({
          lat: Math.round(p.coords.latitude * 10_000) / 10_000,
          lon: Math.round(p.coords.longitude * 10_000) / 10_000,
          zona,
        })
        setEncontrados(null)
      },
      (e) => {
        setFallo(
          e.code === e.PERMISSION_DENIED
            ? 'No has dado permiso para saber dónde estás. No pasa nada: busca tu pueblo aquí arriba.'
            : 'Este aparato no ha sabido decir dónde está. Busca tu pueblo aquí arriba.'
        )
      },
      { timeout: 10_000, maximumAge: 600_000, enableHighAccuracy: false }
    )
  }

  async function guardar(sitio: { nombre: string; lat: number; lon: number; zona: string } | null) {
    setFallo(null)
    setGuardando(true)
    try {
      const r = await fetch(api('/api/casa'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitio }),
      })
      const d = (await r.json().catch(() => null)) as {
        bien?: boolean
        error?: string
        detalle?: string
      } | null

      if (!r.ok || d?.bien !== true) {
        setFallo([d?.error ?? 'No se ha podido guardar.', d?.detalle].filter(Boolean).join(' · '))
        setGuardando(false)
        return
      }

      setHecho(sitio ? sitio.nombre : null)
      setAbierto(false)
      setEncontrados(null)
      setDelAparato(null)
      setTexto('')
      setComoSeLlama('')
      /* Recarga entera y no `router.refresh()`: el tiempo de la pared
         se pide en el servidor y se guarda media hora, así que lo que
         hay que rehacer es la petición, no la pantalla. */
      window.location.reload()
    } catch {
      setFallo('No hay conexión. Inténtalo otra vez.')
    }
    setGuardando(false)
  }

  const loQueHay = hecho ?? puesto?.nombre ?? null

  return (
    <div className="rounded-[20px] border border-borde bg-superficie px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px]"
          style={{ background: 'var(--t-fondo)', color: 'var(--t-tenue)' }}
        >
          <Ico nombre="sol" tam={22} grosor={2.1} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="t-tarjeta block">Dónde está la casa</span>
          <span className="t-apoyo mt-0.5 block">
            {loQueHay
              ? `${loQueHay} · de aquí sale el tiempo de la cocina`
              : 'Sin poner. La cocina enseña el tiempo de Madrid.'}
          </span>
        </span>
      </div>

      {puedo && !abierto && (
        <button
          onClick={() => setAbierto(true)}
          className="t-apoyo mt-2 flex h-12 items-center gap-1.5 font-extrabold text-tinta"
        >
          <Ico nombre="lapiz" tam={18} grosor={2.4} />
          {loQueHay ? 'Cambiarlo' : 'Decir dónde'}
        </button>
      )}

      {puedo && abierto && (
        <div className="mt-3 border-t border-borde pt-3">
          <label htmlFor="pueblo" className="rotulo block">
            ¿En qué pueblo o ciudad?
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="pueblo"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  buscar()
                }
              }}
              placeholder="Madrid"
              maxLength={60}
              autoFocus
              className="t-cuerpo min-w-0 flex-1 rounded-[16px] border border-borde bg-superficie px-4 py-3 font-semibold text-tinta outline-none placeholder:text-apagado focus:border-[color:var(--color-accion)]"
            />
            <button
              onClick={buscar}
              disabled={buscando || texto.trim().length < 2}
              className="t-cuerpo shrink-0 rounded-[16px] px-5 font-extrabold disabled:opacity-50"
              style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
            >
              {buscando ? '…' : 'Buscar'}
            </button>
          </div>

          {encontrados !== null && encontrados.length === 0 && !buscando && (
            <p className="t-apoyo mt-2.5">
              No he encontrado nada con ese nombre. Prueba con el pueblo grande más
              cercano: para el tiempo da igual.
            </p>
          )}

          {encontrados !== null && encontrados.length > 0 && (
            <div className="mt-2.5 flex flex-col gap-1.5">
              {encontrados.map((s) => (
                <button
                  key={`${s.lat},${s.lon}`}
                  onClick={() =>
                    guardar({ nombre: s.nombre, lat: s.lat, lon: s.lon, zona: s.zona })
                  }
                  disabled={guardando}
                  className="tocable flex min-h-[56px] items-center gap-3 rounded-[16px] border border-borde px-3.5 text-left disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="t-cuerpo block truncate font-extrabold">{s.nombre}</span>
                    <span className="t-apoyo block truncate">{s.donde}</span>
                  </span>
                  <Ico nombre="flecha" tam={20} grosor={2.3} className="shrink-0 text-apagado" />
                </button>
              ))}
            </div>
          )}

          {/* ── O que lo diga el aparato ── */}
          {!delAparato ? (
            <button
              onClick={preguntarAlAparato}
              className="t-apoyo mt-3 flex h-12 items-center gap-1.5 font-extrabold text-tinta"
            >
              {/* Sin dibujo: no hay ninguno en mappel que signifique
                  «dónde estoy», y un icono que hay que adivinar es
                  peor que ninguno. La frase ya lo dice entera. */}
              O usar la ubicación de este aparato
            </button>
          ) : (
            <div className="mt-3 rounded-[16px] border border-borde bg-fondo px-3.5 py-3">
              <p className="t-apoyo">
                Este aparato dice que está en <strong>{delAparato.lat}, {delAparato.lon}</strong> ·{' '}
                {delAparato.zona}
              </p>
              <label htmlFor="comoSeLlama" className="rotulo mt-3 block">
                ¿Cómo se llama esto?
              </label>
              <input
                id="comoSeLlama"
                value={comoSeLlama}
                onChange={(e) => setComoSeLlama(e.target.value)}
                placeholder="Casa"
                maxLength={60}
                className="t-cuerpo mt-2 w-full rounded-[16px] border border-borde bg-superficie px-4 py-3 font-semibold text-tinta outline-none placeholder:text-apagado focus:border-[color:var(--color-accion)]"
              />
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() =>
                    guardar({
                      nombre: comoSeLlama.trim() || 'Casa',
                      lat: delAparato.lat,
                      lon: delAparato.lon,
                      zona: delAparato.zona,
                    })
                  }
                  disabled={guardando}
                  className="t-cuerpo h-[52px] flex-1 rounded-[16px] font-extrabold disabled:opacity-50"
                  style={{ background: 'var(--color-accion)', color: 'var(--color-accion-tinta)' }}
                >
                  {guardando ? 'Guardando…' : 'Guardar esto'}
                </button>
                <button
                  onClick={() => setDelAparato(null)}
                  className="t-cuerpo h-[52px] flex-1 rounded-[16px] border border-borde bg-superficie font-extrabold text-tinta"
                >
                  Dejarlo
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-5 border-t border-borde pt-2">
            <button
              onClick={() => {
                setAbierto(false)
                setEncontrados(null)
                setDelAparato(null)
                setFallo(null)
              }}
              className="t-apoyo flex h-12 items-center font-extrabold text-tinta"
            >
              Ahora no
            </button>

            {/* Quitarlo vuelve a dejar el sitio del código. Tiene que
                existir: quien elige el Madrid de Colombia —hay uno—
                necesita poder volver atrás. */}
            {puesto && (
              <button
                onClick={() => guardar(null)}
                disabled={guardando}
                className="t-apoyo flex h-12 items-center font-extrabold"
                style={{ color: 'var(--t-alerta)' }}
              >
                Quitarlo
              </button>
            )}
          </div>
        </div>
      )}

      {fallo && (
        <div className="mt-3">
          <Aviso titulo="No se ha podido" explicacion={fallo} />
        </div>
      )}
    </div>
  )
}
