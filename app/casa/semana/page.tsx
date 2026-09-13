import { hoyAqui } from '@/lib/tablon'
import { elLunesDe, laSemanaDe, comoSeLlamaLaSemana } from '@/lib/menus'
import { laPared, loApuntado, losMenus } from '@/lib/pared'
import { AMBITO } from '../../piezas'
import { Renglon } from '../cosa'
import { Rotulo } from '../rotulo'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LA SEMANA · siete columnas y nada más
  ═══════════════════════════════════════════════════════════════

  La semana entera de un vistazo: lo apuntado y lo que se come, día a
  día. Es la pantalla que pidió Haris cuando dijo «acceso semanal full»,
  y es la razón de que la pared tenga mínimo 1920 px — en menos, siete
  columnas legibles no caben.

  ─────────────────────────────────────────────────────────────
  DE LUNES A DOMINGO, SIEMPRE

  Y no «los próximos siete días». Una casa no piensa en «dentro de
  cuatro días»: piensa en «el jueves». Si la primera columna cambiara
  cada mañana, habría que leer los siete rótulos para saber dónde está
  uno; con la semana fija, el jueves está siempre en el mismo sitio.

  El coste es que el lunes por la noche la mitad de la pantalla es
  pasado. Se acepta: el domingo por la tarde, saber que el lunes hay
  médico vale más.

  ─────────────────────────────────────────────────────────────
  HOY SE SEÑALA, Y CON LA MISMA MARCA DE SIEMPRE

  La columna de hoy va teñida al 6 % de su ámbito, que es el `tinte` de
  `Fila`. No un borde de color ni una sombra: la manera que HUBI ya usa
  para decir «ésta, entre sus vecinas».
*/

export default async function Semana() {
  const { supabase, casa } = await laPared()

  const hoy = hoyAqui()
  const lunes = elLunesDe(hoy)
  const dias = laSemanaDe(lunes)

  const [cosas, menus] = await Promise.all([
    loApuntado(supabase, casa, dias[0], dias[6]),
    losMenus(supabase, casa, dias[0], dias[6]),
  ])

  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-5">
        <Rotulo>La semana</Rotulo>
        <p className="text-[20px] font-extrabold text-tinta-suave">
          {comoSeLlamaLaSemana(lunes)}
        </p>
      </div>

      {/*
        Sin `items-start`: las siete columnas miden lo mismo, la del día
        más cargado. Dejadas a su aire quedaban siete tarjetas de altura
        distinta flotando, que es un desorden y no un calendario. Una
        semana se lee como un tablero.
      */}
      <div className="mt-6 grid grid-cols-7 gap-3">
        {dias.map((dia) => {
          const esHoy = dia === hoy
          const suyas = cosas.filter((c) => c.fecha === dia)
          const comida = menus.find((m) => m.fecha === dia && m.momento === 'comida')?.que ?? null
          const cena = menus.find((m) => m.fecha === dia && m.momento === 'cena')?.que ?? null

          return (
            <div
              key={dia}
              className="rounded-[28px] border px-3.5 py-4"
              style={{
                background: esHoy
                  ? `color-mix(in srgb, ${AMBITO.verde} 6%, var(--t-superficie))`
                  : 'var(--t-superficie)',
                borderColor: esHoy
                  ? `color-mix(in srgb, ${AMBITO.verde} 40%, transparent)`
                  : 'var(--t-borde)',
              }}
            >
              {/* El nombre del día, y «HOY» en vez del nombre cuando lo
                  es: nadie busca «sábado» si lo que quiere saber es qué
                  hay hoy. */}
              <p className="text-[15px] font-extrabold uppercase tracking-wider text-tenue">
                {esHoy ? 'Hoy' : nombreCorto(dia)}
              </p>
              <p className="mt-0.5 text-[30px] font-extrabold leading-none tabular-nums text-tinta">
                {Number(dia.slice(8, 10))}
              </p>

              {suyas.length > 0 && (
                <ul className="mt-4 space-y-2.5">
                  {suyas.map((c) => (
                    <Renglon
                      key={c.id}
                      titulo={c.titulo}
                      cuando={c.hora ? c.hora.slice(0, 5) : undefined}
                      hecha={c.estado === 'hecho'}
                    />
                  ))}
                </ul>
              )}

              {/* La raya solo si hay algo ARRIBA que separar. Sin
                  tareas, un día con menú salía con un renglón suelto
                  colgando de una línea que no dividía nada. */}
              {(comida || cena) && (
                <div
                  className={
                    suyas.length > 0 ? 'mt-4 border-t border-borde pt-3.5' : 'mt-4'
                  }
                >
                  {comida && <Linea que={comida} />}
                  {cena && <Linea que={cena} />}
                </div>
              )}

              {suyas.length === 0 && !comida && !cena && (
                <p className="mt-3.5 text-[16px] font-bold leading-snug text-apagado">
                  Nada apuntado
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* Un plato dentro de una columna. Sin pastilla: a este tamaño, siete
   pastillas de comida en fila serían siete manchas del mismo color y
   dejarían de identificar nada. Basta el punto. */
function Linea({ que }: { que: string }) {
  return (
    <p className="flex items-start gap-2 text-[16px] font-bold leading-snug text-tinta-suave">
      <span
        className="mt-[7px] block h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: AMBITO.arena }}
      />
      <span className="min-w-0">{que}</span>
    </p>
  )
}

const CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function nombreCorto(iso: string): string {
  return CORTO[new Date(`${iso}T12:00:00`).getDay()]
}
