import Link from '@/app/enlace'
import { notFound } from 'next/navigation'
import { hoyAqui } from '@/lib/tablon'
import { elLunesDe } from '@/lib/menus'
import { laPared, loApuntado, losMenus, type CosaDeLaPared } from '@/lib/pared'
import { loDeHoy } from '@/lib/rutinas'
import { Ico } from '../../../iconos'
import { AMBITO } from '../../../piezas'
import { colorApagado } from '@/lib/gente'
import Cosa from '../../cosa'
import Rutinas from '../../rutinas'
import Mes from '../../calendario/mes'
import { Rotulo } from '../../rotulo'
import Apuntar, { type Quien } from './apuntar'

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

/*
  Los platos de una comida, en un renglón. Un punto medio entre ellos,
  que no se confunde con el nombre de un plato como sí hace la coma
  («lentejas con chorizo, y arroz»). Desde el paso 85 una comida puede
  tener varios.
*/
function juntos(menus: { momento: string; que: string | null }[], cual: string): string | null {
  const nombres = menus
    .filter((m) => m.momento === cual)
    .map((m) => (m.que ?? '').trim())
    .filter(Boolean)
  return nombres.length > 0 ? nombres.join(' · ') : null
}

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

  const [cosas, menus, delMesEntero, rutinas, puedeApuntar, gente, puedeCambiar] =
    await Promise.all([
    loApuntado(supabase, casa, fecha, fecha),
    losMenus(supabase, casa, fecha, fecha),
    loApuntado(supabase, casa, `${delMes}-01`, `${delMes}-${ultimo}`),
    /*
      ── Y LO DE CADA DÍA ──

      Haris: *«¿no falta el tema de tareas, de las cosas que hay que
      hacer en casa, o rutinas?»*.

      No faltaba, pero estaba a medias: las rutinas solo salían en Hoy.
      O sea que la pared sabía lo que tocaba HOY y no sabía decir lo que
      toca el jueves — y «lo de cada día» es justamente lo que se
      pregunta cuando se mira un día de la semana que viene.

      Va aquí, con lo demás del día, y no en una pestaña nueva: es el
      punto 18 del planteamiento, y es lo que ya decidimos cuando
      Tareas se fue al Calendario. Para Juan Miguel y Conchita todo son
      **cosas que tengo que recordar**, y una sexta pestaña volvería a
      pedirles que distingan entre una tarea y una rutina antes de
      saber dónde mirar.

      Y en Hoy se quedan donde estaban: esto añade, no mueve.
    */
    loDeHoy(supabase, casa, null, fecha),
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
    /*
      Quién vive aquí, para poder ponerle nombre a lo que se apunta.
      Solo personas: a una pantalla de cocina no se le asignan recados,
      y la política del paso 76 lo rechazaría de todas formas.
    */
    (async () => {
      try {
        const { data } = await supabase
          .from('miembros')
          .select('perfil_id, color')
          .eq('hogar_id', casa)
          .eq('clase', 'persona')
          .not('aceptado_en', 'is', null)
        const suyos = (data ?? []) as { perfil_id: string; color: string | null }[]
        if (suyos.length === 0) return [] as Quien[]

        const { data: perfiles } = await supabase
          .from('perfiles')
          .select('id, nombre')
          .in('id', suyos.map((m) => m.perfil_id))

        const nombreDe = new Map(
          ((perfiles ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre])
        )

        return suyos
          .map((m) => ({
            id: m.perfil_id,
            /* Solo el nombre de pila: en un botón de una pared, «María
               del Carmen Rodríguez» no cabe y no hace falta. */
            nombre: (nombreDe.get(m.perfil_id) ?? '').split(' ')[0],
            color: colorApagado(m.color, null),
          }))
          .filter((q) => q.nombre.length > 0) as Quien[]
      } catch {
        return [] as Quien[]
      }
    })(),
    /*
      ¿Puede esta pantalla cambiar y quitar? Se le pregunta a la base
      igual que lo de apuntar. Si el paso 79 no está dado, la función no
      existe, esto contesta que no y el botón de Cambiar no sale.
    */
    (async () => {
      try {
        const { data, error } = await supabase.rpc('la_cocina_cambia', { casa })
        if (error) return false
        return data === true
      } catch {
        return false
      }
    })(),
  ])

  const conAlgo = new Set(delMesEntero.map((c) => c.fecha).filter(Boolean) as string[])

  const comida = juntos(menus, 'comida')
  const cena = juntos(menus, 'cena')

  /* Lo que no tiene hora, y lo que cae fuera de la franja: arriba, con
     su hora escrita si la lleva. No se pierde nada. */
  const sueltas = cosas.filter((c) => !c.hora || fuera(c.hora))
  const conHora = cosas.filter((c) => c.hora && !fuera(c.hora))

  const d = new Date(`${fecha}T12:00:00`)
  const esHoy = fecha === hoy

  /* El nombre de pila de cada uno, para poder decir de quién es una
     rutina. Sale de `gente`, que ya se ha pedido arriba. */
  const comoSeLlama = new Map(gente.map((g) => [g.id, g.nombre]))

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
                  cambiable={puedeCambiar}
                  fecha={c.fecha}
                  hora={c.hora}
                  para={c.asignado_a ?? null}
                  gente={gente}
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
                          <EnSuHora key={c.id} c={c} cambiable={puedeCambiar} gente={gente} />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {puedeApuntar && <Apuntar fecha={fecha} gente={gente} />}
        </div>

        <div className="space-y-12">
          {/*
            ── LO DE CADA DÍA ──

            En la columna de la derecha y encima del mes: lo de la
            izquierda es lo que pasa ESE día a una hora, y esto es lo
            que se repite. Juntarlos en la misma tira haría que «sacar
            la basura» y «médico a las diez y media» se leyeran como la
            misma clase de cosa.

            Se tacha SOLO si el día es hoy. Marcar una rutina significa
            «esto se ha hecho hoy» —la fecha la pone la base—, así que
            en el jueves que viene se lee y no se toca. Está explicado
            en `rutinas.tsx`.
          */}
          {rutinas.length > 0 && (
            <Rutinas
              enElDia
              sePuedeTachar={esHoy}
              rutinas={rutinas.map((r) => ({
                id: r.id,
                que: r.que,
                hora: r.hora,
                hecha: r.hecha,
                dequien: r.para ? (comoSeLlama.get(r.para) ?? null) : null,
              }))}
            />
          )}

          {/* ── El mes, con este día marcado ── */}
          <div>
            <Rotulo>El mes</Rotulo>
            <div className="mt-5">
              <Mes hoy={hoy} senalado={fecha} conAlgo={conAlgo} lunes={elLunesDe(fecha)} />
            </div>
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
function EnSuHora({
  c,
  cambiable,
  gente,
}: {
  c: CosaDeLaPared
  cambiable: boolean
  gente: Quien[]
}) {
  return (
    <Cosa
      id={c.id}
      titulo={c.titulo}
      cuando={c.hora!.slice(0, 5)}
      talla="lista"
      hecha={c.estado === 'hecho'}
      cambiable={cambiable}
      fecha={c.fecha}
      hora={c.hora}
      para={c.asignado_a ?? null}
      gente={gente}
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
