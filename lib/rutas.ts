export type Categoria = {
  id: string
  padre_id: string | null
  nombre: string
  segmento_drive: string
  icono: string | null
  orden: number
  naturaleza: 'gasto' | 'ingreso' | 'neutro'
}

/** Devuelve la cadena de categorías desde la raíz hasta la hoja. */
export function cadena(categorias: Categoria[], hojaId: string): Categoria[] {
  const porId = new Map(categorias.map((c) => [c.id, c]))
  const camino: Categoria[] = []

  let actual = porId.get(hojaId)
  while (actual) {
    camino.unshift(actual)
    actual = actual.padre_id ? porId.get(actual.padre_id) : undefined
  }
  return camino
}

/**
 * Construye la ruta de carpetas dentro de J+C · FAMILY HUB.
 *
 *   Finca → Gastos → Luz    →   FINCA/GASTOS/2026/T3/LUZ
 *   Vehículos → Seguro      →   VEHICULOS/SEGURO/2026
 *
 * El año y el trimestre se meten antes de la hoja cuando se trata de
 * dinero, porque así es como se consultan las cuentas de la finca.
 * En el resto basta con separar por años.
 */
export function rutaDeCarpetas(camino: Categoria[], fecha: Date): string[] {
  const anio = String(fecha.getFullYear())
  const trimestre = `T${Math.floor(fecha.getMonth() / 3) + 1}`

  const segmentos = camino.map((c) => c.segmento_drive)
  const hoja = camino[camino.length - 1]

  if (hoja.naturaleza === 'gasto' || hoja.naturaleza === 'ingreso') {
    const sinHoja = segmentos.slice(0, -1)
    return [...sinHoja, anio, trimestre, segmentos[segmentos.length - 1]]
  }

  return [...segmentos, anio]
}

/** Quita acentos y caracteres raros para que el nombre de archivo sea limpio. */
export function limpiar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 40)
}

/**
 * 2026-08-26_LUZ.jpg
 * 2026-08-14_LUZ_ENDESA_127-43EUR.jpg   (cuando el OCR aporte datos)
 */
export function nombreDeArchivo(opciones: {
  fecha: Date
  camino: Categoria[]
  titulo?: string | null
  proveedor?: string | null
  importe?: number | null
  extension: string
}): string {
  const { fecha, camino, titulo, proveedor, importe, extension } = opciones

  const dia = fecha.toISOString().slice(0, 10)
  const hoja = camino[camino.length - 1]

  const piezas = [dia, hoja.segmento_drive]

  if (proveedor) piezas.push(limpiar(proveedor))
  else if (titulo && limpiar(titulo) !== hoja.segmento_drive) piezas.push(limpiar(titulo))

  if (importe != null) piezas.push(`${importe.toFixed(2).replace('.', '-')}EUR`)

  return `${piezas.filter(Boolean).join('_')}.${extension}`
}

export function extensionDe(tipoMime: string, nombreOriginal: string): string {
  const porMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'application/pdf': 'pdf',
  }
  if (porMime[tipoMime]) return porMime[tipoMime]

  const trozo = nombreOriginal.split('.').pop()
  return trozo && trozo.length <= 5 ? trozo.toLowerCase() : 'bin'
}
