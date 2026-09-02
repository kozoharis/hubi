import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { euros } from '@/lib/periodos'
import { caminoDe, fechaLarga, type Categoria } from '@/lib/carpetas'
import Barra from '../../barra'
import Cabecera from '../../cabecera'
import { Ico, Pastilla, Volver, seccionDe } from '../../iconos'

export const dynamic = 'force-dynamic'

export default async function Documento({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  /*
    SIN CRUCES. Y ÉSA ES LA CORRECCIÓN.

    Esta consulta pedía, de una sola vez, el documento MÁS el nombre de
    su carpeta MÁS el nombre de quien lo subió, dejando que la base de
    datos resolviera sola por dónde ir a buscarlos.

    Eso funcionó hasta que aparecieron los hogares. Desde entonces hay
    dos caminos posibles para ir de un documento a una persona —el de
    siempre, y el que pasa por `miembros`— y ante dos caminos la base
    de datos no elige: devuelve error. La consulta entera se caía por
    culpa de un nombre que aquí solo sirve para pintar una línea.

    Ahora se piden por separado. Son dos consultas más, insignificantes
    para dos usuarios, y a cambio ninguna puede volverse ambigua
    mañana por una tabla que añadamos pasado.

    Y ojo al `notFound()` de antes: si la consulta fallaba, `data`
    venía vacío y esta pantalla contestaba 404 — "este documento no
    existe"— sobre un documento que estaba perfectamente guardado. Un
    error de lectura no puede disfrazarse de documento inexistente.
  */
  const { data, error: averia } = await supabase
    .from('documentos')
    .select(
      'id, titulo, tipo_mime, nombre_archivo, fecha_documento, fecha_vencimiento, importe, proveedor, texto_ocr, visibilidad, confianza_ocr, categoria_id, subido_por'
    )
    .eq('id', id)
    .maybeSingle()

  if (averia) {
    console.error('[HUBI] No se ha podido leer el documento:', averia.message)
    return <NoSeHaPodido motivo={averia.message} />
  }
  if (!data) notFound()

  const d = data as unknown as {
    id: string
    titulo: string
    tipo_mime: string
    nombre_archivo: string
    fecha_documento: string
    fecha_vencimiento: string | null
    importe: number | null
    proveedor: string | null
    texto_ocr: string | null
    visibilidad: string
    confianza_ocr: string | null
    categoria_id: string
    subido_por: string | null
  }

  const { data: cats } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, orden')
    .eq('activa', true)

  const todas = (cats ?? []) as Categoria[]
  const camino = caminoDe(todas, d.categoria_id)
  const seccion = camino[0]
  const s = seccionDe(seccion?.segmento_drive)

  /* Quién lo guardó, en su propia consulta. Si esto fallara, se queda
     sin poner ese nombre — y nada más. Antes se llevaba por delante el
     documento entero. */
  const { data: autor } = d.subido_por
    ? await supabase.from('perfiles').select('nombre').eq('id', d.subido_por).maybeSingle()
    : { data: null }

  const [{ data: movimiento }, { data: recordatorio }] = await Promise.all([
    supabase.from('movimientos').select('id, tipo, importe').eq('documento_id', id).maybeSingle(),
    supabase
      .from('recordatorios')
      .select('id, titulo, fecha, estado')
      .eq('documento_origen_id', id)
      .maybeSingle(),
  ])

  const esImagen = d.tipo_mime.startsWith('image/')
  const enlace = `/api/documentos/${d.id}/archivo`
  const volver = camino.length > 1
    ? `/documentos/carpeta/${camino[camino.length - 1].id}`
    : '/documentos'

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver
          href={volver}
          texto={camino.length > 1 ? camino[camino.length - 1].nombre : 'Documentos'}
        />
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5">

        {/* ── El papel ── */}
        <a
          href={enlace}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-[20px] border border-borde bg-superficie"
        >
          {esImagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={enlace} alt={d.titulo} className="max-h-72 w-full object-contain" />
          ) : (
            <p className="flex items-center justify-center gap-3 px-6 py-14 text-[17px] font-bold text-tinta-suave">
              <Ico nombre="papel" tam={24} grosor={2} />
              {d.nombre_archivo}
            </p>
          )}
        </a>

        {/* ── Dónde está ── */}
        <div className="mt-4 flex items-center gap-2">
          <Pastilla nombre={s.icono} color={s.color} fondo={s.fondo} tam={24} icono={14} redondez={7} />
          <p className="text-[13.5px] font-extrabold tracking-wider text-tenue">
            {camino.map((c) => c.nombre.toUpperCase()).join(' › ')}
          </p>
        </div>

        <h1 className="mt-1.5 text-[27px] font-extrabold leading-tight tracking-tight">
          {d.titulo}
        </h1>

        {/* ── Sus datos ── */}
        <div className="mt-3.5 rounded-[20px] border border-borde bg-superficie px-4 pb-1">
          <Dato etiqueta="Proveedor" valor={d.proveedor} />
          <Dato etiqueta="Fecha" valor={fechaLarga(d.fecha_documento)} />
          {d.importe != null && (
            <Dato etiqueta="Importe" valor={euros(Number(d.importe))} fuerte color={s.color} />
          )}
          {d.fecha_vencimiento && (
            <Dato etiqueta="Vence" valor={fechaLarga(d.fecha_vencimiento)} color="#FF6B6B" />
          )}
          <Dato etiqueta="Lo guardó" valor={autor?.nombre ?? null} />
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-[15px] font-bold text-tenue">Lo pueden ver</span>
            <span className="flex items-center gap-1.5 text-[16.5px] font-bold">
              <Ico nombre={d.visibilidad === 'privado' ? 'candado' : 'gente'} tam={19} grosor={2} />
              {d.visibilidad === 'privado' ? 'Solo quien lo subió' : 'Los dos'}
            </span>
          </div>
        </div>

        {/* ── Qué acciones ha generado ── */}
        {movimiento && (
          <Link
            href="/finca"
            className="mt-3 flex items-center gap-3.5 rounded-[18px] border border-borde bg-superficie px-4 py-3"
          >
            <Pastilla nombre="euro" color="#8B5CF6" fondo="#EEE8FE" tam={40} icono={21} redondez={12} />
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold">
                {movimiento.tipo === 'gasto' ? 'Cuenta como gasto' : 'Cuenta como ingreso'}
              </span>
              <span className="text-[14.5px] font-semibold text-tenue">
                {euros(Number(movimiento.importe))} en la Finca
              </span>
            </span>
            <Ico nombre="flecha" tam={19} grosor={2.2} className="shrink-0 text-borde" />
          </Link>
        )}

        {recordatorio && (
          <Link
            href={`/tablon/${recordatorio.id}`}
            className="mt-2.5 flex items-center gap-3.5 rounded-[18px] border border-borde bg-superficie px-4 py-3"
          >
            <Pastilla nombre="campana" color="#F59E0B" fondo="#FEF1DC" tam={40} icono={21} redondez={12} />
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold">Tiene un aviso</span>
              <span className="block truncate text-[14.5px] font-semibold text-tenue">
                {recordatorio.titulo}
              </span>
            </span>
            <Ico nombre="flecha" tam={19} grosor={2.2} className="shrink-0 text-borde" />
          </Link>
        )}

        {/* ── Ver el papel ── */}
        <a
          href={enlace}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex h-[62px] items-center justify-center gap-2.5 rounded-[18px] bg-verde text-[18px] font-extrabold text-white"
        >
          <Ico nombre="ojo" tam={22} grosor={2.1} />
          Ver el papel
        </a>

        {/*
          CORREGIR.

          Discreto pero SIEMPRE a la vista, nunca escondido detrás de
          un gesto ni de tres puntitos. Es la salida cuando la foto se
          archivó donde no era o se leyó mal el importe: hasta ahora la
          única forma de arreglarlo era volver a fotografiar el papel y
          quedarse con dos copias en Drive.
        */}
        <Link
          href={`/documentos/${d.id}/editar`}
          className="mt-2.5 flex h-[56px] items-center justify-center gap-2.5 rounded-[18px] border border-borde bg-superficie text-[17px] font-extrabold text-tinta"
        >
          <Ico nombre="lapiz" tam={20} grosor={2.2} />
          Corregir o borrar
        </Link>

        {/* ── Lo que se leyó ── */}
        {d.texto_ocr && (
          <details className="mt-3 rounded-[18px] border border-borde bg-superficie px-4 py-3.5">
            <summary className="cursor-pointer text-[16.5px] font-bold text-tinta-suave">
              Ver el texto leído del papel
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-[15.5px] leading-relaxed text-tinta-suave">
              {d.texto_ocr}
            </p>
            {d.confianza_ocr === 'baja' && (
              <p className="mt-3 text-[15px] font-semibold text-coral">
                La lectura de este documento no fue del todo clara.
              </p>
            )}
          </details>
        )}
      </div>

      <Barra activa="documentos" />
    </main>
  )
}

function Dato({
  etiqueta,
  valor,
  fuerte = false,
  color,
}: {
  etiqueta: string
  valor: string | null
  fuerte?: boolean
  color?: string
}) {
  if (!valor) return null
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-borde py-3">
      <span className="shrink-0 text-[15px] font-bold text-tenue">{etiqueta}</span>
      <span
        className={`text-right ${fuerte ? 'text-[18px] font-extrabold' : 'text-[16.5px] font-bold'}`}
        style={color ? { color } : undefined}
      >
        {valor}
      </span>
    </div>
  )
}

/*
  Cuando el documento no se puede leer.

  No es un 404. El papel existe; lo que ha fallado es leerlo. Decir
  "no existe" sobre algo que sí está guardado es la peor respuesta
  posible: hace pensar que se ha perdido.
*/
function NoSeHaPodido({ motivo }: { motivo: string }) {
  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href="/documentos" texto="Documentos" />
      </Cabecera>
      <div className="mx-auto w-full max-w-md px-5">
        <div className="rounded-[22px] border border-coral bg-coral-suave px-5 py-6">
          <h1 className="text-[22px] font-extrabold text-coral">
            No se ha podido abrir este papel
          </h1>
          <p className="mt-2 text-[16.5px] font-semibold leading-snug text-tinta-suave">
            Sigue guardado, no se ha perdido nada. Es un fallo al leerlo.
          </p>
          <p className="mt-3 break-words rounded-[14px] bg-superficie px-3 py-2.5 text-[14px] font-semibold text-tinta-suave">
            {motivo}
          </p>
        </div>
      </div>
      <Barra activa="documentos" />
    </main>
  )
}
