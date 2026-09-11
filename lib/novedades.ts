import type { SupabaseClient } from '@supabase/supabase-js'

/*
  ═══════════════════════════════════════════════════════════════
  LO NUEVO
  ═══════════════════════════════════════════════════════════════

  Qué ha llegado a un sitio desde la última vez que TÚ entraste ahí.

  Por persona y por carpeta raíz. Lo que mire Conchita no marca lo de
  Juan Miguel, y entrar en Seguros no limpia las novedades de Vehículos.

  ─────────────────────────────────────────────────────────────
  DOS PASOS, Y NO UNO

      1 · entrar_en(...)      → (desde, sello)   NO ESCRIBE NADA
      2 · … se lee la pantalla …
      3 · … se pinta «nuevo» donde creado_en >= desde
      4 · confirmarVisto(..., sello)             solo si el 2 salió bien

  Si la lectura se cae, el paso 4 no se llama y no se pierde nada. Con
  una sola función —sellar y leer de un tirón— un fallo de red dejaba la
  marca puesta sobre cosas que nadie llegó a ver, y desaparecían para
  siempre.

  «Se ve dos veces» es un incordio. «No se ve nunca» es que no sirve.

  ─────────────────────────────────────────────────────────────
  TODO ESTO VA ENVUELTO

  La tabla y las funciones son del SQL 65 y 65b. Si no están, estas
  funciones contestan «no sé» —ninguna novedad, ningún sello— y las
  pantallas salen exactamente como salían antes. Nunca revientan una
  pantalla por una columna que falte.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

/** La marca que tengo yo en un sitio, y el sello que habría que guardar. */
export type Entrada = { desde: string | null; sello: string | null }

const NADA: Entrada = { desde: null, sello: null }

/**
 * Entrar en un sitio. **No escribe.** Devuelve desde cuándo contar lo
 * nuevo y el sello que después habrá que confirmar.
 *
 * `carpeta` puede ser cualquier categoría: la base la sube a su raíz.
 * En los ámbitos que no son carpeta —agenda, cuentas, compra, dia— se
 * ignora.
 */
export async function entrarEn(
  supabase: Cliente,
  hogarId: string | null,
  ambito: string,
  carpeta?: string | null
): Promise<Entrada> {
  if (!hogarId) return NADA
  try {
    const { data, error } = await supabase.rpc('entrar_en', {
      casa: hogarId,
      en_ambito: ambito,
      la_carpeta: carpeta ?? null,
    })
    if (error || !data) return NADA
    /* La función devuelve una tabla de una fila. */
    const fila = Array.isArray(data) ? data[0] : data
    return {
      desde: fila?.desde ?? null,
      sello: fila?.sello ?? null,
    }
  } catch {
    return NADA
  }
}

/**
 * Y ahora sí: guardar el sello. Se llama DESPUÉS de que la lectura haya
 * salido bien, y nunca antes.
 */
export async function confirmarVisto(
  supabase: Cliente,
  hogarId: string | null,
  ambito: string,
  sello: string | null,
  carpeta?: string | null
): Promise<void> {
  if (!hogarId || !sello) return
  try {
    await supabase.rpc('confirmar_visto', {
      casa: hogarId,
      en_ambito: ambito,
      el_sello: sello,
      la_carpeta: carpeta ?? null,
    })
  } catch {
    /* Si no se puede guardar la marca, lo peor que pasa es que las
       mismas novedades salgan otra vez. Eso no rompe nada. */
  }
}

/**
 * Todas mis marcas de esta casa, por carpeta raíz.
 *
 * Es una lectura directa de la tabla —no sella nada— porque la pantalla
 * de Documentos solo quiere PINTAR cuántas cosas nuevas hay en cada
 * carpeta. Sellar ahí sería marcar como visto todo lo que uno no ha
 * llegado a abrir.
 *
 * La clave del mapa es el id de la carpeta raíz. Las marcas sin carpeta
 * —agenda y compañía— no salen aquí.
 */
export async function misMarcas(
  supabase: Cliente,
  hogarId: string | null
): Promise<Map<string, string>> {
  const marcas = new Map<string, string>()
  if (!hogarId) return marcas

  try {
    const { data, error } = await supabase
      .from('visto')
      .select('ambito_id, visto_en')
      .eq('hogar_id', hogarId)
      .not('ambito_id', 'is', null)

    if (error || !data) return marcas
    for (const v of data as { ambito_id: string; visto_en: string }[]) {
      marcas.set(v.ambito_id, v.visto_en)
    }
  } catch {
    /* Sin tabla, sin marcas: nada sale como nuevo y la pantalla es la
       de siempre. */
  }
  return marcas
}

/**
 * Cuántos papeles nuevos hay en cada carpeta raíz.
 *
 * «Nuevo» es: llegó después de mi marca **y no lo guardé yo**. Lo que
 * uno acaba de fotografiar no es una novedad para uno mismo, y contarlo
 * haría que el número no bajara nunca del todo.
 *
 * Sin marca —nunca he entrado ahí— **no sale nada como nuevo**. Si no,
 * el primer día HUBI enseñaría «47 nuevos» en todas las carpetas, que
 * es la forma más rápida de que un rótulo deje de mirarse.
 */
export function nuevosPorRaiz(
  papeles: { categoria_id: string; creado_en?: string | null; subido_por?: string | null }[],
  raizDe: (categoriaId: string) => string | undefined,
  marcas: Map<string, string>,
  yo: string
): Map<string, number> {
  const cuenta = new Map<string, number>()

  for (const p of papeles) {
    if (!p.creado_en) continue
    if (p.subido_por === yo) continue

    const raiz = raizDe(p.categoria_id)
    if (!raiz) continue

    const marca = marcas.get(raiz)
    if (!marca) continue          // nunca he entrado: no es «nuevo», es que no lo he visto nunca
    if (p.creado_en < marca) continue

    cuenta.set(raiz, (cuenta.get(raiz) ?? 0) + 1)
  }

  return cuenta
}
