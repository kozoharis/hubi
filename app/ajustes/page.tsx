import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { clienteServidor } from '@/lib/supabase/servidor'
import BotonSalir from '../boton-salir'
import Barra from '../barra'
import Cabecera from '../cabecera'
import { Ico, Pastilla, Volver, type Icono } from '../iconos'
import SelectorTema from '../tema'
import { leerPerfil } from '@/lib/perfil'
import { miHogar, mandaEnSuCasa } from '@/lib/hogar'
import { estadoGuardado } from '@/lib/google/calendario'
import TuPerfil from './foto'
import PrepararCalendario from './calendario'
import MiCalendario from './mi-calendario'

export const dynamic = 'force-dynamic'

/*
  Ajustes.

  Ya no es una pestaña: se entra tocando la inicial de arriba a la
  derecha en Inicio. Así las cinco pestañas de abajo son secciones de
  verdad y ningún ajuste ocupa sitio.
*/

export default async function Ajustes() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const perfil = await leerPerfil(supabase, user.id, user.email)

  /* De qué casa es quien mira esta pantalla. Todo lo de Google —el
     Drive conectado, el calendario— es de SU casa, no «el» de HUBI. */
  const hogarId = await miHogar(supabase, user.id)

  const admin = clienteServidor()
  const { data: conexion } = hogarId
    ? await admin
        .from('conexion_drive')
        .select('estado, email_cuenta')
        .eq('hogar_id', hogarId)
        .maybeSingle()
    : { data: null }

  const nombre = perfil.nombre

  /* ¿Tiene esta persona su calendario de Google volcado? Se mira si
     hay algo guardado, sin descifrarlo: la dirección no tiene por qué
     salir de `lib/agenda-google.ts` ni para esto. */
  const { data: mio } = await admin
    .from('perfiles')
    .select('ical_desde, ical_compartido')
    .eq('id', user.id)
    .maybeSingle()

  /* Con quién se compartiría. Si vive solo, el interruptor no se
     enseña: un ajuste para compartir con nadie es una pregunta sin
     sentido.

     Va con la SESIÓN y no con la clave de servidor. Con la clave de
     servidor no hay políticas: el «otro» que salía aquí podía ser
     cualquiera de HUBI, y esta pantalla le habría enseñado a alguien
     el nombre de pila de un desconocido. */
  const { data: otros } = await supabase
    .from('perfiles')
    .select('id, nombre')
    .neq('id', user.id)
    .limit(1)
  const elOtro = otros?.[0]?.nombre?.split(' ')[0] ?? null

  /*
    ── Las secciones que se dividen, con lo que tienen dentro ──

    Todo esto va envuelto para que no pueda tumbar Ajustes. `unidades`
    y `palabra_unidad` son cosas nuevas: si el SQL todavía no se ha
    ejecutado, Postgres no falla «esa columna» — rechaza la consulta
    entera. Y una pantalla de Ajustes en blanco deja a la persona sin
    poder ni siquiera salir de la sesión.

    Se lee con la SESIÓN y no con la clave de servidor: las unidades
    son del hogar de quien ha entrado, y las políticas por hogar son
    justamente lo que impide ver las de otra casa.
  */
  const conUnidades: {
    id: string
    nombre: string
    color: string
    fondo: string
    pie: string
  }[] = []

  try {
    /* TODAS las actividades, se dividan o no. Antes solo salían las
       divididas, y por eso la Finca no aparecía por ningún lado: no
       había manera de decirle a HUBI «ésta también quiero llevarla
       por partes». El interruptor está ahora dentro de cada una. */
    const { data: secciones } = await supabase
      .from('categorias')
      .select('id, nombre, color, fondo, usa_unidades, palabra_unidad')
      .is('padre_id', null)
      .eq('lleva_cuentas', true)
      .eq('activa', true)
      .order('orden')

    for (const s of secciones ?? []) {
      const divide = s.usa_unidades === true
      const palabra = ((s.palabra_unidad as string | null) ?? '').replace(
        /^(el|la|los|las)\s+/i,
        ''
      )

      conUnidades.push({
        id: s.id as string,
        nombre: s.nombre as string,
        color: (s.color as string) || '#64748B',
        fondo: (s.fondo as string) || '#EEF2F7',
        pie: divide
          ? `Por ${palabra || 'partes'} · partidas`
          : 'Una sola · partidas',
      })
    }
  } catch {
    /* Sin unidades todavía. Ajustes sigue funcionando entero. */
  }

  const icalDesde = mio?.ical_desde
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(
        new Date(mio.ical_desde as string)
      )
    : null

  const conectado = conexion?.estado === 'activa'

  /* Solo a quien conectó Google en su casa: el calendario vive en su
     cuenta, y quien no lo conectó no tiene nada que preparar ahí. */
  const manda = await mandaEnSuCasa(supabase, user.id)
  const calendario =
    manda && hogarId ? await estadoGuardado(hogarId) : { permiso: false, creado: false }

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href="/" texto="Volver" />

        <h1 className="text-[27px] font-extrabold tracking-tight">Ajustes</h1>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-1">

        {/* ── Quién eres ── */}
        <div className="mt-3">
          <TuPerfil nombre={nombre} foto={perfil.foto} />
        </div>

        {/* ── Cómo se ve ── */}
        <h2 className="rotulo mt-5">Cómo se ve</h2>
        <div className="mt-2.5">
          <SelectorTema />
        </div>

        {/* ── La aplicación ── */}
        <h2 className="rotulo mt-5">La aplicación</h2>
        <div className="mt-2.5 space-y-2.5">
          <Opcion
            href="/avisos"
            icono="campana"
            color="#F59E0B"
            fondo="#FEF1DC"
            titulo="Avisos en el móvil"
            pie="Recordatorios y vencimientos"
          />
          {/*
            AQUÍ HABÍA DOS OPCIONES QUE MENTÍAN.

            "Quién ve qué · papeles compartidos y privados" y "Carpetas
            · dónde se guarda cada papel" llevaban LAS DOS a la misma
            pantalla —la lista de documentos—, que no tiene ni ajuste
            de visibilidad ni gestión de carpetas. Y lo de "privados"
            prometía algo que no existe: hoy todo documento se guarda
            como compartido, sin excepción.

            Se quedan en una sola, que dice lo que de verdad hace.
          */}
          <Opcion
            href="/documentos"
            icono="carpeta"
            color="#14B8A6"
            fondo="#DFF7F3"
            titulo="Los papeles"
            pie="Ver todo lo guardado y sus carpetas"
          />
          {manda ? (
            <>
              <Opcion
                href="/comprobacion"
                icono="escudo"
                color="#64748B"
                fondo="#EEF2F7"
                titulo="Google Drive"
                pie={
                  conectado
                    ? `Conectado · ${conexion?.email_cuenta ?? 'tu cuenta'} · comprobar`
                    : 'Sin conectar'
                }
                bien={conectado}
              />

              {/*
                Volver a conectar tiene que estar SIEMPRE a la vista, no
                solo cuando la conexión se rompe. Cada vez que HUBI pide
                un permiso nuevo a Google —el del calendario, por
                ejemplo— hay que pasar otra vez por esta pantalla, y sin
                este botón no había manera de llegar.
              */}
              <a
                href="/api/google/conectar"
                className="flex items-center gap-3 rounded-[20px] border border-borde bg-superficie px-3.5 py-3"
              >
                <Pastilla nombre="escudo" color="#14B8A6" fondo="#DFF7F3" tam={44} icono={22} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[17.5px] font-extrabold tracking-tight">
                    {conectado ? 'Volver a conectar Google' : 'Conectar Google Drive'}
                  </span>
                  <span className="mt-0.5 block text-[14.5px] font-bold text-tenue">
                    {conectado
                      ? 'Hace falta al añadir permisos nuevos'
                      : 'Para poder guardar documentos'}
                  </span>
                </span>
                <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0 text-borde" />
              </a>

              <PrepararCalendario listo={calendario.creado} permiso={calendario.permiso} />
            </>
          ) : (
            <Opcion
              href="/"
              icono="escudo"
              color="#64748B"
              fondo="#EEF2F7"
              titulo="Google Drive"
              /* Antes decía «Conectado por Juan Miguel», escrito a
                 mano. En otra casa eso sería el nombre de otra
                 persona, así que se dice quién es de verdad: la cuenta
                 con la que se conectó. */
              pie={
                conectado
                  ? `Conectado · ${conexion?.email_cuenta ?? 'la cuenta de tu casa'}`
                  : 'Todavía sin conectar'
              }
              bien={conectado}
            />
          )}
        </div>

        {/* ── Tu calendario de Google ── */}
        {/*
          Va aquí y no dentro del bloque de Juan Miguel: esto lo puede
          hacer cada uno con SU calendario, y cada uno ve solo el suyo.
          El calendario personal de alguien no se le enseña al otro
          porque sí — si lo quieren compartir, Google Calendar sirve
          para eso y es su decisión, no la nuestra.
        */}
        <h2 className="rotulo mt-5">Tu calendario</h2>
        <div className="mt-2.5">
          <MiCalendario
            conectado={Boolean(mio?.ical_desde)}
            desde={icalDesde}
            compartido={mio?.ical_compartido === true}
            elOtro={elOtro}
          />
        </div>

        {/*
          ── Lo que hay dentro de cada sección ──

          Solo sale si alguna sección se divide. Una casa que no tenga
          apartamentos, obras ni pisos no ve nada de esto: el punto 5
          pide pocas decisiones por pantalla, y un apartado vacío es
          una decisión que alguien tiene que descartar cada vez que
          pasa por aquí.
        */}
        {conUnidades.length > 0 && (
          <>
            <h2 className="rotulo mt-5">Tus actividades</h2>
            <div className="mt-2.5 space-y-2.5">
              {conUnidades.map((s) => (
                <Opcion
                  key={s.id}
                  href={`/seccion/${s.id}/ajustes`}
                  icono="euro"
                  color={s.color}
                  fondo={s.fondo}
                  titulo={s.nombre}
                  pie={s.pie}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Si algo no va ── */}
        <h2 className="rotulo mt-5">Si algo no va</h2>
        <div className="mt-2.5 space-y-2.5">
          <Opcion
            href="/comprobacion"
            icono="aviso"
            color="#8B5CF6"
            fondo="#EEE8FE"
            titulo="Comprobar la conexión"
            pie="Mira si todo está en su sitio"
          />
        </div>

        <div className="mt-5">
          <BotonSalir />
        </div>

        <p className="mt-5 text-center text-[14.5px] font-semibold text-tenue">
          <Link href="/privacidad">Privacidad</Link>
          {' · '}
          <Link href="/terminos">Términos</Link>
        </p>
      </div>

      <Barra voz={false} />
    </main>
  )
}

function Opcion({
  href,
  icono,
  color,
  fondo,
  titulo,
  pie,
  bien = false,
}: {
  href: string
  icono: Icono
  color: string
  fondo: string
  titulo: string
  pie: string
  bien?: boolean
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[20px] border border-borde bg-superficie px-3.5 py-3"
    >
      <Pastilla nombre={icono} color={color} fondo={fondo} tam={44} icono={22} />
      <span className="min-w-0 flex-1">
        <span className="block text-[17.5px] font-extrabold tracking-tight">{titulo}</span>
        <span
          className={`mt-0.5 block text-[14.5px] font-bold ${bien ? 'text-verde' : 'text-tenue'}`}
        >
          {pie}
        </span>
      </span>
      <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0 text-borde" />
    </Link>
  )
}
