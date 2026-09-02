import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'

export const dynamic = 'force-dynamic'

/*
  Cambiar tu nombre.

  POR QUÉ HACÍA FALTA.

  El nombre se pone solo el día que se crea la cuenta, y sale del
  correo: `split_part(new.email, '@', 1)`. Así que Juan Miguel se
  llamaba "Jmnazco" en toda la aplicación — en el saludo de Inicio, en
  las tarjetas del Tablón, en los avisos al móvil, en la voz ("díselo a
  Jmnazco"). No había ninguna pantalla para arreglarlo.

  Y no es un detalle de estética: `lib/entender-voz.ts` busca a quién
  va dirigida una tarea COMPARANDO con los nombres de `perfiles`. Con
  el nombre mal puesto, "recuérdale a Juan Miguel que…" no encontraba a
  nadie.

  Cada uno cambia solo el suyo: se escribe en la fila de quien tiene la
  sesión abierta, nunca en la del otro. La base de datos lo vuelve a
  comprobar por su cuenta (política `perfiles_editar_el_suyo`).
*/

const LARGO = 40

export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { nombre?: unknown }
  try {
    cuerpo = (await peticion.json()) as { nombre?: unknown }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido el nombre.' }, { status: 400 })
  }

  /* Se limpia lo que no debería estar en un nombre: saltos de línea,
     caracteres de control y espacios repetidos. Lo demás se respeta —
     acentos, guiones y apellidos compuestos son nombres normales. */
  const nombre = String(cuerpo.nombre ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LARGO)

  if (nombre.length < 2) {
    return NextResponse.json(
      { error: 'Escribe al menos dos letras.' },
      { status: 400 }
    )
  }

  /*
    SE PIDEN LAS FILAS DE VUELTA, A PROPÓSITO.

    Es el fallo que más veces ha aparecido en este proyecto: cuando la
    base de datos no deja hacer algo, no devuelve un error — devuelve
    CERO FILAS y se queda tan tranquila. Sin este `.select()`, un
    cambio que no se ha guardado se vería exactamente igual que uno que
    sí, y la pantalla diría "listo" mintiendo.
  */
  const { data, error } = await supabase
    .from('perfiles')
    .update({ nombre })
    .eq('id', user.id)
    .select('nombre')

  if (error) {
    return NextResponse.json(
      { error: 'No se ha podido guardar el nombre.', detalle: error.message },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido guardar el nombre. Vuelve a entrar y prueba otra vez.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ bien: true, nombre: data[0].nombre })
}
