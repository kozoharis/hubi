/*
  ═══════════════════════════════════════════════════════════════
  LO QUE SE APUNTA SIN ESCRIBIRLO
  ═══════════════════════════════════════════════════════════════

  Haris: *«crea una lista en la compra de alimentos de los que ya hemos
  comprado y algunos de los más comunes… sobre todo para que no se
  tenga que escribir tanto»*.

  ─────────────────────────────────────────────────────────────
  DOS FUENTES, Y UNA MANDA SOBRE LA OTRA

  **Lo vuestro primero.** Lo que ya se ha comprado en esta casa sale de
  `compra` archivada: si la leche ha entrado seis veces, no hay que
  volver a escribirla nunca más. Esto es lo que de verdad sirve, y
  mejora solo con el uso — HUBI no se vuelve más listo porque le
  pongamos un modelo mejor, sino porque lo usáis.

  **Y detrás, lo corriente.** El problema de lo anterior es el primer
  día: una casa que acaba de empezar no tiene historial, y entonces la
  pantalla no ofrece nada justo cuando escribir cuesta más. La lista de
  abajo rellena ese hueco y se va apartando sola según aparece lo
  vuestro.

  ─────────────────────────────────────────────────────────────
  POR QUÉ ESTA LISTA ES CORTA Y NO LA GRANDE

  En `lib/comprables.ts` hay trescientos productos. Esa lista existe
  para PARTIR una frase dictada, y para eso cuantos más mejor.

  Ésta es otra cosa: son botones en una pared. Treinta caben y se leen
  de un vistazo; trescientos son un catálogo que hay que buscar, y
  buscar en un catálogo cuesta más que escribir «leche».

  Son las cosas que se acaban en una casa, en el orden en que se acaban.

  ─────────────────────────────────────────────────────────────
  Y ES DE AQUÍ, NO DE UN SUPERMERCADO DE MADRID

  Papas, no patatas. Plátanos, gofio, millo. Si la pared ofrece
  «patatas» a una familia que dice papas, es una palabra que hay que
  traducir antes de tocarla — y entonces ya no ahorra nada.
*/

export const LO_DE_SIEMPRE: string[] = [
  // Lo que se acaba cada semana
  'Leche',
  'Pan',
  'Huevos',
  'Café',
  'Azúcar',
  'Aceite',
  'Papas',
  'Plátanos',
  'Tomates',
  'Cebollas',
  'Queso',
  'Yogures',
  'Mantequilla',
  'Jamón',
  'Pollo',
  'Pescado',
  'Arroz',
  'Pasta',
  'Legumbres',
  'Gofio',
  'Agua',
  'Zumo',

  // La casa
  'Papel higiénico',
  'Servilletas',
  'Detergente',
  'Lavavajillas',
  'Bolsas de basura',
  'Lejía',
  'Pasta de dientes',
  'Champú',
]

/**
 * Lo que se le ofrece a alguien de pie delante de la pared.
 *
 * Primero lo de esta casa —ordenado por lo que más se repite— y
 * después lo corriente para rellenar. Nunca sale algo que ya esté
 * apuntado: ofrecer leche cuando la leche ya está en la lista es
 * invitar a apuntarla dos veces.
 *
 * @param historia  Lo ya comprado y archivado, tal cual se guardó.
 * @param yaEnLista Lo que hay ahora mismo sin comprar.
 * @param cuantos   Cuántos botones caben.
 */
export function loQueSeOfrece(
  historia: string[],
  yaEnLista: string[],
  cuantos = 18
): string[] {
  const normal = (s: string) => s.trim().toLowerCase()

  const puestas = new Set(yaEnLista.map(normal))
  const sale: string[] = []
  const vistas = new Set<string>()

  const mete = (que: string) => {
    const clave = normal(que)
    if (clave.length < 2) return
    if (puestas.has(clave) || vistas.has(clave)) return
    vistas.add(clave)
    /* Con mayúscula inicial siempre: en la compra se escribe «leche» a
       las once de la noche y «Leche» por la mañana, y en una fila de
       botones esa diferencia se ve. */
    sale.push(que.trim().replace(/^./, (l) => l.toUpperCase()))
  }

  // ── 1 · Lo de esta casa, por veces ──
  const cuenta = new Map<string, { veces: number; como: string }>()
  for (const h of historia) {
    const clave = normal(h)
    if (clave.length < 2) continue
    const ya = cuenta.get(clave)
    /* Se guarda la primera forma vista para escribirlo como lo escriben
       ellos, no como lo escribiría yo. */
    cuenta.set(clave, { veces: (ya?.veces ?? 0) + 1, como: ya?.como ?? h })
  }

  for (const [, v] of [...cuenta.entries()].sort((a, b) => b[1].veces - a[1].veces)) {
    if (sale.length >= cuantos) break
    /* Una sola vez no es una costumbre: es una vez. Con el umbral en
       uno, la pared se llena de la cosa rara que se compró en agosto. */
    if (v.veces >= 2) mete(v.como)
  }

  // ── 2 · Y lo corriente, hasta llenar ──
  for (const c of LO_DE_SIEMPRE) {
    if (sale.length >= cuantos) break
    mete(c)
  }

  return sale
}
