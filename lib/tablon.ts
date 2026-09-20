export type Recordatorio = {
  id: string
  titulo: string
  tipo: string
  asignado_a: string | null
  creado_por: string
  fecha: string | null
  hora: string | null
  estado: 'pendiente' | 'hecho'
  nota: string | null
  documento_origen_id: string | null
}

/**
 * DE QUÉ VA UNA TAREA, DEDUCIDO DE LO QUE SE ESCRIBIÓ.
 *
 * Al crear algo solo se escribe qué hay que hacer. Pedirles que además
 * elijan una categoría sería exactamente la complejidad que no queremos
 * trasladarles.
 *
 * ─────────────────────────────────────────────────────────────
 * AQUÍ HABÍA UNA TERCERA COLUMNA CON EMOJIS, Y SE HA IDO
 *
 * Cada pista llevaba además su emoji —💊, 🩺, 🚗, 📄, ⏳, 🛍— y una
 * función `iconoDe(tipo)` que lo devolvía, con `✅` para lo que no
 * reconocía. Así que MAPPEL tenía **dos vocabularios de iconos**: los
 * dibujados de `iconos.tsx`, que son los de la marca, y estos, que son
 * los del teclado del móvil.
 *
 * Se notó el día que se colgó la pantalla de la cocina: la misma cita
 * médica era un corazón rosa en el teléfono y un 🩺 en la pared. Y una
 * tarea pendiente cualquiera salía con un `✅` verde, diciendo «hecho»
 * a dos metros de distancia.
 *
 * El icono y el color de una tarea los da `pintaDe(titulo)` en
 * `app/iconos.tsx`, y solo esa. Aquí se deduce el TIPO, que es otra
 * cosa: un dato que se guarda en la base.
 */
const PISTAS: [RegExp, string][] = [
  [/farmac|medicaci|medicament|receta|pastill/i, 'farmacia'],
  [/m[e\u00e9]dic|doctor|consulta|an[a\u00e1]lisis|cita|hospital|dentista|revisi[o\u00f3]n m/i, 'cita'],
  [/coche|taller|itv|gasolin|mec[a\u00e1]nic|neum[a\u00e1]tic/i, 'coche'],
  [/papel|documento|contrato|p[o\u00f3]liza|seguro|banco|gestor|notar/i, 'papeles'],
  [/vence|caduca|renov/i, 'vencimiento'],
  [/compr|super|mercad|tienda|traer|llevar|recoger|dejar/i, 'recado'],
]

export function deducirTipo(titulo: string): string {
  for (const [patron, tipo] of PISTAS) if (patron.test(titulo)) return tipo
  return 'tarea'
}

/*
  QUÉ DÍA ES HOY, AQUÍ.

  Esto no es una manía: era un fallo de verdad y difícil de ver.

  `new Date()` da la hora del reloj de la MÁQUINA que ejecuta el
  código. En el móvil de Juan Miguel eso es la hora de casa; pero estas
  pantallas se calculan en el SERVIDOR, y el servidor de Vercel va en
  hora de Londres. Así que a última hora de la tarde el servidor ya
  había cambiado de día antes que ellos: lo de mañana salía como "Hoy",
  y una tarea que aún estaba a tiempo aparecía en rojo como "Sin
  hacer".

  Además pasaba solo un rato al día y solo en verano, que es la clase
  de fallo que se ve tres veces y se acaba achacando a "esto va raro".

  Se pregunta directamente por el día en la zona horaria de la familia.
  'en-CA' no es un capricho: es el único idioma que da la fecha ya
  escrita como 2026-08-29, que es como se guarda en la base de datos.

  ─────────────────────────────────────────────────────────────
  ⚠️  ESTO DECÍA 'Atlantic/Canary' Y NO ERA VERDAD

  Venía del planteamiento original —Juan Miguel, Conchita, Los
  Realejos— y se quedó puesto cuando la aplicación se mudó. Salió a la
  luz por el tiempo de la cocina, que enseñaba el de Tenerife; pero el
  tiempo era lo de menos.

  **`ZONA` decide qué es «hoy» en toda la aplicación**: lo de hoy en
  la agenda, lo vencido, el día en que se apunta un gasto, cuándo le
  toca a un pago fijo. Con Canarias puesta en una casa de la
  península, entre las 00:00 y las 01:00 —las 02:00 en verano— mappel
  creía que todavía era ayer: una tarea apuntada a las 00:30 caía en
  el día anterior y salía ya vencida.

  Eso no lo relaciona nadie nunca con un huso horario.

  ─────────────────────────────────────────────────────────────
  Y SIGUE SIENDO UNA CONSTANTE, A PROPÓSITO

  Desde el paso 93 la CASA tiene su sitio guardado —con su huso— y de
  ahí sale la previsión del tiempo. Esta línea no: `hoyAqui()` es una
  función pura que se llama desde cincuenta sitios, muchos sin sesión
  ni casa a mano (la cita diaria, los avisos del móvil), y volverla
  dependiente de la casa es un cambio de otro tamaño.

  Mientras todas las casas estén en el mismo huso, esto es correcto y
  es una línea. El día que haya una casa en Canarias y otra en Madrid
  habrá que llevarlo hasta el final, y el dato ya estará guardado.

  SI OS MUDÁIS, aquí se cambia.
*/
export const ZONA = 'Europe/Madrid'

const FORMATO_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** El día de hoy donde vive la familia: "2026-08-29". */
export function hoyAqui(): string {
  return FORMATO_DIA.format(new Date())
}

/** "Hoy · 18:00", "Mañana", "Martes 2 de septiembre", "Sin fecha" */
export function cuando(fecha: string | null, hora: string | null): string {
  if (!fecha) return 'Sin fecha'

  const hoy = new Date(hoyAqui() + 'T12:00:00')
  const dia = new Date(fecha + 'T12:00:00')

  const dias = Math.round((dia.getTime() - hoy.getTime()) / 86_400_000)
  const reloj = hora ? ` · ${hora.slice(0, 5)}` : ''

  if (dias === 0) return `Hoy${reloj}`
  if (dias === 1) return `Mañana${reloj}`
  if (dias === -1) return `Ayer${reloj}`
  if (dias < -1) return `Hace ${Math.abs(dias)} días${reloj}`

  const semana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

  if (dias < 7) {
    return `${mayus(semana[dia.getDay()])}${reloj}`
  }
  return `${dia.getDate()} de ${meses[dia.getMonth()]}${reloj}`
}

/*
  Atrasado: tenía fecha, ya pasó, y sigue pendiente.

  Se compara por DÍAS, no por horas: algo puesto para hoy a las diez de
  la mañana no se pone en rojo a las diez y cinco. Tienen el día
  entero. Poner en rojo a alguien a media mañana por un recado que
  todavía puede hacer es regañarle sin motivo.
*/
export function atrasado(r: Recordatorio): boolean {
  if (!r.fecha || r.estado === 'hecho') return false
  return r.fecha < hoyAqui()
}

function mayus(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}
