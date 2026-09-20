import type { SupabaseClient } from '@supabase/supabase-js'
import { DONDE, type Sitio } from './tiempo'
import { elEspacioO } from './espacio'

/*
  ═══════════════════════════════════════════════════════════════
  EL SITIO DE LA CASA
  ═══════════════════════════════════════════════════════════════

  Dónde está, para pedir la previsión del tiempo de ahí y no del sitio
  que vino escrito a mano en el código.

  Devuelve SIEMPRE un sitio. Si la casa no tiene ninguno guardado —o
  si el paso 93 no se ha ejecutado, o si la consulta falla— devuelve
  el del código. Una pared sin tiempo por un dato que falta sería
  peor que una pared con el tiempo de otro pueblo: lo segundo se ve y
  se corrige; lo primero parece que la pantalla está media rota.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

export async function elSitioDeLaCasa(supabase: Cliente): Promise<Sitio> {
  try {
    const casa = await elEspacioO(supabase)

    const { data, error } = await supabase
      .from('hogares')
      .select('sitio_nombre, sitio_lat, sitio_lon, sitio_zona')
      .eq('id', casa)
      .maybeSingle()

    /*
      La trampa de siempre: sin las columnas del paso 93, Postgres no
      devuelve columnas vacías — rechaza la consulta entera. Aquí eso
      no puede notarse, así que se contesta con el sitio del código y
      a seguir.
    */
    if (error || !data) return DONDE

    const lat = Number(data.sitio_lat)
    const lon = Number(data.sitio_lon)

    /* Las dos, o ninguna. Media coordenada apunta al golfo de Guinea,
       que es donde acaba todo lo que se queda a medias en un mapa. */
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return DONDE

    return {
      lat,
      lon,
      zona: (data.sitio_zona as string) || DONDE.zona,
      nombre: (data.sitio_nombre as string) || 'Tu casa',
    }
  } catch {
    return DONDE
  }
}
