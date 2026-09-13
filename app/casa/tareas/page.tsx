import { hoyAqui } from '@/lib/tablon'
import { laPared, loApuntado } from '@/lib/pared'
import Cosa from '../cosa'
import { diaCorto } from '../page'
import { Nada, Rotulo } from '../rotulo'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  TAREAS · lo que hay que hacer
  ═══════════════════════════════════════════════════════════════

  Todo lo pendiente, del más cercano al más lejano, sin cortar por
  semanas. Es la lista que se mira cuando alguien pregunta «¿me queda
  algo?».

  ─────────────────────────────────────────────────────────────
  ⚠️  TODAVÍA NO SE PUEDEN TACHAR, Y NO ES UN OLVIDO

  Lo lógico en una pared es pasar y tachar. Hoy no se puede, y la razón
  está en la base, no aquí:

      recordatorios_editar  →  puedo_en_agenda(hogar_id)
      y para un aparato, `nivel_por_rol('casa','agenda')` = mirar

  O sea que una pantalla puede LEER la agenda y no escribirla. Es
  correcto tal como está: si se le subiera el nivel a `anadir`, la
  pantalla podría además INVENTAR tareas, y una pared que se saca
  recados de la manga no la quiere nadie.

  La solución buena es la del paso 67, permisos POR COLUMNA: el aparato
  puede escribir `estado` y ninguna otra columna. Tachar sí; escribir
  no. Va en su propio paso de SQL, con su ensayo, porque toca permisos.

  Hasta entonces esta pantalla lo dice en voz alta en vez de enseñar un
  botón que falla. Un botón roto es peor que ningún botón.
*/

export default async function Tareas() {
  const { supabase, casa } = await laPared()

  const hoy = hoyAqui()
  const dentroDeUnAno = sumarDias(hoy, 400)

  const cosas = await loApuntado(supabase, casa, hoy, dentroDeUnAno)
  const pendientes = cosas.filter((c) => c.estado !== 'hecho').slice(0, 24)

  const anoDeHoy = Number(hoy.slice(0, 4))

  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-5">
        <Rotulo>Lo que hay que hacer</Rotulo>
        {pendientes.length > 0 && (
          <p className="text-[20px] font-extrabold text-tinta-suave">
            {pendientes.length === 1 ? '1 cosa' : `${pendientes.length} cosas`}
          </p>
        )}
      </div>

      {pendientes.length === 0 ? (
        <Nada>No queda nada pendiente.</Nada>
      ) : (
        <>
          {/*
            Dos columnas: con veinticuatro cosas, una sola columna
            obligaría a deslizar una pantalla que está colgada de una
            pared, y eso es justo lo que no se puede hacer de paso.
          */}
          <ul className="mt-6 grid gap-3 xl:grid-cols-2 xl:gap-x-8">
            {pendientes.map((c) => (
              <Cosa
                key={c.id}
                titulo={c.titulo}
                cuando={cuandoCorto(c, anoDeHoy, hoy)}
                talla="lista"
              />
            ))}
          </ul>

          <p className="mt-7 text-[17px] font-bold text-tenue">
            Se tachan desde el móvil. Esta pantalla todavía no puede marcar nada como hecho.
          </p>
        </>
      )}
    </section>
  )
}

/** «Hoy · 18:00» para lo de hoy; «mar 16 sep» para lo demás. */
function cuandoCorto(
  c: { fecha: string | null; hora: string | null },
  anoDeHoy: number,
  hoy: string
): string {
  const reloj = c.hora ? ` · ${c.hora.slice(0, 5)}` : ''
  if (c.fecha === hoy) return `Hoy${reloj}`
  return diaCorto(c.fecha, anoDeHoy)
}

function sumarDias(iso: string, cuantos: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + cuantos)
  return d.toISOString().slice(0, 10)
}
