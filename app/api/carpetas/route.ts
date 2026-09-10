import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { limpiar } from '@/lib/rutas'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LAS CARPETAS DE LA CASA
  ═══════════════════════════════════════════════════════════════

  Casa, Salud, Vehículos, Seguros, Documentos importantes. Las que se
  crean solas al montar la casa y donde solo se guardan papeles — sin
  cuentas, sin balances. Eso las separa de las ACTIVIDADES, que sí
  llevan gastos e ingresos y tienen su propia puerta.

  Hasta hoy no había forma de tocarlas. Quien no tiene coche cargaba
  con «Vehículos» para siempre, y quien quisiera una carpeta que no
  habíamos previsto —«El barco», «La asociación»— no podía.

  ─────────────────────────────────────────────────────────────
  APAGAR NO BORRA

  Es la misma regla que en las partidas y en la división por partes, y
  se repite aquí porque es la que hace que alguien se atreva a tocar
  el interruptor: apagar una carpeta la esconde. Sus papeles siguen en
  HUBI y en el Drive, exactamente donde estaban, y volver a encenderla
  los devuelve tal cual.

  Un interruptor que destruye lo que hay debajo es un interruptor que
  nadie toca.
*/

/*
  LOS ICONOS QUE HUBI SABE DIBUJAR.

  Las carpetas guardan su icono como emoji —es lo que se puede elegir
  desde una pantalla sin programar nada— pero en la aplicación se
  pintan como iconos de línea, para que no se vean como un pegote de
  otra aplicación y para que tomen el color de su sección.

  Así que la lista no puede ser «cualquier emoji»: solo los que tienen
  dibujo. Es la misma lista que entiende `iconoDeEmoji`, y tiene que
  moverse con ella.
*/
const ICONOS = [
  '📁', '🏠', '❤️', '🚗', '🛡', '📄', '💊', '🌿', '🔑',
  '👷', '🧰', '💼', '⛵', '🐾', '🛒', '⏰', '👥', '🔒', '📌',
]

/** Encender, apagar, renombrar o cambiarle el icono a una carpeta. */
export async function PATCH(peticion: NextRequest) {
  const supabase = await clienteSesion()
  if (!(await quien(supabase))) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { id?: string; activa?: boolean; nombre?: string; icono?: string }
  try {
    cuerpo = (await peticion.json()) as {
      id?: string
      activa?: boolean
      nombre?: string
      icono?: string
    }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const id = String(cuerpo.id ?? '')
  if (!id) return NextResponse.json({ error: 'Falta la carpeta.' }, { status: 400 })

  const cambios: Record<string, unknown> = {}
  if (typeof cuerpo.activa === 'boolean') cambios.activa = cuerpo.activa
  /* Solo los que HUBI sabe dibujar. Cualquier otro emoji se pintaría
     como una carpeta genérica y quien lo eligió no entendería por
     qué; es más honesto no dejarle elegirlo. */
  if (cuerpo.icono !== undefined && ICONOS.includes(String(cuerpo.icono))) {
    cambios.icono = String(cuerpo.icono)
  }
  if (cuerpo.nombre !== undefined) {
    const nombre = String(cuerpo.nombre).trim().replace(/\s+/g, ' ').slice(0, 40)
    if (nombre.length < 2) {
      return NextResponse.json({ error: 'Ponle un nombre.' }, { status: 400 })
    }
    cambios.nombre = nombre
    /*
      El segmento del Drive NO se toca al renombrar. La carpeta ya
      existe en Google con su nombre, y puede tener papeles dentro de
      cuatro años distintos. Cambiarlo aquí haría que HUBI empezara a
      guardar en una carpeta nueva y dejara la vieja atrás, sin decir
      nada. Se cambia el rótulo en HUBI; en Drive se queda como está.
    */
  }

  if (Object.keys(cambios).length === 0) return NextResponse.json({ bien: true })

  /* Solo carpetas raíz que no lleven cuentas: las actividades tienen
     su propia pantalla, y una partida no se toca desde aquí. */
  const { data, error } = await supabase
    .from('categorias')
    .update(cambios)
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('id', id)
    .is('padre_id', null)
    .select('id')

  if (error || !data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se ha podido cambiar.', detalle: error?.message },
      { status: error ? 500 : 409 }
    )
  }

  return NextResponse.json({ bien: true })
}

/** Una carpeta nueva. */
export async function POST(peticion: NextRequest) {
  const supabase = await clienteSesion()
  if (!(await quien(supabase))) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  let cuerpo: { nombre?: string; icono?: string }
  try {
    cuerpo = (await peticion.json()) as { nombre?: string; icono?: string }
  } catch {
    return NextResponse.json({ error: 'No se ha recibido nada.' }, { status: 400 })
  }

  const nombre = String(cuerpo.nombre ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  if (nombre.length < 2) {
    return NextResponse.json({ error: 'Ponle un nombre.' }, { status: 400 })
  }

  const segmento = limpiar(nombre)
  if (!segmento) {
    return NextResponse.json(
      { error: 'Ese nombre no sirve para una carpeta. Usa letras y números.' },
      { status: 400 }
    )
  }

  /* ¿Ya existe? Si está apagada, se enciende —con sus papeles— en vez
     de crear una segunda igual. */
  const { data: yaHay } = await supabase
    .from('categorias')
    .select('id, nombre, activa')
    .eq('hogar_id', await elEspacioO(supabase))
    .is('padre_id', null)
    .or(`nombre.ilike.${nombre},segmento_drive.eq.${segmento}`)

  const misma = (yaHay ?? [])[0]

  if (misma) {
    if (misma.activa === false) {
      const { data: encendida } = await supabase
        .from('categorias')
        .update({ activa: true })
        .eq('hogar_id', await elEspacioO(supabase))
        .eq('id', misma.id)
        .select('id')

      if (encendida && encendida.length > 0) {
        return NextResponse.json({
          bien: true,
          id: misma.id,
          aviso: `«${misma.nombre}» ya existía apagada y se ha vuelto a encender, con lo que tuviera dentro.`,
        })
      }
    }
    return NextResponse.json(
      { error: `Ya tienes una carpeta llamada «${misma.nombre}».` },
      { status: 409 }
    )
  }

  const { data: ultimas } = await supabase
    .from('categorias')
    .select('orden')
    .eq('hogar_id', await elEspacioO(supabase))
    .is('padre_id', null)
    .order('orden', { ascending: false })
    .limit(1)

  const orden = ((ultimas?.[0]?.orden as number | null) ?? 0) + 1

  /* `hogar_id` no se manda: lo pone la base de datos con `mi_hogar()`,
     y la política de creación exige que coincida. Mandarlo desde el
     navegador sería justo la puerta que esa política cierra. */
  const { data: creada, error } = await supabase
    .from('categorias')
    .insert({
      hogar_id: await elEspacioO(supabase),
      nombre,
      segmento_drive: segmento,
      icono: ICONOS.includes(String(cuerpo.icono ?? '')) ? String(cuerpo.icono) : '📁',
      orden,
      activa: true,
      lleva_cuentas: false,
    })
    .select('id')
    .maybeSingle()

  if (error || !creada?.id) {
    console.error('[HUBI] No se ha podido crear la carpeta:', error)
    return NextResponse.json(
      { error: 'No se ha podido crear la carpeta.', detalle: error?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ bien: true, id: creada.id })
}
