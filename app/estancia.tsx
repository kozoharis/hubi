'use client'

import { APARTAMENTOS } from '@/lib/reservas'
import { Ico } from './iconos'

/*
  Los datos de una estancia en Los Helechos.

  Se usa en los dos sitios donde puede nacer un apunte de la casa
  —apuntándolo a mano y guardando la captura de la reserva— porque son
  exactamente los mismos datos. Dos copias serían dos sitios donde
  arreglar el mismo fallo, y uno de los dos se quedaría sin arreglar.

  POR QUÉ EL APARTAMENTO SALE SIEMPRE, TAMBIÉN EN LOS GASTOS. Sin él
  se puede saber qué apartamento ingresa más, pero no cuál GANA más:
  uno muy reservado y con muchas averías parecería el mejor de los
  tres. "Toda la casa" no es una respuesta a medias — la luz, el
  seguro y la gestoría no son de ningún apartamento en concreto, y se
  reparten después a partes iguales.

  POR QUÉ BOTONES Y NO UNA LISTA DESPLEGABLE. Son cuatro opciones que
  caben en pantalla. Un desplegable esconde tres de ellas detrás de un
  toque y de una lista diminuta — justo lo que el punto 5 dice que no.
*/

export type Estancia = {
  apartamento: number | null
  personas: number | null
  noches: number | null
  huesped: string
  referencia: string
}

export const ESTANCIA_VACIA: Estancia = {
  apartamento: null,
  personas: null,
  noches: null,
  huesped: '',
  referencia: '',
}

export default function CamposEstancia({
  valor,
  cambiar,
  /* En un ingreso se pregunta también por noches y personas: es una
     reserva. En un gasto no tiene sentido — una avería no tiene
     huéspedes. */
  conEstancia,
}: {
  valor: Estancia
  cambiar: (e: Estancia) => void
  conEstancia: boolean
}) {
  const poner = (parte: Partial<Estancia>) => cambiar({ ...valor, ...parte })

  return (
    <>
      <p className="mt-8 text-xl font-medium text-tinta">¿Qué apartamento?</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {APARTAMENTOS.map((a) => (
          <Opcion
            key={a.n}
            texto={a.nombre}
            elegido={valor.apartamento === a.n}
            alPulsar={() => poner({ apartamento: a.n })}
          />
        ))}
        <Opcion
          texto="Toda la casa"
          elegido={valor.apartamento === null}
          alPulsar={() => poner({ apartamento: null })}
        />
      </div>

      {conEstancia && (
        <>
          <Contador
            etiqueta="¿Cuántas noches?"
            valor={valor.noches}
            maximo={60}
            alCambiar={(n) => poner({ noches: n })}
          />
          <Contador
            etiqueta="¿Cuántas personas?"
            valor={valor.personas}
            maximo={16}
            alCambiar={(n) => poner({ personas: n })}
          />

          <label htmlFor="huesped" className="mt-8 block text-xl font-medium text-tinta">
            ¿A nombre de quién?
          </label>
          <input
            id="huesped"
            value={valor.huesped}
            onChange={(e) => poner({ huesped: e.target.value })}
            placeholder="Nombre del huésped"
            className="mt-3 w-full rounded-2xl border-2 border-borde bg-fondo px-5 py-4 text-tinta placeholder:text-tenue focus:border-verde focus:outline-none"
          />

          <label htmlFor="referencia" className="mt-8 block text-xl font-medium text-tinta">
            Número de reserva
          </label>
          <input
            id="referencia"
            value={valor.referencia}
            onChange={(e) => poner({ referencia: e.target.value.toUpperCase() })}
            placeholder="Opcional"
            className="mt-3 w-full rounded-2xl border-2 border-borde bg-fondo px-5 py-4 text-tinta placeholder:text-tenue focus:border-verde focus:outline-none"
          />
          <p className="mt-2 text-[15px] font-semibold leading-snug text-tenue">
            Sirve para que la misma reserva no se apunte dos veces.
          </p>
        </>
      )}
    </>
  )
}

function Opcion({
  texto,
  elegido,
  alPulsar,
}: {
  texto: string
  elegido: boolean
  alPulsar: () => void
}) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      aria-pressed={elegido}
      className={`flex h-[62px] items-center justify-center rounded-[18px] border-2 px-3 text-[17.5px] font-extrabold ${
        elegido
          ? 'border-verde bg-verde-suave text-verde'
          : 'border-borde bg-superficie text-tinta'
      }`}
    >
      {elegido && <Ico nombre="check" tam={19} grosor={2.6} className="mr-1.5 shrink-0" />}
      {texto}
    </button>
  )
}

/*
  Menos y más, con el número grande en medio.

  Un teclado numérico para escribir "2" es abrir medio teléfono para
  pulsar una tecla. Y los dos botones son de 60 px: por encima del
  mínimo que nos hemos puesto para todo lo que se toca.
*/
function Contador({
  etiqueta,
  valor,
  maximo,
  alCambiar,
}: {
  etiqueta: string
  valor: number | null
  maximo: number
  alCambiar: (n: number | null) => void
}) {
  const n = valor ?? 0

  return (
    <>
      <p className="mt-8 text-xl font-medium text-tinta">{etiqueta}</p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => alCambiar(n <= 1 ? null : n - 1)}
          disabled={valor == null}
          aria-label={`Quitar uno de ${etiqueta}`}
          className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[18px] border-2 border-borde bg-superficie text-[30px] font-extrabold text-tinta disabled:opacity-30"
        >
          −
        </button>
        <div className="flex h-[60px] flex-1 items-center justify-center rounded-[18px] border-2 border-borde bg-fondo">
          <span
            className={`text-[26px] font-extrabold tabular-nums ${
              valor == null ? 'text-tenue' : 'text-tinta'
            }`}
          >
            {valor ?? '—'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => alCambiar(Math.min(maximo, n + 1))}
          aria-label={`Añadir uno a ${etiqueta}`}
          className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[18px] border-2 border-borde bg-superficie text-[30px] font-extrabold text-tinta"
        >
          +
        </button>
      </div>
    </>
  )
}
