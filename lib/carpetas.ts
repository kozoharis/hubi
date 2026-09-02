/*
  El árbol de carpetas.

  En Drive la ruta es profunda: FINCA / GASTOS / 2026 / T3 / LUZ.
  En HUBI solo se enseñan dos niveles —la sección y el concepto— y el
  año y el trimestre pasan a ser un filtro arriba. La profundidad la
  lleva el sistema, no Juan Miguel ni Conchita.
*/

export type Categoria = {
  id: string
  padre_id: string | null
  nombre: string
  segmento_drive: string
  orden: number
  naturaleza?: string
}

export type Documento = {
  id: string
  categoria_id: string
  fecha_documento: string
  anio: number | null
  trimestre: number | null
}

/** Hijos de una categoría, ordenados como se sembraron. */
export function hijosDe(todas: Categoria[], padre: string | null): Categoria[] {
  return todas
    .filter((c) => c.padre_id === padre)
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Todos los descendientes de una categoría, ella incluida. */
export function ramaDe(todas: Categoria[], raiz: string): Set<string> {
  const dentro = new Set([raiz])
  let creciendo = true
  while (creciendo) {
    creciendo = false
    for (const c of todas) {
      if (c.padre_id && dentro.has(c.padre_id) && !dentro.has(c.id)) {
        dentro.add(c.id)
        creciendo = true
      }
    }
  }
  return dentro
}

/** Cuántos papeles cuelgan de cada categoría, contando sus hijas. */
export function contar(todas: Categoria[], docs: Documento[]): Map<string, number> {
  const directos = new Map<string, number>()
  for (const d of docs) {
    directos.set(d.categoria_id, (directos.get(d.categoria_id) ?? 0) + 1)
  }

  const total = new Map<string, number>()
  for (const c of todas) {
    const rama = ramaDe(todas, c.id)
    let n = 0
    for (const id of rama) n += directos.get(id) ?? 0
    total.set(c.id, n)
  }
  return total
}

/** La última fecha guardada en cada categoría, contando sus hijas. */
export function ultima(todas: Categoria[], docs: Documento[]): Map<string, string> {
  const porCategoria = new Map<string, string>()
  for (const d of docs) {
    const antes = porCategoria.get(d.categoria_id)
    if (!antes || d.fecha_documento > antes) porCategoria.set(d.categoria_id, d.fecha_documento)
  }

  const total = new Map<string, string>()
  for (const c of todas) {
    let mejor = ''
    for (const id of ramaDe(todas, c.id)) {
      const f = porCategoria.get(id)
      if (f && f > mejor) mejor = f
    }
    if (mejor) total.set(c.id, mejor)
  }
  return total
}

/** El camino desde la sección hasta esta categoría. */
export function caminoDe(todas: Categoria[], id: string): Categoria[] {
  const porId = new Map(todas.map((c) => [c.id, c]))
  const camino: Categoria[] = []
  let actual = porId.get(id)
  while (actual) {
    camino.unshift(actual)
    actual = actual.padre_id ? porId.get(actual.padre_id) : undefined
  }
  return camino
}

const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

/** "14 ago 2026" */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${Number(d)} ${MESES_CORTOS[Number(m) - 1]} ${a}`
}

/** "14 ago" si es de este año, "14 ago 2025" si no. */
export function fechaBreve(iso: string): string {
  const [a, m, d] = iso.split('-')
  const esteAnio = String(new Date().getFullYear())
  return a === esteAnio
    ? `${Number(d)} ${MESES_CORTOS[Number(m) - 1]}`
    : `${Number(d)} ${MESES_CORTOS[Number(m) - 1]} ${a}`
}

/** "14 de agosto de 2026" */
export function fechaLarga(iso: string): string {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const [a, m, d] = iso.split('-')
  return `${Number(d)} de ${meses[Number(m) - 1]} de ${a}`
}
