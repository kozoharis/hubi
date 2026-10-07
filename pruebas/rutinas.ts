import { tocaEstaSemana, diaDe } from '../lib/rutinas'

/*
  ═══════════════════════════════════════════════════════════════
  EL GUARDIÁN DE «CADA CUÁNTO TOCA»
  ═══════════════════════════════════════════════════════════════

      npm run probar-rutinas

  Es la única parte de las rutinas que puede equivocarse EN SILENCIO.
  Todo lo demás falla de cara: si no se guarda el plan, se ve; si no
  sale una rutina, se ve. Pero una cuenta de semanas mal hecha enseña
  las sábanas la semana que no toca, y eso no lo nota nadie hasta que
  lleva meses pasando.

  Y hay tres sitios donde se tuerce sola:

    · El cambio de hora. Dos veces al año una semana tiene 167 o 169
      horas, y una resta de milisegundos dividida entre siete días
      redondea mal. Por eso la cuenta va a mediodía y con `Math.round`.
    · El fin de año. La semana del 28 de diciembre y la del 4 de enero
      son consecutivas aunque cambie el año.
    · El ancla en el futuro. El `%` de JavaScript conserva el signo.

  Las tres están abajo.
*/

const fallos: string[] = []
let hechas = 0

function afirma(que: string, esperado: unknown, salio: unknown) {
  hechas++
  if (esperado === salio) return
  fallos.push(`${que} · esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(salio)}`)
}

// ── 1 · Cada semana toca siempre ───────────────────────────
for (const d of ['2026-10-05', '2026-10-12', '2027-04-19', '2020-01-06']) {
  afirma(`cada 1 · ${d}`, true, tocaEstaSemana('2026-10-05', 1, d))
}

/* Y sin ancla, también: es lo que hace que una rutina de antes del
   sql/97 se comporte exactamente igual que ayer. */
afirma('sin ancla · toca', true, tocaEstaSemana(null, 2, '2026-10-12'))
afirma('sin periodo · toca', true, tocaEstaSemana('2026-10-05', null, '2026-10-12'))

// ── 2 · Cada dos semanas, desde el lunes 5 de octubre ──────
const QUINCENAL: [string, boolean][] = [
  ['2026-10-05', true], // el lunes del ancla
  ['2026-10-11', true], // el domingo de esa misma semana
  ['2026-10-12', false], // la siguiente, no
  ['2026-10-18', false],
  ['2026-10-19', true], // y la de después, sí
  ['2026-11-02', true],
  ['2026-11-09', false],
]
for (const [d, toca] of QUINCENAL) {
  afirma(`cada 2 · ${d}`, toca, tocaEstaSemana('2026-10-05', 2, d))
}

// ── 3 · El ancla se normaliza a su lunes ───────────────────
/*
  Da igual que se guardara un miércoles: la semana es la misma. Sin
  esto, dos rutinas creadas la misma semana en días distintos irían
  desfasadas entre sí.
*/
for (const [d, toca] of QUINCENAL) {
  afirma(`ancla en miércoles · ${d}`, toca, tocaEstaSemana('2026-10-07', 2, d))
}
for (const [d, toca] of QUINCENAL) {
  afirma(`ancla en domingo · ${d}`, toca, tocaEstaSemana('2026-10-11', 2, d))
}

// ── 4 · Cada tres y cada cuatro ────────────────────────────
afirma('cada 3 · misma semana', true, tocaEstaSemana('2026-10-05', 3, '2026-10-07'))
afirma('cada 3 · +1', false, tocaEstaSemana('2026-10-05', 3, '2026-10-14'))
afirma('cada 3 · +2', false, tocaEstaSemana('2026-10-05', 3, '2026-10-21'))
afirma('cada 3 · +3', true, tocaEstaSemana('2026-10-05', 3, '2026-10-28'))

afirma('cada 4 · misma semana', true, tocaEstaSemana('2026-10-05', 4, '2026-10-06'))
afirma('cada 4 · +3', false, tocaEstaSemana('2026-10-05', 4, '2026-10-27'))
afirma('cada 4 · +4', true, tocaEstaSemana('2026-10-05', 4, '2026-11-03'))
afirma('cada 4 · +8', true, tocaEstaSemana('2026-10-05', 4, '2026-11-30'))

// ── 5 · El cambio de hora ──────────────────────────────────
/*
  En España el reloj se atrasa el último domingo de octubre y se
  adelanta el último de marzo. Una resta de milisegundos partida entre
  siete días da 1,994 o 2,006 semanas esas veces, y sin `Math.round`
  el truncado se come una semana entera.
*/
afirma('otoño · antes', true, tocaEstaSemana('2026-10-19', 2, '2026-10-21'))
afirma('otoño · la de después NO', false, tocaEstaSemana('2026-10-19', 2, '2026-10-28'))
afirma('otoño · y la siguiente SÍ', true, tocaEstaSemana('2026-10-19', 2, '2026-11-04'))

afirma('primavera · antes', true, tocaEstaSemana('2027-03-22', 2, '2027-03-24'))
afirma('primavera · la de después NO', false, tocaEstaSemana('2027-03-22', 2, '2027-03-31'))
afirma('primavera · y la siguiente SÍ', true, tocaEstaSemana('2027-03-22', 2, '2027-04-07'))

// ── 6 · El fin de año ──────────────────────────────────────
/* Lunes 28 de diciembre de 2026 y lunes 4 de enero de 2027 son
   semanas consecutivas, aunque cambie el año. */
afirma('fin de año · misma', true, tocaEstaSemana('2026-12-28', 2, '2026-12-30'))
afirma('fin de año · siguiente NO', false, tocaEstaSemana('2026-12-28', 2, '2027-01-05'))
afirma('fin de año · la otra SÍ', true, tocaEstaSemana('2026-12-28', 2, '2027-01-11'))

// ── 7 · Un ancla en el futuro no rompe nada ────────────────
/* El `%` de JavaScript conserva el signo: sin el arreglo, esto daría
   -1 y no casaría nunca. */
afirma('ancla futura · una antes NO', false, tocaEstaSemana('2026-10-19', 2, '2026-10-12'))
afirma('ancla futura · dos antes SÍ', true, tocaEstaSemana('2026-10-19', 2, '2026-10-05'))

// ── 8 · Y el día de la semana, que no se ha tocado ─────────
afirma('lunes es 1', 1, diaDe('2026-10-05'))
afirma('domingo es 7', 7, diaDe('2026-10-11'))

// ── El veredicto ───────────────────────────────────────────
console.log('')
console.log('═══ CADA CUÁNTO TOCA ═══')
console.log('')
if (fallos.length === 0) {
  console.log(`  ✓ ${hechas} comprobaciones, todas en verde.`)
  console.log('')
} else {
  for (const f of fallos) console.log('  MAL ' + f)
  console.log('')
  console.log(`  ${fallos.length} de ${hechas} mal.`)
  console.log('')
  process.exit(1)
}
