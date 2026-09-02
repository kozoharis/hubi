import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import {
  calendariosVisibles,
  citasDeLaFamilia,
  etiquetaIcal,
} from '@/lib/agenda-google'
import { hoyAqui } from '@/lib/tablon'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/*
  «ACTUALIZAR AHORA» — Y LO QUE ESTE BOTÓN NO PUEDE HACER.

  Hay DOS retrasos entre una cita puesta en el móvil y esa cita
  aparecida en HUBI, y este botón solo quita uno:

    1. EL NUESTRO. HUBI guarda lo que trae de Google durante quince
       minutos para no ir a pedir el archivo en cada pantalla. Esto lo
       tira a la basura y va a buscarlo otra vez. Es instantáneo.

    2. EL DE GOOGLE. Google no publica al momento el archivo de la
       dirección secreta: lo regenera cuando le parece, y en la
       práctica pueden pasar horas. Eso NO está en nuestra mano y
       ningún botón lo va a arreglar.

  Por eso la respuesta dice cuántas citas hay AHORA MISMO en vez de un
  "sincronizado" a secas. Si el número no ha cambiado, no es que el
  botón no funcione: es que Google todavía no ha publicado el cambio, y
  eso hay que decirlo con esas palabras. Un botón que promete
  sincronizar y calla cuando no ha traído nada nuevo es de las cosas
  que hacen desconfiar de una aplicación entera.
*/
export async function POST() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const calendarios = await calendariosVisibles(user.id)
  if (calendarios.length === 0) {
    return NextResponse.json({ error: 'No hay ningún calendario conectado.' }, { status: 400 })
  }

  /* 1 · Fuera lo guardado de cada calendario que esta persona puede
     ver. El `{ expire: 0 }` es lo que hace que caduque YA y no dentro
     de un rato: sin él, esta llamada solo lo marcaría para más tarde y
     el botón parecería no hacer nada. */
  for (const c of calendarios) revalidateTag(etiquetaIcal(c.id), { expire: 0 })

  /* 2 · Y se va a buscar de nuevo AQUÍ MISMO, no en la pantalla
     siguiente. Así se puede contestar con un dato real y, si Google no
     responde, se dice ahora y no después. */
  const hoy = hoyAqui()
  const dentroDeUnMes = new Date(hoy + 'T12:00:00')
  dentroDeUnMes.setMonth(dentroDeUnMes.getMonth() + 1)

  const hasta = `${dentroDeUnMes.getFullYear()}-${String(dentroDeUnMes.getMonth() + 1).padStart(2, '0')}-${String(dentroDeUnMes.getDate()).padStart(2, '0')}`

  /* El `true` del final es lo que hace que esto vaya A GOOGLE y no a
     lo que acabamos de tirar. Sin él, el botón invalidaba lo guardado
     y en la misma petición volvía a leerlo: contestaba con el número
     viejo y parecía que no había hecho nada. */
  const citas = await citasDeLaFamilia(user.id, hoy, hasta, null, true)

  return NextResponse.json({
    bien: true,
    citas: citas.length,
    calendarios: calendarios.length,
  })
}
