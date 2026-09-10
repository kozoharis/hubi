import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { miHogar, SIN_CASA } from '@/lib/hogar'
import { avisarA } from '@/lib/push'
import { leerPerfil } from '@/lib/perfil'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LAS NOTAS
  ═══════════════════════════════════════════════════════════════

  Poner una, cambiarla, decir que la has visto, quitarla y volver a
  sacarla. Cinco cosas, dos verbos: POST pone, PATCH toca.

  Todo con la SESIÓN, nunca con la clave de servidor. La clave de
  servidor se salta las políticas — y las políticas son justo lo que
  impide que una nota acabe en la casa de al lado o firmada por otro.
*/

const LARGO = 1200

// ── Poner una nota ─────────────────────────────────────────
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { texto?: string; para?: string | null }
  try {
    cuerpo = (await peticion.json()) as { texto?: string; para?: string | null }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const texto = String(cuerpo.texto ?? '').trim()
  if (texto.length === 0) {
    return NextResponse.json({ error: 'La nota está vacía.' }, { status: 400 })
  }
  if (texto.length > LARGO) {
    return NextResponse.json(
      { error: `La nota es muy larga. Máximo ${LARGO} letras.` },
      { status: 400 }
    )
  }

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 409 })

  /*
    ¿PARA QUIÉN?

    Vacío = para toda la casa. Con alguien, se comprueba que ese
    alguien está EN ESTA CASA: sin esta comprobación, un identificador
    escrito a mano dejaría una nota dirigida a un desconocido, que ni
    la vería ni se podría quitar de encima.
  */
  let para: string | null = null
  const pedido = String(cuerpo.para ?? '').trim()

  if (pedido === user.id) {
    /*
      A TI MISMO, QUE ES LO MÁS NORMAL DEL MUNDO.

      Antes esta línea decía `pedido && pedido !== user.id`: tu propio
      identificador se descartaba EN SILENCIO y la nota acababa siendo
      «para la casa». O sea que dejarte una nota a ti no fallaba, que
      habría sido mejor — hacía otra cosa sin decirlo.

      Y una nota a la casa no es lo mismo: la de la casa no sale en tu
      Inicio y no se queda hasta que la despachas. Es justo eso lo que
      se busca al apuntarse algo uno mismo.

      Aquí no hace falta comprobar que estás en esta casa: `miHogar`
      acaba de devolverla y es la tuya.
    */
    para = pedido
  } else if (pedido) {
    const { data: esDeCasa } = await supabase
      .from('miembros')
      .select('perfil_id')
      .eq('hogar_id', hogarId)
      .eq('perfil_id', pedido)
      .maybeSingle()

    if (!esDeCasa) {
      return NextResponse.json({ error: 'Esa persona no está en esta casa.' }, { status: 400 })
    }
    para = pedido
  }

  /* El `.select()` no es adorno: un INSERT que las políticas no
     permitan afecta a cero filas y contesta que todo ha ido bien. */
  const { data, error } = await supabase
    .from('notas')
    .insert({ hogar_id: hogarId, texto, para, escrita_por: user.id })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[HUBI] No se ha podido poner la nota:', error)
    return NextResponse.json(
      {
        error: 'No se ha podido guardar la nota.',
        detalle: error?.message ?? 'Esto todavía no está disponible en esta casa.',
      },
      { status: 500 }
    )
  }

  /*
    EL AVISO, SOLO SI ES PARA ALGUIEN.

    Una nota para toda la casa no hace sonar ningún teléfono: es el
    corcho de la cocina, se mira cuando se pasa por delante. Hacer
    vibrar dos móviles cada vez que alguien apunta «queda poca leña»
    es la manera más rápida de que los dos apaguen los avisos.
  */
  /* Y a ti mismo no, claro. Que te vibre el móvil por algo que
     acabas de escribir tú es la manera más rápida de que apagues los
     avisos — y de que dejes de enterarte de los que sí importan. */
  if (para && para !== user.id) {
    try {
      const yo = await leerPerfil(supabase, user.id, user.email)
      const quienEs = yo.nombre.split(' ')[0]
      await avisarA(para, {
        titulo: 'HUBI',
        cuerpo: `${quienEs} te ha dejado una nota: ${recorta(texto)}`,
        url: '/notas',
        tag: `nota-${data.id}`,
      })
    } catch (e) {
      /* La nota ya está puesta. Que el aviso no salga no puede hacer
         que la pantalla diga que ha fallado. */
      console.error('[HUBI] Nota guardada pero sin avisar:', e)
    }
  }

  return NextResponse.json({ bien: true, id: data.id })
}

// ── Tocar una nota ─────────────────────────────────────────
/*
  Cuatro cosas, y cada una la puede hacer alguien distinto:

    visto      · quien la recibe. Decir «me he enterado».
    texto      · quien la escribió. Corregirla.
    guardar    · cualquiera de los dos. La aparta de la vista.
    recuperar  · cualquiera de los dos. La devuelve al corcho.

  Quién puede qué se comprueba AQUÍ además de en las políticas. Las
  políticas dejan tocar la fila a los dos —hace falta para que «Visto»
  funcione—; el reparto fino de qué columna toca cada uno es este.
*/
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  type Cambio = { id?: string; que?: string; texto?: string; destino?: string | null }

  let cuerpo: Cambio
  try {
    cuerpo = (await peticion.json()) as Cambio
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const id = String(cuerpo.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta la nota.' }, { status: 400 })

  /* Su casa. Hace falta para comprobar que el nuevo destinatario está
     dentro de ella: sin eso, un identificador escrito a mano dejaría
     la nota dirigida a un desconocido, que ni la vería ni podría
     quitársela de encima. */
  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) return NextResponse.json({ error: SIN_CASA }, { status: 409 })

  const { data: nota } = await supabase
    .from('notas')
    .select('id, escrita_por, para, guardada_en')
    .eq('id', id)
    .maybeSingle()

  if (!nota) {
    return NextResponse.json({ error: 'Esa nota ya no está.' }, { status: 404 })
  }

  const mia = nota.escrita_por === user.id
  const paraMi = nota.para === user.id

  const cambio: Record<string, string | null> = {}

  switch (cuerpo.que) {
    case 'visto':
      if (!paraMi) {
        return NextResponse.json({ error: 'Esa nota no es para ti.' }, { status: 403 })
      }
      cambio.vista_en = new Date().toISOString()
      break

    case 'texto': {
      if (!mia) {
        return NextResponse.json(
          { error: 'Solo puede cambiarla quien la escribió.' },
          { status: 403 }
        )
      }
      const texto = String(cuerpo.texto ?? '').trim()
      if (texto.length === 0) {
        return NextResponse.json({ error: 'La nota está vacía.' }, { status: 400 })
      }
      if (texto.length > LARGO) {
        return NextResponse.json(
          { error: `La nota es muy larga. Máximo ${LARGO} letras.` },
          { status: 400 }
        )
      }
      cambio.texto = texto
      cambio.cambiada_en = new Date().toISOString()

      /*
        Y DE PASO, PARA QUIÉN.

        Faltaba: se podía corregir la letra pero no el destinatario, y
        equivocarse de persona al ponerla es lo más fácil del mundo —
        las pastillas están una al lado de otra—. Sin esto había que
        quitar la nota y escribirla otra vez.

        `destino` viaja aparte de `para` en el cuerpo para poder
        distinguir «no lo toques» de «ponla para la casa»: con un solo
        campo, no mandarlo y mandarlo vacío serían lo mismo, y una
        corrección de texto acabaría desasignando la nota sin querer.
      */
      if (cuerpo.destino !== undefined) {
        const aQuien = String(cuerpo.destino ?? '').trim()

        if (!aQuien) {
          cambio.para = null
        } else if (aQuien === user.id) {
          cambio.para = aQuien
        } else {
          const { data: esDeCasa } = await supabase
            .from('miembros')
            .select('perfil_id')
            .eq('hogar_id', hogarId)
            .eq('perfil_id', aQuien)
            .maybeSingle()

          if (!esDeCasa) {
            return NextResponse.json(
              { error: 'Esa persona no está en esta casa.' },
              { status: 400 }
            )
          }
          cambio.para = aQuien
        }

        /* Cambia de dueño, así que el «visto» del anterior ya no dice
           nada: la nota vuelve a estar sin ver para quien la reciba
           ahora. Dejarlo puesto haría que le llegara marcada como
           leída por otro. */
        if (cambio.para !== nota.para) cambio.vista_en = null
      }
      break
    }

    case 'guardar':
      if (!mia && !paraMi) {
        return NextResponse.json({ error: 'Esa nota no es tuya.' }, { status: 403 })
      }
      cambio.guardada_en = new Date().toISOString()
      break

    case 'recuperar':
      if (!mia && !paraMi) {
        return NextResponse.json({ error: 'Esa nota no es tuya.' }, { status: 403 })
      }
      cambio.guardada_en = null
      break

    default:
      return NextResponse.json({ error: 'No sé qué hacer con esa nota.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('notas')
    .update(cambio)
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    console.error('[HUBI] No se ha podido cambiar la nota:', error)
    return NextResponse.json(
      {
        error: 'No se ha podido cambiar la nota.',
        detalle: error?.message ?? 'Puede que no tengas permiso para escribir en esta casa.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true })
}

/* El aviso del móvil enseña un trozo, no la nota entera: en la
   pantalla bloqueada no cabe, y cortada a lo bruto se lee peor que
   con puntos suspensivos. */
function recorta(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  return limpio.length <= 80 ? limpio : `${limpio.slice(0, 79)}…`
}
