import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { genteDeLaCasa } from '@/lib/gente'
import { puedeEscribir } from '@/lib/hogar'
import { notasDe, conFecha } from '@/lib/notas'
import Cabecera from '../cabecera'
import Barra from '../barra'
import { Volver } from '../iconos'
import Notas from './notas'
import { elEspacio } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LAS NOTAS
  ═══════════════════════════════════════════════════════════════

  El corcho de la cocina. Cosas que no se «hacen» y no caducan: dónde
  está la llave del garaje, qué día viene el del agua, que los papeles
  del seguro están encima de la mesa.

  Es lo que el planteamiento llama TABLÓN, y por eso no se ha metido
  en la Agenda: la Agenda es «lo que tengo que recordar», con fecha y
  con un «hecho» al final. Esto es «lo que nos decimos», que no tiene
  ni lo uno ni lo otro.
*/
export default async function PaginaNotas({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>
}) {
  const p = await searchParams
  const viendoGuardadas = p.ver === 'guardadas'

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const hogarId = await elEspacio(supabase)

  const [notas, escribo] = await Promise.all([
    notasDe(supabase, viendoGuardadas),
    puedeEscribir(supabase, user.id, hogarId),
  ])

  /*
    Los nombres de la casa. Hacen falta dos veces: para firmar cada
    nota y para el desplegable de «¿para quién?».

    Se piden los de ESTA casa y no todos los perfiles que las
    políticas dejen ver: quien tenga dos casas se vería a sí mismo en
    la lista de la otra.
  */
  /* Con su color: es lo que deja saber de quién es cada nota sin leer
     la firma. `genteDeLaCasa` ya viene envuelto y con respaldo si
     falta la columna del SQL 39. */
  let gente: { id: string; nombre: string; color: string }[] = []

  try {
    gente = (await genteDeLaCasa(supabase, hogarId))
      .map((g) => ({ id: g.id, nombre: g.nombre, color: g.color }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  } catch {
    /* Sin nombres, las notas salen igual y se firman con «Alguien».
       Una nota sin firmar sigue sirviendo; una pantalla que no carga,
       no. */
  }

  return (
    <main className="min-h-screen pb-40 lg:pb-16">
      <Cabecera ancho>
        <Volver href="/dia" />
        <div className="flex h-12 items-center">
          <h1 className="t-titulo">Notas</h1>
        </div>
      </Cabecera>

      <div className="columna pt-2">
        <Notas
          notas={conFecha(notas)}
          gente={gente}
          yo={user.id}
          escribo={escribo}
          viendoGuardadas={viendoGuardadas}
        />
      </div>

      <Barra activa="dia" />
    </main>
  )
}
