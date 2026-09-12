import { redirect, notFound } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../../../barra'
import Cabecera from '../../../cabecera'
import { Volver } from '../../../iconos'
import { Aviso } from '../../../piezas'
import type { Categoria } from '@/lib/carpetas'
import Corregir, { type Papel } from './formulario'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  Corregir un papel guardado.

  Faltaba desde el principio, y era de las cosas que más falta hacían:
  una foto mal clasificada, con el comercio mal leído o el importe
  equivocado, se quedaba así para siempre. La única salida era volver a
  fotografiarla — y quedarse con el papel DUPLICADO en Drive, que es
  peor que el problema.

  Sin cruces de tablas: el documento por un lado, las carpetas por
  otro. Ya sabemos cómo acaba lo otro.
*/
export default async function EditarDocumento({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  /*
    DOS INTENTOS, Y NO ES DESCONFIANZA: ES EXPERIENCIA.

    `se_renueva`, `preaviso_dias` y `avisar_con` son del SQL 43
    (`fecha_vencimiento` ya existía). Si todavía no se ha ejecutado,
    Postgres no falla solo por esas tres: rechaza la consulta entera, y esta pantalla —que sí mira el
    error— enseñaría «no se ha podido abrir» sobre un papel que está
    perfectamente. Ya nos ha pasado tres veces en este proyecto.

    Sin las columnas se corrige todo lo demás igual que ayer, y el
    bloque del vencimiento sale vacío.
  */
  const BASE =
    'id, titulo, proveedor, fecha_documento, importe, categoria_id, fecha_vencimiento'

  let { data, error } = await supabase
    .from('documentos')
    .select(`${BASE}, se_renueva, preaviso_dias, avisar_con`)
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('id', id)
    .maybeSingle()

  if (error) {
    ;({ data, error } = await supabase
      .from('documentos')
      .select(BASE)
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('id', id)
      .maybeSingle())
  }

  if (error) {
    console.error('[HUBI] No se ha podido abrir para corregir:', error.message)
    return (
      <main className="min-h-screen pb-40">
        <Cabecera formulario>
          <Volver href={`/documentos/${id}`} />
          <h1 className="t-titulo mt-2.5">No se ha podido abrir</h1>
        </Cabecera>
        <div className="columna-formulario">
          {/* El motivo técnico va al registro del servidor, arriba.
              Y faltaba la frase que sí importa: que no se ha perdido. */}
          <Aviso
            titulo="No se ha podido abrir este papel"
            explicacion="Sigue guardado, no se ha perdido nada. Es un fallo al leerlo. Vuelve a intentarlo en un momento."
          />
        </div>
        <Barra activa="documentos" />
      </main>
    )
  }

  if (!data) notFound()

  const { data: cats } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, orden')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('activa', true)

  return (
    <main className="min-h-screen pb-40">
      <Cabecera formulario>
        <Volver href={`/documentos/${id}`} />
        <h1 className="t-titulo mt-2.5">Corregir</h1>
      </Cabecera>

      <div className="columna-formulario">
        <Corregir papel={data as Papel} categorias={(cats ?? []) as Categoria[]} />
      </div>

      <Barra activa="documentos" />
    </main>
  )
}
