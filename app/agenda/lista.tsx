import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Tarjeta from '../tablon/tarjeta'
import { Ico } from '../iconos'
import { atrasado, hoyAqui, type Recordatorio } from '@/lib/tablon'
import { citasDeLaFamilia, calendariosVisibles, type CitaDeAlguien } from '@/lib/agenda-google'
import Refrescar from './refrescar'

/*
  La lista de la Agenda — DE SEMANA EN SEMANA.

  QUÉ PASABA ANTES.

  Salía TODO lo pendiente de una vez: lo atrasado, hoy, mañana y
  "Próximamente", que era un cajón sin fondo con todo lo que hubiera
  hasta doscientas cosas. Con la aplicación recién estrenada eso son
  cuatro tarjetas y se ve bien; en cuanto haya un par de meses de uso
  —seguros que vencen, revisiones, recados— es un rollo interminable en
  el que no se distingue lo de mañana de lo de noviembre.

  CÓMO SE ARREGLA.

  Se enseñan SIETE DÍAS. Ni uno más. Con flechas para pasar de semana,
  igual que el Mes pasa de mes: la misma manera de moverse en las dos
  vistas, que es una cosa menos que aprender.

  TRES DECISIONES QUE PARECEN DETALLES Y NO LO SON:

  1. LO ATRASADO NO ENTRA EN LA SEMANA. Va clavado arriba, en rojo, y
     se queda ahí aunque pases de semana. Lo que se pasó sin hacer es
     lo único que nunca se puede esconder. (Y así tampoco sale dos
     veces: no aparece luego en su día.)

  2. NO SE PUEDE IR HACIA ATRÁS DE ESTA SEMANA. Porque no habría nada
     que ver: lo pendiente del pasado ya está arriba en rojo y lo hecho
     está en su pestaña. Una flecha que lleva a una pantalla vacía hace
     dudar de si la aplicación funciona. Para mirar hacia atrás está el
     Mes, que sí enseña un día entero como fue.

  3. LOS DÍAS VACÍOS NO SE PINTAN. Cuatro días diciendo "nada" ocupan
     media pantalla para no contar nada.

  Lo que cae más allá de la semana no se pierde: hay un botón abajo que
  dice cuántas cosas hay y lleva a verlas por meses.
*/

const SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]

export default async function Lista({
  ver,
  semana,
  de,
  dia,
}: {
  ver?: string
  semana?: string
  de?: string
  dia?: string
}) {
  const viendoHechas = ver === 'hechas'
  const viendoAdelante = ver === 'adelante'

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre')
  const nombres = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p.nombre]))

  const { data } = await supabase
    .from('recordatorios')
    .select(
      'id, titulo, tipo, asignado_a, creado_por, fecha, hora, estado, nota, documento_origen_id'
    )
    .order('fecha', { ascending: true, nullsFirst: false })
    .order('hora', { ascending: true, nullsFirst: true })
    .limit(200)

  const todos = (data ?? []) as Recordatorio[]
  const pendientes = todos.filter((r) => r.estado === 'pendiente')
  const hechos = todos.filter((r) => r.estado === 'hecho').slice(0, 20)

  /* La fecha de hoy DONDE VIVEN ELLOS, no donde está el servidor.
     El porqué está en `lib/tablon.ts`. */
  const hoyISO = hoyAqui()
  const hoy = deISO(hoyISO)

  const lunesEstaSemana = lunesDe(hoy)
  const lunes =
    semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) && semana > iso(lunesEstaSemana)
      ? lunesDe(deISO(semana))
      : lunesEstaSemana

  const domingo = sumar(lunes, 6)
  const desde = iso(lunes)
  const hasta = iso(domingo)

  const enEstaSemana = desde === iso(lunesEstaSemana)

  // Lo que se pasó de fecha y sigue sin hacerse. Nunca se esconde.
  const tarde = pendientes.filter(atrasado)

  // Los siete días. Lo atrasado ya está arriba, así que no se repite.
  const deLaSemana = pendientes.filter(
    (r) => r.fecha && r.fecha >= desde && r.fecha <= hasta && !atrasado(r)
  )

  /*
    Las citas de Google que esta persona puede ver: la suya siempre, y
    la del otro si él la ha compartido.

    Se piden UNA VEZ para la semana entera y se reparten por días:
    siete peticiones a Google para pintar una pantalla sería absurdo.
  */
  const calendarios = await calendariosVisibles(user.id)
  const dueno = de && calendarios.some((c) => c.id === de) ? de : null
  const suyas = await citasDeLaFamilia(user.id, desde, hasta, dueno)

  /*
    LOS SIETE DÍAS, TODOS. También los vacíos.

    Antes se quitaban los días sin nada —cuatro renglones diciendo
    «nada» ocupaban media pantalla para no contar nada— y eso valía
    cuando la pantalla era una lista corrida. Con la tira de arriba ya
    no: la tira ES los siete días, y un lunes que no aparece en una
    semana deja un hueco donde debería haber un lunes.

    Los vacíos siguen sin ocupar espacio: en la tira son una casilla
    sin puntos.
  */
  const dias = Array.from({ length: 7 }, (_, i) => iso(sumar(lunes, i))).map((f) => ({
    fecha: f,
    lista: deLaSemana.filter((r) => r.fecha === f),
    google: suyas.filter((c) => c.fecha === f),
  }))

  /*
    ── QUÉ DÍA SE ESTÁ MIRANDO ──

    Toda la semana de un vistazo arriba, y debajo UN día entero. Antes
    era la semana entera abierta en una lista corrida: se lee de
    arriba abajo, pero para saber si el jueves hay algo hay que
    recorrerla — que es justo lo que una agenda de papel contesta sin
    leer nada.

    Si no se ha elegido ninguno, se abre en el que interesa: hoy si
    estamos en esta semana, y si no el primer día que tenga algo. Una
    semana futura que se abriera vacía en su lunes haría pensar que no
    hay nada en toda la semana.
  */
  const conAlgo = dias.filter((d) => d.lista.length > 0 || d.google.length > 0)

  const elegido =
    dia && dias.some((d) => d.fecha === dia)
      ? dia
      : enEstaSemana && dias.some((d) => d.fecha === hoyISO)
        ? hoyISO
        : (conAlgo[0]?.fecha ?? desde)

  const abierto = dias.find((d) => d.fecha === elegido) ?? dias[0]

  // Lo que viene después de la semana que se está mirando.
  const adelante = pendientes.filter((r) => r.fecha && r.fecha > hasta)
  const sinFecha = pendientes.filter((r) => !r.fecha)
  const masAlla = adelante.length + sinFecha.length

  return (
    <>
      {/* ── Por hacer · Hechas ── */}
      <div className="mt-1 flex gap-2">
        <Link
          href="/agenda"
          className="flex h-11 flex-1 items-center justify-center rounded-full text-[15px] font-extrabold"
          style={
            viendoHechas
              ? { background: 'var(--t-superficie)', color: 'var(--t-tinta-suave)', border: '1px solid var(--t-borde)' }
              : { background: '#F59E0B', color: '#0F172A' }
          }
        >
          Por hacer · {pendientes.length}
        </Link>
        <Link
          href="/agenda?ver=hechas"
          className="flex h-11 flex-1 items-center justify-center rounded-full text-[15px] font-extrabold"
          style={
            viendoHechas
              ? { background: '#F59E0B', color: '#0F172A' }
              : { background: 'var(--t-superficie)', color: 'var(--t-tinta-suave)', border: '1px solid var(--t-borde)' }
          }
        >
          Hechas
        </Link>
      </div>

      {viendoHechas ? (
        // ── HECHAS ────────────────────────────────────────────
        hechos.length === 0 ? (
          <Vacio texto="Todavía no hay nada marcado como hecho." />
        ) : (
          <ul className="mt-4 space-y-2.5">
            {hechos.map((r) => (
              <Tarjeta key={r.id} r={r} nombres={nombres} yo={user.id} />
            ))}
          </ul>
        )
      ) : viendoAdelante ? (
        // ── MÁS ADELANTE ──────────────────────────────────────
        <MasAdelante
          adelante={adelante}
          sinFecha={sinFecha}
          nombres={nombres}
          yo={user.id}
        />
      ) : (
        // ── LA SEMANA ─────────────────────────────────────────
        <>
          {tarde.length > 0 && (
            <section className="mt-5">
              <h2 className="rotulo" style={{ color: '#FF6B6B' }}>
                Sin hacer · {tarde.length}
              </h2>
              <ul className="mt-2.5 space-y-2.5">
                {tarde.map((r) => (
                  <Tarjeta key={r.id} r={r} nombres={nombres} yo={user.id} />
                ))}
              </ul>
            </section>
          )}

          {/*
            DE QUIÉN SON LAS CITAS DE GOOGLE.

            Solo aparece cuando hay más de un calendario: con uno solo,
            unos botones para elegir "el de Juan Miguel" cuando no hay
            otro es una decisión inventada.
          */}
          {calendarios.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {calendarios.length > 1 && (
                <>
                  <Filtro texto="Los dos" href={paraSemana(desde)} puesto={!dueno} color="#0F172A" />
                  {calendarios.map((c) => (
                    <Filtro
                      key={c.id}
                      texto={c.nombre.split(' ')[0]}
                      href={`${paraSemana(desde)}&de=${c.id}`}
                      puesto={dueno === c.id}
                      color={c.color}
                    />
                  ))}
                </>
              )}
              {/* Con un solo calendario no hay filtro, pero el botón de
                  actualizar sigue haciendo falta: es lo que se pulsa
                  cuando acabas de apuntar algo en el móvil. */}
              <Refrescar cuantasHabia={suyas.length} />
            </div>
          )}

          {/* ── De qué semana estamos hablando ── */}
          <div className="mt-5 flex items-center gap-1">
            {enEstaSemana ? (
              /* Hueco del mismo tamaño que la flecha, para que el
                 texto no salte de sitio al cambiar de semana. */
              <span className="h-12 w-12 shrink-0" aria-hidden />
            ) : (
              <Link
                href={paraSemana(iso(sumar(lunes, -7)))}
                aria-label="Semana anterior"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-tinta"
              >
                <Ico nombre="atras" tam={23} grosor={2.4} />
              </Link>
            )}

            <p className="flex-1 text-center text-[17px] font-extrabold leading-tight tracking-tight">
              {enEstaSemana ? 'Esta semana' : rangoEnPalabras(lunes, domingo)}
              {enEstaSemana && (
                <span className="mt-0.5 block text-[14px] font-bold text-tenue">
                  {rangoEnPalabras(lunes, domingo)}
                </span>
              )}
            </p>

            <Link
              href={paraSemana(iso(sumar(lunes, 7)))}
              aria-label="Semana siguiente"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-tinta"
            >
              <Ico nombre="flecha" tam={23} grosor={2.4} />
            </Link>
          </div>

          {/* ── La semana entera, en una fila ── */}
          <Tira dias={dias} elegido={elegido} hoyISO={hoyISO} desde={desde} de={dueno} />

          {/* ── Y debajo, el día que se esté mirando ── */}
          {abierto && (
            <section className="mt-5">
              <h2 className="rotulo">{diaEnPalabras(abierto.fecha, hoyISO)}</h2>

              {abierto.lista.length === 0 && abierto.google.length === 0 ? (
                <Vacio
                  texto={
                    conAlgo.length === 0
                      ? enEstaSemana
                        ? 'Nada más esta semana.'
                        : 'Nada esta semana.'
                      : 'Este día no tienes nada.'
                  }
                />
              ) : (
                <ul className="mt-2.5 space-y-2.5">
                  {abierto.lista.map((r) => (
                    <Tarjeta key={r.id} r={r} nombres={nombres} yo={user.id} />
                  ))}
                  {abierto.google.map((c) => (
                    <DeGoogle key={c.uid} c={c} conVarios={calendarios.length > 1} />
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Lo que queda más allá NO se esconde: se dice cuánto hay. */}
          {masAlla > 0 && (
            <Link
              href="/agenda?ver=adelante"
              className="mt-5 flex h-[56px] items-center justify-center gap-2 rounded-[18px] border border-borde bg-superficie text-[16.5px] font-extrabold text-tinta"
            >
              Más adelante · {masAlla}
              <Ico nombre="flecha" tam={19} grosor={2.3} className="text-borde" />
            </Link>
          )}
        </>
      )}

      <Link
        href="/tablon/nuevo"
        className="mt-3 flex h-[60px] items-center justify-center gap-2.5 rounded-[18px] bg-boton text-[18px] font-extrabold text-boton-texto"
      >
        <Ico nombre="mas" tam={22} grosor={2.3} />
        Apuntar algo
      </Link>
    </>
  )
}

/*
  ═══════════════════════════════════════════════════════════════
  LA TIRA DE LA SEMANA
  ═══════════════════════════════════════════════════════════════

  Los siete días en una fila, como en una agenda de papel: la letra
  arriba, el número debajo, y unos puntos que dicen cuánto hay ese
  día. Se toca uno y debajo sale lo suyo.

  ─────────────────────────────────────────────────────────────
  POR QUÉ PUNTOS Y NO EL NÚMERO

  Un «3» pequeño dentro de una casilla de 44 px hay que leerlo. Tres
  puntos se ven sin leer, incluso de reojo — y el reojo es como se
  mira una agenda. A partir de cuatro cosas los puntos dejarían de
  distinguirse, así que a partir de ahí se ponen tres y se ensancha
  el tercero: la diferencia que importa es «hay poco» / «hay lío», no
  si son cinco o seis.

  ─────────────────────────────────────────────────────────────
  LA CASILLA ENTERA ES EL BOTÓN

  44 px de ancho por 62 de alto. Está por encima del mínimo que nos
  hemos puesto para lo que hay que pulsar, y sobre todo no exige
  puntería: el dedo cae en la casilla, no en el número.

  Y el día elegido no se marca SOLO con color: lleva el fondo relleno
  y el número en negrita. Quien no distinga bien los colores tiene que
  poder saber igualmente en qué día está.
*/
function Tira({
  dias,
  elegido,
  hoyISO,
  desde,
  de,
}: {
  dias: { fecha: string; lista: Recordatorio[]; google: CitaDeAlguien[] }[]
  elegido: string
  hoyISO: string
  desde: string
  de: string | null
}) {
  const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return (
    <div className="mt-4 flex justify-between gap-1">
      {dias.map((d, i) => {
        const puesto = d.fecha === elegido
        const esHoy = d.fecha === hoyISO
        const cuantos = d.lista.length + d.google.length
        const numero = Number(d.fecha.slice(8, 10))

        return (
          <Link
            key={d.fecha}
            href={`/agenda?semana=${desde}&dia=${d.fecha}${de ? `&de=${de}` : ''}`}
            aria-current={puesto ? 'date' : undefined}
            aria-label={`${SEMANA[(i + 1) % 7]} ${numero}${
              cuantos === 0 ? ', sin nada' : cuantos === 1 ? ', 1 cosa' : `, ${cuantos} cosas`
            }`}
            className="flex h-[62px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-[14px]"
            style={
              puesto
                ? { background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }
                : {
                    background: 'var(--t-superficie)',
                    color: 'var(--t-tinta-suave)',
                    border: '1px solid var(--t-borde)',
                  }
            }
          >
            <span className="text-[12px] font-bold uppercase tracking-wider opacity-70">
              {LETRAS[i]}
            </span>
            <span
              className="text-[17px] font-extrabold leading-none"
              /* Hoy va subrayado por debajo del número, no de otro
                 color: el color ya lo usa el día elegido y dos cosas
                 distintas del mismo color no se distinguen. */
              style={
                esHoy && !puesto
                  ? { color: 'var(--t-tinta)', textDecoration: 'underline', textUnderlineOffset: 3 }
                  : undefined
              }
            >
              {numero}
            </span>

            {/* El renglón de los puntos existe siempre, con o sin
                puntos: si apareciera solo en los días con algo, las
                casillas tendrían alturas distintas y la fila bailaría. */}
            <span className="flex h-[6px] items-center gap-[3px]" aria-hidden>
              {Array.from({ length: Math.min(cuantos, 3) }, (_, k) => (
                <span
                  key={k}
                  className="h-[5px] rounded-full"
                  style={{
                    width: k === 2 && cuantos > 3 ? 11 : 5,
                    background: puesto ? 'var(--t-boton-texto)' : '#F59E0B',
                    opacity: puesto ? 0.75 : 1,
                  }}
                />
              ))}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

/*
  Todo lo que viene después de la semana, por meses.

  Por meses y no en una lista seguida porque a partir de aquí ya no se
  mira "qué tengo que hacer" sino "cuándo cae aquello" — y para eso el
  mes es la unidad en la que piensa cualquiera.
*/
function MasAdelante({
  adelante,
  sinFecha,
  nombres,
  yo,
}: {
  adelante: Recordatorio[]
  sinFecha: Recordatorio[]
  nombres: Record<string, string>
  yo: string
}) {
  const meses = new Map<string, Recordatorio[]>()
  for (const r of adelante) {
    const clave = r.fecha!.slice(0, 7)
    meses.set(clave, [...(meses.get(clave) ?? []), r])
  }

  return (
    <>
      <Link
        href="/agenda"
        className="mt-4 flex h-12 items-center gap-1.5 text-[16px] font-extrabold text-tinta"
      >
        <Ico nombre="atras" tam={20} grosor={2.4} />
        Volver a la semana
      </Link>

      {meses.size === 0 && sinFecha.length === 0 && (
        <Vacio texto="No hay nada más apuntado." />
      )}

      {[...meses.entries()].map(([clave, lista]) => (
        <section key={clave} className="mt-5">
          <h2 className="rotulo">{mesEnPalabras(clave)}</h2>
          <ul className="mt-2.5 space-y-2.5">
            {lista.map((r) => (
              <Tarjeta key={r.id} r={r} nombres={nombres} yo={yo} />
            ))}
          </ul>
        </section>
      ))}

      {sinFecha.length > 0 && (
        <section className="mt-5">
          <h2 className="rotulo">Cuando se pueda · {sinFecha.length}</h2>
          <ul className="mt-2.5 space-y-2.5">
            {sinFecha.map((r) => (
              <Tarjeta key={r.id} r={r} nombres={nombres} yo={yo} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/*
  Una cita traída del Google de esta persona.

  De borde discontinuo y SIN ser un enlace, a propósito. Es de fuera:
  vive en su calendario, HUBI solo la enseña. Si se pudiera tocar y
  marcar "hecho", HUBI estaría prometiendo algo que no puede cumplir —
  ese cambio no llegaría nunca a Google.
*/
function DeGoogle({ c, conVarios }: { c: CitaDeAlguien; conVarios: boolean }) {
  return (
    <li className="flex items-start gap-3 rounded-[20px] border border-dashed border-borde bg-superficie px-3.5 py-3.5">
      {/* Una barra del color de su dueño. Pero el color NO va solo:
          debajo está el nombre escrito. Quien no distinga bien los
          colores tiene que poder saber igualmente de quién es. */}
      <span
        className="mt-0.5 h-10 w-[4px] shrink-0 rounded-full"
        style={{ background: c.color }}
        aria-hidden
      />
      <span className="w-[46px] shrink-0 text-[15px] font-extrabold text-tinta-suave">
        {c.hora ?? <span className="text-tenue">—</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold leading-snug">{c.titulo}</span>
        <span className="mt-0.5 block text-[14px] font-bold text-tenue">
          {[conVarios ? c.de : null, c.lugar, 'Google']
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </li>
  )
}

function Filtro({
  texto,
  href,
  puesto,
  color,
}: {
  texto: string
  href: string
  puesto: boolean
  color: string
}) {
  return (
    <Link
      href={href}
      aria-current={puesto ? 'page' : undefined}
      className="flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-extrabold"
      style={
        puesto
          ? { background: color, color: '#FFFFFF' }
          : {
              background: 'var(--t-superficie)',
              color: 'var(--t-tinta-suave)',
              border: '1px solid var(--t-borde)',
            }
      }
    >
      {!puesto && (
        <span className="h-[9px] w-[9px] rounded-full" style={{ background: color }} />
      )}
      {texto}
    </Link>
  )
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="mt-5 rounded-[20px] bg-superficie px-6 py-10 text-center text-[17px] font-medium text-tinta-suave">
      {texto}
    </p>
  )
}

// ── Fechas ───────────────────────────────────────────────────
// Todas en la hora de aquí. Ni una sola con `toISOString()`.

function iso(f: Date): string {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

function deISO(s: string): Date {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}

function sumar(f: Date, dias: number): Date {
  const otro = new Date(f.getFullYear(), f.getMonth(), f.getDate())
  otro.setDate(otro.getDate() + dias)
  return otro
}

/** El lunes de la semana de esa fecha. En España la semana empieza en lunes. */
function lunesDe(f: Date): Date {
  return sumar(f, -((f.getDay() + 6) % 7))
}

function paraSemana(lunesISO: string): string {
  return `/agenda?semana=${lunesISO}`
}

/** "24 – 30 de agosto" · "31 de agosto – 6 de septiembre" */
function rangoEnPalabras(lunes: Date, domingo: Date): string {
  const mismoMes = lunes.getMonth() === domingo.getMonth()
  const a = mismoMes
    ? String(lunes.getDate())
    : `${lunes.getDate()} de ${MESES[lunes.getMonth()]}`
  return `${a} – ${domingo.getDate()} de ${MESES[domingo.getMonth()]}`
}

/** "Hoy · miércoles 26" · "Mañana · jueves 27" · "Viernes 28" */
function diaEnPalabras(fecha: string, hoyISO: string): string {
  const f = deISO(fecha)
  const nombre = SEMANA[f.getDay()]
  const manana = iso(sumar(deISO(hoyISO), 1))

  if (fecha === hoyISO) return `Hoy · ${nombre} ${f.getDate()}`
  if (fecha === manana) return `Mañana · ${nombre} ${f.getDate()}`
  return `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} ${f.getDate()}`
}

/** "2026-09" → "Septiembre" · "Enero de 2027" si cambia el año */
function mesEnPalabras(clave: string): string {
  const [a, m] = clave.split('-').map(Number)
  const nombre = MESES[m - 1]
  const mayus = nombre.charAt(0).toUpperCase() + nombre.slice(1)
  return a === new Date().getFullYear() ? mayus : `${mayus} de ${a}`
}
