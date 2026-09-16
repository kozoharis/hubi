import Link from '@/app/enlace'
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
import EscapeCierra from './escape'
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
  tarea,
}: {
  ver?: string
  semana?: string
  de?: string
  /*
    Lo elegido en la semana de escritorio. Viene de la dirección, y
    por eso se puede copiar, recargar y volver atrás.

    En el móvil no llega nunca: allí una tarea no se elige, se entra
    en ella. Es la regla del sistema — *si hay sitio para enseñar lo
    elegido, elegir lo enseña; si no lo hay, elegir lleva* — y aquí es
    literalmente eso: el mismo clic hace dos cosas distintas según el
    tamaño, y no es una incoherencia.
  */
  tarea?: string
}) {
  const viendoAdelante = ver === 'adelante'

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  /*
    LOS NOMBRES, SOLO LOS DE ESTA CASA.

    Esto era `from('perfiles').select('id, nombre')` a secas. Con la
    sesión no es una fuga —`perfiles_leer` ya limita a la gente de tus
    casas— pero con dos casas el mapa mezcla a todo el mundo, y una
    pantalla de cocina, que en `miembros` es un miembro más, entraría
    como si fuera una persona.

    Se pide la casa una vez y se reutiliza abajo: antes se llamaba a
    `elEspacioO` dentro de la consulta y era otra ida y vuelta.
  */
  const casa = await elEspacioO(supabase)

  const { data: deLaCasa } = await supabase
    .from('miembros')
    .select('perfil_id')
    .eq('hogar_id', casa)
    .eq('clase', 'persona')

  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id, nombre')
    .in('id', (deLaCasa ?? []).map((m) => m.perfil_id as string))
  const nombres = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p.nombre]))

  const { data } = await supabase
    .from('recordatorios')
    .select(
      'id, titulo, tipo, asignado_a, creado_por, fecha, hora, estado, nota, documento_origen_id'
    )
    .eq('hogar_id', casa)
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

  /*
    ═══════════════════════════════════════════════════════════
    LO ELEGIDO
    ═══════════════════════════════════════════════════════════

    Se busca primero entre lo que ya está pintado, que es casi
    siempre: si la tarea está en esta semana, ya vino en la consulta
    de arriba y pedirla otra vez sería una ida y vuelta de más en la
    pantalla que más se abre.

    Los datos que la ficha enseña y la semana no —el aviso, si se
    repite, quién la apuntó, si se ve en la cocina— sí hay que
    pedirlos, pero SOLO cuando hay algo elegido. Sin selección, esta
    pantalla hace exactamente las mismas consultas que hacía antes.

    Y si el `tarea=` de la dirección no corresponde a nada —un enlace
    viejo, una tarea borrada— no pasa nada: `elegida` se queda en
    `null` y la pantalla es la de siempre. Una dirección estropeada no
    puede dejar una pantalla rota.
  */
  const elegida = tarea ? (todos.find((r) => r.id === tarea) ?? null) : null

  const { data: extra } = elegida
    ? await supabase
        .from('recordatorios')
        .select('aviso_previo, repite, creado_en, hecho_en, hecho_por, visible_en_casa')
        .eq('hogar_id', casa)
        .eq('id', elegida.id)
        .maybeSingle()
    : { data: null }

  /* De dónde salió: el papel que la generó, si salió de un papel. */
  const { data: papelOrigen } =
    elegida?.documento_origen_id
      ? await supabase
          .from('documentos')
          .select('id, titulo')
          .eq('hogar_id', casa)
          .eq('id', elegida.documento_origen_id)
          .maybeSingle()
      : { data: null }

  /* Qué más hay ese día. Sin ella misma: repetir la elegida dentro de
     su propio contexto no cuenta nada. */
  const suDia = elegida?.fecha ? dias.find((d) => d.fecha === elegida.fecha) : null
  const loDemasDelDia = suDia
    ? [
        ...suDia.lista.filter((r) => r.id !== elegida?.id),
        ...suDia.google.map((c) => ({ id: c.uid, titulo: c.titulo, hora: c.hora })),
      ]
    : []

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

        · VENCIDAS era lo más urgente de MAPPEL escondido detrás de un
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
            <section className="mt-4 lg:hidden">
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

          {/*
            ── LO MISMO, EN UNA SOLA LÍNEA ──

            En el móvil lo vencido son tarjetas enteras, y está bien:
            ahí hay una columna y el sitio se gasta en lo importante.

            En grande eso mismo eran DOS TARJETONES de novecientos
            píxeles con la píldora de «Hecho» a un palmo del texto al
            que pertenece — y encima empujaban la semana fuera de la
            pantalla, que es lo único que se viene a ver aquí.

            Comprimido a una línea sigue siendo lo primero que se lee
            —es lo único con fondo de color de toda la pantalla— y deja
            la altura para la semana.
          */}
          {tarde.length > 0 && (
            <section className="mt-4 hidden items-center gap-3 rounded-[14px] border border-alerta-velo bg-alerta-velo px-4 py-2.5 lg:flex">
              <span className="shrink-0 font-extrabold text-alerta">
                {tarde.length === 1
                  ? 'Una cosa se pasó de fecha'
                  : `${tarde.length} cosas se pasaron de fecha`}
              </span>
              <span className="flex min-w-0 flex-wrap gap-2">
                {tarde.slice(0, 4).map((r) => (
                  <Link
                    key={r.id}
                    href={`/tablon/${r.id}`}
                    className="roza max-w-[260px] truncate rounded-full border border-borde bg-superficie px-3 py-1 text-[14px] text-tinta-suave"
                  >
                    {r.titulo}
                  </Link>
                ))}
                {tarde.length > 4 && (
                  <span className="self-center text-[13px] text-tenue">
                    y {tarde.length - 4} más
                  </span>
                )}
              </span>
              <span className="ml-auto shrink-0 text-[13px] text-tenue">
                Tócalas para marcarlas o cambiarles el día
              </span>
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

          {/* ── La semana entera, en una fila ──

              `lg:hidden`: en grande la semana se ve entera ahí abajo,
              en sus siete columnas, y la tira sería decir dos veces lo
              mismo en la misma pantalla — una con puntitos y otra con
              palabras. */}
          <div className="lg:hidden">
            <Tira dias={dias} hoyISO={hoyISO} de={dueno} />
          </div>

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
          {/*
            ══════════════════════════════════════════════════════
            LA SEMANA EN SIETE COLUMNAS · sólo en grande
            ══════════════════════════════════════════════════════

            Una semana es horizontal. En el móvil no cabe y por eso se
            recorre hacia abajo; en un ordenador, recorrerla hacia
            abajo es tirar la única ventaja que tiene la pantalla.

            Dos diferencias con lo de abajo, y las dos importan:

            · SE PINTAN LOS SIETE, también los vacíos. Abajo los días
              sin nada no se pintan —cuatro renglones diciendo «nada»
              se comen media pantalla de móvil—, pero aquí el hueco ES
              la información: que el fin de semana esté libre se ve sin
              leer una palabra, y sólo se ve si está dibujado.

            · CADA DÍA ES UNA COLUMNA y no una sección. Así se compara
              el jueves con el viernes de un vistazo, que es la razón
              por la que alguien abre la semana en vez del día.
          */}
          <div
            className={
              'zona-que-cede denso-trabajo mt-4 hidden grid-cols-7 gap-2 lg:grid ' +
              (elegida ? 'cede' : '')
            }
          >
            {dias.map((d) => {
              const cosas = d.lista.length + d.google.length
              const esHoy = d.fecha === hoyISO
              return (
                <div key={d.fecha} className="flex min-w-0 flex-col gap-2">
                  <Link
                    href={`/agenda?vista=dia&dia=${d.fecha}${dueno ? `&de=${dueno}` : ''}`}
                    className="roza rounded-[10px] py-1 text-center"
                  >
                    <span className="rotulo block truncate">{nombreDelDia(d.fecha)}</span>
                    <span
                      className={
                        'block text-[19px] tabular-nums ' +
                        (esHoy ? 'font-extrabold' : 'font-bold') +
                        (cosas === 0 && !esHoy ? ' text-tenue' : '')
                      }
                      style={esHoy ? { color: 'var(--color-accion)' } : undefined}
                    >
                      {Number(d.fecha.slice(8, 10))}
                      {esHoy && <span className="text-[14px]"> · hoy</span>}
                    </span>
                  </Link>

                  {cosas === 0 ? (
                    /* El hueco, dibujado. Una raya discontinua y nada
                       más: no dice «no hay nada», lo enseña. */
                    <div
                      aria-hidden
                      className="min-h-[92px] flex-1 rounded-[11px] border border-dashed border-borde"
                    />
                  ) : (
                    <>
                      {d.lista.map((r) => (
                        <Cosita
                          key={r.id}
                          /*
                            Elegir, no entrar. Y pulsar la que ya está
                            elegida la cierra: es la tercera manera de
                            cerrar la ficha —con Esc, eligiendo otra, o
                            volviendo a pulsar ésta— y la que se prueba
                            sin pensar.
                          */
                          href={enlaceAgenda(
                            { ver, semana, de },
                            { tarea: elegida?.id === r.id ? null : r.id }
                          )}
                          elegida={elegida?.id === r.id}
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
                      ))}
                      {d.google.map((c) => (
                        <Cosita
                          key={c.uid}
                          hora={c.hora}
                          titulo={c.titulo}
                          color={c.color}
                          pie={
                            [calendarios.length > 1 ? c.de.split(' ')[0] : null, c.lugar]
                              .filter(Boolean)
                              .join(' · ') || null
                          }
                        />
                      ))}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/*
            ═══════════════════════════════════════════════════
            Y LA FICHA, SOLO CUANDO HAY ALGO ELEGIDO
            ═══════════════════════════════════════════════════

            Lo primero que hay que decir es lo que NO hay: sin nada
            elegido, aquí abajo no existe nada. Ni una franja gris
            esperando, ni un «selecciona una tarea» centrado. Una zona
            reservada que la mitad de las veces está vacía es la
            silueta de un programa de trabajo — y esta pantalla la abre
            gente que viene a mirar una semana, no a operar un panel.

            Al elegir, la semana cede el alto y esto entra desde abajo,
            a la vez. Se ve un movimiento, no dos.

            ── POR QUÉ DEBAJO Y NO AL LADO ──

            Al lado es lo que hace Papeles, y allí es lo correcto. Aquí
            no: un panel de 340 a la derecha dejaría cada día en 112 px
            y la semana dejaría de poder leerse, que es lo único que
            esta pantalla hace bien. Se le quita alto, que sobra, y no
            ancho, que no.
          */}
          {elegida && (
            <>
              <EscapeCierra a={enlaceAgenda({ ver, semana, de }, { tarea: null })} />
              <section
                aria-label="La tarea elegida"
                className="entra-abajo mt-4 hidden rounded-[18px] border border-borde bg-superficie px-5 py-4 shadow-[0_-6px_20px_-14px_rgba(26,23,20,0.3)] lg:block"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="rotulo">La tarea</span>
                  <Link
                    href={enlaceAgenda({ ver, semana, de }, { tarea: null })}
                    scroll={false}
                    aria-label="Cerrar"
                    className="objetivo roza -mr-2 flex items-center justify-center rounded-full text-[22px] leading-none text-tenue"
                  >
                    ×
                  </Link>
                </div>

                {/*
                  Cuatro medidas, y cada columna aparece cuando hay
                  sitio para ella entera. Nunca se estrecha una para
                  que quepa otra: una columna de contexto a 140 px no
                  es contexto, es un recorte.
                */}
                <div className="grid items-start gap-x-8 gap-y-5 lg:grid-cols-[340px_repeat(2,minmax(0,1fr))] ancha:grid-cols-[400px_repeat(3,minmax(0,1fr))] monitor:grid-cols-[400px_repeat(4,minmax(0,1fr))]">
                  {/* Uno · la tarea, con sus dos acciones.

                      Es la MISMA tarjeta del móvil, a propósito. Podía
                      haberse dibujado una ficha distinta para grande y
                      habría quedado bien; pero entonces «Hecho» estaría
                      en dos sitios con dos formas, y el día que cambie
                      una cosa habrá que acordarse de la otra. */}
                  <ul>
                    <Tarjeta r={elegida} nombres={nombres} yo={user.id} />
                  </ul>

                  {/* Dos · de dónde salió */}
                  <Columna rotulo="De dónde salió">
                    {papelOrigen ? (
                      <>
                        <Enunciado>De un papel que guardasteis:</Enunciado>
                        <Link
                          href={`/documentos/${papelOrigen.id}`}
                          className="roza -mx-2 mt-1.5 flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[15px] font-bold"
                        >
                          <Ico nombre="papel" tam={16} grosor={2.4} />
                          <span className="min-w-0 truncate">{papelOrigen.titulo}</span>
                        </Link>
                      </>
                    ) : (
                      <Enunciado>
                        La apuntó {nombres[elegida.creado_por] ?? 'alguien de casa'}
                        {extra?.creado_en ? ` el ${fechaCorta(extra.creado_en)}` : ''}.
                      </Enunciado>
                    )}
                    {elegida.nota && (
                      <p className="mt-3 border-l-2 border-borde pl-3 text-[14px] leading-snug text-tinta-suave">
                        {elegida.nota}
                      </p>
                    )}
                  </Columna>

                  {/* Tres · qué más hay ese día.

                      Es la pregunta que se hace de verdad al mirar una
                      tarea: no «qué es esto», que ya lo pone, sino «¿me
                      cuadra con lo demás de ese día?». */}
                  <Columna rotulo="Ese día, además">
                    {loDemasDelDia.length === 0 ? (
                      <Enunciado>No hay nada más ese día.</Enunciado>
                    ) : (
                      <ul className="space-y-1.5">
                        {loDemasDelDia.slice(0, 5).map((c) => (
                          <li key={c.id} className="flex gap-2 text-[14px] leading-snug">
                            <span className="w-[42px] shrink-0 font-bold tabular-nums text-tenue">
                              {c.hora ? c.hora.slice(0, 5) : '—'}
                            </span>
                            <span className="min-w-0 flex-1 text-tinta-suave">{c.titulo}</span>
                          </li>
                        ))}
                        {loDemasDelDia.length > 5 && (
                          <li className="text-[13px] text-tenue">
                            y {loDemasDelDia.length - 5} más
                          </li>
                        )}
                      </ul>
                    )}
                  </Columna>

                  {/* Cuatro · lo que va a hacer sola.

                      Desde 1440. El aviso y la repetición no se ven en
                      ninguna otra parte de la semana, y son justo lo
                      que hace dudar: «¿esto me va a avisar o no?». */}
                  <div className="hidden ancha:block">
                    <Columna rotulo="Y además">
                      <ul className="space-y-1.5 text-[14px] leading-snug text-tinta-suave">
                        <li>{avisoEnPalabras(extra?.aviso_previo ?? null)}</li>
                        {extra?.repite && <li>Se repite {extra.repite}.</li>}
                        {extra?.visible_en_casa && <li>Se ve en la pantalla de la cocina.</li>}
                      </ul>
                    </Columna>
                  </div>

                  {/* Cinco · el historial. Desde 1800, y sólo ahí: es
                      el dato que menos se mira de los cinco, así que es
                      el que espera a que sobre sitio de verdad. */}
                  <div className="hidden monitor:block">
                    <Columna rotulo="Historial">
                      <ul className="space-y-1.5 text-[14px] leading-snug text-tinta-suave">
                        {extra?.creado_en && (
                          <li>
                            Apuntada el {fechaCorta(extra.creado_en)} por{' '}
                            {nombres[elegida.creado_por] ?? 'alguien de casa'}.
                          </li>
                        )}
                        {extra?.hecho_en ? (
                          <li>
                            Hecha el {fechaCorta(extra.hecho_en)}
                            {extra.hecho_por && nombres[extra.hecho_por]
                              ? ` por ${nombres[extra.hecho_por]}`
                              : ''}
                            .
                          </li>
                        ) : (
                          <li className="text-tenue">Todavía sin hacer.</li>
                        )}
                      </ul>
                    </Columna>
                  </div>
                </div>
              </section>
            </>
          )}

          <div className="lg:hidden">
          {conAlgo.length === 0 ? (
            <Vacio
              texto={enEstaSemana ? 'Nada más esta semana.' : 'Nada esta semana.'}
            />
          ) : (
            /*
              ── DOS COLUMNAS EN GRANDE ──

              Esto es una vista SEMANAL, y en una tira de 448 px la
              semana no cabe: con tres cosas el martes y dos el
              jueves, el domingo ya está fuera de la pantalla. Para
              saber si el finde está libre hay que deslizar, y
              entonces el martes deja de verse. Eso no es mirar una
              semana: es mirar días de uno en uno con más pasos.

              A dos columnas los siete caben de golpe, que es la
              única razón por la que alguien abre la semana en vez
              del día.

              `items-start` para que un día con cuatro cosas no
              estire al de al lado, y `space-y-0` porque el margen
              entre hermanos desencaja las filas de una rejilla —
              ahí manda `gap`.
            */
            <div className="mt-5 space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:gap-y-6 lg:space-y-0">
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
          </div>

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
            /* Con techo en grande: un botón no crece con la pantalla. */
            <div className="mt-4 lg:max-w-[420px]">
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

      {/* Apuntar algo ES la acción de la Agenda.

          SOLO EN EL MÓVIL: en grande vive arriba a la derecha, en la
          banda, con la caja de MAPPEL. Aquí abajo, después de la semana
          entera y con el ancho de la pantalla, quedaba flotando en
          mitad del papel a media pantalla de lo que se estaba
          leyendo. */}
      <div className="mt-3 lg:hidden">
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
        className="w-[42px] shrink-0 text-[13px] font-extrabold tabular-nums"
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
  ───────────────────────────────────────────────────────────────
  LA MISMA COSA, PERO EN UNA COLUMNA DE 154 PX
  ───────────────────────────────────────────────────────────────

  El `Renglon` de arriba no sirve en la semana panorámica: allí la
  hora vive en una columna fija de 42 px a la izquierda, y en una
  columna de día eso deja 90 px para el título. «Recoger la
  medicación en la farmacia» se convierte en «Recoger la…».

  Así que aquí la hora sube: va encima del título, pequeña y en el
  color del ámbito, y el título se queda con el ancho entero de la
  columna. Se pierde la alineación vertical de las horas —que era
  toda la gracia del renglón de móvil—, pero en la semana la
  alineación que importa es la otra: la de los días entre sí.

  Lo demás es idéntico a propósito, porque es la misma cosa vista
  de otra manera: la rayita de 3 px del ámbito a la izquierda, el
  tachado y el tic cuando está hecha, el pie con el nombre corto de
  quien la tiene. Dos alturas distintas para lo mismo, no dos
  lenguajes distintos.
*/
function Cosita({
  href,
  hora,
  titulo,
  color,
  pie,
  hecha = false,
  elegida = false,
}: {
  href?: string
  hora: string | null
  titulo: string
  color: string
  pie: string | null
  hecha?: boolean
  /*
    ── EL BORDE VERDE MARCA LO ELEGIDO, NO «HOY» ──

    Es la aclaración que hubo que hacer al componerlo, y conviene que
    se quede escrita: hoy se reconoce por el número en negrita y la
    palabra «hoy» en la cabecera de su columna. Si además llevara
    borde de color, un martes cualquiera elegido y el día de hoy se
    verían igual y el borde dejaría de significar nada.
  */
  elegida?: boolean
}) {
  const dentro = (
    <span
      className={
        'flex gap-2 rounded-[11px] border px-2 py-1.5 transition-colors ' +
        (elegida
          ? 'border-bien bg-verde-suave shadow-[0_0_0_1px_var(--color-bien)] '
          : 'border-borde bg-superficie ') +
        (hecha ? 'opacity-55' : '')
      }
    >
      <span
        aria-hidden
        className="w-[3px] shrink-0 self-stretch rounded-full"
        style={{ background: hecha ? 'var(--t-bien)' : color }}
      />
      <span className="min-w-0 flex-1">
        {hora && (
          <span
            className="block text-[12px] font-extrabold tabular-nums leading-tight"
            style={{ color }}
          >
            {hora.slice(0, 5)}
          </span>
        )}
        <span
          /*
            Dos líneas y no más. Truncar a una deja «Llevar los
            papeles del…» en la mitad de los casos; dejarlo libre
            hace que un título largo estire su columna y desencaje
            las otras seis.
          */
          className="block text-[14px] font-bold leading-snug [display:-webkit-box] [overflow:hidden] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
          style={hecha ? { textDecorationLine: 'line-through' } : undefined}
        >
          {titulo}
        </span>
        {pie && (
          <span className="mt-0.5 block truncate text-[12px] font-bold text-tenue">
            {pie}
          </span>
        )}
      </span>
      {hecha && (
        <span className="shrink-0 self-start" style={{ color: 'var(--t-bien)' }}>
          <Ico nombre="check" tam={14} grosor={2.6} />
        </span>
      )}
    </span>
  )

  if (!href) return <span className="block">{dentro}</span>
  return (
    /*
      `scroll={false}`: elegir cambia la dirección, y sin esto el
      navegador se iría arriba del todo cada vez. La semana está a
      media pantalla; saltar al techo en cada clic haría que elegir
      pareciera cambiar de pantalla, que es justo lo contrario de lo
      que esto hace.
    */
    <Link href={href} scroll={false} aria-current={elegida ? 'true' : undefined} className="block">
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
    /*
      ── NO SE ESTIRA ──

      Cada casilla es `flex-1`, así que en una columna de 1100 px los
      siete días salían de ciento cincuenta píxeles de ancho por
      sesenta y dos de alto: siete rectángulos tumbados, con una letra
      y un número perdidos en el centro de cada uno, haciendo de
      pancarta encima de los días de verdad.

      Una tira de días es un CONTROL, no un contenido: tiene su tamaño
      natural y ensancharlo no enseña ni un dato más. Es la misma regla
      que la caja de MAPPEL (420) y los segmentos (440) de la banda —
      medidas fijas, y el sitio que sobra se deja sobrar.

      440 para que sea exactamente la de los segmentos: en la Agenda
      las dos cosas están una debajo de la otra y desalinearlas por
      veinte píxeles se ve.
    */
    <div className="mt-4 flex justify-between gap-1 lg:max-w-[440px]">
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
            <span className="text-[13px] font-bold uppercase tracking-wider opacity-70">
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


/*
  Una columna de contexto de la ficha.

  Rótulo de 13 px en versales y lo que sea debajo. Sin tarjeta, sin
  borde y sin fondo: van DENTRO de la ficha, y meter tarjetas dentro de
  una tarjeta es como una pantalla acaba pareciendo un panel de
  control. Lo que las separa es el hueco de 32 px, que basta.
*/
function Columna({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="rotulo mb-2">{rotulo}</p>
      {children}
    </div>
  )
}

/** Una frase de contexto, en el gris de lo que acompaña. */
function Enunciado({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] leading-snug text-tinta-suave">{children}</p>
}

/*
  El aviso, dicho como se diría en voz alta.

  «1_dia» es lo que hay en la base de datos, y ahí está bien. En la
  pantalla no: nadie ha guardado nunca nada «1_dia antes».
*/
const AVISO: Record<string, string> = {
  sin_aviso: 'No avisa antes.',
  '30_min': 'Avisa 30 minutos antes.',
  '1_dia': 'Avisa un día antes.',
  '1_semana': 'Avisa una semana antes.',
  '1_mes': 'Avisa un mes antes.',
}

function avisoEnPalabras(clave: string | null): string {
  return clave ? (AVISO[clave] ?? 'No avisa antes.') : 'No avisa antes.'
}

/** "14 de agosto" · "14 de agosto de 2025" si no es de este año. */
function fechaCorta(cuando: string): string {
  const f = new Date(cuando)
  if (Number.isNaN(f.getTime())) return ''
  const esteAno = f.getFullYear() === new Date().getFullYear()
  return `${f.getDate()} de ${MESES[f.getMonth()]}${esteAno ? '' : ` de ${f.getFullYear()}`}`
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

/*
  "Lunes" · "Martes" · … — el rótulo de encima de cada columna en la
  semana panorámica.

  Entero y no la inicial: las iniciales (L M X J V S D) valen en la
  tira del móvil, donde hay 44 px por casilla y el día elegido va
  relleno. En una columna de 154 px no hay ninguna razón para
  abreviar, y «X» es de las cosas que hay que saberse.
*/
function nombreDelDia(fecha: string): string {
  const nombre = SEMANA[deISO(fecha).getDay()]
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

/** "2026-09" → "Septiembre" · "Enero de 2027" si cambia el año */
function mesEnPalabras(clave: string): string {
  const [a, m] = clave.split('-').map(Number)
  const nombre = MESES[m - 1]
  const mayus = nombre.charAt(0).toUpperCase() + nombre.slice(1)
  return a === new Date().getFullYear() ? mayus : `${mayus} de ${a}`
}
