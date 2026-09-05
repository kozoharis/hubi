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
  ═══════════════════════════════════════════════════════════════
  AQUÍ HABÍA UNA LISTA DE RESPALDO, Y SE HA QUITADO
  ═══════════════════════════════════════════════════════════════

  Decía: «si esto falla, devuelve La Finca y Los Helechos escritas a
  mano, y así la barra de abajo sigue funcionando». Y el propio
  comentario avisaba de su fecha de caducidad: «desaparece cuando la
  primera familia distinta entre en HUBI».

  Esa familia entró, y pasó exactamente lo previsto. Una casa recién
  creada no tiene ninguna actividad con cuentas, así que la consulta
  devolvía cero filas —que es la respuesta CORRECTA— y el respaldo se
  activaba: en la barra de esa casa aparecían **la Finca y Los
  Helechos de Juan Miguel**. Con sus nombres y sus colores.

  No se filtraba ni un dato —las pestañas no llevaban a ninguna parte
  real—, pero enseñar a una familia el nombre de las cosas de otra ya
  es bastante malo. Y sobre todo enseña por qué esta clase de red de
  seguridad es traicionera: no distingue entre «ha fallado algo» y «la
  respuesta es que no hay nada», y trata las dos igual.

  Cero actividades es un resultado legítimo. Se devuelve cero.
*/

export async function actividadesDe(supabase: Cliente): Promise<Actividad[]> {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, nombre, icono, color, fondo, segmento_drive')
      .is('padre_id', null)
      .eq('activa', true)
      .eq('lleva_cuentas', true)
      .order('orden')

    /* La barra no se rompe con una lista vacía: sus tres pestañas
       fijas —Inicio, Papeles, Agenda— no dependen de esto. */
    if (error || !data || data.length === 0) return []

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
    return []
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
