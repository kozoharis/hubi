import { redirect, notFound } from 'next/navigation'
import Link from '@/app/enlace'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien as quienEs } from '@/lib/supabase/quien'
import { partesDe, enHoras, primeroDelMes } from '@/lib/dia'
import { hoyAqui } from '@/lib/tablon'
import Barra from '../../barra'
import Cabecera from '../../cabecera'
import { Ico, Volver } from '../../iconos'
import { ambitoDeColor, BotonSecundario, Cifra, Fila, Tarjeta, Vacio } from '../../piezas'
import { genteDeLaCasa } from '@/lib/gente'
import { elEspacio, NINGUNO } from '@/lib/espacio'
export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LAS HORAS DE MÁS, MES A MES
  ═══════════════════════════════════════════════════════════════

  Apuntarlas ya se podía. Lo que faltaba era poder MIRARLAS.

  Hasta hoy la ficha decía «3 horas este mes, en 2 días» y ahí se
  acababa. Eso sirve para saber que hay algo que pagar y no sirve para
  cuadrarlo: a fin de mes lo que hace falta es repasar juntos QUÉ DÍAS
  fueron y por qué, y para eso el total no vale.

  Y sin ese repaso pasa lo de siempre — que se paga de memoria, que
  alguien se acuerda de una tarde que el otro no, y que una cosa que
  debería ser tranquila se convierte en una conversación incómoda una
  vez al mes.

  ─────────────────────────────────────────────────────────────
  LA MISMA PANTALLA PARA LOS DOS

  La ve ella y la ve la familia, y ven exactamente lo mismo. Eso es
  deliberado: si cada uno mirara una cuenta distinta, la conversación
  de fin de mes empieza discutiendo cuál es la buena.

  Quién puede leer qué lo decide la base de datos —el sql/49—, no esta
  pantalla: quien ayuda ve los suyos, la familia los de su casa.
*/
export default async function HorasDeAlguien({
  params,
  searchParams,
}: {
  params: Promise<{ quien: string }>
  searchParams: Promise<{ mes?: string }>
}) {
  const { quien: aQuien } = await params
  const { mes } = await searchParams

  const supabase = await clienteSesion()
  const user = await quienEs(supabase)
  if (!user) redirect('/entrar')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('id, nombre')
    .eq('id', aQuien)
    .maybeSingle()

  if (!perfil) notFound()

  /* Su color, el mismo con el que sale en La casa y en el corcho. Sin
     él —si no se encuentra en la casa— el ámbito de reserva. */
  const hogarId = await elEspacio(supabase)
  const suyo = ambitoDeColor(
    (await genteDeLaCasa(supabase, hogarId)).find((g) => g.id === aQuien)?.color
  )

  /* El mes que se está mirando. Sin decir nada, el de hoy. */
  const anclado = /^\d{4}-\d{2}$/.test(mes ?? '') ? `${mes}-01` : primeroDelMes(hoyAqui())
  const [a, m] = anclado.split('-').map(Number)

  const finDeMes = m === 12 ? `${a + 1}-01-01` : `${a}-${dos(m + 1)}-01`

  /*
    Se piden desde el día 1 y se corta aquí por arriba.

    `partesDe` solo sabe pedir «desde tal día», y añadirle un «hasta»
    obligaría a tocar una función que usan otras dos pantallas. Con
    cuatro filas al mes, filtrar aquí no cuesta nada y no arriesga
    nada — que es exactamente el trato que conviene.
  */
  const todos = await partesDe(supabase, hogarId ?? NINGUNO, aQuien, anclado)
  const delMes = todos.filter((p) => p.fecha < finDeMes && Number(p.extra ?? 0) > 0)

  const total = delMes.reduce((n, p) => n + Number(p.extra ?? 0), 0)

  const anterior = m === 1 ? `${a - 1}-12` : `${a}-${dos(m - 1)}`
  const siguiente = m === 12 ? `${a + 1}-01` : `${a}-${dos(m + 1)}`
  /* No se puede pasar del mes de hoy: enseñar octubre en septiembre
     sería ofrecer una pantalla que siempre estará vacía. */
  const hayFuturo = `${a}-${dos(m)}` >= hoyAqui().slice(0, 7)

  const suyas = aQuien === user.id

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href="/lacasa" />
        <h1 className="t-titulo">
          {suyas ? 'Mis horas de más' : `Horas de ${perfil.nombre.split(' ')[0]}`}
        </h1>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5">
        {/* ── El mes ── */}
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/horas/${aQuien}?mes=${anterior}`}
            aria-label="El mes anterior"
            className="r-campo flex h-[56px] w-[56px] shrink-0 items-center justify-center border border-borde bg-superficie"
          >
            <Ico nombre="atras" tam={20} grosor={2.4} />
          </Link>

          <p className="t-cuerpo min-w-0 flex-1 text-center font-extrabold capitalize">
            {MESES[m - 1]} de {a}
          </p>

          {hayFuturo ? (
            <span className="h-[56px] w-[56px] shrink-0" />
          ) : (
            <Link
              href={`/horas/${aQuien}?mes=${siguiente}`}
              aria-label="El mes siguiente"
              className="r-campo flex h-[56px] w-[56px] shrink-0 items-center justify-center border border-borde bg-superficie"
            >
              <Ico nombre="flecha" tam={20} grosor={2.4} />
            </Link>
          )}
        </div>

        {/*
          ── El total, que es lo que se viene a ver ──

          Era una tarjeta con degradado morado y la letra en blanco, la
          gemela de la que llevaba el balance de la finca. Se retiró por
          lo mismo: el degradado es de HUBI —lo que el asistente
          entiende, lo que se dice con la voz— y usarlo aquí lo
          convierte en decoración.

          Y una cifra grande de color se lee como una alarma. Cuarenta
          y cinco horas de más no son una alarma: son lo que hay que
          pagar. La cifra va en tinta.
        */}
        <div className="mt-3">
          <Tarjeta ambito={total > 0 ? suyo : undefined}>
            <Cifra
              rotulo="Horas de más este mes"
              valor={total > 0 ? enHoras(total) : '0 h'}
              pie={
                delMes.length === 0
                  ? 'Ningún día'
                  : delMes.length === 1
                    ? 'En un día'
                    : `En ${delMes.length} días`
              }
            />
          </Tarjeta>
        </div>

        {/* ── Y qué días fueron ── */}
        {delMes.length === 0 ? (
          <div className="mt-5">
            <Vacio
              titulo="Ninguna hora de más este mes"
              explicacion={
                suyas
                  ? 'Los días normales no hace falta apuntarlos: solo los que se salen de lo acordado.'
                  : undefined
              }
            />
          </div>
        ) : (
          <ul className="mt-5 space-y-2.5">
            {delMes.map((p) => (
              <li key={p.fecha}>
                <Fila ambito={suyo}>
                  <span className="min-w-0 flex-1">
                    <span className="t-tarjeta block capitalize">{enPalabras(p.fecha)}</span>
                    {p.nota && <span className="t-apoyo mt-0.5 block">{p.nota}</span>}
                  </span>
                  {/* Era `text-morado`, un color que no está en la
                      paleta. Las horas de un día son un dato, no un
                      aviso: van en tinta. */}
                  <span className="t-cifra-2 shrink-0">{enHoras(Number(p.extra))}</span>
                </Fila>
              </li>
            ))}
          </ul>
        )}

        {/*
          Se apunta donde siempre, no aquí.

          Podría haber un botón de «añadir» en esta pantalla, y sería un
          segundo sitio donde apuntar lo mismo. Dos sitios para el mismo
          dato acaban con dos costumbres distintas y con días apuntados
          dos veces. Aquí se mira; se apunta en el día.
        */}
        <div className="mt-6">
          <BotonSecundario href="/lacasa" icono="atras">
            {suyas ? 'Apuntar las de hoy' : 'Volver a la casa'}
          </BotonSecundario>
        </div>
      </div>

      <Barra activa="dia" voz={false} />
    </main>
  )
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function dos(n: number): string {
  return String(n).padStart(2, '0')
}

/** «martes, 8» — el día de la semana importa: es como se recuerda. */
function enPalabras(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return `${DIAS[d.getDay()]}, ${d.getDate()}`
}
