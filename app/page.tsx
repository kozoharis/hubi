import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { clienteServidor } from '@/lib/supabase/servidor'
import Barra from './barra'
import Arranque from './arranque'
import Invitacion from './invitacion'
import Cabecera from './cabecera'
import { Ico, Logo, Pastilla, pintaDe } from './iconos'
import Avatar from './avatar'
import { cuando, type Recordatorio } from '@/lib/tablon'
import { leerPerfil } from '@/lib/perfil'
import { miHogar, mandaEnSuCasa, quienManda } from '@/lib/hogar'
import { casasDe } from '@/lib/casas'
import { cuantasNotas } from '@/lib/notas'
import { gastadoEnCasa } from '@/lib/gastos-casa'
import { queVeEnInicio } from '@/lib/roles'
import { eurosRedondo } from '@/lib/periodos'
import Casas from './casas'

export const dynamic = 'force-dynamic'

function saludo() {
  const hora = new Date().getHours()
  if (hora < 6) return 'Buenas noches'
  if (hora < 14) return 'Buenos días'
  if (hora < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

function hoyEnPalabras() {
  const f = new Date()
  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${dias[f.getDay()]}, ${f.getDate()} de ${meses[f.getMonth()]}`
}

const AVISOS: Record<string, { texto: string; bien: boolean }> = {
  conectado: { texto: 'Google Drive conectado correctamente.', bien: true },
  cancelado: { texto: 'No se ha dado el permiso. Puedes intentarlo otra vez.', bien: false },
  /* Sin nombres escritos a mano: quien conecta el Drive es distinto
     en cada casa, y en la de al lado «Juan Miguel» no significa nada. */
  'no-eres-tu': {
    texto: 'El Drive lo conecta quien creó esta casa: la cuenta de Google es suya.',
    bien: false,
  },
  'sin-casa': {
    texto: 'Tu cuenta todavía no está en ninguna casa. Avisa a quien te invitó.',
    bien: false,
  },
  'sin-permiso': {
    texto:
      'Google no ha devuelto un permiso duradero. Entra en la cuenta de Google, quita el acceso de HUBI y vuelve a conectarlo.',
    bien: false,
  },
  estado: { texto: 'La conexión se ha interrumpido por seguridad. Inténtalo de nuevo.', bien: false },
  error: { texto: 'Algo ha fallado al conectar con Google. Inténtalo de nuevo.', bien: false },
}

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>
}) {
  const { drive: avisoClave } = await searchParams
  const aviso = avisoClave ? AVISOS[avisoClave] : null

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const hoyISO = new Date().toISOString().slice(0, 10)

  // Lo que viene: los próximos 60 días.
  const dentroDe60 = new Date()
  dentroDe60.setDate(dentroDe60.getDate() + 60)

  const admin = clienteServidor()

  /*
    ── ¿TIENE CASA? ──

    Quien entra sin hogar no ve NADA: todas las políticas de la base
    de datos dicen `hogar_id = mi_hogar()`, así que cada consulta le
    devuelve cero filas. Y un HUBI completamente vacío, con sus cinco
    pestañas y ni un dato, no parece una casa nueva: parece una
    aplicación rota.

    Se le lleva a crear la suya, que es lo que de verdad le falta.
  */
  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) redirect('/empezar')

  /* En cuántas casas está, y si le han invitado a alguna. Con una sola
     —o sea, casi siempre— esto no pinta nada en la pantalla. */
  const casas = await casasDe(supabase, user.id)

  const CAMPOS =
    'id, titulo, tipo, asignado_a, creado_por, fecha, hora, estado, nota, documento_origen_id'

  /*
    Las cinco consultas, a la vez.

    Antes iban una detrás de otra, y ninguna necesitaba el resultado de
    la anterior: eran cuatro viajes de ida y vuelta a la base de datos
    puestos en fila por costumbre, no por necesidad. En un móvil, con
    la base de datos al otro lado, eso son cuatro esperas donde bastaba
    con una.
  */
  const [
    perfil,
    { data: pendientes },
    { data: siguientes },
    { data: conexion },
    { count: porComprar },
    notasPuestas,
    gastoCasa,
  ] =
    await Promise.all([
      leerPerfil(supabase, user.id, user.email),

      // Lo de hoy y lo que se quedó atrás: nada más. El inicio no es una lista.
      supabase
        .from('recordatorios')
        .select(CAMPOS)
        .eq('estado', 'pendiente')
        .lte('fecha', hoyISO)
        .order('hora', { ascending: true, nullsFirst: true })
        .limit(4),

      supabase
        .from('recordatorios')
        .select(CAMPOS)
        .eq('estado', 'pendiente')
        .gt('fecha', hoyISO)
        .lte('fecha', dentroDe60.toISOString().slice(0, 10))
        .order('fecha', { ascending: true })
        .limit(3),

      hogarId
        ? admin.from('conexion_drive').select('estado').eq('hogar_id', hogarId).maybeSingle()
        : Promise.resolve({ data: null }),

      /* Cuántas cosas faltan. Solo el número: la lista entera se ve
         al entrar, y el inicio no es una lista. */
      supabase
        .from('compra')
        .select('id', { count: 'exact', head: true })
        .eq('comprado', false)
        .is('archivado_en', null),

      /* Las notas del corcho, y cuántas te están esperando a ti. */
      cuantasNotas(supabase, user.id),

      /* Lo que se va este trimestre fuera de las actividades. */
      gastadoEnCasa(supabase),
    ])

  /* ¿Esta casa usa la lista de la compra? Envuelto: la columna es
     nueva y, si el SQL 32 no se ha ejecutado, Postgres rechaza la
     consulta entera en vez de decir «esa columna no existe». */
  let usaCompra = true
  try {
    const { data: casa } = await supabase
      .from('hogares')
      .select('usa_compra')
      .eq('id', hogarId)
      .maybeSingle()
    if (casa && casa.usa_compra === false) usaCompra = false
  } catch {
    /* Sin la columna todavía: se comporta como siempre. */
  }

  const hoy = (pendientes ?? []) as Recordatorio[]
  const proximos = (siguientes ?? []) as Recordatorio[]

  const nombre = perfil.nombre

  /*
    ── QUÉ LE ENSEÑA HUBI A ESTA PERSONA ──

    Y esto es lo que de verdad cambia con los roles, más que los
    permisos. A quien ayuda en casa, HUBI no le abre en «Cuentas de
    casa» y «Papeles»: le abre en lo de hoy y la compra. El permiso
    evita que vea algo; la pantalla hace que encuentre lo suyo en un
    segundo.

    OJO: esto es lo que se OFRECE, no lo que protege. Lo que no puede
    ver sigue sin poder verlo aunque escriba la dirección a mano — de
    eso se encargan las políticas de la base de datos, y así tiene que
    seguir siendo. Esconder un botón nunca es una medida de seguridad.

    Envuelto: `rol` es del SQL 37. Sin él, todo el mundo ve lo de
    siempre.
  */
  let rol: string | null = null
  try {
    const { data: mio } = await supabase
      .from('miembros')
      .select('rol')
      .eq('perfil_id', user.id)
      .eq('hogar_id', hogarId)
      .maybeSingle()
    rol = (mio?.rol as string | null) ?? null
  } catch {
    /* Sin la columna: se comporta como antes. */
  }
  const ve = queVeEnInicio(rol)

  /*
    QUIÉN MANDA AQUÍ, Y CÓMO SE LLAMA.

    Antes era `perfil.es_propietario_drive`, una casilla global que
    solo tiene Juan Miguel — así que en cualquier otra casa NADIE veía
    el botón de conectar Drive, y a todos les salía el aviso de
    esperar a que lo conectara él.
  */
  const manda = await mandaEnSuCasa(supabase, user.id)
  const elJefe = manda || !hogarId ? null : await quienManda(supabase, hogarId)
  const conectado = conexion?.estado === 'activa'
  const caducado = conexion?.estado === 'caducada'

  return (
    <main className="relative min-h-screen pb-40">
      <Arranque />

      {/* El color, de borde a borde y siempre por detrás */}
      <div aria-hidden className="telon">
        <span className="mancha deriva-1" style={{ width: 300, height: 300, left: -110, top: -130, background: 'rgba(20,184,166,.30)' }} />
        <span className="mancha deriva-3" style={{ width: 280, height: 280, right: -110, top: -140, background: 'rgba(59,130,246,.26)' }} />
        <span className="mancha deriva-2" style={{ width: 260, height: 260, left: 110, top: -40, background: 'rgba(139,92,246,.18)' }} />
        <span className="mancha deriva-4" style={{ width: 300, height: 300, right: -130, bottom: -140, background: 'rgba(255,107,107,.12)' }} />
        <span
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom,' +
              'color-mix(in srgb, var(--t-fondo) 30%, transparent),' +
              'color-mix(in srgb, var(--t-fondo) 82%, transparent) 38%,' +
              'var(--t-fondo) 70%)',
          }}
        />
      </div>

      {/* ── Cabecera, clavada arriba ── */}
      <Cabecera>
        {/*
          ── ARRIBA: QUIÉN ERES, Y AJUSTES ──

          Antes la foto ERA el botón de ajustes, y eso no lo adivina
          nadie: una foto de perfil dice «este eres tú», no «toca aquí
          para configurar». Quien no lo supiera de antemano no
          encontraba los ajustes en toda la aplicación.

          Ahora son dos cosas distintas:

            · La foto solo dice quién está usando HUBI. Ya no se puede
              tocar, porque no llevaba a ningún sitio que se pudiera
              adivinar.
            · Al lado, un botón con la rueda Y la palabra «Ajustes».

          Con la palabra, no solo el dibujo. Es el punto 5 —«iconos
          siempre acompañados por texto»— y aquí se nota especialmente:
          la rueda la reconoce cualquiera que use el móvil a diario,
          pero no todo el mundo usa el móvil a diario.

          Se descartó la otra idea, la de animar la foto para que
          girase y enseñara una rueda de vez en cuando: un botón que
          solo se entiende si lo miras en el segundo correcto es un
          botón que a veces no existe. Y en una pantalla pensada para
          ir con prisa, eso es peor que no tener nada.
        */}
        <div className="flex h-14 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Logo tam={36} />
            <span className="text-[22px] font-extrabold tracking-[0.09em]">HUBI</span>
          </span>

          <span className="flex shrink-0 items-center gap-2">
            <Avatar nombre={nombre} foto={perfil.foto} tam={40} />
            <Link
              href="/ajustes"
              className="flex h-11 items-center gap-1.5 rounded-full border border-borde bg-superficie pl-3 pr-3.5 text-[15.5px] font-extrabold text-tinta"
            >
              <Ico nombre="rueda" tam={18} grosor={2} />
              Ajustes
            </Link>
          </span>
        </div>
      </Cabecera>

      <div className="relative z-10 mx-auto w-full max-w-md px-5 pt-1">
        {/* ── En qué casa estás, y las que te han ofrecido ── */}
        {/* Va lo primero, encima del saludo del día: si alguien te ha
            dado acceso a los papeles de su casa, eso no puede quedar
            debajo de la lista de la compra. */}
        <Casas casas={casas} />

        {/* ── Saludo ── */}
        <p className="mt-2.5 text-[14.5px] font-bold text-tenue">{hoyEnPalabras()}</p>
        {/* Nunca "Buenas tardes," a secas: si no hubiera nombre, se
            saluda sin coma y punto. Una frase colgando hace dudar de
            todo lo que viene debajo. */}
        <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight tracking-tight">
          {nombre ? `${saludo()}, ${nombre}` : saludo()}
        </h1>

        {/*
          ── PARA QUÉ ESTÁS AQUÍ ──

          Solo a quien no es de la familia. Una empleada o un gestor
          entran en la casa de OTRO: sin una línea que lo diga, la
          pantalla parece a medio cargar —«¿y lo demás?»— cuando en
          realidad está completa.

          Y al asesor le hace más falta que a nadie: su Inicio no lleva
          ninguna tarjeta, porque lo suyo son las cuentas y ésas están
          en las pestañas de abajo.
        */}
        {rol && rol !== 'familia' && (
          <p className="mt-4 rounded-[18px] border border-borde bg-superficie px-4 py-3.5 text-[15.5px] font-semibold leading-snug text-tinta-suave">
            {rol === 'ayuda'
              ? 'Aquí tienes lo que te han encargado y la lista de la compra. El ticket del súper se guarda desde la propia compra.'
              : rol === 'asesor'
                ? 'Tienes acceso a las cuentas y a los papeles de las actividades de esta casa. Están abajo. No puedes cambiar nada.'
                : 'Puedes ver las cosas de esta casa, pero no cambiar nada.'}
          </p>
        )}

        {conectado && <Invitacion />}

        {aviso && (
          <p
            className={`mt-5 rounded-2xl px-5 py-4 text-[17px] font-medium leading-snug ${
              aviso.bien ? 'bg-verde-suave text-verde' : 'bg-coral-suave text-coral'
            }`}
          >
            {aviso.texto}
          </p>
        )}

        {/*
          ═══════════════════════════════════════════════════════
          EL MOSAICO
          ═══════════════════════════════════════════════════════

          Eran cuatro filas idénticas de 74 px. Se entendían —eso
          nunca fue el problema— pero pesaban todas lo mismo, y en una
          pantalla donde todo pesa igual no hay nada que mirar
          primero: hay que leerse las cuatro.

          Ahora la FORMA dice la importancia, que es lo que hace un
          mosaico bien hecho:

            ancha    Guardar documento — el punto 6 la quiere sola
            cuadrado La compra · Notas — dos cosas del día a día
            ancha    Cuentas de casa — para que el número sea grande

          ─────────────────────────────────────────────────────
          Y LOS CUADRADOS SE TOCAN MEJOR, NO PEOR

          Es lo primero que preocupa al pensar en manos de 75 años, y
          sale al revés: en una pantalla de móvil cada cuadrado mide
          unos 170 × 150 px. Las filas de antes tenían 74 de alto. El
          dedo tiene el doble de sitio donde caer, y encima ya no hay
          que apuntar a una franja fina.

          Se pasa de unos 340 px de alto a unos 270, y eso sube «Hoy»
          hasta donde se ve sin arrastrar la pantalla — que era lo
          único que de verdad se quedaba abajo.
        */}

        {/* ── La grande: hacer una foto ── */}
        {conectado && ve.guardarDocumento && (
          <Link
            href="/guardar"
            className="mt-2.5 flex h-[76px] items-center gap-3.5 rounded-[22px] px-4"
            style={{
              background: 'color-mix(in srgb, #14B8A6 12%, transparent)',
              border: '1px solid color-mix(in srgb, #14B8A6 30%, transparent)',
            }}
          >
            <span className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[15px] bg-superficie text-verde">
              <Ico nombre="foto" tam={25} grosor={2.1} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block whitespace-nowrap text-[19px] font-extrabold tracking-tight">
                Guardar documento
              </span>
              <span className="block text-[14.5px] font-bold text-verde">
                Haz una foto y yo lo archivo
              </span>
            </span>
            <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-verde" />
          </Link>
        )}

        {/* ── Los dos cuadrados ── */}
        {(usaCompra && ve.compra) || ve.notas ? (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {usaCompra && ve.compra && (
              <Cuadro
                href="/compra"
                icono="bolsa"
                color="#0EA5E9"
                titulo="La compra"
                /* Con cifra, el pie dice QUÉ son. Sin cifra, dice
                   cómo está la lista. Poner «3» y debajo «Faltan 3
                   cosas» sería decir lo mismo dos veces en un sitio
                   donde no sobra ni una palabra. */
                pie={
                  !porComprar
                    ? 'La lista está vacía'
                    : porComprar === 1
                      ? 'cosa por coger'
                      : 'cosas por coger'
                }
                /* El número, grande, solo cuando hay algo que contar.
                   Un «0» enorme en la pantalla de inicio es un
                   reproche por algo que no has hecho mal. */
                cifra={porComprar && porComprar > 0 ? String(porComprar) : null}
              />
            )}

            {ve.notas && (
              <Cuadro
                href="/notas"
                icono="chincheta"
                color="#F59E0B"
                titulo="Notas"
                pie={
                  notasPuestas.paraMi > 0
                    ? notasPuestas.paraMi === 1
                      ? 'una es para ti'
                      : `${notasPuestas.paraMi} son para ti`
                    : notasPuestas.puestas === 0
                      ? 'Deja un recado'
                      : notasPuestas.puestas === 1
                        ? 'puesta en el corcho'
                        : 'puestas en el corcho'
                }
                cifra={notasPuestas.puestas > 0 ? String(notasPuestas.puestas) : null}
                /* Lo que es PARA TI se ve desde el otro lado de la
                   habitación. Es lo único del Inicio que te está
                   esperando a ti en concreto. */
                avisa={notasPuestas.paraMi > 0}
              />
            )}
          </div>
        ) : null}

        {/* ── Y las cuentas, anchas, con el número de protagonista ── */}
        {ve.cuentasCasa && (
          <Link
            href="/gastos"
            className="mt-2.5 flex h-[76px] items-center gap-3.5 rounded-[22px] px-4"
            style={{
              background: 'color-mix(in srgb, #8B5CF6 12%, transparent)',
              border: '1px solid color-mix(in srgb, #8B5CF6 30%, transparent)',
            }}
          >
            <span
              className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[15px] bg-superficie"
              style={{ color: '#8B5CF6' }}
            >
              <Ico nombre="euro" tam={25} grosor={2.1} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block whitespace-nowrap text-[15px] font-bold text-tenue">
                Cuentas de casa
              </span>
              {gastoCasa > 0 ? (
                <span className="block text-[24px] font-extrabold leading-tight tracking-tight">
                  {eurosRedondo(gastoCasa)}
                  <span className="ml-1.5 text-[14.5px] font-bold text-tenue">
                    este trimestre
                  </span>
                </span>
              ) : (
                <span className="block text-[18px] font-extrabold leading-snug tracking-tight">
                  Todavía no hay nada apuntado
                </span>
              )}
            </span>
            <span className="shrink-0" style={{ color: '#8B5CF6' }}>
              <Ico nombre="flecha" tam={22} grosor={2.2} />
            </span>
          </Link>
        )}
        {/* ── Conectar Drive ── */}
        {!conectado && manda && (
          <div className="mt-6">
            <a
              href="/api/google/conectar"
              className="flex h-[60px] items-center justify-center rounded-[18px] bg-verde text-[18px] font-extrabold text-white"
            >
              {caducado ? 'Volver a conectar Google Drive' : 'Conectar Google Drive'}
            </a>
            <p className="mt-4 text-[16px] leading-relaxed text-tinta-suave">
              Google mostrará un aviso de aplicación no verificada. Es normal: pulsa{' '}
              <strong>Configuración avanzada</strong> y después <strong>Ir a HUBI</strong>.
              Solo ocurre esta vez.
            </p>
          </div>
        )}

        {!conectado && !manda && (
          <p className="mt-6 rounded-2xl bg-superficie px-5 py-4 text-[17px] leading-snug text-tinta-suave">
            Guardar documentos estará disponible cuando{' '}
            {elJefe ?? 'quien creó esta casa'} conecte su Google Drive.
          </p>
        )}

        {/* ── Hoy ── */}
        {ve.agenda && hoy.length > 0 && (
          <section className="mt-6">
            <h2 className="rotulo">Hoy</h2>
            <ul className="mt-2.5 space-y-2.5">
              {hoy.map((r) => {
                const p = pintaDe(r.titulo)
                return (
                  <li key={r.id}>
                    <Link
                      href={`/tablon/${r.id}`}
                      className="flex items-center gap-3.5 rounded-[20px] border border-borde bg-superficie px-3.5 py-3"
                    >
                      <Pastilla nombre={p.icono} color={p.color} fondo={p.fondo} tam={44} icono={22} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17.5px] font-bold leading-snug">
                          {r.titulo}
                        </span>
                        <span className="mt-0.5 block text-[15px] font-semibold text-tenue">
                          {cuando(r.fecha, r.hora)}
                        </span>
                      </span>
                      <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0 text-borde" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* ── Próximamente ── */}
        {ve.agenda && proximos.length > 0 && (
          <section className="mt-6">
            <h2 className="rotulo">Próximamente</h2>
            <ul className="mt-1">
              {proximos.map((r) => {
                const p = pintaDe(r.titulo)
                return (
                  <li key={r.id}>
                    <Link href={`/tablon/${r.id}`} className="flex items-center gap-3.5 px-0.5 py-2.5">
                      <Pastilla
                        nombre={p.icono}
                        color={p.color}
                        fondo={p.fondo}
                        tam={38}
                        icono={20}
                        redondez={12}
                      />
                      <span className="min-w-0 flex-1 truncate text-[17px] font-bold">
                        {r.titulo}
                      </span>
                      <span
                        className="shrink-0 text-[15px] font-bold"
                        style={{ color: p.color }}
                      >
                        {enCuanto(r.fecha)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {ve.agenda && hoy.length === 0 && proximos.length === 0 && conectado && (
          <p className="mt-6 rounded-[20px] bg-superficie px-6 py-8 text-center text-[17px] font-medium text-tinta-suave">
            Hoy no hay nada apuntado.
          </p>
        )}
      </div>

      <Barra activa="inicio" voz={false} />
    </main>
  )
}

/*
  ═══════════════════════════════════════════════════════════════
  UN CUADRADO DEL MOSAICO
  ═══════════════════════════════════════════════════════════════

  El icono arriba, la cifra en grande en medio, y abajo qué es y qué
  hay. Es el orden en que se mira un mosaico: primero el color y la
  forma, luego el número, y solo si hace falta se lee la letra.

  ─────────────────────────────────────────────────────────────
  LA CIFRA NO SALE SIEMPRE, Y ES LO IMPORTANTE

  Un «0» enorme en la pantalla de inicio es un reproche por algo que
  no has hecho mal. Cuando no hay nada, el cuadrado dice qué es y para
  qué sirve —«Deja un recado»— y ya está: invita en vez de regañar.

  Y el número es UN dato, no una tabla. «3» y debajo «Faltan 3 cosas»
  sería decir lo mismo dos veces, así que el pie cambia: con cifra
  dice lo que son, sin cifra dice para qué vale.
*/
function Cuadro({
  href,
  icono,
  color,
  titulo,
  pie,
  cifra,
  avisa = false,
}: {
  href: string
  icono: 'bolsa' | 'chincheta'
  color: string
  titulo: string
  pie: string
  /** El número, si hay algo que contar. */
  cifra: string | null
  /** Algo te está esperando a ti: se ve desde lejos. */
  avisa?: boolean
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[152px] flex-col justify-between rounded-[22px] p-4"
      style={{
        background: `color-mix(in srgb, ${color} ${avisa ? 20 : 12}%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} ${avisa ? 55 : 30}%, transparent)`,
      }}
    >
      <span
        className="flex h-[44px] w-[44px] items-center justify-center rounded-[14px] bg-superficie"
        style={{ color }}
      >
        <Ico nombre={icono} tam={23} grosor={2.1} />
      </span>

      <span className="mt-3 block">
        {cifra && (
          <span
            className="block text-[34px] font-extrabold leading-none tracking-tight"
            style={{ color }}
          >
            {cifra}
          </span>
        )}
        <span className="mt-1.5 block text-[17.5px] font-extrabold leading-tight tracking-tight">
          {titulo}
        </span>
        <span className="mt-0.5 block text-[14px] font-bold leading-snug" style={{ color }}>
          {pie}
        </span>
      </span>
    </Link>
  )
}

/** "en 8 días", "mañana", "en 2 meses" */
function enCuanto(fecha: string | null): string {
  if (!fecha) return ''
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dia = new Date(fecha + 'T12:00:00')
  dia.setHours(0, 0, 0, 0)
  const dias = Math.round((dia.getTime() - hoy.getTime()) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias < 45) return `en ${dias} días`
  return `en ${Math.round(dias / 30)} meses`
}
