/*
  ═══════════════════════════════════════════════════════════════
  MONTAR EL ESQUEMA
  ═══════════════════════════════════════════════════════════════

  Coge el CSV que devuelve `sql/sacar-el-esquema.sql` y levanta con él
  una copia de HUBI en un Postgres cualquiera. Sin datos: solo la forma.

  ─────────────────────────────────────────────────────────────
  POR QUÉ NO VALE EJECUTARLO TAL CUAL

  El texto sale ordenado para leerlo —tablas, restricciones, índices,
  funciones…— y ése no es el orden en que Postgres puede montarlo.

  `carpetas_drive.hogar_id` tiene como valor por defecto `mi_hogar()`.
  Crear esa tabla antes que la función es imposible: Postgres exige que
  la función exista para poder apuntarla en el defecto.

  Y al revés tampoco: las funciones leen tablas que aún no están.

  Se rompe el nudo con `check_function_bodies = off`, que le dice a
  Postgres «acepta el cuerpo de la función sin comprobar todavía a qué
  se refiere». Primero las funciones, después las tablas, y al final
  todo lo que cuelga de las dos.

      node pruebas/montar-esquema.mjs <el.csv> <nombre-de-la-base>
*/

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const [csv, base = 'hubi'] = process.argv.slice(2)
if (!csv) {
  console.error('Falta el CSV.\n  node pruebas/montar-esquema.mjs <el.csv> [base]')
  process.exit(1)
}

/* El CSV trae una cabecera y una única celda con todo dentro, entre
   comillas y con las comillas internas dobladas. */
const crudo = readFileSync(csv, 'utf8')
const desde = crudo.indexOf('"')
const texto = crudo.slice(desde + 1, crudo.lastIndexOf('"')).replaceAll('""', '"')

const trozos = {}
for (const [i, parte] of texto.split(/-- ══ ([A-ZÁÉÍÓÚ]+) ══/).entries()) {
  if (i % 2 === 1) trozos[parte] = texto.split(`-- ══ ${parte} ══`)[1].split('-- ══')[0]
}

const ORDEN = [
  'FUNCIONES', 'TABLAS', 'RESTRICCIONES', 'ÍNDICES',
  'DISPARADORES', 'PERMISOS', 'SEGURIDAD', 'POLÍTICAS',
]

const faltan = ORDEN.filter((s) => !trozos[s])
if (faltan.length > 0) {
  console.error(`El CSV no trae: ${faltan.join(', ')}`)
  process.exit(1)
}

const guion =
  'set check_function_bodies = off;\n\n' +
  ORDEN.map((s) => `-- ══ ${s} ══\n${trozos[s]}`).join('\n') +
  '\nreset check_function_bodies;\n'

writeFileSync('/tmp/hubi-esquema-ordenado.sql', guion)

const psql = (args, entrada) =>
  execFileSync('psql', args, { encoding: 'utf8', input: entrada, stdio: ['pipe', 'pipe', 'pipe'] })

psql(['-q', '-d', 'postgres', '-c', `drop database if exists ${base}`])
psql(['-q', '-d', 'postgres', '-c', `create database ${base}`])
psql(['-q', '-v', 'ON_ERROR_STOP=1', '-d', base, '-f', 'pruebas/supabase-de-mentira.sql'])
psql(['-q', '-v', 'ON_ERROR_STOP=1', '-d', base, '-f', '/tmp/hubi-esquema-ordenado.sql'])

const cuenta = (q) => psql(['-At', '-d', base, '-c', q]).trim()
console.log(`
  tablas     ${cuenta("select count(*) from information_schema.tables where table_schema='public'")}
  funciones  ${cuenta("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'")}
  políticas  ${cuenta("select count(*) from pg_policies where schemaname='public'")}
  con RLS    ${cuenta("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity")}
`)
