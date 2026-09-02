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
export function rutaDeCarpetas(
  camino: Categoria[],
  fecha: Date,
  /*
    DE QUÉ UNIDAD ES: «Helechos 2», «Obra Manuel».

    Se mete justo debajo de la sección, que es donde lo buscaría una
    persona abriendo su Drive: primero la carpeta de la obra, y dentro
    sus facturas. Al revés —los materiales de todas las obras juntos y
    la obra dentro— no lo ordena nadie así.

        OBRAS / OBRA MANUEL / GASTOS / 2026 / T3 / MATERIALES

    Sin unidad, la ruta es exactamente la de siempre. Eso no es un
    detalle: los gastos comunes —la luz, el seguro— no son de ninguna
    unidad, y meterlos a la fuerza en una carpeta cualquiera sería
    colocarlos donde nadie los va a buscar.
  */
  unidad?: string | null
): string[] {
  const anio = String(fecha.getFullYear())
  const trimestre = `T${Math.floor(fecha.getMonth() / 3) + 1}`

  const segmentos = camino.map((c) => c.segmento_drive)
  const hoja = camino[camino.length - 1]

  /* La unidad entra después de la RAÍZ, no después de la hoja. Si
     `camino` viniera vacío no se mete en ningún sitio: una ruta que
     empieza por la unidad sin sección encima sería una carpeta suelta
     colgando del Drive. */
  const conUnidad = (partes: string[]): string[] => {
    const nombre = unidad ? limpiar(unidad) : ''
    if (!nombre || partes.length === 0) return partes
    return [partes[0], nombre, ...partes.slice(1)]
  }

  if (hoja.naturaleza === 'gasto' || hoja.naturaleza === 'ingreso') {
    const sinHoja = segmentos.slice(0, -1)
    return [...conUnidad(sinHoja), anio, trimestre, segmentos[segmentos.length - 1]]
  }

  return [...conUnidad(segmentos), anio]
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
