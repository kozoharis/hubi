import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Tarjeta from '../tablon/tarjeta'
import { Ico, Volver, pintaDe } from '../iconos'
import { AMBITO, ambitoDeColor } from '@/lib/ambitos'
import { Aviso, BotonPrincipal, BotonSecundario, Pildora } from '../piezas'
import { atrasado, hoyAqui, type Recordatorio } from '@/lib/tablon'
import { citasDeLaFamilia, calendariosVisibles, type CitaDeAlguien } from '@/lib/agenda-google'
import { enlaceAgenda } from '@/lib/agenda-enlace'
import Refrescar from './refrescar'
import { elEspacioO } from '@/lib/espacio'

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
}: {
  ver?: string
  semana?: string
  de?: string
}) {
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
    .eq('hogar_id', await elEspacioO(supabase))
    .order('fecha', { ascending: true, nullsFirst: false })
    .order('hora', { ascending: true, nullsFirst: true })
    .limit(200)

  const todos = (data ?? []) as Recordatorio[]
  const pendientes = todos.filter((r) => r.estado === 'pendiente')

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

  /*
    ── LO VENCIDO YA NO ES UNA PESTAÑA ──

    Lo era, y ése era el problema: algo que se pasó de fecha y sigue
    sin hacerse solo se veía SI ALGUIEN PULSABA esa pestaña. Lo más
    urgente de la Agenda estaba escondido detrás de un botón que hay
    que saber que existe.

    Ahora sube arriba del todo, siempre que haya algo. Si no hay nada
    vencido, no aparece: un recuadro vacío diciendo «no hay nada
    vencido» es ruido en la pantalla que más se mira.
  */
  const tarde = pendientes.filter(atrasado)

  /*
    ── Y LO HECHO SE VE EN SU DÍA, TACHADO ──

    También era pestaña, y también estaba mal: lo hecho no es una
    categoría hermana de lo pendiente, es LO MISMO un rato después.
    Sacarlo de su día para meterlo en una lista aparte hacía que el
    martes dijera «una cosa» cuando en realidad hubo dos y una se hizo.

    Con los dos juntos, el martes cuenta lo que de verdad pasó el
    martes. Y lo hecho se distingue sin leer: tachado y atenuado.
  */
  const deLaSemana = todos.filter(
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

  /* Los días que tienen algo. Los vacíos no se pintan abajo —cuatro
     renglones diciendo «nada» ocupan media pantalla para no contar
     nada— pero siguen en la tira, que es donde se ve el hueco. */
  const conAlgo = dias.filter((d) => d.lista.length > 0 || d.google.length > 0)

  // Lo que viene después de la semana que se está mirando.
  const adelante = pendientes.filter((r) => r.fecha && r.fecha > hasta)
  const sinFecha = pendientes.filter((r) => !r.fecha)
  const masAlla = adelante.length + sinFecha.length

  return (
    <>
      {/*
        ═══════════════════════════════════════════════════════
        AQUÍ HABÍA TRES PESTAÑAS Y AHORA NO HAY NINGUNA
        ═══════════════════════════════════════════════════════

        «Por hacer · Vencidas · Hechas». Entre ésas, la escala, el
        filtro de personas, la semana y la tira, había CINCO filas de
        controles antes de que apareciera una sola cosa que hacer —
        más de media pantalla en un móvil de 360.

        Las tres se van, y cada una por su motivo:

        · VENCIDAS era lo más urgente de HUBI escondido detrás de un
          botón que hay que saber que existe. Ahora sube arriba del
          todo, y solo cuando hay algo.

        · HECHAS no es una categoría hermana de lo pendiente: es lo
          mismo un rato después. Vuelve a su día, tachado.

        · POR HACER, sin las otras dos, no distinguía nada: era la
          única pestaña. Una pestaña sola no es una pestaña.
      */}
      {viendoAdelante ? (
        // ── MÁS ADELANTE ──────────────────────────────────────
        <MasAdelante
          adelante={adelante}
          sinFecha={sinFecha}
          nombres={nombres}
          yo={user.id}
          volver={enlaceAgenda({ semana, de })}
        />
      ) : (
        // ── LA SEMANA ─────────────────────────────────────────
        <>
          {/*
            ═══════════════════════════════════════════════════
            LO VENCIDO, ARRIBA DEL TODO Y SIN PEDIRLO
            ═══════════════════════════════════════════════════

            Era una pestaña. Y una pestaña es un sitio donde hay que
            entrar: quien no la pulsara —o no supiera que estaba— no
            se enteraba nunca de que la ITV se pasó hace tres días.

            Lo urgente no se guarda detrás de un botón. Sube aquí, con
            su color de alerta, y **solo cuando hay algo**: un recuadro
            permanente diciendo «no hay nada vencido» sería ruido en la
            pantalla que más se mira.
          */}
          {tarde.length > 0 && (
            <section className="mt-4">
              <Aviso
                titulo={
                  tarde.length === 1
                    ? 'Una cosa se pasó de fecha'
                    : `${tarde.length} cosas se pasaron de fecha`
                }
                explicacion="Sigue sin hacerse. Tócala para marcarla o cambiarle el día."
              />
              <ul className="mt-2.5 space-y-2.5">
                {tarde.map((r) => (
                  <Tarjeta key={r.id} r={r} nombres={nombres} yo={user.id} />
                ))}
              </ul>
            </section>
          )}

          {/* ── De qué semana estamos hablando ── */}
          <div className="mt-5 flex items-center gap-1">
            {enEstaSemana ? (
              /* Hueco del mismo tamaño que la flecha, para que el
                 texto no salte de sitio al cambiar de semana. */
              <span className="h-12 w-12 shrink-0" aria-hidden />
            ) : (
              <Link
                href={enlaceAgenda({ ver, de }, { semana: iso(sumar(lunes, -7)) })}
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
              href={enlaceAgenda({ ver, de }, { semana: iso(sumar(lunes, 7)) })}
              aria-label="Semana siguiente"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-tinta"
            >
              <Ico nombre="flecha" tam={23} grosor={2.4} />
            </Link>
          </div>

          {/* ── La semana entera, en una fila ── */}
          <Tira dias={dias} hoyISO={hoyISO} de={dueno} />

          {/*
            ═══════════════════════════════════════════════════
            Y DEBAJO, LA SEMANA ENTERA
            ═══════════════════════════════════════════════════

            Antes salía UN día: el elegido en la tira. Y con eso la
            semana no se veía nunca — para saber qué hay el jueves
            había que tocar el jueves, y para compararlo con el viernes
            tocar otra vez. Una agenda semanal que enseña un día es una
            agenda diaria con una tira de adorno.

            Ahora se enseñan los siete, resumidos: una línea por cosa,
            con su hora si la tiene. Los días vacíos no se pintan —
            cuatro renglones diciendo «nada» ocupan media pantalla para
            no contar nada— pero siguen estando en la tira, que es
            donde se ve el hueco.

            Y el día se abre entrando: el título de cada día lleva a su
            pantalla de horas.
          */}
          {conAlgo.length === 0 ? (
            <Vacio
              texto={enEstaSemana ? 'Nada más esta semana.' : 'Nada esta semana.'}
            />
          ) : (
            <div className="mt-5 space-y-5">
              {conAlgo.map((d) => (
                <section key={d.fecha}>
                  <Link
                    href={`/agenda?vista=dia&dia=${d.fecha}${dueno ? `&de=${dueno}` : ''}`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    {/* Hoy en el color de acción. Iba en
                        `--color-verde`, que ahora es el ámbito de la
                        Finca: el día de hoy salía pintado del color de
                        una sección concreta. */}
                    <h2
                      className="rotulo"
                      style={
                        d.fecha === hoyISO ? { color: 'var(--color-accion)' } : undefined
                      }
                    >
                      {diaEnPalabras(d.fecha, hoyISO)}
                    </h2>
                    <span className="flex items-center gap-1 text-[13.5px] font-bold text-tenue">
                      Ver el día
                      <Ico nombre="flecha" tam={14} grosor={2.6} />
                    </span>
                  </Link>

                  <ul className="mt-2 space-y-1.5">
                    {d.lista.map((r) => (
                      <li key={r.id}>
                        <Renglon
                          href={`/tablon/${r.id}`}
                          hora={r.hora}
                          titulo={r.titulo}
                          color={AMBITO[pintaDe(r.titulo).ambito]}
                          hecha={r.estado === 'hecho'}
                          pie={
                            r.asignado_a
                              ? (nombres[r.asignado_a] ?? '').split(' ')[0]
                              : null
                          }
                        />
                      </li>
                    ))}
                    {d.google.map((c) => (
                      <li key={c.uid}>
                        <Renglon
                          href={null}
                          hora={c.hora}
                          titulo={c.titulo}
                          color={c.color}
                          pie={
                            [calendarios.length > 1 ? c.de.split(' ')[0] : null, c.lugar]
                              .filter(Boolean)
                              .join(' · ') || null
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {/*
            ── DE QUIÉN SON LAS CITAS, Y ACTUALIZAR ──

            Esto estaba ARRIBA, en la cuarta fila de controles, y no
            pinta nada ahí: filtrar por persona es algo que se hace de
            vez en cuando, no todos los días. Baja al final de la
            semana, que es donde se mira cuando de verdad hace falta.

            Y solo si hay más de un calendario: unos botones para
            elegir «el de Juan Miguel» cuando no hay otro es una
            decisión inventada.
          */}
          {calendarios.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {calendarios.length > 1 && (
                <>
                  <Pildora
                    href={enlaceAgenda({ ver, semana: desde }, { de: null })}
                    puesta={!dueno}
                  >
                    Los dos
                  </Pildora>
                  {calendarios.map((c) => (
                    <Pildora
                      key={c.id}
                      href={enlaceAgenda({ ver, semana: desde }, { de: c.id })}
                      puesta={dueno === c.id}
                      color={AMBITO[ambitoDeColor(c.color)]}
                    >
                      {c.nombre.split(' ')[0]}
                    </Pildora>
                  ))}
                </>
              )}
              {/* Con un solo calendario no hay filtro, pero actualizar
                  sigue haciendo falta: es lo que se pulsa cuando
                  acabas de apuntar algo en el móvil. */}
              <Refrescar cuantasHabia={suyas.length} />
            </div>
          )}

          {/* Lo que queda más allá NO se esconde: se dice cuánto hay. */}
          {masAlla > 0 && (
            <div className="mt-4">
              <BotonSecundario
                href={enlaceAgenda({ de }, { ver: 'adelante' })}
                icono="flecha"
              >
                Más adelante · {masAlla}
              </BotonSecundario>
            </div>
          )}
        </>
      )}

      {/* Apuntar algo ES la acción de la Agenda. Iba con `bg-boton`,
          que era el color de antes. */}
      <div className="mt-3">
        <BotonPrincipal href="/tablon/nuevo" icono="mas">
          Apuntar algo
        </BotonPrincipal>
      </div>
    </>
  )
}


/*
  Una cosa de la semana, en un renglón.

  Resumida a propósito: la hora, el título y de quién es. Lo demás
  —la nota, el documento del que salió, el botón de hecho— está al
  entrar. Siete días con tarjetas enteras serían tres pantallas de
  deslizar para ver una semana.

  La hora, en columna fija a la izquierda: así todas las horas quedan
  alineadas y el ojo puede bajar por ellas sin leer los títulos.
*/
function Renglon({
  href,
  hora,
  titulo,
  color,
  pie,
  hecha = false,
}: {
  href: string | null
  hora: string | null
  titulo: string
  color: string
  pie: string | null
  /*
    ── LO HECHO SE QUEDA EN SU DÍA ──

    Antes se lo llevaba una pestaña aparte, y con eso el martes decía
    «una cosa» cuando en realidad hubo dos y una se hizo. Aquí se
    queda, tachado y atenuado: se distingue sin leer y el día cuenta
    lo que de verdad pasó.

    Y con el tic además del tachado: en una pantalla pequeña, a
    contraluz, una línea fina encima de una palabra se pierde.
  */
  hecha?: boolean
}) {
  const dentro = (
    <span
      className={`flex items-center gap-2.5 rounded-[14px] border border-borde bg-superficie px-3 py-2.5 ${
        hecha ? 'opacity-55' : ''
      }`}
    >
      <span
        className="w-[40px] shrink-0 text-[12.5px] font-extrabold tabular-nums"
        style={{ color: hora ? color : 'var(--t-apagado)' }}
      >
        {hora ? hora.slice(0, 5) : '—'}
      </span>
      <span
        className="h-[26px] w-[3px] shrink-0 rounded-full"
        style={{ background: hecha ? 'var(--t-bien)' : color }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[16px] font-bold leading-snug"
          style={hecha ? { textDecorationLine: 'line-through' } : undefined}
        >
          {titulo}
        </span>
        {pie && (
          <span className="block truncate text-[13px] font-bold text-tenue">{pie}</span>
        )}
      </span>
      {hecha && (
        <span className="shrink-0" style={{ color: 'var(--t-bien)' }}>
          <Ico nombre="check" tam={17} grosor={2.6} />
        </span>
      )}
    </span>
  )

  if (!href) return <span className="block">{dentro}</span>
  return (
    <Link href={href} className="block">
      {dentro}
    </Link>
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
  hoyISO,
  de,
}: {
  dias: { fecha: string; lista: Recordatorio[]; google: CitaDeAlguien[] }[]
  hoyISO: string
  de: string | null
}) {
  const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return (
    <div className="mt-4 flex justify-between gap-1">
      {dias.map((d, i) => {
        /* Ya no hay «día elegido»: tocar un día ENTRA en él. Lo único
           que se marca es hoy, que es el punto de referencia. */
        const puesto = d.fecha === hoyISO
        const esHoy = puesto
        const cuantos = d.lista.length + d.google.length
        const numero = Number(d.fecha.slice(8, 10))

        return (
          <Link
            key={d.fecha}
            href={`/agenda?vista=dia&dia=${d.fecha}${de ? `&de=${de}` : ''}`}
            aria-current={puesto ? 'date' : undefined}
            aria-label={`${SEMANA[(i + 1) % 7]} ${numero}${
              cuantos === 0 ? ', sin nada' : cuantos === 1 ? ', 1 cosa' : `, ${cuantos} cosas`
            }`}
            className="flex h-[62px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-[14px]"
            style={
              /* El día elegido se rellena de TINTA, como la píldora
                 del sistema: estar en un día es un estado. Iba con
                 `--t-boton`, el color de antes. */
              puesto
                ? { background: 'var(--t-tinta)', color: 'var(--t-fondo)' }
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
                /* Hoy va en el color de acción, que es lo único de la
                   tira que dice «estás aquí». Cuando además está
                   elegido, la tinta del relleno manda. */
                esHoy && !puesto ? { color: 'var(--color-accion)' } : undefined
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
                    /* Era `#F59E0B`, un ámbar fuera de paleta. Un
                       punto no dice de qué va la cosa, solo que hay
                       algo: pizarra. */
                    background: puesto ? 'var(--t-fondo)' : 'var(--t-tenue)',
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
  /* A dónde se vuelve: la semana y el filtro desde los que se entró.
     Antes era `/agenda` a secas y salir de aquí te dejaba en la
     semana de hoy, sin el calendario que tenías puesto. */
  volver,
}: {
  adelante: Recordatorio[]
  sinFecha: Recordatorio[]
  nombres: Record<string, string>
  yo: string
  volver: string
}) {
  const meses = new Map<string, Recordatorio[]>()
  for (const r of adelante) {
    const clave = r.fecha!.slice(0, 7)
    meses.set(clave, [...(meses.get(clave) ?? []), r])
  }

  return (
    <>
      <div className="mt-4">
        <Volver href={volver} />
      </div>

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
