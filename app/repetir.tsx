'use client'

import { Ico } from './iconos'

/*
  ¿Se repite? ¿Y hasta cuándo?

  Se usa al apuntar algo y al cambiarlo, porque son la misma pregunta.

  EL PRINCIPIO ES LA FECHA DE LA TAREA. No hay un tercer campo "desde":
  la tarea ya tiene su día, y ése es el primero. "Todos los lunes del 1
  de septiembre al 30 de octubre" es una tarea del 1 de septiembre que
  se repite cada semana hasta el 30 de octubre. Un campo "desde" aparte
  sería un cuarto dato que decir y una manera más de contradecirse.

  EL "HASTA CUÁNDO" SOLO APARECE SI SE REPITE. Preguntar hasta cuándo
  se repite algo que no se repite es pedirle a alguien que conteste una
  pregunta sin sentido — y quien la contesta se queda pensando que ha
  hecho algo mal.

  Y por defecto: PARA SIEMPRE. La mayoría de lo que se repite en una
  casa —el agua, la basura, regar— no tiene fin previsto. Obligar a
  poner una fecha de fin sería obligar a inventarla.
*/

export const REPETICIONES = [
  { valor: null, nombre: 'No se repite' },
  { valor: 'diaria', nombre: 'Cada día' },
  { valor: 'semanal', nombre: 'Cada semana' },
  { valor: 'mensual', nombre: 'Cada mes' },
  { valor: 'anual', nombre: 'Cada año' },
] as const

export type Repeticion = 'diaria' | 'semanal' | 'mensual' | 'anual' | null

export default function Repetir({
  repite,
  hasta,
  desde,
  cambiar,
}: {
  repite: Repeticion
  hasta: string
  /** La fecha de la tarea: el "hasta" nunca puede ser anterior. */
  desde: string
  cambiar: (r: Repeticion, hasta: string) => void
}) {
  return (
    <>
      <p className="mt-8 text-xl font-medium text-tinta">¿Se repite?</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {REPETICIONES.map((r) => {
          const elegida = repite === r.valor
          return (
            <button
              key={r.nombre}
              type="button"
              onClick={() => cambiar(r.valor, r.valor ? hasta : '')}
              aria-pressed={elegida}
              className={`flex h-[62px] items-center justify-center rounded-[18px] border-2 px-3 text-[17px] font-extrabold ${
                elegida
                  ? 'border-verde bg-verde-suave text-verde'
                  : 'border-borde bg-superficie text-tinta'
              } ${r.valor === null ? 'col-span-2' : ''}`}
            >
              {elegida && <Ico nombre="check" tam={19} grosor={2.6} className="mr-1.5 shrink-0" />}
              {r.nombre}
            </button>
          )
        })}
      </div>

      {repite && (
        <>
          <label htmlFor="hasta" className="mt-8 block text-xl font-medium text-tinta">
            ¿Hasta cuándo?
          </label>
          <p className="mt-1.5 text-[15.5px] font-semibold leading-snug text-tenue">
            Déjalo en blanco si no tiene fin.
          </p>
          <input
            id="hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => cambiar(repite, e.target.value)}
            className="mt-3 w-full rounded-2xl border-2 border-borde bg-fondo px-5 py-4 text-tinta focus:border-verde focus:outline-none"
          />

          {hasta && desde && hasta < desde && (
            <p className="mt-3 rounded-[16px] bg-coral-suave px-4 py-3 text-[16px] font-semibold leading-snug text-coral">
              Esa fecha es anterior al día de la tarea. Así no se repetiría nunca.
            </p>
          )}

          {hasta && desde && hasta >= desde && (
            <p className="mt-3 text-[16px] font-semibold leading-snug text-tinta-suave">
              {resumen(repite, desde, hasta)}
            </p>
          )}
        </>
      )}
    </>
  )
}

/* Decirlo en cristiano antes de guardar. Quien lo lee tiene que poder
   ver el error sin entender de repeticiones. */
function resumen(repite: Exclude<Repeticion, null>, desde: string, hasta: string): string {
  const cada = {
    diaria: 'Todos los días',
    semanal: 'Cada semana',
    mensual: 'Cada mes',
    anual: 'Cada año',
  }[repite]

  return `${cada}, desde el ${enDia(desde)} hasta el ${enDia(hasta)}.`
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function enDia(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${a}`
}
