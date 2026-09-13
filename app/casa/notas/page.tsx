import { laPared } from '@/lib/pared'
import { AMBITO } from '../../piezas'
import { Nada, Rotulo } from '../rotulo'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  NOTAS · el corcho de la casa
  ═══════════════════════════════════════════════════════════════

  Lo que alguien deja escrito para todos. «He dejado los papeles del
  seguro en la mesa.» Es el punto 16 del planteamiento, puesto donde
  siempre estuvo el corcho de una casa: en la cocina.

  ─────────────────────────────────────────────────────────────
  AQUÍ NO SE DECIDE QUÉ NOTAS SALEN

  Y es lo más importante de esta pantalla. Se piden TODAS las notas de
  la casa, sin una sola condición, porque la que filtra es la base:

      notas_solo_lo_de_la_casa_en_la_pantalla   (paso 64)
        →  not soy_pantalla_de_casa(hogar_id)
           or coalesce(visible_en_casa, false)

  Una nota privada entre dos personas no llega aquí, y no llega porque
  Postgres no la manda — no porque esta pantalla se acuerde de
  esconderla. Si filtrara también aquí habría dos reglas para lo mismo,
  y el día que una se olvide conviene que se olvide la que no protege.

  Lo que sale en la cocina se decide en Ajustes → La cocina, desde el
  móvil.

  ─────────────────────────────────────────────────────────────
  Y SIN NOMBRES

  El corcho del móvil dice de quién es cada nota. Aquí no: esto lo ve
  cualquiera que entre en la casa, incluida gente que no vive en ella.
  «He dejado los papeles en la mesa» no necesita firma para servir; con
  firma, además, cuenta quién estaba.
*/

type Nota = {
  id: string
  texto: string
  creado_en: string | null
}

export default async function Notas() {
  const { supabase, casa } = await laPared()

  const { data } = await supabase
    .from('notas')
    .select('id, texto, creado_en')
    .eq('hogar_id', casa)
    .order('creado_en', { ascending: false })
    .limit(12)

  const notas = (data ?? []) as Nota[]

  return (
    <section className="mt-12">
      <Rotulo>En la casa</Rotulo>

      {notas.length === 0 ? (
        <Nada>No hay nada escrito en el corcho.</Nada>
      ) : (
        /*
          Tres columnas de altura libre. Un corcho no es una lista: las
          notas son de largos muy distintos y alinearlas en filas
          dejaría huecos enormes debajo de las cortas.
        */
        <div className="mt-6 gap-4 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {notas.map((n) => (
            <div
              key={n.id}
              className="rounded-[28px] border bg-superficie px-6 py-5"
              style={{
                borderColor: 'var(--t-borde)',
                borderLeft: `6px solid ${AMBITO.rosa}`,
              }}
            >
              <p className="whitespace-pre-wrap text-[24px] font-extrabold leading-snug text-tinta">
                {n.texto}
              </p>
              {n.creado_en && (
                <p className="mt-2.5 text-[16px] font-bold text-tenue">{haceCuanto(n.creado_en)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/*
  «Hoy», «Ayer», «Hace 3 días».

  Y no la fecha exacta: en un corcho lo que importa es si es de esta
  mañana o de la semana pasada. «12/09/2026» obliga a restar.
*/
function haceCuanto(iso: string): string {
  const cuando = new Date(iso)
  const dias = Math.floor((Date.now() - cuando.getTime()) / 86_400_000)

  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 7) return `Hace ${dias} días`
  if (dias < 14) return 'Hace una semana'
  if (dias < 31) return `Hace ${Math.floor(dias / 7)} semanas`
  return 'Hace más de un mes'
}
