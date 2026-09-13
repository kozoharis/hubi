import Link from '@/app/enlace'
import { notFound } from 'next/navigation'
import { hoyAqui } from '@/lib/tablon'
import { elLunesDe } from '@/lib/menus'
import { laPared, loApuntado, losMenus, type CosaDeLaPared } from '@/lib/pared'
import { Ico } from '../../../iconos'
import { AMBITO } from '../../../piezas'
import Cosa from '../../cosa'
import Mes from '../../calendario/mes'
import { Rotulo } from '../../rotulo'
import Apuntar from './apuntar'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  UN DÍA, POR HORAS
  ═══════════════════════════════════════════════════════════════

  Se llega tocando una columna del calendario. Y no es una lista: es el
  día **con sus horas**, que es como lo pidió Haris y como se mira un
  día de verdad.

  ─────────────────────────────────────────────────────────────
  POR QUÉ LAS HORAS Y NO UNA LISTA

  Una lista de dos cosas dice qué hay. Un día con sus horas dice además
  **lo que NO hay**, que es la mitad de la información: que la mañana
  está libre, que entre el médico y la merienda hay tres horas, que la
  tarde está tomada. Eso en una lista no se ve.

  De 7 a 22, que es la franja en la que pasa lo que pasa en una casa.
  Lo que caiga fuera no desaparece: sale arriba, con su hora escrita.

  ─────────────────────────────────────────────────────────────
  Y EL MENÚ YA NO OCUPA MEDIA PANTALLA

  Estaba en una columna entera a la derecha, y para decir «este día no
  tiene menú puesto» eso es media pantalla gastada en una frase. Haris
  lo vio: *«lo del menú… ¿no lo ves un poco torpe?»*.

  Ahora es una tira encima del día —comida y cena, una línea— y la
  columna de la derecha es para el **mes**, con el día que se está
  mirando marcado: así, desde cualquier día, se sabe dónde se está sin
  volver al calendario. «Así tenemos siempre controlado dónde estamos.»

  ─────────────────────────────────────────────────────────────
  POR QUÉ ESTE DETALLE ES DE LA PARED Y NO EL DE LA APLICACIÓN

  Enlazar a `/tablon/<id>` habría sido más fácil y habría estado mal:
  esa ficha está llena de botones que una pantalla no puede —cambiar,
  borrar— y además la sacaría del armazón, sin pestañas, sin reloj y
  sin la vuelta automática a Hoy. Una tableta acabaría atascada en la
  ficha de una tarea hasta que alguien la rescatara.
*/

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/* La franja del día. Fuera de aquí casi nunca hay nada, y dibujar las
   veinticuatro dejaría siete filas vacías arriba y dos abajo comiéndose
   el sitio de las que importan. */
const DESDE = 7
const HASTA = 22

export default async function ElDia({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params

  /* La fecha llega de la dirección, o sea de fuera. Si no tiene la forma
     exacta, no se consulta nada: una fecha torcida en un `gte` es una
     consulta que puede devolver cualquier cosa. */
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound()

  const { supabase, casa } = await laPared()
  const hoy = hoyAqui()

  /* El mes entero del día que se mira, para los puntitos. */
  const [ano, mes] = fecha.split('-').map(Number)
  const delMes = `${ano}-${String(mes).padStart(2, '0')}`
  const ultimo = String(new Date(ano, mes, 0).getDate()).padStart(2, '0')

  const [cosas, menus, delMesEntero, puedeApuntar] = await Promise.all([
    loApuntado(supabase, casa, fecha, fecha),
    losMenus(supabase, casa, fecha, fecha),
    loApuntado(supabase, casa, `${delMes}-01`, `${delMes}-${ultimo}`),
    /*
      ¿Puede esta pantalla apuntar? Se pregunta a la BASE y no se deduce
      aquí. Si el paso 75 no está dado, la función no existe, esto
      contesta que no y el botón no sale.

      Un botón que falla es peor que ningún botón — la misma regla que
      se aplicó con lo de tachar mientras todavía no se podía.
    */
    (async () => {
      try {
        const { data, error } = await supabase.rpc('la_cocina_apunta', { casa })
        if (error) return false
        return data === true
      } catch {
        return false
      }
    })(),
  ])

  const conAlgo = new Set(delMesEntero.map((c) => c.fecha).filter(Boolean) as string[])

  const comida = menus.find((m) => m.momento === 'comida')?.que ?? null
  const cena = menus.find((m) => m.momento === 'cena')?.que ?? null

  /* Lo que no tiene hora, y lo que cae fuera de la franja: arriba, con
     su hora escrita si la lleva. No se pierde nada. */
  const sueltas = cosas.filter((c) => !c.hora || fuera(c.hora))
  const conHora = cosas.filter((c) => c.hora && !fuera(c.hora))

  const d = new Date(`${fecha}T12:00:00`)
  const esHoy = fecha === hoy

  const horas: number[] = []
  for (let h = DESDE; h <= HASTA; h++) horas.push(h)

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-8">
        <div className="flex items-baseline gap-5">
          <Rotulo>{esHoy ? 'Hoy' : DIAS[d.getDay()]}</Rotulo>
          <p className="text-[34px] font-extrabold leading-none tracking-tight text-tinta">
            {d.getDate()} de {MESES[d.getMonth()]}
          </p>
        </div>

        <Link
          href={`/casa/calendario?lunes=${elLunesDe(fecha)}`}
          className="tocable flex h-[60px] shrink-0 items-center gap-3 rounded-full border border-borde bg-superficie px-6 text-[18px] font-extrabold text-tinta"
        >
          <Ico nombre="atras" tam={22} grosor={2.3} />
          Volver a la semana
        </Link>
      </div>

      <div className="mt-8 grid gap-12 xl:grid-cols-[1.6fr_1fr] xl:items-start">
        <div>
          {/* ── La tira del menú ── */}
          {/*
            Una línea, no una columna. Y solo si hay algo puesto: en el
            día de dentro de tres semanas no hay menú casi nunca, y una
            tira que diga «sin poner» en todos los días del año es una
            tira que se deja de leer.
          */}
          {(comida || cena) && (
            <div
              className="mb-7 flex flex-wrap items-center gap-x-10 gap-y-2 rounded-[24px] border bg-superficie px-7 py-4"
              style={{ borderColor: 'var(--t-borde)', borderLeft: `6px solid ${AMBITO.arena}` }}
            >
              <span style={{ color: AMBITO.arena }}>
                <Ico nombre="taza" tam={26} grosor={2.1} />
              </span>
              {comida && <Plato etiqueta="Comida" que={comida} />}
              {cena && <Plato etiqueta="Cena" que={cena} />}
            </div>
          )}

          {/* ── Lo que no tiene hora ── */}
          {sueltas.length > 0 && (
            <ul className="mb-7 space-y-3">
              {sueltas.map((c) => (
                <Cosa
                  key={c.id}
                  id={c.id}
                  titulo={c.titulo}
                  cuando={c.hora ? c.hora.slice(0, 5) : 'Sin hora'}
                  talla="lista"
                  hecha={c.estado === 'hecho'}
                />
              ))}
            </ul>
          )}

          {/* ── El día, hora a hora ── */}
          <div className="overflow-hidden rounded-[28px] border border-borde bg-superficie">
            {horas.map((h) => {
              const suyas = conHora.filter((c) => Number(c.hora!.slice(0, 2)) === h)
              const ahora = esHoy && new Date().getHours() === h

              return (
                <div
                  key={h}
                  className="flex items-stretch border-t border-borde first:border-t-0"
                  style={
                    /* La hora en la que estamos, teñida. Es el mismo
                       tinte que marca hoy en la semana, y hace que al
                       abrir el día de hoy el ojo caiga donde toca. */
                    ahora
                      ? { background: `color-mix(in srgb, ${AMBITO.verde} 7%, transparent)` }
                      : undefined
                  }
                >
                  <span className="w-[110px] shrink-0 border-r border-borde px-5 py-3 text-[19px] font-extrabold tabular-nums text-tenue">
                    {String(h).padStart(2, '0')}:00
                  </span>

                  <div className="min-w-0 flex-1 px-5 py-3">
                    {suyas.length === 0 ? (
                      /* Un hueco de la altura de una línea. Sin él, las
                         horas vacías medirían cero y el día dejaría de
                         parecer un día. */
                      <span className="block h-[30px]" />
                    ) : (
                      <ul className="space-y-2">
                        {suyas.map((c) => (
                          <EnSuHora key={c.id} c={c} />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {puedeApuntar && <Apuntar fecha={fecha} />}
        </div>

        {/* ── El mes, con este día marcado ── */}
        <div>
          <Rotulo>El mes</Rotulo>
          <div className="mt-5">
            <Mes hoy={hoy} senalado={fecha} conAlgo={conAlgo} lunes={elLunesDe(fecha)} />
          </div>
        </div>
      </div>
    </section>
  )
}

/*
  Una cosa dentro de su hora. Aquí no cabe la columna del cuándo —la
  hora ya la dice la fila— así que se usa el renglón grande: la marca de
  color, la hora exacta y el título.

  Se tacha tocándolo, como en todas partes en la pared.
*/
function EnSuHora({ c }: { c: CosaDeLaPared }) {
  return (
    <Cosa
      id={c.id}
      titulo={c.titulo}
      cuando={c.hora!.slice(0, 5)}
      talla="lista"
      hecha={c.estado === 'hecho'}
    />
  )
}

function Plato({ etiqueta, que }: { etiqueta: string; que: string }) {
  return (
    <span className="flex items-baseline gap-3">
      <span className="text-[14.5px] font-extrabold uppercase tracking-wider text-tenue">
        {etiqueta}
      </span>
      <span className="text-[23px] font-extrabold leading-tight text-tinta">{que}</span>
    </span>
  )
}

/** ¿Cae fuera de la franja que se dibuja? */
function fuera(hora: string): boolean {
  const h = Number(hora.slice(0, 2))
  return h < DESDE || h > HASTA
}
