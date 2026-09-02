/*
  Lo que se compra en una casa.

  Esta lista existe por un motivo muy concreto: EL TRANSCRIPTOR DEL
  MÓVIL NO PONE COMAS. Cuando alguien dicta la compra sale un chorro de
  palabras seguidas —"leche pan huevos tomates aceite"— y partir por
  comas y por "y", que es lo que se hacía, deja UN artículo con los
  cinco dentro.

  Con esta lista se puede segmentar el chorro: se va reconociendo lo
  que suena a producto y cada uno se separa del siguiente.

  NO PRETENDE SER COMPLETA, y no pasa nada. Es la red de emergencia:
  cuando Gemini responde, es él quien separa la frase y esto no llega
  a usarse. Y lo que falte aquí lo pone el propio uso — la lista de la
  compra guarda lo ya comprado, y eso se suma a ésta.

  Los términos de varias palabras van primero al comparar: "papel
  higiénico" tiene que ganarle a "papel" o quedaría "papel" por un
  lado e "higiénico" por otro.
*/

export const COMPRABLES = [
  /*
    CANARIAS PRIMERO.

    La lista salió con vocabulario peninsular y esta familia es de
    Tenerife. Si dicen "papas" y aquí solo pone "patatas", "papas" no
    se reconoce como producto y el chorro de palabras no se parte por
    ahí — se lleva por delante también lo que venga detrás.
  */
  'papas', 'papas arrugadas', 'papas bonitas', 'millo', 'gofio',
  'mojo', 'mojo picón', 'mojo verde', 'plátanos', 'plátano',
  'queso fresco', 'queso de cabra', 'cochino', 'costillas',
  'potaje', 'garbanzas', 'batata', 'bubango', 'pella de gofio',
  'ñames', 'piña de millo', 'vino del país', 'ron miel',

  /* Y lo que faltaba de lo corriente: si no está aquí, no separa. */
  'papel de aluminio', 'papel film', 'bolsas de basura', 'estropajo',
  'friegasuelos', 'lejía', 'amoniaco', 'quitagrasas', 'ambientador',
  'pilas', 'bombillas', 'servilletas', 'pañuelos', 'algodón',
  'pasta de dientes', 'cepillo de dientes', 'colutorio', 'cuchillas',
  'espuma de afeitar', 'crema hidratante', 'protector solar',
  'pan de molde', 'pan rallado', 'harina', 'levadura', 'azúcar moreno',
  'aceite de girasol', 'vinagre de manzana', 'caldo', 'sopa',
  'atún en lata', 'sardinas', 'mejillones', 'aceitunas', 'encurtidos',
  'mermelada', 'miel', 'cereales', 'galletas maría', 'chocolate',
  'café molido', 'café en cápsulas', 'infusiones', 'manzanilla',
  'agua mineral', 'zumo de naranja', 'refrescos', 'cerveza', 'vino',

  // Frescos
  'leche', 'pan', 'huevos', 'huevo', 'queso', 'mantequilla', 'yogur', 'yogures',
  'nata', 'jamon', 'jamón', 'jamon serrano', 'jamón serrano', 'jamon york',
  'chorizo', 'salchichon', 'salchichón', 'mortadela', 'bacon', 'panceta',
  'pollo', 'pechuga', 'ternera', 'cerdo', 'carne picada', 'filetes', 'chuletas',
  'costillas', 'cordero', 'conejo', 'pavo', 'salchichas', 'hamburguesas',
  'pescado', 'merluza', 'salmon', 'salmón', 'atun', 'atún', 'sardinas',
  'bacalao', 'gambas', 'langostinos', 'calamares', 'pulpo', 'mejillones',

  // Fruta y verdura
  'tomates', 'tomate', 'patatas', 'papas', 'cebollas', 'cebolla', 'ajos', 'ajo',
  'pimientos', 'lechuga', 'zanahorias', 'calabacin', 'calabacín', 'berenjenas',
  'pepino', 'brocoli', 'brócoli', 'coliflor', 'espinacas', 'acelgas', 'judias',
  'judías', 'guisantes', 'champinones', 'champiñones', 'setas', 'puerros',
  'apio', 'perejil', 'cilantro', 'aguacate', 'aguacates',
  'platanos', 'plátanos', 'manzanas', 'naranjas', 'limones', 'peras', 'uvas',
  'fresas', 'melon', 'melón', 'sandia', 'sandía', 'kiwi', 'kiwis', 'mandarinas',
  'melocotones', 'piña', 'pina', 'cerezas', 'ciruelas', 'higos', 'papaya',

  // Despensa
  'aceite', 'aceite de oliva', 'aceite de girasol', 'vinagre', 'sal', 'azucar',
  'azúcar', 'harina', 'arroz', 'pasta', 'macarrones', 'espaguetis', 'fideos',
  'lentejas', 'garbanzos', 'alubias', 'legumbres', 'tomate frito', 'conservas',
  'atun en lata', 'cafe', 'café', 'te', 'té', 'infusiones', 'cacao', 'colacao',
  'galletas', 'cereales', 'tostadas', 'pan de molde', 'magdalenas', 'bizcocho',
  'chocolate', 'miel', 'mermelada', 'frutos secos', 'almendras', 'nueces',
  'especias', 'oregano', 'orégano', 'pimienta', 'pimenton', 'pimentón',
  'caldo', 'sopa', 'mayonesa', 'ketchup', 'mostaza',

  // Bebidas
  'agua', 'agua mineral', 'vino', 'cerveza', 'refrescos', 'zumo', 'zumos',
  'gaseosa', 'coca cola', 'tonica', 'tónica', 'hielo',

  // Congelados
  'congelados', 'pizza', 'helado', 'verduras congeladas',

  // Limpieza y droguería
  'detergente', 'suavizante', 'lejia', 'lejía', 'amoniaco', 'friegasuelos',
  'lavavajillas', 'estropajos', 'bayetas', 'fregona', 'papel de cocina',
  'papel higienico', 'papel higiénico', 'servilletas', 'bolsas de basura',
  'bolsas', 'ambientador', 'insecticida', 'limpiacristales',

  // Higiene
  'jabon', 'jabón', 'gel', 'champu', 'champú', 'acondicionador', 'pasta de dientes',
  'cepillo de dientes', 'desodorante', 'colonia', 'crema', 'cuchillas',
  'espuma de afeitar', 'compresas', 'panuelos', 'pañuelos', 'algodon', 'algodón',

  // Farmacia y casa
  'paracetamol', 'ibuprofeno', 'tiritas', 'alcohol', 'gasas',
  'pilas', 'bombillas', 'velas', 'cerillas', 'mecheros',

  // Para animales y finca
  'pienso', 'comida de perro', 'comida de gato', 'arena de gato',
  'abono', 'semillas', 'fertilizante', 'insecticida agricola', 'mangueras',

  // Ropa de casa
  'toallas', 'sabanas', 'sábanas', 'fundas', 'mantas', 'trapos',
]

/* Los de varias palabras primero: "papel higiénico" tiene que ganarle
   a "papel", o quedaría partido en dos artículos sin sentido. */
export const COMPRABLES_ORDENADOS = [...COMPRABLES].sort(
  (a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length
)

/*
  ─────────────────────────────────────────────────────────────
  EN QUÉ PARTE DEL SUPERMERCADO ESTÁ CADA COSA

  Una lista de la compra de veinte cosas en el orden en que se
  dictaron obliga a cruzar la tienda cuatro veces. Agrupada por zonas,
  se hace de una pasada.

  Y esto NO SE LE PREGUNTA A NADIE. Es exactamente la clase de trabajo
  que el punto 29 dice que le toca al sistema: quien dicta la compra
  dice "leche", no "leche, sección de frescos". Se deduce del propio
  nombre y ya está.

  Se deduce al enseñar la lista, no al guardarla: así lo ya apuntado
  se reordena solo en cuanto se mejore esta tabla, sin tocar nada de
  lo guardado.

  El orden de las zonas es el de una tienda de verdad —fresco primero,
  limpieza al final— para que la lista se recorra de arriba abajo.
*/

export type Pasillo =
  | 'Frescos'
  | 'Fruta y verdura'
  | 'Carne y pescado'
  | 'Despensa'
  | 'Bebidas'
  | 'Congelados'
  | 'Limpieza'
  | 'Higiene'
  | 'Casa'
  | 'Otras cosas'

export const PASILLOS: Pasillo[] = [
  'Fruta y verdura',
  'Carne y pescado',
  'Frescos',
  'Despensa',
  'Congelados',
  'Bebidas',
  'Limpieza',
  'Higiene',
  'Casa',
  'Otras cosas',
]

/* Palabras que delatan la zona. Se busca por trozos, así que "leche
   semidesnatada" cae en Frescos por "leche" sin tener que listarla. */
const PISTAS: [Pasillo, string[]][] = [
  ['Fruta y verdura', [
    'papas', 'papa', 'patata', 'tomate', 'lechuga', 'cebolla', 'ajo', 'zanahoria',
    'pimiento', 'calabacin', 'berenjena', 'bubango', 'batata', 'ñame', 'name',
    'platano', 'manzana', 'naranja', 'limon', 'pera', 'uva', 'melon', 'sandia',
    'aguacate', 'piña', 'fresa', 'kiwi', 'mango', 'papaya', 'verdura', 'fruta',
    'ensalada', 'espinaca', 'acelga', 'judia', 'guisante', 'millo', 'maiz',
    'perejil', 'cilantro', 'seta', 'champiñon', 'puerro', 'apio', 'pepino',
  ]],
  ['Carne y pescado', [
    'pollo', 'carne', 'ternera', 'cerdo', 'cochino', 'costilla', 'chuleta',
    'filete', 'lomo', 'jamon', 'chorizo', 'salchich', 'bacon', 'panceta',
    'pescado', 'merluza', 'salmon', 'atun fresco', 'sardina', 'gamba', 'calamar',
    'pulpo', 'vieja', 'cherne', 'sama', 'bocinegro', 'conejo', 'pavo', 'cordero',
  ]],
  ['Frescos', [
    'leche', 'queso', 'yogur', 'mantequilla', 'nata', 'huevo', 'margarina',
    'flan', 'natilla', 'cuajada', 'requeson', 'gofio', 'pella',
  ]],
  ['Despensa', [
    'pan', 'harina', 'arroz', 'pasta', 'macarron', 'espagueti', 'fideo',
    'lenteja', 'garbanza', 'garbanzo', 'alubia', 'aceite', 'vinagre', 'sal',
    'azucar', 'especia', 'pimienta', 'oregano', 'laurel', 'caldo', 'sopa',
    'atun en lata', 'lata', 'conserva', 'aceituna', 'encurtido', 'mermelada',
    'miel', 'cereal', 'galleta', 'chocolate', 'cafe', 'colacao', 'te',
    'infusion', 'manzanilla', 'levadura', 'tomate frito', 'mayonesa', 'ketchup',
    'mojo', 'potaje', 'pan rallado', 'pan de molde', 'tostada', 'magdalena',
  ]],
  ['Congelados', ['congelado', 'helado', 'pizza', 'croqueta', 'empanadilla', 'hielo']],
  ['Bebidas', [
    'agua', 'zumo', 'refresco', 'cerveza', 'vino', 'ron', 'coca', 'gaseosa',
    'bebida', 'batido', 'tonica', 'sidra',
  ]],
  ['Limpieza', [
    'detergente', 'suavizante', 'lejia', 'amoniaco', 'friegasuelos', 'limpia',
    'quitagrasas', 'estropajo', 'bayeta', 'fregona', 'escoba', 'basura',
    'lavavajilla', 'ambientador', 'insecticida', 'jabon de lavadora',
  ]],
  ['Higiene', [
    'papel higienico', 'champu', 'gel', 'jabon', 'pasta de dientes',
    'cepillo de dientes', 'colutorio', 'desodorante', 'cuchilla', 'afeitar',
    'crema', 'protector solar', 'compresa', 'tampon', 'pañal', 'algodon',
    'pañuelo', 'toallita', 'colonia',
  ]],
  ['Casa', [
    'papel de cocina', 'papel de aluminio', 'papel film', 'servilleta',
    'pila', 'bombilla', 'vela', 'cerilla', 'mechero', 'bolsa', 'percha',
    'plato', 'vaso', 'cubierto', 'sarten', 'olla', 'trapo',
  ]],
]

const sinTildes = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * En qué zona de la tienda cae esto. Nunca falla: lo que no reconoce
 * va a "Otras cosas", que sigue estando en la lista y a la vista.
 */
export function pasilloDe(que: string): Pasillo {
  const p = sinTildes(que)
  if (!p) return 'Otras cosas'

  /* Las pistas largas ganan: "papel de cocina" es de Casa aunque
     "papel higienico" también empiece por "papel". */
  let mejor: { zona: Pasillo; largo: number } | null = null

  for (const [zona, palabras] of PISTAS) {
    for (const palabra of palabras) {
      if (p.includes(palabra) && (!mejor || palabra.length > mejor.largo)) {
        mejor = { zona, largo: palabra.length }
      }
    }
  }

  return mejor?.zona ?? 'Otras cosas'
}

/*
  ─────────────────────────────────────────────────────────────
  ¿ESTO ES ALGO QUE SE COMPRA?

  En una lista de la compra solo tienen que entrar cosas que se
  compran: alimentos, productos, cosas de casa. Lo que se colaba era
  basura de la propia frase —el verbo con el que se pidió, un día de
  la semana, el nombre de quien va a ir— y cada línea de basura hay
  que borrarla a mano, que es justo lo que esta pantalla venía a
  evitar.

  NO ES UNA LISTA CERRADA, y no puede serlo: una bombona de butano o
  unas alpargatas son compras legítimas y no van a estar nunca en
  ninguna tabla. Así que no se aprueba lo conocido — se RECHAZA lo que
  seguro que no es un producto. Ante la duda, entra: una línea de más
  se tacha de un toque; una que falta, no se sabe que falta.
*/

/* Con lo que se PIDE apuntar. Nunca es el producto. */
const VERBOS = /^(apunta|apuntar|apuntame|anade|añade|anadir|añadir|pon|poner|ponme|mete|meter|meteme|escribe|agrega|agregar|compra|comprar|comprame|necesito|necesitamos|quiero|queremos|hace falta|hacen falta|hay que|tengo que|tenemos que|recuerda|recuerdame|acuerdate|traeme|trae)\b/

/* Relleno que a veces queda suelto al partir la frase. */
const RELLENO = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'y', 'e', 'o', 'que', 'para', 'por', 'con', 'sin', 'en', 'a', 'al',
  'lo', 'mas', 'más', 'tambien', 'también', 'porfavor', 'favor', 'gracias',
  'cosas', 'cosa', 'algo', 'todo', 'nada', 'esto', 'eso',
  'compra', 'super', 'súper', 'supermercado', 'lista', 'mercado',
])

/* Cuándo, no qué. */
const CUANDO = new Set([
  'hoy', 'manana', 'mañana', 'ayer', 'lunes', 'martes', 'miercoles',
  'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo',
  'semana', 'mes', 'año', 'ano', 'finde', 'tarde', 'noche',
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
])

export function esAlgoQueSeCompra(que: string, gente: string[] = []): boolean {
  const limpio = sinTildes(que).replace(/[^\wáéíóúñ\s]/gi, ' ').replace(/\s+/g, ' ').trim()
  if (limpio.length < 2 || limpio.length > 60) return false

  // Lo que está en la tabla entra siempre, sin más preguntas.
  if (COMPRABLES.some((c) => limpio === sinTildes(c) || limpio.startsWith(sinTildes(c) + ' '))) {
    return true
  }

  if (VERBOS.test(limpio)) return false

  const palabras = limpio.split(' ').filter(Boolean)
  if (palabras.length === 0 || palabras.length > 5) return false

  // Solo relleno, solo un día, o solo cifras: no es un producto.
  if (palabras.every((p) => RELLENO.has(p))) return false
  if (palabras.every((p) => CUANDO.has(p))) return false
  if (palabras.every((p) => /^\d+$/.test(p))) return false

  // El nombre de quien va a la compra no es lo que hay que comprar.
  const nombres = gente.map((g) => sinTildes(g.split(' ')[0]))
  if (palabras.every((p) => nombres.includes(p))) return false

  return true
}
