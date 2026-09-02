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
  'no-eres-tu': { texto: 'Solo Juan Miguel puede conectar el Drive de la familia.', bien: false },
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

      admin.from('conexion_drive').select('estado').eq('id', 1).maybeSingle(),

      /* Cuántas cosas faltan. Solo el número: la lista entera se ve
         al entrar, y el inicio no es una lista. */
      supabase
        .from('compra')
        .select('id', { count: 'exact', head: true })
        .eq('comprado', false)
        .is('archivado_en', null),
    ])

  const hoy = (pendientes ?? []) as Recordatorio[]
  const proximos = (siguientes ?? []) as Recordatorio[]

  const nombre = perfil.nombre

  const esJuanMiguel = perfil.es_propietario_drive
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
        <div className="flex h-14 items-center justify-between">
          <span className="flex items-center gap-2">
            <Logo tam={36} />
            <span className="text-[22px] font-extrabold tracking-[0.09em]">HUBI</span>
          </span>
          <Link href="/ajustes" aria-label="Ajustes">
            <Avatar nombre={nombre} foto={perfil.foto} tam={44} />
          </Link>
        </div>
      </Cabecera>

      <div className="relative z-10 mx-auto w-full max-w-md px-5 pt-1">
        {/* ── Saludo ── */}
        <p className="mt-2.5 text-[14.5px] font-bold text-tenue">{hoyEnPalabras()}</p>
        {/* Nunca "Buenas tardes," a secas: si no hubiera nombre, se
            saluda sin coma y punto. Una frase colgando hace dudar de
            todo lo que viene debajo. */}
        <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight tracking-tight">
          {nombre ? `${saludo()}, ${nombre}` : saludo()}
        </h1>

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

        {/* ── Lo único grande de la pantalla ── */}
        {conectado && (
          <Link
            href="/guardar"
            className="mt-2.5 flex h-[74px] items-center gap-3.5 rounded-[22px] px-4"
            style={{
              background: 'color-mix(in srgb, #14B8A6 12%, transparent)',
              border: '1px solid color-mix(in srgb, #14B8A6 30%, transparent)',
            }}
          >
            <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-superficie text-verde">
              <Ico nombre="foto" tam={24} grosor={2.1} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block whitespace-nowrap text-[18.5px] font-extrabold tracking-tight">
                Guardar documento
              </span>
              <span className="block text-[14.5px] font-bold text-verde">
                Haz una foto y yo lo archivo
              </span>
            </span>
            <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-verde" />
          </Link>
        )}

        {/*
          ── La compra ──

          Va aquí arriba, con Guardar documento, y no en la barra de
          abajo. Cinco pestañas es el tope: con seis, cada botón baja
          de los 48 px que protegen a un dedo de 75 años.

          Y va arriba porque es lo que más se usa. Un papel se guarda
          una vez por semana; la compra es todos los días. El punto 6
          dice que el inicio es para lo relevante, y lo relevante es
          lo que se toca a diario.
        */}
        <Link
          href="/compra"
          className="mt-2.5 flex h-[74px] items-center gap-3.5 rounded-[22px] px-4"
          style={{
            background: 'color-mix(in srgb, #0EA5E9 12%, transparent)',
            border: '1px solid color-mix(in srgb, #0EA5E9 30%, transparent)',
          }}
        >
          <span
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-superficie"
            style={{ color: '#0EA5E9' }}
          >
            <Ico nombre="bolsa" tam={24} grosor={2.1} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block whitespace-nowrap text-[18.5px] font-extrabold tracking-tight">
              La compra
            </span>
            <span className="block text-[14.5px] font-bold" style={{ color: '#0EA5E9' }}>
              {porComprar === 0
                ? 'La lista está vacía'
                : porComprar === 1
                  ? 'Falta 1 cosa por coger'
                  : `Faltan ${porComprar} cosas por coger`}
            </span>
          </span>
          <span className="shrink-0" style={{ color: '#0EA5E9' }}>
            <Ico nombre="flecha" tam={22} grosor={2.2} />
          </span>
        </Link>

        {/* ── Conectar Drive ── */}
        {!conectado && esJuanMiguel && (
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

        {!conectado && !esJuanMiguel && (
          <p className="mt-6 rounded-2xl bg-superficie px-5 py-4 text-[17px] leading-snug text-tinta-suave">
            Guardar documentos estará disponible cuando Juan Miguel conecte el Drive de la
            familia.
          </p>
        )}

        {/* ── Hoy ── */}
        {hoy.length > 0 && (
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
        {proximos.length > 0 && (
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

        {hoy.length === 0 && proximos.length === 0 && conectado && (
          <p className="mt-6 rounded-[20px] bg-superficie px-6 py-8 text-center text-[17px] font-medium text-tinta-suave">
            Hoy no hay nada apuntado.
          </p>
        )}
      </div>

      <Barra activa="inicio" voz={false} />
    </main>
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
