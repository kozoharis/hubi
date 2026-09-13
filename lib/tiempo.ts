/*
  ═══════════════════════════════════════════════════════════════
  EL TIEMPO
  ═══════════════════════════════════════════════════════════════

  Lo primero que mira cualquiera por la mañana en una cocina. Y en una
  casa con finca no es curiosidad: es si hay que regar, si se puede
  tender y si conviene adelantar la recogida.

  ─────────────────────────────────────────────────────────────
  POR QUÉ OPEN-METEO Y NO OTRA

  Porque **no hace falta dar de alta nada en ningún sitio**. No pide
  clave, no pide cuenta, no pide tarjeta. El punto 26 del planteamiento
  dice que cuando haga falta configuración externa hay que parar y
  guiarte; aquí no hace falta parar, y eso vale más que cualquier
  comparación de funciones.

  Las de pago dan más datos —radar, avisos, polen—. Ninguno de esos
  datos cabe en una pared que se lee desde la puerta.

  ─────────────────────────────────────────────────────────────
  ⚠️  AQUÍ ESTÁ ESCRITO DÓNDE VIVÍS · ES LA SEGUNDA LÍNEA ASÍ

  La primera es `ZONA` en `lib/tablon.ts`. Ésta es la otra.

  Está puesto en el norte de Tenerife porque es lo que dice la zona
  horaria (`Atlantic/Canary`) y porque el planteamiento habla de llevar
  cosas a Los Realejos. **Si no es ahí, se cambian estos dos números y
  ya está** — no hay nada más que tocar en todo el proyecto.

  Se buscan en cualquier mapa: pulsar sobre el pueblo y copiar las
  coordenadas.

  ─────────────────────────────────────────────────────────────
  Y SI FALLA, NO SALE

  Ni mensaje de error ni hueco gris. Una pared que dice «no se ha podido
  cargar el tiempo» es una pared con un cartel de avería en la cocina
  todo el día. Si la previsión no llega, esa esquina simplemente no
  existe hoy.
*/

export const DONDE = {
  lat: 28.39,
  lon: -16.59,
  /* Solo para poder decir de dónde es la previsión si algún día hace
     falta. No se enseña: en tu propia cocina ya sabes dónde estás. */
  sitio: 'Norte de Tenerife',
}

export type DiaDeTiempo = {
  fecha: string
  maxima: number
  minima: number
  /** El código de la OMM que devuelve Open-Meteo. */
  codigo: number
  /** Probabilidad de lluvia, en porcentaje. */
  lluvia: number
}

export type ElTiempo = {
  ahora: number
  codigoAhora: number
  dias: DiaDeTiempo[]
}

/*
  Se pide en el servidor y se guarda media hora. La pared se repinta
  cada cinco minutos: sin esto serían casi trescientas llamadas al día
  por pantalla, para un dato que cambia cada hora larga.

  `next: { revalidate }` es la caché de Next, o sea que la comparten
  todas las pantallas de todas las casas — que es lo correcto, porque
  el tiempo no es de nadie.
*/
export async function elTiempo(): Promise<ElTiempo | null> {
  try {
    const direccion =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${DONDE.lat}&longitude=${DONDE.lon}` +
      `&current=temperature_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=Atlantic%2FCanary&forecast_days=4`

    const r = await fetch(direccion, { next: { revalidate: 1800 } })
    if (!r.ok) return null

    const d = (await r.json()) as {
      current?: { temperature_2m?: number; weather_code?: number }
      daily?: {
        time?: string[]
        weather_code?: number[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        precipitation_probability_max?: (number | null)[]
      }
    }

    if (!d.daily?.time || d.daily.time.length === 0) return null

    return {
      ahora: Math.round(d.current?.temperature_2m ?? 0),
      codigoAhora: d.current?.weather_code ?? 0,
      dias: d.daily.time.map((fecha, i) => ({
        fecha,
        maxima: Math.round(d.daily?.temperature_2m_max?.[i] ?? 0),
        minima: Math.round(d.daily?.temperature_2m_min?.[i] ?? 0),
        codigo: d.daily?.weather_code?.[i] ?? 0,
        lluvia: Math.round(d.daily?.precipitation_probability_max?.[i] ?? 0),
      })),
    }
  } catch {
    return null
  }
}

/*
  ─────────────────────────────────────────────────────────────
  DE UN NÚMERO A UNA PALABRA

  Open-Meteo devuelve los códigos de la Organización Meteorológica
  Mundial: veintiocho números del 0 al 99. Aquí se reducen a SIETE
  estados, y es a propósito.

  Nadie en una cocina necesita distinguir «llovizna ligera» de «llovizna
  moderada» de «llovizna intensa». Necesita saber si va a llover. Las
  veintiocho palabras exactas convertirían un vistazo en una lectura.
*/
export type Cielo = 'sol' | 'nubes' | 'cubierto' | 'niebla' | 'lluvia' | 'tormenta' | 'nieve'

export function elCielo(codigo: number): Cielo {
  if (codigo === 0 || codigo === 1) return 'sol'
  if (codigo === 2) return 'nubes'
  if (codigo === 3) return 'cubierto'
  if (codigo === 45 || codigo === 48) return 'niebla'
  if (codigo >= 71 && codigo <= 77) return 'nieve'
  if (codigo >= 85 && codigo <= 86) return 'nieve'
  if (codigo >= 95) return 'tormenta'
  return 'lluvia'
}

export const COMO_SE_LLAMA: Record<Cielo, string> = {
  sol: 'Despejado',
  nubes: 'Algunas nubes',
  cubierto: 'Nublado',
  niebla: 'Niebla',
  lluvia: 'Lluvia',
  tormenta: 'Tormenta',
  nieve: 'Nieve',
}
