import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  ESTA CARPETA ES MÍA · O VUELVE A SER DE LA CASA
  ═══════════════════════════════════════════════════════════════

  El punto 21 del planteamiento, y lo que dijo Haris: *«si es salud, tú
  puedas decidir si quieres hacerla visible solo para ti o para toda la
  familia»*.

  Dos valores y nada más: `privada_de = yo` o `privada_de = null`.

  ─────────────────────────────────────────────────────────────
  AQUÍ NO SE COMPRUEBA QUIÉN PUEDE. LO HACE LA BASE

  Y es a propósito. El disparador `lo_privado_es_de_su_duenyo`
  (paso 82) solo deja tres movimientos: cerrarla si es de la casa,
  abrirla si es mía, o no tocarla. Ni el propietario puede abrir la de
  otro.

  Repetir esa regla aquí sería tener dos sitios donde arreglarla, y la
  de aquí es la que NO protege: quien llame a Postgres por otro camino
  —la voz, un guion, la pantalla de la cocina— se salta esta ruta pero
  no se salta el disparador.

  Lo que sí se hace aquí es **traducir el error a algo que se entienda**.
  Un mensaje de Postgres en una pantalla que ve Conchita no es un
  mensaje, es un susto.

  ─────────────────────────────────────────────────────────────
  Y NO SE MANDA A QUIÉN

  El cuerpo dice `mia: true` o `mia: false`, y el dueño sale de la
  sesión. Si viniera un `perfil_id` en la petición, esta ruta existiría
  para ponerle a otro una carpeta a su nombre — que es justo lo que el
  disparador impide y lo que no queremos poder pedir.
*/

export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })

  const casa = await elEspacioO(supabase)
  const cuerpo = (await peticion.json().catch(() => ({}))) as { id?: string; mia?: boolean }

  const id = String(cuerpo.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta la carpeta.' }, { status: 400 })

  const { data, error } = await supabase
    .from('categorias')
    .update({ privada_de: cuerpo.mia === true ? user.id : null })
    .eq('hogar_id', casa)
    .eq('id', id)
    .select('id, privada_de')

  if (error) {
    /* El disparador del paso 82 habla en castellano a propósito, así
       que su mensaje se puede enseñar tal cual. Lo demás, no. */
    const suyo = /solo la cierra y la abre quien la tiene/i.test(error.message)
    return NextResponse.json(
      {
        error: suyo
          ? 'Esa carpeta es de otra persona. Solo ella puede abrirla o cerrarla.'
          : 'No se ha podido cambiar.',
        detalle: suyo ? undefined : error.message,
      },
      { status: suyo ? 403 : 500 }
    )
  }

  /* Con `.select()`: un cambio que la seguridad no permite contesta
     «todo bien» habiendo tocado cero filas. */
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'Esa carpeta ya no está, o no puedes cambiarla.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ bien: true, mia: data[0].privada_de != null })
}
