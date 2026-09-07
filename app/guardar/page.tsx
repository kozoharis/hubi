import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { miHogar, quienManda } from '@/lib/hogar'
import { clienteServidor } from '@/lib/supabase/servidor'
import { Volver } from '../iconos'
import Formulario from './formulario'
import type { Categoria } from '@/lib/rutas'

export const dynamic = 'force-dynamic'

export default async function Guardar({
  searchParams,
}: {
  searchParams: Promise<{ en?: string; lista?: string }>
}) {
  const { en, lista: laCompra } = await searchParams

  const supabase = await clienteSesion()

  const user = await quien(supabase)

  if (!user) redirect('/entrar')

  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, icono, orden, naturaleza')
    .eq('activa', true)
    .order('orden')

  /* El Drive de SU casa. Preguntar por «la» conexión enseñaría a una
     familia el estado de la de al lado — y peor, la dejaría entrar a
     guardar creyendo que tiene Drive cuando el conectado es otro. */
  const hogarId = await miHogar(supabase, user.id)

  const admin = clienteServidor()
  const { data: conexion } = hogarId
    ? await admin
        .from('conexion_drive')
        .select('estado')
        .eq('hogar_id', hogarId)
        .maybeSingle()
    : { data: null }

  if (conexion?.estado !== 'activa') {
    const elJefe = hogarId ? await quienManda(supabase, hogarId) : null

    return (
      <main className="techo-holgado min-h-screen px-5 pb-12">
        <div className="mx-auto w-full max-w-md">
          <Volver href="/" />
          <h1 className="mt-8 text-[28px] font-extrabold leading-tight tracking-tight text-tinta">
            Todavía no se pueden guardar documentos
          </h1>
          {/* El nombre sale de la casa, no está escrito aquí: en la casa
              de al lado «Juan Miguel» es un desconocido. */}
          <p className="mt-5 text-lg leading-relaxed text-tinta-suave">
            {elJefe ?? 'Quien creó esta casa'} tiene que conectar su Google Drive
            antes de que los documentos tengan dónde guardarse.
          </p>
        </div>
      </main>
    )
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('es_propietario_drive')
    .eq('id', user.id)
    .maybeSingle()

  /*
    La carpeta de donde viene, si viene de una. Se comprueba que
    exista Y QUE SEA SUYA —la consulta va con la sesión, así que las
    políticas por hogar ya lo garantizan— antes de dársela al
    formulario: un identificador escrito a mano en la dirección no
    puede colar un documento en la carpeta de otra familia.
  */
  const lista = (categorias ?? []) as Categoria[]
  const enCarpeta = en && lista.some((c) => c.id === en) ? en : null

  return (
    <Formulario
      categorias={lista}
      esPropietario={Boolean(perfil?.es_propietario_drive)}
      enCarpeta={enCarpeta}
      /* La compra a la que engancharle este ticket, si se ha venido
         desde ahí. Sin comprobar aquí que existe: si no existe, el
         enganche falla en silencio y el documento se guarda igual —
         que es lo único que no puede fallar. */
      paraLista={laCompra ?? null}
    />
  )
}
