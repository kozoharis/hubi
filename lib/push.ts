import webpush from 'web-push'
import { clienteServidor } from '@/lib/supabase/servidor'

export type Aviso = {
  titulo: string
  cuerpo: string
  url?: string
  tag?: string
}

let configurado = false

function configurar() {
  if (configurado) return

  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY

  if (!publica || !privada) throw new Error('SIN_CLAVES_VAPID')

  webpush.setVapidDetails('mailto:jmnazco@gmail.com', publica, privada)
  configurado = true
}

/**
 * Manda un aviso a todos los teléfonos de una persona.
 *
 * Si un teléfono ya no existe —app desinstalada, permiso revocado—
 * Google o Apple responden 404 o 410. Esa suscripción se borra: seguir
 * intentándolo eternamente solo generaría ruido.
 */
export async function avisarA(perfilId: string, aviso: Aviso): Promise<number> {
  configurar()
  const supa = clienteServidor()

  const { data: suscripciones } = await supa
    .from('suscripciones_push')
    .select('id, endpoint, p256dh, auth')
    .eq('perfil_id', perfilId)

  if (!suscripciones?.length) return 0

  let entregados = 0

  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(aviso)
        )
        entregados++
        await supa
          .from('suscripciones_push')
          .update({ usada_en: new Date().toISOString(), fallos: 0, ultimo_error: null })
          .eq('id', s.id)
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode

        if (codigo === 404 || codigo === 410) {
          await supa.from('suscripciones_push').delete().eq('id', s.id)
          return
        }

        await supa
          .from('suscripciones_push')
          .update({
            ultimo_error: e instanceof Error ? e.message.slice(0, 200) : 'desconocido',
          })
          .eq('id', s.id)
      }
    })
  )

  return entregados
}

/**
 * "Conchita ha añadido 3 cosas a la compra."
 *
 * UN aviso por tanda, no uno por artículo. Es la diferencia entre esto
 * y haberlo montado sobre las tareas: allí, apuntar la compra de la
 * semana habría hecho sonar el teléfono quince veces seguidas. Nadie
 * aguanta eso — y quien lo silencia, silencia también los avisos del
 * médico.
 *
 * Y solo al OTRO. Avisar a quien acaba de escribirlo es decirle algo
 * que ya sabe.
 */
export async function avisarDeCompra(quienLoApunta: string, cuantas: number): Promise<void> {
  const admin = clienteServidor()

  const { data: perfiles } = await admin.from('perfiles').select('id, nombre')
  const yo = (perfiles ?? []).find((p) => p.id === quienLoApunta)
  const otros = (perfiles ?? []).filter((p) => p.id !== quienLoApunta)

  const nombre = yo?.nombre?.split(' ')[0] ?? 'Alguien'
  const cuerpo =
    cuantas === 1 ? 'Ha añadido una cosa a la compra' : `Ha añadido ${cuantas} cosas a la compra`

  await Promise.all(
    otros.map((p) =>
      avisarA(p.id, {
        titulo: nombre,
        cuerpo,
        url: '/compra',
        /* La misma etiqueta siempre: si apunta tres tandas seguidas,
           el teléfono sustituye el aviso en vez de apilar tres. */
        tag: 'compra',
      }).catch(() => 0)
    )
  )
}
