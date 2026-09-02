import { notFound, redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { iconoDeEmoji } from '../../iconos'
import Cuentas from '../../cuentas'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  UNA SOLA PANTALLA DE CUENTAS, PARA TODAS LAS ACTIVIDADES
  ═══════════════════════════════════════════════════════════════

  Antes esto eran dos archivos —`app/finca/page.tsx` y
  `app/helechos/page.tsx`— que hacían exactamente lo mismo con otro
  nombre y otro color escritos a mano. Y ahí estaba el techo de HUBI:
  una familia podía crear la actividad «Obras» con sus categorías, sus
  unidades y sus carpetas en Drive… y no tendría ninguna pantalla
  donde verlas. Habría que escribir un archivo nuevo.

  O sea: HUBI necesitaba a un programador cada vez que alguien tenía
  una actividad que no habíamos previsto. Escribir ocho pantallas para
  ocho obras es el camino de no acabar nunca. Ésta es una que sirve
  para todas.

  ─────────────────────────────────────────────────────────────
  Y LA ETIQUETA SALE DE LA PALABRA DE LA SECCIÓN

  «el apartamento» → «Cada apartamento». «la obra» → «Cada obra».
  Nadie lee nunca la palabra «unidad», que es nuestra y no suya.
*/

export default async function Seccion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ vista?: string; ancla?: string }>
}) {
  const { id } = await params

  const supabase = await clienteSesion()
  if (!(await quien(supabase))) redirect('/entrar')

  /*
    Solo se piden las columnas nuevas dentro de su propio intento. Si
    el SQL 27 no se ha ejecutado, pedirlas haría fallar LA CONSULTA
    ENTERA —no la columna— y esta pantalla saldría como «no existe»
    aunque la sección esté ahí. Ya ha pasado tres veces en este
    proyecto y siempre cuesta media tarde encontrarlo.
  */
  const columnas = 'id, nombre, icono, segmento_drive, padre_id, activa'

  let fila: Record<string, unknown> | null = null

  const conColor = await supabase
    .from('categorias')
    .select(`${columnas}, color, fondo, lleva_cuentas, palabra_unidad`)
    .eq('id', id)
    .maybeSingle()

  if (conColor.error) {
    const basico = await supabase.from('categorias').select(columnas).eq('id', id).maybeSingle()
    fila = basico.data as Record<string, unknown> | null
  } else {
    fila = conColor.data as Record<string, unknown> | null
  }

  // Ni existe, ni es una raíz, ni está viva: no hay cuentas que enseñar.
  if (!fila || fila.padre_id || fila.activa === false) notFound()

  const palabra = (fila.palabra_unidad as string | null) ?? null

  return (
    <Cuentas
      seccion={{
        raiz: fila.segmento_drive as string,
        nombre: fila.nombre as string,
        icono: iconoDeEmoji(fila.icono as string | null),
        /* Sin color se pinta en gris. Es más honesto que inventarle
           uno que luego no case con nada del resto. */
        color: (fila.color as string) || '#64748B',
        fondo: (fila.fondo as string) || '#EEF2F7',
        ruta: `/seccion/${id}`,
        pestana: id,
        /* Ya no hace falta el respaldo de los tres apartamentos: si
           esta pantalla se está usando, las unidades existen. */
        apartamentos: false,
        etiquetaUnidades: palabra ? `Cada ${sinArticulo(palabra)}` : undefined,
      }}
      searchParams={searchParams}
    />
  )
}

/** «el apartamento» → «apartamento». */
function sinArticulo(palabra: string): string {
  return palabra.replace(/^(el|la|los|las)\s+/i, '').trim()
}
