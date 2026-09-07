import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../barra'
import Cabecera from '../cabecera'
import { Volver } from '../iconos'
import { miHogar } from '@/lib/hogar'
import { genteDeLaCasa, type Quien } from '@/lib/gente'
import { loDeHoy } from '@/lib/rutinas'
import { parteDe, partesDe, primeroDelMes, type Parte } from '@/lib/dia'
import { hoyAqui } from '@/lib/tablon'
import RutinasHoy, { type Deber } from '../rutinas-hoy'
import ParteDelDia from './parte'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LA CASA HOY
  ═══════════════════════════════════════════════════════════════

  Todo lo de un día, en un sitio: qué tocaba, qué se ha hecho, cuántas
  horas y qué hay que contar.

  ─────────────────────────────────────────────────────────────
  POR QUÉ SE FUE DEL INICIO

  Estaba entero ahí: cinco líneas con casillas, debajo de las tarjetas.
  Y ocupaba media pantalla todos los días para decir algo que casi
  siempre se resume en «0 de 4» — mientras empujaba hacia abajo el
  médico de las diez, que es lo que de verdad hay que ver al abrir.

  Arriba queda UNA tarjeta con el número. Lo demás está aquí, a un
  toque, que es donde puede ocupar lo que necesite.

  ─────────────────────────────────────────────────────────────
  Y AQUÍ CABE LO QUE NO CABÍA

  Marcar tareas era todo lo que se podía hacer, y el día tiene más:
  cuántas horas estuvo, y qué pasó —«no pude planchar, no había
  plancha», «me quedé una hora más»—. Eso en el Inicio no cabe, y sin
  sitio propio acaba en un WhatsApp.
*/

export default async function LaCasaHoy({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>
}) {
  const { dia } = await searchParams

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) redirect('/empezar')

  /* Un día concreto si se pide; si no, hoy. Nunca `new Date()`: la
     hora del servidor puede ir un día por delante de la de aquí. */
  const fecha = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : hoyAqui()
  const esHoy = fecha === hoyAqui()

  const gente = await genteDeLaCasa(supabase, hogarId)
  const yo = gente.find((g) => g.id === user.id)
  const soyLaAyuda = yo?.rol === 'ayuda'

  /* Quien ayuda en casa ve lo suyo; la familia ve todo lo del día. Es
     la misma regla del Inicio, y la de verdad la aplican las políticas
     de la base de datos: aquí solo se decide qué se pide. */
  const filas = await loDeHoy(supabase, soyLaAyuda ? user.id : null, fecha)

  const nombreDe = new Map(gente.map((g) => [g.id, g.nombre.split(' ')[0]]))

  const deberes: Deber[] = filas.map((r) => ({
    id: r.id,
    que: r.que,
    hora: r.hora,
    hecha: r.hecha,
    deQuien: r.para ? (nombreDe.get(r.para) ?? null) : null,
  }))

  /*
    ── DE QUIÉN ES ESTE DÍA ──

    De quien ayuda en casa, si hay alguien con ese papel. Es de quien
    se enseña el parte y quien lo escribe. Con varias personas
    ayudando, la primera aceptada — y ése es el día que habrá que
    elegir cuál, no antes.
  */
  const laAyuda: Quien | null = soyLaAyuda
    ? (yo ?? null)
    : (gente.find((g) => g.rol === 'ayuda' && !g.pendiente) ?? null)

  const suParte: Parte | null = laAyuda ? await parteDe(supabase, laAyuda.id, fecha) : null

  /* Las horas de MÁS que lleva del mes. El horario de siempre no se
     apunta: lo que hay que cuadrar a fin de mes es lo que se salió de
     lo acordado. */
  const delMes = laAyuda ? await partesDe(supabase, laAyuda.id, primeroDelMes(fecha)) : []
  const extraDelMes = delMes.reduce((n, p) => n + Number(p.extra ?? 0), 0)

  const hechas = deberes.filter((d) => d.hecha).length

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href="/" texto="Inicio" />
        <div className="flex h-14 items-center gap-3">
          {laAyuda && (
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold text-white"
              style={{ background: laAyuda.color }}
            >
              {laAyuda.nombre.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <h1 className="truncate text-[25px] font-extrabold leading-tight tracking-tight">
              {esHoy ? 'La casa hoy' : enPalabras(fecha)}
            </h1>
            <p className="text-[14.5px] font-bold text-tenue">
              {laAyuda
                ? `${laAyuda.nombre.split(' ')[0]} · ${hechas} de ${deberes.length}`
                : `${hechas} de ${deberes.length}`}
            </p>
          </span>
        </div>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-1">
        {deberes.length > 0 ? (
          <RutinasHoy
            rutinas={deberes}
            puedeMarcar={yo?.rol !== 'mirar' && yo?.rol !== 'asesor'}
            soloMias={soyLaAyuda}
            titulo="Lo que toca"
          />
        ) : (
          <p className="mt-5 rounded-[20px] bg-superficie px-6 py-8 text-center text-[17px] font-medium leading-snug text-tinta-suave">
            {esHoy ? 'Hoy no toca nada.' : 'Ese día no tocaba nada.'}
          </p>
        )}

        {/*
          ── EL PARTE ──

          Lo escribe ella y solo ella, y por eso a los demás se les
          enseña, no se les ofrece. No es una limitación de la pantalla:
          las políticas de la base de datos dicen lo mismo, y si aquí
          saliera un formulario para la familia, fallaría al guardar.
        */}
        {laAyuda && (
          <ParteDelDia
            deQuien={laAyuda.nombre.split(' ')[0]}
            color={laAyuda.color}
            fecha={fecha}
            esHoy={esHoy}
            mio={soyLaAyuda}
            parte={
              suParte ? { extra: suParte.extra, nota: suParte.nota } : { extra: null, nota: null }
            }
            extraDelMes={extraDelMes}
            diasConExtra={delMes.filter((p) => Number(p.extra ?? 0) > 0).length}
          />
        )}
      </div>

      <Barra activa={null} voz={false} />
    </main>
  )
}

/** «2026-09-08» → «Martes, 8 de septiembre». */
function enPalabras(iso: string): string {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const meses = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre',
  ]
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  const f = new Date(a, m - 1, d)
  return `${dias[f.getDay()]}, ${d} de ${meses[m - 1]}`
}
