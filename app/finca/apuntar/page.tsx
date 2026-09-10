import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Apuntar from './formulario'
import { esImpuesto, type Impuesto } from '@/lib/impuesto'
import type { Categoria } from '@/lib/rutas'
import { elEspacio, elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  Apuntar a mano.

  Recibe de qué sección se apunta. Con la Finca sola daba igual —solo
  había una— pero desde que existe Los Helechos, enseñar las dos listas
  mezcladas obligaría a distinguir "Luz" (de la finca) de "Suministros"
  (de la casa) en una misma pantalla. Cada sección enseña lo suyo.

  ─────────────────────────────────────────────────────────────
  Y AQUÍ HABÍA DOS NOMBRES ESCRITOS A FUEGO

  Decía: «si pone HELECHOS es Los Helechos, y si no, la Finca». En la
  casa de Juan Miguel funcionaba; en la de cualquier otro, apuntar un
  gasto de sus obras acababa en las categorías de una finca que no
  tiene. Ahora el parámetro es el `segmento_drive` de la raíz, sea la
  que sea.

  Y admite uno más: `resto`, que son las cuentas de casa — todo lo que
  NO es una actividad. Ahí no hay una raíz sola: son la Casa, los
  Vehículos, los Seguros y lo Personal juntos.
*/
export default async function PaginaApuntar({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>
}) {
  const { seccion } = await searchParams
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const deCasa = seccion === 'resto'

  /* `lleva_cuentas` va en su propio intento: si el SQL 27 no está,
     pedirla no falla esa columna, hace que Postgres rechace la
     consulta entera y esta pantalla saldría sin ninguna categoría. */
  const campos = 'id, padre_id, nombre, segmento_drive, icono, orden, naturaleza'
  type Cat = Categoria & { lleva_cuentas?: boolean; usa_unidades?: boolean }

  let todas: Cat[] = []
  const conCuentas = await supabase
    .from('categorias')
    .select(`${campos}, lleva_cuentas, usa_unidades`)
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('activa', true)
    .order('orden')

  if (conCuentas.error) {
    const basico = await supabase
      .from('categorias')
      .select(campos)
      .eq('hogar_id', await elEspacioO(supabase))
      .eq('activa', true)
      .order('orden')
    todas = (basico.data ?? []) as Cat[]
  } else {
    todas = (conCuentas.data ?? []) as Cat[]
  }

  const porId = new Map(todas.map((c) => [c.id, c]))
  const conHijas = new Set(todas.map((c) => c.padre_id).filter(Boolean))

  function raizDe(c: Cat): Cat {
    let actual = c
    while (actual.padre_id) {
      const padre = porId.get(actual.padre_id)
      if (!padre) break
      actual = padre
    }
    return actual
  }

  const raiz = deCasa
    ? null
    : (todas.find((c) => c.segmento_drive === (seccion || 'FINCA') && !c.padre_id) ?? null)

  /*
    Solo las carpetas FINALES, y solo las que mueven dinero.

    Lo segundo es nuevo y hace falta aquí: en las cuentas de casa
    cuelgan carpetas que son papel puro —Garantías, Informes,
    Contratos—. Ofrecerlas para apuntar un gasto sería ofrecer un
    sitio donde el gasto no contaría después.
  */
  const opciones = todas.filter((c) => {
    if (conHijas.has(c.id)) return false
    /* Y lo de «solo las que mueven dinero» vale también DENTRO de una
       actividad. Desde que cada una tiene su carpeta de Documentos
       —Contratos, Seguros, Licencias—, ofrecerlas aquí sería ofrecer
       un sitio donde el gasto se guarda y luego no aparece en ningún
       balance, porque las 'neutro' no generan apunte a propósito. */
    if (c.naturaleza === 'neutro') return false
    const suRaiz = raizDe(c)
    if (deCasa) return suRaiz.lleva_cuentas !== true
    return suRaiz.id === raiz?.id
  })

  /* ¿Esta casa lleva IGIC o IVA? Envuelto: sin el SQL 46 se comporta
     como siempre y el formulario no enseña nada nuevo. */
  let impuesto: Impuesto = 'ninguno'
  try {
    const casa = await elEspacio(supabase)
    if (casa) {
      const { data: fila } = await supabase
        .from('hogares')
        .select('impuesto')
        .eq('id', casa)
        .maybeSingle()
      if (fila && esImpuesto(fila.impuesto)) impuesto = fila.impuesto
    }
  } catch {
    /* Como siempre: sin impuesto. */
  }

  return (
    <Apuntar
      categorias={opciones}
      impuesto={impuesto}
      nombre={deCasa ? 'Casa' : (raiz?.nombre ?? 'Finca')}
      volver={deCasa ? '/gastos' : raiz ? `/seccion/${raiz.id}` : '/'}
      /* Si la sección se reparte en unidades —los apartamentos de Los
         Helechos, las obras de un reformista— el formulario pregunta en
         cuál. Lo decide la base de datos; antes estaba escrito aquí que
         solo Los Helechos lo hacían. Las cuentas de casa nunca: una
         casa no se divide en nada. */
      conApartamentos={!deCasa && raiz?.usa_unidades === true}
      /* El mismo parámetro con el que se entró, para que «Apuntar otro»
         vuelva a ESTA sección y no a una escrita a mano. */
      seccion={seccion ?? null}
    />
  )
}
