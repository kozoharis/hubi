import { entenderFrase } from '@/lib/entender-voz'

/*
  Las frases que tienen que salir bien. No es una suite: es la lista de
  lo que se rompió alguna vez, más lo que se acaba de pedir.
*/
const personas = [{ nombre: 'Haris Kozo' }, { nombre: 'Conchita Pérez' }, { nombre: 'Rosana Díaz' }]
const hoy = '2026-09-10'

/* [ lo que se dice, el título que debe salir, para quién ]
   Con el título a `null` la frase NO es una tarea: solo se comprueba
   que no se lea como tal. */
const casos: [string, string | null, string | null][] = [
  // ── Se lo pone uno a sí mismo, sin decir su nombre ──
  ['recuérdame mañana a las diez que recoja la medicación', 'Recoja la medicación', 'yo'],
  ['avísame mañana a las diez de la reunión', 'Reunión', 'yo'],
  ['recuérdame que tengo que llamar al fontanero', 'Llamar al fontanero', 'yo'],
  ['apúntame para el viernes lo del banco', 'Lo del banco', 'yo'],
  ['que no se me olvide pasar la ITV el jueves', 'Pasar la ITV', 'yo'],
  ['ponme el viernes lo del gestor', 'Lo del gestor', 'yo'],
  ['anótame el lunes lo del seguro', 'Lo del seguro', 'yo'],
  // ── A otro ──
  ['recuérdale a Conchita que lleve los papeles', 'Lleve los papeles', 'Conchita Pérez'],
  // ── A varios ──
  ['recuérdale a Conchita y a mí lo de la ITV', 'Lo de la ITV', 'yo y Conchita Pérez'],
  ['apunta para Conchita y Rosana lo de la cooperativa', 'Lo de la cooperativa', 'Conchita Pérez y Rosana Díaz'],
  ['recuérdanos mañana lo del médico', 'Lo del médico', 'los dos'],
  ['avísanos el martes de la cita', 'Cita', 'los dos'],
  ['recuérdale a los dos que hay que regar', 'Regar', 'los dos'],
  // ── Y lo que NO debe cambiar ──
  ['apunta un gasto de 85 euros de productos de la finca', null, null],
  ['¿cuánto hemos gastado este trimestre en agua?', null, null],
]

let mal = 0
for (const [frase, tituloEsperado, paraEsperado] of casos) {
  const r = entenderFrase({ frase, personas, categorias: [], hoy })
  /* Con título esperado nulo solo se comprueba que NO se ha leído como
     una tarea: son las frases de otra cosa. */
  const okT = tituloEsperado === null ? r.accion !== 'recordatorio' : r.titulo === tituloEsperado
  const okP = tituloEsperado === null ? true : (r.para ?? null) === paraEsperado
  if (!okT || !okP) mal++
  console.log(
    `${okT && okP ? '  ok ' : '  MAL'} «${frase}»` +
      (okT && okP
        ? ''
        : `\n       titulo: ${JSON.stringify(r.titulo)} (esperado ${JSON.stringify(tituloEsperado)})` +
          `\n       para:   ${JSON.stringify(r.para)} (esperado ${JSON.stringify(paraEsperado)})` +
          `\n       accion: ${r.accion}`)
  )
}
console.log(mal === 0 ? `\nLas ${casos.length} bien.` : `\n${mal} de ${casos.length} MAL`)
