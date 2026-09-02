import type { SupabaseClient } from '@supabase/supabase-js'

/*
  ═══════════════════════════════════════════════════════════════
  LAS UNIDADES DE UNA SECCIÓN
  ═══════════════════════════════════════════════════════════════

  Una unidad es DE QUIÉN es el gasto: «Helechos 2», «Piso abuela»,
  «Obra Manuel». No es una categoría — la categoría es QUÉ CLASE de
  gasto es: materiales, luz, personal.

  Son dos ejes, y confundirlos es el error caro. Si «Obra Manuel»
  fuera una categoría, se perdería para siempre poder preguntar
  «¿cuánto llevo en materiales este año, en todas las obras?».
  Separados, se cruzan.

  ─────────────────────────────────────────────────────────────
  POR QUÉ TODO AQUÍ ESTÁ ENVUELTO EN UN `try`

  Porque `unidades` es una tabla nueva, y ya nos ha pasado tres veces
  en este proyecto: se mete una columna nueva en un SELECT, el SQL
  todavía no se ha ejecutado, y Postgres rechaza LA CONSULTA ENTERA.
  No falla la columna nueva: falla todo. Y la pantalla, que no mira
  el error, enseña tranquilamente «todavía no hay nada».

  La regla que salió de ahí, y que se aplica aquí sin excepción:

      Una columna nueva NUNCA puede ser obligatoria para lo que ya
      funcionaba.

  Si esto no encuentra la tabla, devuelve una lista vacía y la
  pantalla sigue funcionando como antes.
*/

export type Unidad = {
  id: string
  nombre: string
  orden: number
  referencia: string | null
  presupuesto: number | null
}

export type ComoEsLaSeccion = {
  /** ¿Se divide en unidades? Los Helechos sí. La Finca no: la finca es una. */
  usaUnidades: boolean
  /*
    ¿Los gastos comunes se reparten entre ellas?

    En Los Helechos sí: la luz, el seguro y la gestoría son de los tres
    y se parten a partes iguales, porque los tres se alquilan igual.

    EN OBRAS ESO SERÍA MENTIR. Repartir la gasolina del mes entre una
    reforma de 40.000 € y un baño de 3.000 no dice nada de ninguna de
    las dos. Por eso es una pregunta aparte, y por defecto es que no.
  */
  reparteComunes: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

/** Las unidades vivas de una sección, en su orden. */
export async function unidadesDe(supabase: Cliente, seccionId: string): Promise<Unidad[]> {
  try {
    const { data, error } = await supabase
      .from('unidades')
      .select('id, nombre, orden, referencia, presupuesto')
      .eq('seccion_id', seccionId)
      .eq('activa', true)
      .order('orden', { ascending: true })

    if (error || !data) return []

    return data.map((u) => ({
      id: u.id as string,
      nombre: (u.nombre as string) ?? '',
      orden: Number(u.orden ?? 0),
      referencia: (u.referencia as string | null) ?? null,
      presupuesto: u.presupuesto == null ? null : Number(u.presupuesto),
    }))
  } catch {
    return []
  }
}

/** Si la sección se divide, y si reparte lo común. */
export async function comoEsLaSeccion(
  supabase: Cliente,
  seccionId: string
): Promise<ComoEsLaSeccion> {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('usa_unidades, reparte_comunes')
      .eq('id', seccionId)
      .maybeSingle()

    if (error || !data) return { usaUnidades: false, reparteComunes: false }

    return {
      usaUnidades: data.usa_unidades === true,
      reparteComunes: data.reparte_comunes === true,
    }
  } catch {
    return { usaUnidades: false, reparteComunes: false }
  }
}

/*
  Reconocer una unidad por su nombre, dicho como lo diría una persona.

  «la obra de Manuel», «helechos dos», «el piso de la abuela». No se
  compara letra a letra: se quitan tildes, artículos y palabras de
  relleno, y se admite el número escrito con letras, que es como se
  dice de viva voz.

  Devuelve null cuando no hay una ganadora clara. Eso es a propósito:
  colgarle un gasto a la unidad equivocada es peor que preguntar.
*/
export function unidadPorNombre(texto: string, unidades: Unidad[]): Unidad | null {
  const dicho = limpiar(texto)
  if (!dicho || unidades.length === 0) return null

  let mejor: { u: Unidad; puntos: number } | null = null

  for (const u of unidades) {
    const suyo = limpiar(u.nombre)
    if (!suyo) continue

    let puntos = 0

    // El nombre entero dentro de lo dicho: la señal más fuerte.
    if (dicho.includes(suyo)) puntos += 10

    /* Palabra a palabra, para «la obra de Manuel» contra «Obra
       Manuel»: las palabras cortas no cuentan, que «de» y «la»
       aparecen en todo. */
    for (const p of suyo.split(' ').filter((x) => x.length > 2)) {
      if (dicho.includes(p)) puntos += 2
    }

    if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { u, puntos }
  }

  if (!mejor) return null

  /* Si dos empatan, no se elige. «Helechos 1» y «Helechos 2» empatan
     cuando solo se dijo «helechos», y ahí la respuesta correcta es
     «no lo sé», no una de las dos al azar. */
  const empatan = unidades.filter((u) => u.id !== mejor!.u.id && puntosDe(dicho, u) === mejor!.puntos)
  if (empatan.length > 0) return null

  return mejor.u
}

function puntosDe(dicho: string, u: Unidad): number {
  const suyo = limpiar(u.nombre)
  if (!suyo) return 0
  let puntos = dicho.includes(suyo) ? 10 : 0
  for (const p of suyo.split(' ').filter((x) => x.length > 2)) {
    if (dicho.includes(p)) puntos += 2
  }
  return puntos
}

const NUMEROS: Record<string, string> = {
  uno: '1', una: '1', primero: '1', primera: '1',
  dos: '2', segundo: '2', segunda: '2',
  tres: '3', tercero: '3', tercera: '3',
  cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9', diez: '10',
}

/** «tres» → «3». Lo demás se queda como está. */
function enNumero(p: string): string {
  return NUMEROS[p] ?? p
}

/*
  Quitar tildes, signos y palabras que no distinguen nada.

  Ojo con la eñe: `normalize` + quitar diacríticos convierte «ñ» en
  «n». Es lo que queremos aquí —que «Baño» y «bano» casen— pero hay
  que saberlo, porque en este proyecto ya costó horas una vez: unas
  frases clave escritas con eñe no coincidían nunca.
*/
function limpiar(texto: string): string {
  const sinRuido = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const vacias = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'a', 'al', 'un', 'una'])

  /*
    Los números se pasan a cifra AQUÍ MISMO, no se añaden aparte.

    La primera versión devolvía las dos formas juntas —«helechos 2
    helechos 2»— para no tener que elegir. Y con eso se rompía justo
    lo que más importa: buscar el nombre entero dentro de la frase.
    «Helechos 2» ya no estaba contenido en su propia versión
    duplicada, así que la señal más fuerte que tiene esta función no
    se disparaba nunca y todo se decidía por palabras sueltas.

    Lo cazaron las pruebas antes de que llegara a nadie. Con una sola
    forma —la cifra— «helechos dos» y «Helechos 2» acaban siendo
    exactamente el mismo texto, que era la idea desde el principio.
  */
  return sinRuido
    .split(' ')
    .filter((p) => p && !vacias.has(p))
    .map(enNumero)
    .join(' ')
}
