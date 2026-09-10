'use client'

import { useState } from 'react'
import { Ico } from '../iconos'
import { PastillaAmbito } from '../piezas'

/*
  Poner en marcha el calendario de Google.

  Es una acción de una sola vez, pero se deja siempre a mano: si algún
  día Juan Miguel borra el calendario sin querer, o Conchita pierde el
  correo de invitación, se vuelve a pulsar y listo.
*/

type Resultado = {
  bien?: boolean
  yaExistia?: boolean
  compartido?: string[]
  aMano?: string[]
  fallidos?: string[]
  error?: string
}

export default function PrepararCalendario({
  listo,
  permiso,
}: {
  listo: boolean
  permiso: boolean
}) {
  const [ocupado, setOcupado] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  // Tres estados, tres frases. Nada de iconos de estado sin texto.
  const pie = !permiso
    ? 'Antes hay que volver a conectar Google'
    : listo
      ? 'Creado · pulsa para volver a compartirlo'
      : 'Crear el calendario HUBI y compartirlo'

  async function preparar() {
    setOcupado(true)
    setResultado(null)
    try {
      const r = await fetch('/api/calendario/preparar', { method: 'POST' })
      setResultado((await r.json()) as Resultado)
    } catch {
      setResultado({ error: 'No se ha podido hablar con Google. Inténtalo otra vez.' })
    }
    setOcupado(false)
  }

  return (
    <div>
      <button
        onClick={preparar}
        disabled={ocupado}
        className="flex w-full items-center gap-3 rounded-[20px] border border-borde bg-superficie px-3.5 py-3 text-left disabled:opacity-60"
      >
        <PastillaAmbito icono="calendario" ambito="violeta" tam={44} />
        <span className="min-w-0 flex-1">
          <span className="block text-[17.5px] font-extrabold tracking-tight">
            {ocupado ? 'Preparando…' : 'Calendario en Google'}
          </span>
          <span
            className={`mt-0.5 block text-[14.5px] font-bold ${
              listo && permiso ? 'text-verde' : 'text-tenue'
            }`}
          >
            {pie}
          </span>
        </span>
        <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0 text-apagado" />
      </button>

      {resultado?.error && (
        <p className="mt-2 t-apoyo rounded-[16px] border px-4 py-3"
          style={{ background: 'var(--t-alerta-velo)', borderColor: 'color-mix(in srgb, var(--t-alerta) 45%, transparent)', color: 'var(--t-alerta)' }}>
          {resultado.error}
        </p>
      )}

      {resultado?.bien && (
        <div className="mt-2 rounded-[16px] bg-[color:var(--t-bien-velo)] px-4 py-3 text-[15px] font-semibold leading-snug text-[color:var(--t-bien)]">
          <p>
            {resultado.yaExistia
              ? 'El calendario HUBI ya estaba en tu Google.'
              : 'Calendario HUBI creado en tu Google.'}
          </p>
          {resultado.compartido && resultado.compartido.length > 0 && (
            <p className="mt-1.5">
              Compartido con {resultado.compartido.join(', ')}. Le llegará un correo de
              Google para aceptarlo.
            </p>
          )}
          {/* No es un fallo del calendario —ya está creado—: es que
              falta compartirlo con alguien. `atencion`, no alerta. */}
          {resultado.fallidos && resultado.fallidos.length > 0 && (
            <p className="mt-1.5" style={{ color: 'var(--t-atencion)' }}>
              No se ha podido compartir con {resultado.fallidos.join(', ')}.
            </p>
          )}
        </div>
      )}

      {/*
        Compartir a mano.

        Google no deja que HUBI reparta permisos de un calendario sin
        pedir un permiso mucho más grande, que además obliga a pasar
        una verificación y a ver una pantalla de advertencia cada vez
        que se conecta. Por un gesto que se hace UNA vez, no compensa.

        Así que aquí se explica, con los tres toques exactos y en el
        orden en que aparecen en Google. Nada de «consulta la ayuda de
        Google»: los pasos, escritos.
      */}
      {resultado?.bien && resultado.aMano && resultado.aMano.length > 0 && (
        <div className="mt-2 rounded-[16px] border border-borde bg-superficie px-4 py-3.5">
          <p className="text-[16.5px] font-extrabold leading-snug">
            Falta compartirlo con {resultado.aMano.join(', ')}
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-tenue">
            Esto se hace una sola vez, desde Google, mejor en el ordenador:
          </p>
          <ol className="mt-2.5 space-y-2">
            <Paso n={1}>
              Abre <b>calendar.google.com</b> y busca <b>HUBI</b> en la lista de la
              izquierda.
            </Paso>
            <Paso n={2}>
              Pon el ratón encima, pulsa los <b>tres puntos</b> y elige{' '}
              <b>Configuración y uso compartido</b>.
            </Paso>
            <Paso n={3}>
              Baja hasta <b>Compartir con personas específicas</b>, pulsa{' '}
              <b>Añadir personas</b>, escribe el correo y, en <b>Permisos</b>, elige{' '}
              <b>Hacer cambios y ver todos los detalles del evento</b>. Después,{' '}
              <b>Enviar</b>.
            </Paso>
          </ol>
          <p className="mt-2.5 text-[15px] font-semibold leading-snug text-tenue">
            Le llegará un correo. Lo acepta y ya le aparece el calendario en su
            móvil.
          </p>
        </div>
      )}
    </div>
  )
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[color:var(--t-bien)] text-[15px] font-extrabold text-[color:var(--t-superficie)]">
        {n}
      </span>
      <span className="text-[16px] font-semibold leading-snug">{children}</span>
    </li>
  )
}
