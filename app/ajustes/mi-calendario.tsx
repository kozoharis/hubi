'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ico, Pastilla } from '../iconos'

/*
  Conectar tu calendario de Google.

  La instrucción está escrita para hacerse EN EL ORDENADOR, y no por
  capricho: la app del móvil no enseña la dirección secreta en ninguna
  parte. Si esto dijera solo "pega tu dirección iCal", Juan Miguel se
  quedaría mirando el móvil buscando algo que allí no existe.

  Y no se pinta un icono de Google ni se imita su pantalla: esto es
  HUBI pidiendo un dato, no Google pidiendo una contraseña. Nunca hay
  que dar pie a confundir las dos cosas.
*/
export default function MiCalendario({
  conectado,
  desde,
  compartido,
  elOtro,
}: {
  conectado: boolean
  desde: string | null
  compartido: boolean
  elOtro: string | null
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [url, setUrl] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [comparte, setComparte] = useState(compartido)
  const [aviso, setAviso] = useState<string | null>(null)
  const [bien, setBien] = useState<string | null>(null)

  async function conectar() {
    setAviso(null)
    setBien(null)
    setOcupado(true)

    const r = await fetch('/api/calendario/ical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    })
    const d = (await r.json().catch(() => ({}))) as { error?: string; citas?: number }

    if (!r.ok) {
      setAviso(d.error ?? 'No se ha podido conectar.')
      setOcupado(false)
      return
    }

    /* Se confirma con un DATO, no con un "listo". "He encontrado 34
       citas" demuestra que se ha leído de verdad; "conectado" no
       demuestra nada. */
    setBien(
      d.citas
        ? `Conectado. He encontrado ${d.citas} ${d.citas === 1 ? 'cita' : 'citas'} para el próximo año.`
        : 'Conectado, aunque no he encontrado ninguna cita en el próximo año.'
    )
    setUrl('')
    setAbierto(false)
    setOcupado(false)
    router.refresh()
  }

  async function cambiarComparte(valor: boolean) {
    setComparte(valor)          // se ve al momento
    setOcupado(true)
    const r = await fetch('/api/calendario/ical', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compartido: valor }),
    })
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      setAviso(d.error ?? 'No se ha podido guardar.')
      setComparte(!valor)       // no se guardó: se deshace
    }
    setOcupado(false)
    router.refresh()
  }

  async function desconectar() {
    setOcupado(true)
    await fetch('/api/calendario/ical', { method: 'DELETE' })
    setBien(null)
    setOcupado(false)
    router.refresh()
  }

  return (
    <div>
      <div className="rounded-[20px] border border-borde bg-superficie px-3.5 py-3">
        <div className="flex items-center gap-3">
          <Pastilla nombre="calendario" color="#3B82F6" fondo="#E3EDFD" tam={44} icono={22} />
          <span className="min-w-0 flex-1">
            <span className="block text-[17.5px] font-extrabold tracking-tight">
              Tus citas de Google
            </span>
            <span
              className={`mt-0.5 block text-[14.5px] font-bold ${conectado ? 'text-verde' : 'text-tenue'}`}
            >
              {conectado
                ? `Se ven en tu Agenda${desde ? ` · desde el ${desde}` : ''}`
                : 'Sin conectar'}
            </span>
          </span>
          {!conectado && (
            <button
              onClick={() => setAbierto(!abierto)}
              className="flex h-11 shrink-0 items-center rounded-full border border-borde px-3.5 text-[13.5px] font-extrabold tracking-wide text-tinta"
            >
              {abierto ? 'CERRAR' : 'CONECTAR'}
            </button>
          )}
        </div>

        {conectado && (
          <>
            {/*
              COMPARTIRLO LO DECIDE QUIEN LO TIENE.

              Dentro de un calendario personal hay cosas de terceros:
              con quién se ve uno, dónde, a qué hora. Que el otro
              pudiera encenderlo sería colocarle a esta persona una
              decisión que es suya. Y empieza apagado a propósito:
              nadie se encuentra su agenda en la pantalla del otro por
              una actualización que no pidió.
            */}
            {elOtro && (
              <button
                onClick={() => cambiarComparte(!comparte)}
                disabled={ocupado}
                aria-pressed={comparte}
                className="mt-3 flex w-full items-center gap-3 rounded-[16px] border border-borde px-3.5 py-3 text-left disabled:opacity-50"
              >
                <span
                  className="flex h-7 w-12 shrink-0 items-center rounded-full px-[3px] transition-colors"
                  style={{ background: comparte ? '#14B8A6' : 'var(--t-borde)' }}
                >
                  <span
                    className="h-[22px] w-[22px] rounded-full bg-white transition-transform"
                    style={{ transform: comparte ? 'translateX(20px)' : 'none' }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-extrabold tracking-tight">
                    Que {elOtro} también las vea
                  </span>
                  <span className="mt-0.5 block text-[14px] font-semibold leading-snug text-tenue">
                    {comparte
                      ? `${elOtro} ve tus citas en su Agenda, con tu nombre al lado.`
                      : 'Ahora mismo tus citas solo las ves tú.'}
                  </span>
                </span>
              </button>
            )}

            <button
              onClick={desconectar}
              disabled={ocupado}
              className="mt-2 h-11 px-1 text-[15px] font-bold text-tenue disabled:opacity-50"
            >
              Dejar de ver mis citas de Google
            </button>
          </>
        )}

        {abierto && !conectado && (
          <div className="mt-3 border-t border-borde pt-3.5">
            {/*
              Cuatro pasos, numerados y con el nombre EXACTO de lo que
              hay que buscar en cada pantalla. Nada de "ve a los ajustes
              del calendario": los ajustes de Google tienen treinta
              opciones y la que buscamos está abajo del todo.
            */}
            <p className="text-[15.5px] font-bold leading-snug text-tinta">
              Esto se hace en el ordenador. En el móvil no se puede: la
              aplicación de Google no enseña esta dirección.
            </p>

            <ol className="mt-3 space-y-2.5">
              <Paso n={1}>
                Entra en <b>calendar.google.com</b> con la cuenta de Juan Miguel.
              </Paso>
              <Paso n={2}>
                A la izquierda, pon el ratón encima de tu calendario (el que lleva
                tu nombre), toca los tres puntos y elige{' '}
                <b>Configuración y uso compartido</b>.
              </Paso>
              <Paso n={3}>
                Baja del todo hasta <b>Dirección secreta en formato iCal</b> y
                cópiala entera.
              </Paso>
              <Paso n={4}>Pégala aquí abajo.</Paso>
            </ol>

            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/…"
              autoComplete="off"
              spellCheck={false}
              className="entrada mt-3 text-[15px]"
            />

            <p className="mt-2 text-[14.5px] font-semibold leading-snug text-tenue">
              Esa dirección es una llave: quien la tenga puede leer tu calendario.
              Se guarda cifrada y no sale de aquí. Si algún día quieres anularla,
              en esa misma pantalla de Google hay un botón para generar otra.
            </p>

            {aviso && (
              <p className="mt-3 rounded-[16px] bg-coral-suave px-4 py-3 text-[15.5px] font-semibold leading-snug text-coral">
                {aviso}
              </p>
            )}

            <button
              onClick={conectar}
              disabled={ocupado || url.trim().length < 20}
              className="mt-3 flex h-[56px] w-full items-center justify-center gap-2 rounded-[16px] bg-boton text-[17px] font-extrabold text-boton-texto disabled:opacity-50"
            >
              {ocupado ? 'Comprobando…' : 'Conectar'}
            </button>
          </div>
        )}
      </div>

      {bien && (
        <p className="mt-2 flex items-start gap-2 rounded-[16px] bg-verde-suave px-4 py-3 text-[15.5px] font-semibold leading-snug text-verde">
          <Ico nombre="check" tam={19} grosor={2.3} className="mt-0.5 shrink-0" />
          {bien}
        </p>
      )}
    </div>
  )
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fondo text-[13px] font-extrabold text-tinta-suave">
        {n}
      </span>
      <span className="text-[15.5px] font-medium leading-snug text-tinta-suave">{children}</span>
    </li>
  )
}
