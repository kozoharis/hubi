'use client'

import { useState, type ReactNode } from 'react'
import { Ico } from './iconos'

/*
  ═══════════════════════════════════════════════════════════════
  HUBI INPUT · la pieza, no todavía el asistente
  ═══════════════════════════════════════════════════════════════

  ESTO ES SOLO LA PIEZA VISUAL Y SUS ESTADOS. No está conectada a
  nada y no sustituye a `/hablar`: la arquitectura del asistente es de
  la Fase 2. Se define ahora para que nada de lo que construyamos
  entretanto la contradiga.

  ─────────────────────────────────────────────────────────────
  POR QUÉ EXISTE

  Hoy HUBI no es una capacidad del producto: es una PANTALLA del
  producto. Vive en su propia dirección, se navega hasta ella, se hace
  una cosa y se sale. No sabe desde dónde has llegado. Y compite con un
  buscador que hace la misma pregunta con otro motor — la caja «¿Qué
  estás buscando?» de Papeles y el asistente son dos sistemas para lo
  mismo, y la persona tiene que saber a cuál acudir.

  Eso es justo lo contrario de «no busques, pregunta a HUBI».

  La pieza que arregla eso no es un chatbot flotante. Es más simple:
  UNA SOLA CAJA, la misma en todas partes, que sabe dónde está.

  ─────────────────────────────────────────────────────────────
  LAS TRES REGLAS QUE ESTA PIEZA FIJA

  1 · VOZ Y TEXTO SON LA MISMA COSA.
      Se puede escribir sin tocar el micrófono y hablar sin tocar el
      teclado. La voz es la forma preferida de hablarle a HUBI, no la
      única — y en una casa donde alguien tiene setenta años, la voz
      falla más a menudo, no menos. Un asistente que solo funciona por
      voz no es un asistente: es una función de voz.

  2 · EL CONTEXTO CAMBIA LA SUGERENCIA, NO EL COMPORTAMIENTO.
      En Papeles propone «la última póliza del coche»; en la Compra,
      «añade leche»; en Cuentas, «cuánto llevamos este trimestre».
      Escribas lo que escribas, funciona igual. La sugerencia solo
      enseña qué se puede pedir AQUÍ — que es lo que convierte una
      función en una capacidad.

  3 · EL DEGRADADO Y LA SOMBRA SON SUYOS.
      En toda la aplicación solo hay tres sombras y las tres son del
      botón de voz. Que la sombra teal signifique «HUBI está aquí» y
      nada más es una regla de sistema, y esta pieza la hereda: donde
      aparece el degradado, hay inteligencia detrás.
*/

export type EstadoHubi =
  | 'reposo'
  | 'escuchando'
  | 'pensando'
  | 'respondiendo'
  | 'no_entendido'
  | 'sin_microfono'

const DEGRADADO = 'linear-gradient(140deg,#2DD4BF,#14B8A6 45%,#3B82F6)'

/**
 * Lo que se sugiere en cada sitio.
 *
 * No son órdenes ni una lista cerrada: son ejemplos de lo que tiene
 * sentido pedir mirando esa pantalla. Sin nombres propios escritos a
 * mano — eso ya nos pasó con «Recuérdale a Conchita», que es falso en
 * cuanto entra la segunda familia.
 */
export const SUGERENCIAS: Record<string, string> = {
  inicio: 'Pregunta o di lo que necesitas',
  papeles: '«Busca la última póliza del coche»',
  agenda: '«¿Qué tengo mañana?»',
  compra: '«Añade leche y pan»',
  dia: '«Añade leche a la compra»',
  cuentas: '«¿Cuánto llevamos gastado este trimestre?»',
  menus: '«Pon lentejas el martes»',
}

// ═══════════════════════════════════════════════════════════════

export default function HubiInput({
  estado = 'reposo',
  donde = 'inicio',
  sugerencia: sugerenciaDada,
  valor = '',
  segundos = 0,
  nivel = 0,
  respuesta,
  acciones,
  alEscribir,
  alEnviar,
  alHablar,
}: {
  estado?: EstadoHubi
  /** Qué pantalla es ésta. Solo cambia la sugerencia. */
  donde?: keyof typeof SUGERENCIAS | string
  /*
    Una sugerencia concreta, por encima de la de la pantalla. En el
    Inicio van rotando: es la única parte de HUBI que enseña qué se le
    puede pedir, y nadie lee un manual pero todo el mundo lee una
    frase que se mueve delante de sus ojos.
  */
  sugerencia?: string
  valor?: string
  segundos?: number
  /** 0–1, para el medidor mientras escucha. */
  nivel?: number
  respuesta?: string
  acciones?: ReactNode
  alEscribir?: (t: string) => void
  alEnviar?: () => void
  alHablar?: () => void
}) {
  const [propio, setPropio] = useState('')
  const texto = alEscribir ? valor : propio
  const escribir = alEscribir ?? setPropio

  const sugerencia = sugerenciaDada ?? SUGERENCIAS[donde] ?? SUGERENCIAS.inicio
  const escuchando = estado === 'escuchando'
  const puedeHablar = estado !== 'sin_microfono'

  return (
    <div>
      <div
        className="flex h-[64px] w-full items-center gap-3 rounded-[18px] border pl-3.5 pr-2"
        style={{
          background: 'var(--t-superficie)',
          borderColor: escuchando ? 'var(--color-accion)' : 'var(--t-borde)',
        }}
      >
        {/* ── Lo que hay a la izquierda dice en qué estado está ── */}
        {escuchando ? (
          <Medidor nivel={nivel} />
        ) : estado === 'pensando' ? (
          <span className="relative flex h-[22px] w-[22px] shrink-0">
            <span aria-hidden className="orbita" />
          </span>
        ) : (
          <span className="shrink-0 text-tenue">
            <Ico nombre="onda" tam={22} grosor={2.2} />
          </span>
        )}

        {/* ── El campo ── */}
        {estado === 'pensando' || estado === 'escuchando' ? (
          <p className="t-cuerpo min-w-0 flex-1 truncate font-bold">
            {escuchando ? `Te escucho · ${segundos}s` : 'Un momento…'}
          </p>
        ) : (
          <form
            className="flex min-w-0 flex-1 items-center"
            onSubmit={(e) => {
              e.preventDefault()
              if (texto.trim()) alEnviar?.()
            }}
          >
            <input
              value={texto}
              onChange={(e) => escribir(e.target.value)}
              placeholder={sugerencia}
              aria-label="Pregunta o di lo que necesitas"
              enterKeyHint="send"
              className="t-cuerpo w-full min-w-0 bg-transparent text-tinta outline-none placeholder:font-medium placeholder:text-tenue"
            />
          </form>
        )}

        {/*
          El micrófono. Es lo único de toda la aplicación que lleva el
          degradado y la sombra de HUBI — y por eso se reconoce.

          Cuando no hay micrófono desaparece en vez de quedarse
          apagado: un botón muerto invita a pulsarlo y a pensar que
          algo está roto. La caja sigue funcionando, escrita.
        */}
        {puedeHablar && (
          <button
            type="button"
            onClick={escuchando ? undefined : alHablar}
            aria-label={escuchando ? 'Terminar' : 'Hablar con HUBI'}
            className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[14px] text-white"
            style={{ background: DEGRADADO, boxShadow: '0 6px 16px rgba(20,184,166,.34)' }}
          >
            <Ico nombre={escuchando ? 'check' : 'micro'} tam={22} grosor={2.3} />
          </button>
        )}
      </div>

      {/* ── Sin micrófono: se dice, y se sigue pudiendo usar ── */}
      {estado === 'sin_microfono' && (
        <p className="t-apoyo mt-2">
          Este navegador no deja grabar. Escríbelo y te entiendo igual.
        </p>
      )}

      {/* ── La respuesta, EN EL SITIO ── */}
      {estado === 'respondiendo' && respuesta && (
        <div className="mt-3 rounded-[20px] border border-borde bg-superficie px-4 py-3.5">
          {texto && <p className="t-apoyo">«{texto}»</p>}
          <p className="t-cuerpo mt-1.5 font-bold">{respuesta}</p>
          {acciones && <div className="mt-3.5 flex flex-wrap gap-2">{acciones}</div>}
        </div>
      )}

      {/*
        No lo he entendido.

        Aquí el asistente ofrece hoy NUEVE botones de 66 px, justo en el
        momento en que la persona ya está molesta. Cuatro y un «otra
        cosa» cubren casi todo: menos decisiones cuando menos ganas hay
        de decidir.
      */}
      {estado === 'no_entendido' && (
        <div className="mt-3 rounded-[20px] border border-borde bg-superficie px-4 py-3.5">
          <p className="t-cuerpo font-bold">¿Qué quieres que haga con esto?</p>
          {acciones && <div className="mt-3 flex flex-wrap gap-2">{acciones}</div>}
        </div>
      )}
    </div>
  )
}

/* Siete barras que se mueven con la voz. Dice lo único que se sabe con
   certeza: que el micrófono te oye. */
const PESOS = [0.35, 0.6, 0.85, 1, 0.85, 0.6, 0.35]

function Medidor({ nivel }: { nivel: number }) {
  return (
    <span aria-hidden className="flex h-[24px] shrink-0 items-center gap-[3px]">
      {PESOS.map((peso, i) => (
        <span
          key={i}
          className="w-[4px] rounded-full transition-all duration-100"
          style={{
            height: `${Math.max(4, nivel * peso * 24)}px`,
            background: 'var(--color-accion)',
          }}
        />
      ))}
    </span>
  )
}
