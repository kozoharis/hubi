import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { quien } from '@/lib/supabase/quien'
import { mandaEnSuCasa, quienManda } from '@/lib/hogar'
import { estadoGuardado } from '@/lib/google/calendario'
import Cabecera from '../../cabecera'
import Barra from '../../barra'
import { Volver } from '../../iconos'
import PrepararCalendario from '../calendario'
import { elEspacio } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  GOOGLE, EN UNA PANTALLA APARTE
  ═══════════════════════════════════════════════════════════════

  En Ajustes había TRES filas para esto: «Google Drive · Conectado»,
  «Volver a conectar Google» y «Calendario en Google». Tres, seguidas,
  diciendo casi lo mismo, y una de ellas llevaba a la pantalla de
  diagnóstico — que es una herramienta de mantenimiento, no un ajuste.

  Ajustes es la pantalla donde alguien busca UNA cosa concreta. Cuando
  tres de sus filas hablan del mismo asunto, hay que leerlas las tres
  para saber cuál. Ahora es una: «Google», y lo de dentro está dentro.
*/

export default async function AjustesDeGoogle() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const hogarId = await elEspacio(supabase)
  const manda = await mandaEnSuCasa(supabase, user.id)

  const admin = clienteServidor()
  const { data: conexion } = hogarId
    ? await admin
        .from('conexion_drive')
        .select('estado, email_cuenta')
        .eq('hogar_id', hogarId)
        .maybeSingle()
    : { data: null }

  const conectado = conexion?.estado === 'activa'
  const caducado = conexion?.estado === 'caducada'

  const calendario =
    manda && hogarId ? await estadoGuardado(hogarId) : { permiso: false, creado: false }

  const elJefe = manda || !hogarId ? null : await quienManda(supabase, hogarId)

  return (
    <main className="min-h-screen pb-40">
      <Cabecera formulario>
        <Volver href="/ajustes" />
        <h1 className="t-titulo mt-2.5">Google</h1>
      </Cabecera>

      <div className="columna-formulario pt-1">
        {/* ── Cómo está ── */}
        <div className="mt-3 rounded-[20px] border border-borde bg-superficie px-4 py-4">
          <p className="text-[17.5px] font-extrabold leading-snug">
            {conectado ? 'Conectado' : caducado ? 'La conexión ha caducado' : 'Sin conectar'}
          </p>
          <p className="mt-1 text-[15.5px] font-semibold leading-snug text-tenue">
            {conectado ? (
              <>
                Los papeles de esta casa se guardan en el Google Drive de{' '}
                <strong className="text-tinta">{conexion?.email_cuenta ?? 'la cuenta'}</strong>,
                en una carpeta llamada <strong className="text-tinta">HUBI</strong>.
              </>
            ) : manda ? (
              'Todavía no se pueden guardar papeles. Conecta tu cuenta de Google aquí abajo.'
            ) : (
              `Lo conecta ${elJefe ?? 'quien creó esta casa'}: la cuenta de Google es suya.`
            )}
          </p>

          {/*
            HUBI SOLO VE LO QUE ELLA MISMA CREA.

            Es literalmente cierto —el permiso que pedimos a Google se
            llama `drive.file`— y es la frase que decide si alguien
            pulsa o cierra la pestaña. Se dice aquí, donde está la
            duda, y no en un texto legal que nadie abre.
          */}
          <p className="mt-3 rounded-[16px] border border-borde px-3.5 py-3 text-[14.5px] font-semibold leading-snug text-tenue">
            HUBI solo ve los archivos que ella misma crea. No puede abrir nada de lo que ya
            tengas en tu Drive.
          </p>
        </div>

        {manda && (
          <>
            <a
              href="/api/google/conectar"
              className="mt-3 flex h-[60px] items-center justify-center rounded-[16px] bg-accion text-[19px] font-extrabold text-accion-tinta"
            >
              {conectado ? 'Volver a conectar' : caducado ? 'Volver a conectar' : 'Conectar Google Drive'}
            </a>

            <p className="mt-3 text-[15px] font-semibold leading-snug text-tenue">
              {conectado
                ? 'Hace falta solo si HUBI pide un permiso nuevo —el del calendario, por ejemplo— o si algo deja de funcionar. No pierdes nada de lo guardado.'
                : 'Google mostrará un aviso de aplicación no verificada. Es normal: pulsa Configuración avanzada y después Ir a HUBI. Solo ocurre esta vez.'}
            </p>

            <h2 className="rotulo mt-6">El calendario</h2>
            <div className="mt-2.5">
              <PrepararCalendario listo={calendario.creado} permiso={calendario.permiso} />
            </div>
          </>
        )}
      </div>

      <Barra voz={false} />
    </main>
  )
}
