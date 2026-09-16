import Link from '@/app/enlace'
import { Ico } from './iconos'
import { fechaBreve } from '@/lib/carpetas'
import { euros } from '@/lib/periodos'

/*
  ═══════════════════════════════════════════════════════════════
  EL PANEL DE UN PAPEL · la tercera zona, escrita una vez
  ═══════════════════════════════════════════════════════════════

  Lo usan dos pantallas y va a usarlo una tercera:

    PAPELES   la tabla de papeles, con el elegido al lado.
    CUENTAS   la tabla de movimientos, con el papel del movimiento
              elegido al lado — que es lo que permite poner el IVA que
              falta sin salir de la cuenta donde se ha visto que falta.

  Tenerlo en cada pantalla habría sido tres fichas parecidas que se
  van separando: una enseña el proveedor, otra no; una abre el original
  en otra pestaña, otra se lo lleva la pantalla. Y entonces el mismo
  papel se ve de tres maneras según por dónde se haya llegado, que es
  como se pierde la sensación de que es un solo producto.
*/

/*
  ═══════════════════════════════════════════════════════════════
  EL PAPEL ELEGIDO
  ═══════════════════════════════════════════════════════════════

  La tercera zona. Lo primero es la FOTO, no los datos: quien elige un
  recibo en la tabla lo que quiere es verlo, y a 480 px de ancho un
  recibo se lee sin ampliarlo. A 340 se intuye, que ya es más que
  abrirlo en otra pantalla para volver.

  Debajo, lo que la tabla no cabe: el proveedor, el vencimiento y
  dónde está guardado.

  ── LAS ACCIONES VAN AQUÍ Y NO EN LA CABECERA ──

  «Abrir el original» y «Ver todo» son acciones DEL PAPEL, no de la
  pantalla. La cabecera de Papeles tiene una sola acción —guardar
  uno— y meter ahí las de lo elegido haría que cambiara de contenido
  según lo que estuviera marcado abajo, que es como una banda de
  título deja de ser un sitio fijo.
*/
export default function ElPapel({
  papel,
  camino,
  cerrar,
}: {
  papel: {
    id: string
    titulo: string
    nombre_archivo: string | null
    tipo_mime: string | null
    proveedor: string | null
    fecha_documento: string | null
    importe: number | null
    fecha_vencimiento: string | null
    se_renueva: boolean | null
  }
  camino: string[]
  cerrar: string
}) {
  const esImagen = (papel.tipo_mime ?? '').startsWith('image/')
  const archivo = `/api/documentos/${papel.id}/archivo`

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="rotulo">El papel</span>
        <Link
          href={cerrar}
          scroll={false}
          aria-label="Cerrar"
          className="objetivo roza -mr-2 flex items-center justify-center rounded-full text-[22px] leading-none text-tenue"
        >
          ×
        </Link>
      </div>

      <div className="overflow-hidden rounded-[16px] border border-borde bg-superficie">
        {/*
          La foto abre el original en otra pestaña. `target="_blank"` a
          propósito: es un archivo, no una pantalla de MAPPEL, y
          llevárselo la pantalla entera obligaría a volver con la
          flecha del navegador para seguir revisando la tabla.
        */}
        <a href={archivo} target="_blank" rel="noreferrer" className="block">
          {esImagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={archivo}
              alt={papel.titulo}
              className="max-h-[300px] w-full object-contain monitor:max-h-[420px]"
            />
          ) : (
            <p className="flex items-center justify-center gap-2.5 px-4 py-12 text-center text-[15px] font-bold text-tinta-suave">
              <Ico nombre="papel" tam={22} grosor={2} />
              <span className="min-w-0 truncate">{papel.nombre_archivo ?? 'Archivo'}</span>
            </p>
          )}
        </a>

        <div className="border-t border-borde px-4 py-3.5">
          <p className="text-[16px] font-extrabold leading-snug">{papel.titulo}</p>
          {camino.length > 0 && (
            <p className="mt-1 truncate text-[13px] text-tenue">{camino.join(' › ')}</p>
          )}

          <dl className="mt-3 space-y-1.5 text-[14px]">
            {papel.proveedor && (
              <Renglonete etiqueta="Proveedor" valor={papel.proveedor} />
            )}
            {/* Un papel sin fecha existe: una foto de algo que no la
                lleva. Se dice «Sin fecha» en vez de dejar el renglón
                fuera, porque la ausencia también es un dato. */}
            <Renglonete
              etiqueta="Fecha"
              valor={papel.fecha_documento ? fechaBreve(papel.fecha_documento) : 'Sin fecha'}
            />
            {papel.importe != null && (
              <Renglonete etiqueta="Importe" valor={euros(Number(papel.importe))} fuerte />
            )}
            {papel.fecha_vencimiento && (
              <Renglonete
                etiqueta={papel.se_renueva ? 'Se renueva' : 'Vence'}
                valor={fechaBreve(papel.fecha_vencimiento)}
                tono="alerta"
              />
            )}
          </dl>

          <div className="mt-3.5 flex flex-wrap gap-2">
            <a
              href={archivo}
              target="_blank"
              rel="noreferrer"
              className="objetivo roza flex items-center gap-1.5 rounded-full border border-borde px-3.5 text-[13.5px] font-extrabold text-tinta"
            >
              <Ico nombre="ojo" tam={16} grosor={2.4} />
              Abrir el original
            </a>
            <Link
              href={`/documentos/${papel.id}`}
              className="objetivo roza flex items-center gap-1.5 rounded-full px-3 text-[13.5px] font-extrabold text-tinta-suave"
            >
              Ver todo
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Etiqueta a la izquierda, valor a la derecha. Nada más. */
function Renglonete({
  etiqueta,
  valor,
  fuerte = false,
  tono,
}: {
  etiqueta: string
  valor: string
  fuerte?: boolean
  tono?: 'alerta'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-tenue">{etiqueta}</dt>
      <dd
        className={
          'min-w-0 truncate text-right ' + (fuerte ? 'font-extrabold tabular-nums' : 'font-semibold')
        }
        style={tono === 'alerta' ? { color: 'var(--t-alerta)' } : undefined}
      >
        {valor}
      </dd>
    </div>
  )
}

