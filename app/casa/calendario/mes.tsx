import { AMBITO } from '../../piezas'

/*
  ═══════════════════════════════════════════════════════════════
  EL MES · el calendario pequeño de la esquina
  ═══════════════════════════════════════════════════════════════

  Debajo de la semana, a la derecha. Contesta una pregunta que la
  semana no puede contestar: **¿en qué parte del mes estamos?**

  Y otra que se hace mucho más de lo que parece: «el día 4, ¿qué día de
  la semana cae?». Sin un mes delante eso se cuenta con los dedos.

  ─────────────────────────────────────────────────────────────
  QUÉ DICE Y QUÉ NO

  Dice tres cosas y ni una más:

    · qué día es hoy — círculo relleno;
    · qué días tienen algo — un punto debajo del número;
    · y en qué semana estamos — la fila de esta semana, teñida.

  No dice QUÉ hay cada día. Para eso están las siete columnas de
  arriba, que es donde cabe escribirlo. Un mes con texto dentro de las
  casillas es un mes ilegible: son cuadros de 38 px.

  ─────────────────────────────────────────────────────────────
  EMPIEZA EN LUNES

  Como el resto de HUBI y como cualquier calendario de pared en España.
  `getDay()` devuelve 0 para el domingo, así que aquí se convierte con
  `(d + 6) % 7` — la misma cuenta que hace `lib/menus.ts`.
*/

const CABECERA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export default function Mes({
  hoy,
  /** Los días de este mes que tienen algo apuntado. */
  conAlgo,
  /** El lunes de la semana que se está enseñando arriba. */
  lunes,
}: {
  hoy: string
  conAlgo: Set<string>
  lunes: string
}) {
  const [ano, mes] = hoy.split('-').map(Number)

  /* El día 1 y cuántos días trae el mes. `new Date(ano, mes, 0)` es el
     último día del mes anterior contando desde 1, o sea el último de
     éste contando desde 0: es la manera de no tener que saberse cuántos
     días trae septiembre. */
  const primero = new Date(ano, mes - 1, 1, 12)
  const cuantos = new Date(ano, mes, 0).getDate()
  const empiezaEn = (primero.getDay() + 6) % 7

  /* Las casillas: los huecos del principio, y luego los días. */
  const casillas: (number | null)[] = []
  for (let i = 0; i < empiezaEn; i++) casillas.push(null)
  for (let d = 1; d <= cuantos; d++) casillas.push(d)
  /* Y hasta completar la última fila, para que la rejilla no quede
     coja por abajo. */
  while (casillas.length % 7 !== 0) casillas.push(null)

  const domingo = sumar(lunes, 6)

  return (
    <div className="rounded-[28px] border border-borde bg-superficie px-6 py-5">
      <p className="text-[19px] font-extrabold uppercase tracking-[0.14em] text-tinta">
        {MESES[mes - 1]}
        <span className="ml-2.5 text-tenue">{ano}</span>
      </p>

      <div className="mt-4 grid grid-cols-7">
        {CABECERA.map((d, i) => (
          <span
            key={i}
            className="flex h-[24px] items-center justify-center text-[13.5px] font-extrabold uppercase text-apagado"
          >
            {d}
          </span>
        ))}

        {casillas.map((d, i) => {
          if (d === null) return <span key={i} />

          const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const esHoy = iso === hoy
          const deEstaSemana = iso >= lunes && iso <= domingo
          const tiene = conAlgo.has(iso)

          return (
            <span
              key={i}
              className="flex h-[38px] flex-col items-center justify-center"
              style={
                /* La semana que se está viendo arriba, teñida. Es el
                   hilo entre las dos mitades de esta pantalla: sin él,
                   el mes y la semana parecen dos cosas que no se
                   hablan. */
                deEstaSemana && !esHoy
                  ? { background: `color-mix(in srgb, ${AMBITO.azul} 9%, transparent)` }
                  : undefined
              }
            >
              <span
                className={`flex h-[29px] w-[29px] items-center justify-center rounded-full text-[16px] font-extrabold tabular-nums ${
                  esHoy ? 'text-white' : 'text-tinta'
                }`}
                style={esHoy ? { background: AMBITO.verde } : undefined}
              >
                {d}
              </span>
              {/* El punto va SIEMPRE, transparente cuando no hay nada:
                  si apareciera y desapareciera, los números bailarían
                  media línea de una semana a otra. */}
              <span
                className="mt-[2px] block h-[5px] w-[5px] rounded-full"
                style={{ background: tiene ? AMBITO.azul : 'transparent' }}
              />
            </span>
          )
        })}
      </div>
    </div>
  )
}

function sumar(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}
