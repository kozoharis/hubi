import { redirect, notFound } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { euros } from '@/lib/periodos'
import { caminoDe, fechaLarga, type Categoria } from '@/lib/carpetas'
import { diaLimite } from '@/lib/vencimientos'
import Barra from '../../barra'
import Cabecera from '../../cabecera'
import { Ico, Volver } from '../../iconos'
import {
  Aviso,
  BotonPrincipal,
  BotonSecundario,
  Dato,
  Fila,
  PastillaAmbito,
  seccionPintada,
} from '../../piezas'

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
  const BASE =
    'id, titulo, tipo_mime, nombre_archivo, fecha_documento, fecha_vencimiento, importe, proveedor, texto_ocr, visibilidad, confianza_ocr, categoria_id, subido_por'

  /* Dos intentos: `se_renueva` y `preaviso_dias` son del SQL 43, y sin
     él Postgres rechazaría la consulta entera y esta pantalla diría «no
     se ha podido leer» sobre un papel que está perfectamente. */
  let { data, error: averia } = await supabase
    .from('documentos')
    .select(`${BASE}, se_renueva, preaviso_dias`)
    .eq('id', id)
    .maybeSingle()

  if (averia) {
    ;({ data, error: averia } = await supabase
      .from('documentos')
      .select(BASE)
      .eq('id', id)
      .maybeSingle())
  }

  if (averia) {
    console.error('[HUBI] No se ha podido leer el documento:', averia.message)
    return <NoSeHaPodido />
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
    se_renueva?: boolean | null
    preaviso_dias?: number | null
  }

  const { data: cats } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive, orden')
    .eq('activa', true)

  const todas = (cats ?? []) as Categoria[]
  const camino = caminoDe(todas, d.categoria_id)
  const seccion = camino[0]
  const { icono, ambito } = seccionPintada(seccion?.segmento_drive)

  /* Quién lo guardó, en su propia consulta. Si esto fallara, se queda
     sin poner ese nombre — y nada más. Antes se llevaba por delante el
     documento entero. */
  const { data: autor } = d.subido_por
    ? await supabase.from('perfiles').select('nombre').eq('id', d.subido_por).maybeSingle()
    : { data: null }

  /* El apunte de dinero, con su desglose si lo tiene. En dos intentos:
     las columnas del impuesto son del SQL 46 y no pueden hacer que
     desaparezca la línea de «cuenta como gasto», que lleva meses ahí. */
  const conDesglose = await supabase
    .from('movimientos')
    .select('id, tipo, importe, impuesto_tipo, impuesto_cuota')
    .eq('documento_id', id)
    .maybeSingle()

  const { data: movimiento } = conDesglose.error
    ? await supabase
        .from('movimientos')
        .select('id, tipo, importe')
        .eq('documento_id', id)
        .maybeSingle()
    : conDesglose

  const { data: recordatorio } = await supabase
    .from('recordatorios')
    .select('id, titulo, fecha, estado')
    .eq('documento_origen_id', id)
    .maybeSingle()

  const apunte = movimiento as {
    id: string
    tipo: string
    importe: number
    impuesto_tipo?: number | null
    impuesto_cuota?: number | null
  } | null

  const esImagen = d.tipo_mime.startsWith('image/')
  const enlace = `/api/documentos/${d.id}/archivo`
  const volver = camino.length > 1
    ? `/documentos/carpeta/${camino[camino.length - 1].id}`
    : '/documentos'

  return (
    <main className="min-h-screen pb-40">
      {/*
        EL TÍTULO SUBE A LA CABECERA.

        Vivía en el cuerpo, debajo de la foto, y desaparecía en cuanto
        se hacía scroll: se acababa mirando una ficha sin saber de qué
        papel era. En la pantalla de al lado —Corregir— sí estaba
        arriba, así que la misma zona hacía dos cosas distintas en
        pantallas contiguas.
      */}
      <Cabecera>
        <Volver href={volver} />
        <h1 className="t-titulo mt-2.5 line-clamp-2">{d.titulo}</h1>
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
          <PastillaAmbito icono={icono} ambito={ambito} tam={24} />
          <p className="rotulo truncate">
            {camino.map((c) => c.nombre.toUpperCase()).join(' › ')}
          </p>
        </div>

        {/* ── Sus datos ── */}
        <div className="mt-3.5 rounded-[20px] border border-borde bg-superficie px-4 pb-1">
          <Dato etiqueta="Proveedor" valor={d.proveedor} />
          <Dato etiqueta="Fecha" valor={fechaLarga(d.fecha_documento)} />
          {/* El importe iba pintado del color de la sección. Ahora es
              TINTA: un número no lleva color propio, y el color de
              ámbito no puede aparecer en una cifra. */}
          {d.importe != null && (
            <Dato etiqueta="Importe" valor={euros(Number(d.importe))} fuerte />
          )}
          {d.fecha_vencimiento && (
            <Dato
              etiqueta={d.se_renueva ? 'Se renueva' : 'Vence'}
              valor={fechaLarga(d.fecha_vencimiento)}
              tono="alerta"
            />
          )}
          {/*
            EL ÚLTIMO DÍA PARA CANCELARLO, EN SU PROPIA LÍNEA.

            Podría deducirse de las dos de arriba, y precisamente por eso
            va escrito: nadie resta treinta días de cabeza mirando la
            ficha de un contrato. Ésta es la fecha por la que se entra
            aquí, así que se dice, no se insinúa.
          */}
          {d.fecha_vencimiento && d.se_renueva && d.preaviso_dias ? (
            <Dato
              etiqueta="Último día para cancelarlo"
              valor={fechaLarga(diaLimite(d.fecha_vencimiento, d.preaviso_dias))}
              fuerte
              tono="alerta"
            />
          ) : null}
          <Dato etiqueta="Lo guardó" valor={autor?.nombre ?? null} />
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="t-apoyo shrink-0">Lo pueden ver</span>
            <span className="t-cuerpo flex items-center gap-1.5 font-extrabold">
              <Ico nombre={d.visibilidad === 'privado' ? 'candado' : 'gente'} tam={19} grosor={2} />
              {d.visibilidad === 'privado' ? 'Solo quien lo subió' : 'Los dos'}
            </span>
          </div>
        </div>

        {/* ── Qué acciones ha generado ── */}
        {movimiento && (
          <div className="mt-3">
          {/*
            ── DECÍA «EN LA FINCA» PASARA LO QUE PASARA ──

            Esta fila llevaba `href="/finca"` y el texto «en la Finca»
            escritos a mano, para CUALQUIER movimiento. Una factura de
            luz de la Casa decía que contaba en la Finca y llevaba
            allí.

            Y «la Finca» es el nombre de una actividad de UNA casa: en
            la de al lado ese texto nombra algo que no existe y esa
            dirección no lleva a ninguna parte.

            La sección ya estaba calculada aquí arriba —es la raíz del
            camino del papel—, así que solo había que usarla. Y de paso
            va con SU color, no con el violeta fijo de antes.
          */}
          <Fila href={seccion ? `/seccion/${seccion.id}` : '/cuentas'} ambito={ambito}>
            <PastillaAmbito icono="euro" ambito={ambito} tam={40} />
            <span className="min-w-0 flex-1">
              <span className="t-cuerpo block font-extrabold">
                {movimiento.tipo === 'gasto' ? 'Cuenta como gasto' : 'Cuenta como ingreso'}
              </span>
              <span className="t-apoyo block">
                {euros(Number(movimiento.importe))}
                {seccion ? ` en ${seccion.nombre}` : ''}
              </span>
              {/*
                ── Y CÓMO SE REPARTE ──

                Faltaba esto, y por eso parecía que HUBI «no separaba el
                IGIC»: lo separaba y lo guardaba, pero no lo enseñaba en
                ningún sitio. Un dato que existe y no se ve, para quien
                mira la pantalla no existe.

                La base va primero y el impuesto detrás, como en la
                propia factura, para poder comparar de un vistazo con el
                papel que se tiene delante.
              */}
              {apunte?.impuesto_cuota != null && (
                <span className="mt-0.5 block text-[15px] font-extrabold text-tinta-suave">
                  Base {euros(Number(apunte.importe) - Number(apunte.impuesto_cuota))}
                  {' · '}
                  {apunte.impuesto_tipo != null
                    ? `${String(apunte.impuesto_tipo).replace('.', ',')}%`
                    : 'impuesto'}{' '}
                  {euros(Number(apunte.impuesto_cuota))}
                </span>
              )}
            </span>
            <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
          </Fila>
          </div>
        )}

        {recordatorio && (
          <div className="mt-2.5">
          <Fila href={`/tablon/${recordatorio.id}`}>
            <PastillaAmbito icono="campana" ambito="arena" tam={40} />
            <span className="min-w-0 flex-1">
              <span className="t-cuerpo block font-extrabold">Tiene un aviso</span>
              <span className="t-apoyo block truncate">{recordatorio.titulo}</span>
            </span>
            <Ico nombre="flecha" tam={22} grosor={2.2} className="shrink-0 text-apagado" />
          </Fila>
          </div>
        )}

        {/* ── Ver el papel ── */}
        {/*
          Era `bg-verde` con texto BLANCO, 62 px de alto y radio 18.
          Ahora es el botón principal del sistema, con `externo` porque
          abre el archivo en otra pestaña en vez de navegar dentro de
          HUBI — que es la razón por la que en la primera migración
          tuve que repetir sus estilos a mano.
        */}
        <div className="mt-4">
          <BotonPrincipal href={enlace} externo icono="ojo">
            Ver el papel
          </BotonPrincipal>
        </div>

        {/*
          CORREGIR.

          Discreto pero SIEMPRE a la vista, nunca escondido detrás de
          un gesto ni de tres puntitos. Es la salida cuando la foto se
          archivó donde no era o se leyó mal el importe: hasta ahora la
          única forma de arreglarlo era volver a fotografiar el papel y
          quedarse con dos copias en Drive.
        */}
        <div className="mt-2.5">
          <BotonSecundario href={`/documentos/${d.id}/editar`} icono="lapiz">
            Corregir o borrar
          </BotonSecundario>
        </div>

        {/* ── Lo que se leyó ── */}
        {d.texto_ocr && (
          <details className="mt-3 rounded-[20px] border border-borde bg-superficie px-4 py-3.5">
            <summary className="t-cuerpo cursor-pointer font-extrabold text-tinta-suave">
              Ver el texto leído del papel
            </summary>
            <p className="t-apoyo mt-3 whitespace-pre-wrap text-tinta-suave">
              {d.texto_ocr}
            </p>
            {d.confianza_ocr === 'baja' && (
              <p className="t-apoyo mt-3" style={{ color: 'var(--t-alerta)' }}>
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

/*
  Cuando el documento no se puede leer.

  No es un 404. El papel existe; lo que ha fallado es leerlo. Decir
  "no existe" sobre algo que sí está guardado es la peor respuesta
  posible: hace pensar que se ha perdido.
*/
function NoSeHaPodido() {
  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href="/documentos" />
        <h1 className="t-titulo mt-2.5">No se ha podido abrir</h1>
      </Cabecera>
      <div className="mx-auto w-full max-w-md px-5">
        {/* El motivo técnico va al registro del servidor, arriba. Aquí
            lo único que hace falta saber es que el papel no se ha
            perdido — eso es lo que preocupa. */}
        <Aviso
          titulo="No se ha podido abrir este papel"
          explicacion="Sigue guardado, no se ha perdido nada. Es un fallo al leerlo. Vuelve a intentarlo en un momento."
        />
      </div>
      <Barra activa="documentos" />
    </main>
  )
}
