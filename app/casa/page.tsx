import { hoyAqui } from '@/lib/tablon'
import { laPared, loApuntado, losMenus } from '@/lib/pared'
import { Ico } from '../iconos'
import { AMBITO } from '../piezas'
import Cosa from './cosa'
import { Nada, Rotulo } from './rotulo'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  HOY · la pantalla en la que se queda la pared
  ═══════════════════════════════════════════════════════════════

  Es la que se ve el 95 % del tiempo: a las demás se va a mirar algo
  concreto y la pared vuelve sola aquí a los tres minutos
  (`vuelve-a-hoy.tsx`).

  Así que ésta no puede ser una lista más: tiene que contestar de un
  vistazo, desde la puerta, las tres preguntas de una casa.

      ¿Qué hay hoy?          → lo apuntado, con su hora
      ¿Qué se come?          → la comida y la cena de hoy
      ¿Y lo que viene?       → los próximos días, en pequeño

  ─────────────────────────────────────────────────────────────
  LO QUE SE PIDE, Y LO QUE NO SE FILTRA

  Los recordatorios se piden sin una sola condición de visibilidad, a
  propósito: lo pone la base. Está explicado en `lib/pared.ts`.
*/

export default async function Hoy() {
  const { supabase, casa } = await laPared()
  const hoy = hoyAqui()

  /* Hasta dentro de dos semanas: de ahí sale «después». */
  const dentroDeDos = sumarDias(hoy, 14)

  const [cosas, menus] = await Promise.all([
    loApuntado(supabase, casa, hoy, dentroDeDos),
    losMenus(supabase, casa, hoy, hoy),
  ])

  const pendientes = cosas.filter((c) => c.estado !== 'hecho')
  const deHoy = pendientes.filter((c) => c.fecha === hoy)
  const luego = pendientes.filter((c) => c.fecha !== hoy).slice(0, 5)

  const comida = menus.find((m) => m.momento === 'comida')?.que ?? null
  const cena = menus.find((m) => m.momento === 'cena')?.que ?? null

  return (
    <div className="mt-12 xl:grid xl:grid-cols-[1.4fr_1fr] xl:items-start xl:gap-14">
      {/* ── Lo de hoy ── */}
      <section>
        <Rotulo>Hoy</Rotulo>

        {deHoy.length === 0 ? (
          <Nada>Hoy no hay nada apuntado.</Nada>
        ) : (
          <ul className="mt-6 space-y-4">
            {deHoy.map((c) => (
              <Cosa
                key={c.id}
                titulo={c.titulo}
                cuando={c.hora ? c.hora.slice(0, 5) : ''}
                talla="hoy"
              />
            ))}
          </ul>
        )}
      </section>

      <div className="mt-12 xl:mt-0">
        {/* ── Qué se come ── */}
        {/*
          La comida y la cena de hoy, y solo eso. El menú de la semana
          entera tiene su pestaña; aquí, la pregunta es «¿qué hay para
          comer?», y se contesta con dos líneas o con ninguna.
        */}
        <section>
          <Rotulo>Qué se come</Rotulo>

          {!comida && !cena ? (
            <Nada>Hoy no hay menú puesto.</Nada>
          ) : (
            <div className="mt-6 space-y-3">
              <Plato momento="Comida" que={comida} />
              <Plato momento="Cena" que={cena} />
            </div>
          )}
        </section>

        {/* ── Lo que viene ── */}
        {luego.length > 0 && (
          <section className="mt-12">
            <Rotulo>Después</Rotulo>
            <ul className="mt-6 space-y-3">
              {luego.map((c) => (
                <Cosa
                  key={c.id}
                  titulo={c.titulo}
                  cuando={diaCorto(c.fecha, Number(hoy.slice(0, 4)))}
                  talla="columna"
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

/*
  Un plato. Sin plato puesto NO se esconde la fila: se dice que está
  vacía.

  Es lo contrario de lo que hace `Dato` en la aplicación —allí un valor
  vacío no pinta la fila—, y la diferencia es real. En una ficha, una
  etiqueta con un hueco al lado parece un dato que falta. Aquí, que la
  cena esté sin poner es justamente lo que alguien necesita ver al
  pasar por la cocina a las siete.
*/
function Plato({ momento, que }: { momento: string; que: string | null }) {
  return (
    <div
      className="flex items-center gap-4 rounded-[24px] border bg-superficie px-5 py-4"
      style={{
        borderColor: 'var(--t-borde)',
        borderLeft: `6px solid ${AMBITO.arena}`,
      }}
    >
      <span
        className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[16px]"
        style={{
          background: `color-mix(in srgb, ${AMBITO.arena} 16%, var(--t-superficie))`,
          color: AMBITO.arena,
        }}
      >
        <Ico nombre="taza" tam={24} grosor={2.1} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-extrabold uppercase tracking-wider text-tenue">
          {momento}
        </span>
        <span
          className={`block text-[22px] font-extrabold leading-tight ${
            que ? 'text-tinta' : 'text-apagado'
          }`}
        >
          {que ?? 'Sin poner'}
        </span>
      </span>
    </div>
  )
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** «2026-09-13» + 14 → «2026-09-27». */
function sumarDias(iso: string, cuantos: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + cuantos)
  return d.toISOString().slice(0, 10)
}

/**
 * «mar 16 sep», y «mar 10 ago 2027» cuando no es de este año.
 *
 * El año no estaba, y en la pared salió esto:
 *
 *     lun 14 sep   Presentación del cole de Paula
 *     mar 10 ago   Último día para cancelar: IONOS
 *
 * Todo correcto por dentro —la de IONOS es de 2027 y va ordenada— y
 * todo equivocado por fuera: puesto debajo del 14 de septiembre, un «10
 * de agosto» sin año se lee como una fecha pasada, y una pantalla que
 * parece enseñar cosas caducadas deja de creerse.
 *
 * Corto es bueno, pero no a costa de decir algo que no es.
 */
export function diaCorto(fecha: string | null, anoDeHoy: number): string {
  if (!fecha) return ''
  const [a, m, d] = fecha.split('-').map(Number)
  /* Mediodía y no medianoche: con la hora a cero, un desfase de zona de
     una hora hacia atrás cambia el día. */
  const f = new Date(a, m - 1, d, 12)
  const base = `${DIAS[f.getDay()]} ${d} ${MESES[m - 1]}`
  return a === anoDeHoy ? base : `${base} ${a}`
}
