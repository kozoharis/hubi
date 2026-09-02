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
 * El icono lo decide el sistema, no la persona.
 *
 * Al crear algo solo se escribe qué hay que hacer. Pedirles que además
 * elijan una categoría sería exactamente la complejidad que no queremos
 * trasladarles.
 */
const PISTAS: [RegExp, string, string][] = [
  [/farmac|medicaci|medicament|receta|pastill/i, 'farmacia', '💊'],
  [/m[eé]dic|doctor|consulta|an[aá]lisis|cita|hospital|dentista|revisi[oó]n m/i, 'cita', '🩺'],
  [/coche|taller|itv|gasolin|mec[aá]nic|neum[aá]tic/i, 'coche', '🚗'],
  [/papel|documento|contrato|p[oó]liza|seguro|banco|gestor|notar/i, 'papeles', '📄'],
  [/vence|caduca|renov/i, 'vencimiento', '⏳'],
  [/compr|super|mercad|tienda|traer|llevar|recoger|dejar/i, 'recado', '🛍'],
]

export function deducirTipo(titulo: string): string {
  for (const [patron, tipo] of PISTAS) if (patron.test(titulo)) return tipo
  return 'tarea'
}

export function iconoDe(tipo: string): string {
  for (const [, t, icono] of PISTAS) if (t === tipo) return icono
  return '✅'
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

  SI NO VIVÍS EN CANARIAS, aquí se cambia. Es la única línea del
  proyecto donde está escrito dónde estáis.
*/
export const ZONA = 'Atlantic/Canary'

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
