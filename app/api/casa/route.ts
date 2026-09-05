import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  CREAR LA CASA
  ═══════════════════════════════════════════════════════════════

  Esta ruta casi no hace nada, y eso es lo correcto: todo el trabajo
  —el hogar, la persona dentro como propietaria, las carpetas base y
  la actividad— lo hace `crear_mi_casa` dentro de la base de datos, en
  UNA transacción. Ver sql/30.

  Si esto se hubiera montado como cuatro inserciones desde aquí, entre
  la primera y la cuarta cabe que se corte la cobertura, se cierre la
  pestaña o Vercel congele la función. Y quedarse a medias significa
  una persona con hogar y sin carpetas, o un hogar sin nadie dentro:
  nadie se enteraría hasta ir a guardar la primera factura.

  Se llama con la SESIÓN, no con la clave de servidor. La función sabe
  quién es por `auth.uid()`, así que nadie puede crear una casa a
  nombre de otro pasando un identificador a mano.
*/

const ACTIVIDADES = ['finca', 'obra', 'alquileres'] as const

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { nombre?: string; actividad?: string | null }
  try {
    cuerpo = (await peticion.json()) as { nombre?: string; actividad?: string | null }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const nombre = String(cuerpo.nombre ?? '').trim().slice(0, 60)
  if (nombre.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre a tu casa.' }, { status: 400 })
  }

  /* Lo que no esté en la lista es «ninguna». Nunca se pasa a la base
     de datos algo que venga del navegador sin comprobarlo. */
  const suelto = String(cuerpo.actividad ?? '')
  const actividad = (ACTIVIDADES as readonly string[]).includes(suelto) ? suelto : null

  const { data, error } = await supabase.rpc('crear_mi_casa', {
    nombre_casa: nombre,
    actividad,
  })

  if (error) {
    console.error('[HUBI] No se ha podido crear la casa:', error)

    /* El caso concreto que va a pasar de verdad: el SQL 30 todavía no
       se ha ejecutado. Merece decirse con nombre y apellidos en vez de
       un «algo ha fallado» que no ayuda a nadie. */
    const faltaLaFuncion = /crear_mi_casa|function|does not exist|schema cache/i.test(
      error.message
    )

    return NextResponse.json(
      {
        error: faltaLaFuncion
          ? 'HUBI todavía no sabe crear casas nuevas. No es cosa tuya: avisa a quien lo mantiene (falta ejecutar el SQL 30).'
          : 'No se ha podido crear tu casa. Inténtalo en un minuto.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true, hogar: data })
}
