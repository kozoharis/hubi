import type { SupabaseClient } from '@supabase/supabase-js'

/*
  ═══════════════════════════════════════════════════════════════
  LAS ACTIVIDADES DE LA CASA
  ═══════════════════════════════════════════════════════════════

  Una actividad es una sección CON CUENTAS: la Finca, Los Helechos,
  las Obras de un reformista. Tiene ingresos, gastos y balance
  propios. Seguros o Salud no lo son: ahí solo se guardan papeles.

  Antes esto eran dos archivos —`app/finca/page.tsx` y
  `app/helechos/page.tsx`— que hacían lo mismo con otro nombre y otro
  color. Ahora es un dato, y por eso HUBI ya no necesita a nadie que
  escriba código cuando una familia tiene una actividad que no
  habíamos previsto.

  ─────────────────────────────────────────────────────────────
  SI ESTO FALLA, LA APLICACIÓN NO SE CAE

  Lo lee la barra de abajo, que sale en TODAS las pantallas. Un error
  aquí dejaría a la persona sin poder navegar a ningún sitio. Así que
  cuando algo va mal —el SQL sin ejecutar, la base de datos caída, sin
  sesión— se devuelven las de siempre, escritas a mano. Se navega
  igual y ya se arreglará.
*/

export type Actividad = {
  id: string
  nombre: string
  /** El emoji de la sección: 🌿 🔑 🧱 */
  icono: string
  color: string
  fondo: string
  segmento: string
  /** Dónde se ve. Una sola pantalla para todas. */
  ruta: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

/*
  LA RED DE SEGURIDAD.

  Son las dos de Juan Miguel y Conchita, con sus colores exactos. No
  es una lista «por si acaso» decorativa: mientras el SQL 27 no esté
  ejecutado, esto es lo que hace que la barra de abajo siga
  funcionando igual que ayer.

  Desaparece cuando la primera familia distinta entre en HUBI: para
  entonces, una lista escrita a mano con las secciones de una casa
  concreta sería directamente un error.
*/
const LAS_DE_SIEMPRE: Actividad[] = [
  {
    id: 'finca',
    nombre: 'La Finca',
    icono: '🌿',
    color: '#14B8A6',
    fondo: '#DFF7F3',
    segmento: 'FINCA',
    ruta: '/finca',
  },
  {
    id: 'helechos',
    nombre: 'Los Helechos',
    icono: '🔑',
    color: '#F59E0B',
    fondo: '#FEF1DC',
    segmento: 'HELECHOS',
    ruta: '/helechos',
  },
]

export async function actividadesDe(supabase: Cliente): Promise<Actividad[]> {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, nombre, icono, color, fondo, segmento_drive')
      .is('padre_id', null)
      .eq('activa', true)
      .eq('lleva_cuentas', true)
      .order('orden')

    if (error || !data || data.length === 0) return LAS_DE_SIEMPRE

    return data.map((c) => ({
      id: c.id as string,
      nombre: (c.nombre as string) ?? '',
      icono: (c.icono as string) || '📁',
      /* Sin color se pintaría en gris y parecería apagada al lado de
         las demás. Un gris por defecto es más honesto que inventarle
         un color que luego no coincide con nada. */
      color: (c.color as string) || '#64748B',
      fondo: (c.fondo as string) || '#EEF2F7',
      segmento: (c.segmento_drive as string) ?? '',
      ruta: `/seccion/${c.id}`,
    }))
  } catch {
    return LAS_DE_SIEMPRE
  }
}

/*
  Un nombre corto para la barra de abajo.

  Ahí caben unos diez caracteres antes de que el texto se parta en dos
  renglones y la pestaña se descoloque. «Los Helechos» no cabe;
  «Helechos» sí, y se entiende igual. Se quita el artículo, que es lo
  que sobra, en vez de cortar por donde caiga y dejar «Los Helec…».
*/
export function nombreCorto(nombre: string): string {
  const sinArticulo = nombre.replace(/^(el|la|los|las)\s+/i, '')
  return sinArticulo.length <= 11 ? sinArticulo : sinArticulo.slice(0, 10).trimEnd() + '…'
}
