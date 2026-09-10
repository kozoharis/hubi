import type { SupabaseClient } from '@supabase/supabase-js'

/*
  ═══════════════════════════════════════════════════════════════
  QUIÉN ES QUIÉN, Y DE QUÉ COLOR
  ═══════════════════════════════════════════════════════════════

  En una casa con cuatro personas dentro, todo lo que hacen se mezcla
  en las mismas listas: la agenda, el corcho, lo de hoy. Saber QUIÉN
  ha dejado cada cosa obliga hoy a leerse la letra pequeña de cada
  línea, una por una.

  Un color por persona contesta eso sin leer. Es lo que hace cualquier
  calendario compartido, y funciona porque el color se reconoce de
  reojo y el nombre no.

  ─────────────────────────────────────────────────────────────
  EL COLOR ES DE LA PERSONA, NO DEL PAPEL

  Sale del papel —la ayuda de un color, el asesor de otro— pero se
  guarda por persona. Dos asesores del mismo color no se distinguen
  entre sí, que es justo lo que veníamos a resolver.

  ─────────────────────────────────────────────────────────────
  Y SI FALTA LA COLUMNA, HAY COLOR IGUAL

  `miembros.color` es del SQL 39. Sin él, cada uno recibe el de su
  papel: se pierde el poder distinguir a dos personas del mismo papel,
  pero ninguna pantalla se queda en blanco por eso.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

export type Quien = {
  id: string
  nombre: string
  rol: string | null
  color: string
  /** Invitado pero todavía sin aceptar. */
  pendiente: boolean
}

/*
  ═══════════════════════════════════════════════════════════════
  LA PALETA: LA MISMA DEL PRODUCTO, NO UNA SUYA
  ═══════════════════════════════════════════════════════════════

  Aquí había nueve colores propios, y dos de ellos eran un problema de
  verdad:

  · `#14B8A6` — el turquesa que ahora significa ACCIÓN. Con él, la
    primera persona de la casa llevaba en la cara exactamente el color
    que en el resto de HUBI quiere decir «pulsa esto». Un color no
    puede significar dos cosas.

  · `#0EA5E9` — un cian que no estaba declarado en ninguna paleta y
    que iba de salida para quien ayuda en casa.

  Y el resto eran colores vivos —el naranja, el rosa fuerte— usados
  para IDENTIFICAR, que es justo el trabajo de los apagados.

  Así que las personas pasan a los ocho colores de ámbito. No es
  ahorro: es que HUBI tiene UNA paleta que identifica y otra que
  avisa, y una persona se identifica. No se confunden con las
  secciones porque no se parecen en nada más: una persona es un
  círculo con su cara o sus iniciales, siempre al lado de su nombre;
  una sección es un cuadrado redondeado con un icono.

  ─────────────────────────────────────────────────────────────
  Y LOS COLORES YA GUARDADOS SIGUEN VALIENDO

  `miembros.color` guarda el hexadecimal, no un nombre. Los que ya
  están puestos son los de antes, y no se puede pedir que alguien
  entre en Ajustes a recolocar a los suyos para que HUBI se vea bien.
  Se traducen al leer, uno a uno, al apagado que más se le parece.
*/
export const COLORES = [
  '#6FA88A', // verde
  '#6B93D6', // azul
  '#9482D9', // violeta
  '#C09A62', // arena
  '#D07E97', // rosa
  '#9AA85E', // oliva
  '#A87BB5', // ciruela
  '#7A8899', // pizarra
]

/** El color de salida de un papel, cuando no hay otro guardado. */
export function colorDeRol(rol: string | null | undefined): string {
  switch (rol) {
    case 'ayuda':
      return '#6B93D6' // azul
    case 'asesor':
      return '#C09A62' // arena
    case 'mirar':
      return '#7A8899' // pizarra
    default:
      return '#6FA88A' // verde
  }
}

/*
  De un color guardado al de la paleta de hoy.

  Los nueve de antes tienen su equivalente escrito a mano —el morado
  al violeta, el ámbar a la arena— porque «el más parecido» calculado
  a ojo de máquina manda dos personas al mismo sitio. Cualquier otro
  valor (uno futuro, uno escrito a mano en la base de datos) se
  reparte por la rueda a partir de sus propias letras: siempre el
  mismo, y nunca el color de acción.
*/
const ANTES: Record<string, string> = {
  '#14B8A6': '#6FA88A', // turquesa → verde
  '#10B981': '#6FA88A', // verde vivo → verde
  '#0EA5E9': '#6B93D6', // cian → azul
  '#3B82F6': '#6B93D6', // azul vivo → azul
  '#8B5CF6': '#9482D9', // morado → violeta
  '#EC4899': '#D07E97', // rosa fuerte → rosa
  '#F59E0B': '#C09A62', // ámbar → arena
  '#F97316': '#C09A62', // naranja → arena
  '#64748B': '#7A8899', // pizarra → pizarra
}

export function colorApagado(color: string | null | undefined, rol?: string | null): string {
  if (!color) return colorDeRol(rol)

  const hex = color.trim().toUpperCase()
  if (COLORES.includes(hex)) return hex

  const conocido = ANTES[hex]
  if (conocido) return conocido

  let n = 0
  for (let i = 0; i < hex.length; i++) n = (n * 31 + hex.charCodeAt(i)) % 100000
  return COLORES[n % COLORES.length]
}

/**
 * Los de esta casa, con su papel y su color.
 *
 * Con la SESIÓN: las políticas por hogar son justamente lo que hace
 * que aquí salgan los tuyos y no los de otra casa. Y con `hogar_id`
 * explícito además, porque las políticas dejan ver también TUS filas
 * en otras casas —hacen falta para las invitaciones— y quien tenga
 * dos se vería a sí mismo dos veces.
 */
export async function genteDeLaCasa(
  supabase: Cliente,
  hogarId: string | null
): Promise<Quien[]> {
  if (!hogarId) return []

  try {
    /* `color` y `rol` son columnas nuevas. Si el SQL 39 no se ha
       ejecutado, Postgres no dice «esa columna no existe»: rechaza la
       consulta ENTERA. Por eso el segundo intento. */
    let filas: {
      perfil_id: string
      rol?: string | null
      color?: string | null
      aceptado_en?: string | null
    }[] = []

    const completa = await supabase
      .from('miembros')
      .select('perfil_id, rol, color, aceptado_en')
      .eq('hogar_id', hogarId)
      .order('unido_en')

    if (completa.error) {
      const basica = await supabase
        .from('miembros')
        .select('perfil_id')
        .eq('hogar_id', hogarId)
        .order('unido_en')
      filas = (basica.data ?? []) as typeof filas
    } else {
      filas = (completa.data ?? []) as typeof filas
    }

    const ids = filas.map((m) => m.perfil_id)
    if (ids.length === 0) return []

    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('id, nombre')
      .in('id', ids)

    const nombreDe = new Map(
      (perfiles ?? []).map((p: { id: string; nombre: string }) => [p.id, p.nombre])
    )

    return filas.map((m) => ({
      id: m.perfil_id,
      nombre: nombreDe.get(m.perfil_id) ?? 'Alguien',
      rol: m.rol ?? null,
      color: colorApagado(m.color, m.rol),
      pendiente: m.aceptado_en === null,
    }))
  } catch {
    return []
  }
}

/** El asesor de la casa, si hay alguno dentro. */
export function elAsesor(gente: Quien[]): Quien | null {
  return gente.find((g) => g.rol === 'asesor' && !g.pendiente) ?? null
}
