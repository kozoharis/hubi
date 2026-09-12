import Link from '@/app/enlace'
import { redirect, notFound } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Anadir from "../../anadir"
import Barra from '../../../barra'
import Cabecera from '../../../cabecera'
import Encabezado from '../../../encabezado'
import { Ico, Volver } from '../../../iconos'
import { Aviso, PastillaAmbito, Vacio, seccionPintada } from '../../../piezas'
import { caminoDe, ramaDe, fechaCorta, type Categoria } from '@/lib/carpetas'
import { euros } from '@/lib/periodos'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

type Papel = {
  id: string
  titulo: string
  fecha_documento: string
  tipo_mime: string
  importe: number | null
  proveedor: string | null
  visibilidad: string
  categoria_id: string
  subido_por: string | null
}

export default async function Carpeta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ anio?: string; t?: string }>
}) {
  const { id } = await params
  const filtro = await searchParams

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const { data: cats } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, orden')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('activa', true)

  const todas = (cats ?? []) as Categoria[]
  const carpeta = todas.find((c) => c.id === id)
  if (!carpeta) notFound()

  const camino = caminoDe(todas, carpeta.id)
  const seccion = camino[0]
  const s = seccionPintada(seccion?.segmento_drive)
  const dentro = [...ramaDe(todas, carpeta.id)]

  let consulta = supabase
    .from('documentos')
    .select(
      /* Sin cruce con `perfiles`: desde que existen los hogares hay dos
         caminos para ir de un documento a una persona y la base de datos
         se niega a elegir, así que la consulta entera fallaba. Los
         nombres se piden aparte, abajo. */
      'id, titulo, fecha_documento, tipo_mime, importe, proveedor, visibilidad, categoria_id, subido_por'
    )
    .eq('hogar_id', await elEspacioO(supabase))
    .in('categoria_id', dentro)
    .order('fecha_documento', { ascending: false })
    .limit(200)

  if (filtro.anio && /^\d{4}$/.test(filtro.anio)) consulta = consulta.eq('anio', Number(filtro.anio))
  if (filtro.t && /^[1-4]$/.test(filtro.t)) consulta = consulta.eq('trimestre', Number(filtro.t))

  /* Si esto falla, SE DICE. Ignorando el error, la carpeta salía
     "vacía" — que es justo lo que se ve cuando de verdad no hay nada. */
  const { data, error: averia } = await consulta
  if (averia) console.error('[HUBI] Carpeta no ha podido cargar:', averia.message)
  const papeles = (data ?? []) as unknown as Papel[]

  /* Los nombres, en una consulta aparte y sin cruces. Si fallara, las
     tarjetas dirían "Guardó alguien" — y los papeles seguirían ahí. */
  const { data: gente } = await supabase.from('perfiles').select('id, nombre')
  const quienEs = new Map((gente ?? []).map((g) => [g.id as string, g.nombre as string]))

  const total = papeles.reduce((t, p) => t + (p.importe != null ? Number(p.importe) : 0), 0)
  const cuando =
    filtro.anio && filtro.t
      ? `T${filtro.t} ${filtro.anio}`
      : filtro.anio
        ? String(filtro.anio)
        : 'Todo'

  const volver = seccion
    ? `/documentos/seccion/${seccion.id}${filtro.anio ? `?anio=${filtro.anio}${filtro.t ? `&t=${filtro.t}` : ''}` : ''}`
    : '/documentos'

  return (
    <main className="min-h-screen pb-40 lg:pb-16">
      <Cabecera ancho>
        <div className="lg:hidden">
          <Volver href={volver} />
          <div className="mt-2.5 flex items-center gap-3">
            <PastillaAmbito icono={s.icono} ambito={s.ambito} />
            <div className="min-w-0">
              <h1 className="t-titulo truncate">{carpeta.nombre}</h1>
              <p className="t-apoyo">
                {cuando} · {papeles.length} {papeles.length === 1 ? 'papel' : 'papeles'}
                {total > 0 ? ` · ${euros(total)}` : ''}
              </p>
            </div>
          </div>
        </div>

        <Encabezado
          icono={s.icono}
          ambito={s.ambito}
          titulo={carpeta.nombre}
          pie={`${cuando} · ${papeles.length} ${papeles.length === 1 ? 'papel' : 'papeles'}${
            total > 0 ? ` · ${euros(total)}` : ''
          }`}
          volver={volver}
        />
      </Cabecera>

      <div className="columna">

        {averia ? (
          <div className="mt-6">
            <Aviso
              titulo="No se han podido leer los papeles de esta carpeta"
              explicacion="Siguen guardados. Esto es un fallo al leerlos, no una pérdida."
            />
          </div>
        ) : papeles.length === 0 ? (
          <div className="mt-6">
            <Vacio
              titulo="Aquí no hay nada guardado todavía"
              explicacion="Haz una foto y yo lo archivo en esta carpeta."
              accion={{
                texto: 'Guardar un papel',
                /* `en`, no `carpeta`: es el nombre que lee /guardar
                   (`app/guardar/page.tsx:18`). Con el otro, el papel
                   llegaba sin carpeta y había que volver a bajar a mano. */
                href: `/guardar?en=${carpeta.id}`,
                icono: 'foto',
              }}
            />
          </div>
        ) : (
          /* El contenido de una carpeta: a dos columnas en grande, que
             es para lo que se entra aquí — a encontrar uno entre
             muchos. */
          <ul className="mt-5 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:space-y-0">
            {papeles.map((p) => (
              <li key={p.id}>
                {/*
                  La hojita se queda: enseña de un vistazo si es una foto
                  o un PDF, y eso es información, no adorno. Lo que
                  cambia es su color, que ahora es el de ámbito.

                  Es la tercera manera de pintar una fila que hay en
                  Papeles. Unificarla con la Fila del sistema sería un
                  cambio visible, y eso es rediseño: queda anotado para
                  que lo decidas tú.
                */}
                <Link
                  href={`/documentos/${p.id}`}
                  className="flex items-start gap-3.5 rounded-[20px] border border-borde bg-superficie px-3.5 py-3"
                >
                  <Hoja ambito={s.ambito} pdf={p.tipo_mime === 'application/pdf'} />
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="t-cuerpo block font-extrabold leading-snug">{p.titulo}</span>
                    <span className="t-apoyo mt-1 block truncate">
                      {p.proveedor ? `${p.proveedor} · ` : ''}
                      {fechaCorta(p.fecha_documento)}
                    </span>
                    <span className="t-apoyo mt-1 flex items-center gap-1.5">
                      <Ico nombre={p.visibilidad === 'privado' ? 'candado' : 'gente'} tam={16} grosor={2} />
                      {p.visibilidad === 'privado'
                        ? 'Privado'
                        : `Guardó ${(p.subido_por && quienEs.get(p.subido_por)) ?? 'alguien'}`}
                    </span>
                  </span>
                  {p.importe != null && (
                    <span className="t-cuerpo shrink-0 pt-0.5 font-extrabold tabular-nums">
                      {euros(Number(p.importe))}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Anadir carpetaId={carpeta.id as string} />
      </div>

      <Barra activa="documentos" />
    </main>
  )
}

/** Una hojita de papel, para que la lista se lea de un vistazo. */
function Hoja({ ambito, pdf }: { ambito: string; pdf: boolean }) {
  return (
    <span className="flex h-[66px] w-[52px] shrink-0 flex-col gap-1 rounded-[9px] border border-borde bg-superficie px-[7px] pt-[9px]">
      <span className="h-[3px] rounded-sm" style={{ background: `var(--color-ambito-${ambito})` }} />
      <span className="h-[3px] w-[70%] rounded-sm bg-borde" />
      <span className="h-[3px] rounded-sm bg-borde" />
      <span className="h-[3px] w-[55%] rounded-sm bg-borde" />
      <span className="h-[3px] rounded-sm bg-borde" />
      <span className="mt-auto mb-[7px] text-[8px] font-extrabold tracking-wider text-tenue">
        {pdf ? 'PDF' : 'FOTO'}
      </span>
    </span>
  )
}
