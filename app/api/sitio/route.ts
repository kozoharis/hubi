import { NextResponse, type NextRequest } from 'next/server'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  BUSCAR UN PUEBLO
  ═══════════════════════════════════════════════════════════════

  Se escribe «madrid» y salen los Madrid que hay en el mundo, cada uno
  con su provincia, su país, sus coordenadas y su huso horario. De ahí
  sale todo lo que necesita la previsión del tiempo.

  Es el buscador de Open-Meteo, el mismo sitio de donde viene la
  previsión: sin clave, sin cuenta y sin dar de alta nada. El punto 26
  del planteamiento dice que cuando haga falta configuración externa
  hay que parar y guiar; aquí no hace falta parar, y eso vale más que
  cualquier comparación de funciones.

  ─────────────────────────────────────────────────────────────
  POR QUÉ PASA POR AQUÍ Y NO LO PIDE EL NAVEGADOR

  Podría pedirlo él: Open-Meteo lo permite. Pero entonces el navegador
  de la cocina hablaría con un servidor de fuera, y hoy sólo habla con
  mappel. Mantenerlo así cuesta veinte líneas y deja la puerta cerrada
  para el día que se ponga una CSP de verdad — que está en la lista.

  Y de paso lo cachea Next: buscar «madrid» dos veces es una sola
  llamada de verdad.

  ─────────────────────────────────────────────────────────────
  PIDE SESIÓN

  No porque el resultado sea secreto —son los pueblos del mundo— sino
  porque una dirección abierta que llama a un servidor de fuera con
  texto que le mandan es un sitio por donde tirar del hilo. Que haya
  que haber entrado para usarla la deja fuera de eso.
*/
export async function GET(peticion: NextRequest) {
  const supabase = await clienteSesion()
  if (!(await quien(supabase))) {
    return NextResponse.json({ error: 'Tienes que entrar primero.' }, { status: 401 })
  }

  const que = (peticion.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60)

  /* Con menos de dos letras no se busca: «a» devuelve ruido y gasta
     una llamada por cada tecla. */
  if (que.length < 2) return NextResponse.json({ sitios: [] })

  try {
    const direccion =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(que)}&count=6&language=es&format=json`

    const r = await fetch(direccion, { next: { revalidate: 86_400 } })
    /*
      `fallo: true` y no una lista vacía. Los dos casos se parecen y no
      son lo mismo: «no hay ningún pueblo que se llame así» es una
      respuesta, y «no he podido preguntar» es una avería. Con una
      lista vacía para los dos, una caída del buscador le diría a
      alguien que su pueblo no existe.
    */
    if (!r.ok) return NextResponse.json({ sitios: [], fallo: true })

    const d = (await r.json()) as {
      results?: {
        name?: string
        admin1?: string
        country?: string
        latitude?: number
        longitude?: number
        timezone?: string
      }[]
    }

    const sitios = (d.results ?? [])
      .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
      .map((s) => ({
        /* «Madrid · Comunidad de Madrid, España». La provincia hace
           falta: hay un Madrid en Colombia y otro en Filipinas, y sin
           ella los tres son «Madrid» en una lista de tres. */
        nombre: s.name ?? '',
        donde: [s.admin1, s.country].filter(Boolean).join(', '),
        lat: Number(s.latitude),
        lon: Number(s.longitude),
        zona: s.timezone ?? 'Europe/Madrid',
      }))

    return NextResponse.json({ sitios })
  } catch {
    /* Sin buscador no se puede elegir pueblo, pero la pantalla sigue
       entera y el sitio que hubiera guardado sigue puesto. */
    return NextResponse.json({ sitios: [], fallo: true })
  }
}
