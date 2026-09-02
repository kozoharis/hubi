import { redirect, notFound } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../../../barra'
import Cabecera from '../../../cabecera'
import { Volver } from '../../../iconos'
import type { Categoria } from '@/lib/carpetas'
import Corregir, { type Papel } from './formulario'

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

  const { data, error } = await supabase
    .from('documentos')
    .select('id, titulo, proveedor, fecha_documento, importe, categoria_id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[HUBI] No se ha podido abrir para corregir:', error.message)
    return (
      <main className="min-h-screen pb-40">
        <Cabecera>
          <Volver href={`/documentos/${id}`} texto="Volver" />
        </Cabecera>
        <div className="mx-auto w-full max-w-md px-5">
          <div className="rounded-[22px] border border-coral bg-coral-suave px-5 py-6">
            <h1 className="text-[22px] font-extrabold text-coral">
              No se ha podido abrir
            </h1>
            <p className="mt-2 break-words rounded-[14px] bg-superficie px-3 py-2.5 text-[14px] font-semibold text-tinta-suave">
              {error.message}
            </p>
          </div>
        </div>
        <Barra activa="documentos" />
      </main>
    )
  }

  if (!data) notFound()

  const { data: cats } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, orden')
    .eq('activa', true)

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href={`/documentos/${id}`} texto="Volver al papel" />
        <h1 className="text-[27px] font-extrabold tracking-tight">Corregir</h1>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5">
        <Corregir papel={data as Papel} categorias={(cats ?? []) as Categoria[]} />
      </div>

      <Barra activa="documentos" />
    </main>
  )
}
