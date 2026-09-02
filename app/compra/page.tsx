import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../barra'
import Cabecera from '../cabecera'
import { Pastilla } from '../iconos'
import Pantalla, { type ListaCompra } from './lista'

export const dynamic = 'force-dynamic'

/*
  La compra.

  Es la nota de la nevera, y probablemente lo que más se va a usar de
  todo HUBI: un papel se guarda una vez por semana, la compra es todos
  los días.

  NO TIENE PESTAÑA PROPIA, y es a propósito. Cinco es el tope: con seis
  cada botón baja de los 48 px que protegen a un dedo de 75 años, y ese
  suelo no se negocia. Se entra desde la tarjeta del Inicio, que es
  donde va lo que de verdad se usa a diario.
*/
export default async function Compra() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre')

  /* Las secciones de esta familia: las carpetas raíz. Con ellas se
     etiqueta la compra —"para la finca"— y se agrupa la lista. */
  const { data: raices } = await supabase
    .from('categorias')
    .select('id, nombre, segmento_drive')
    .is('padre_id', null)
    .eq('activa', true)
    .order('orden')
  const nombres = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p.nombre]))

  /* Las listas vivas. Puede haber varias por categoría: la del lunes
     y la de fin de mes son dos compras distintas, con su día y su
     responsable cada una.

     Si la tabla todavía no existe —el SQL sin ejecutar— esto viene
     vacío y la pantalla funciona igual, con una sola lista. */
  const { data: listas } = await supabase
    .from('listas_compra')
    .select('id, nombre, seccion_id, fecha, hora, asignado_a')
    .is('archivada_en', null)
    .order('creada_en')

  /*
    ── LA COMPRA ──

    Y AQUÍ VOLVÍ A HACER LO MISMO. Es la tercera vez en este proyecto
    y merece quedar escrito con todas las letras.

    Añadí `lista_id` a las columnas que se piden. Si esa columna
    todavía no existe en la base de datos, Postgres NO devuelve las
    demás: rechaza la consulta entera. Y como aquí no se miraba el
    error, `data` venía vacío y la pantalla decía "La lista está
    vacía" — con la compra perfectamente guardada por debajo.

    Alguien apunta seis cosas, las ve desaparecer una detrás de otra y
    concluye, con toda la razón, que HUBI no guarda nada.

    LA REGLA, POR TERCERA VEZ: una columna nueva nunca puede ser
    obligatoria para lo que ya funcionaba. Se pide con ella; si la base
    la rechaza, se pide sin ella. Y el error se MIRA.
  */
  const columnas = 'id, que, cantidad, comprado, anadido_por, creado_en, seccion_id'

  type Fila = {
    id: string
    que: string
    cantidad: string | null
    comprado: boolean
    anadido_por: string
    seccion_id: string | null
    lista_id?: string | null
  }

  const primera = await supabase
    .from('compra')
    .select(`${columnas}, lista_id`)
    .is('archivado_en', null)
    .order('comprado', { ascending: true })
    .order('creado_en', { ascending: true })

  let data = primera.data as Fila[] | null
  let falloCompra = primera.error

  if (falloCompra) {
    console.error('[HUBI] La compra no ha cargado con lista_id:', falloCompra.message)
    const segunda = await supabase
      .from('compra')
      .select(columnas)
      .is('archivado_en', null)
      .order('comprado', { ascending: true })
      .order('creado_en', { ascending: true })

    data = segunda.data as Fila[] | null
    falloCompra = segunda.error
  }

  /*
    Lo que soléis comprar.

    Sale de lo ya archivado: si la leche ha entrado seis veces, no hay
    que volver a escribirla nunca. Es la misma idea que con los
    proveedores de las facturas — HUBI no se vuelve más listo porque le
    pongamos un modelo mejor, sino porque lo usáis.
  */
  const { data: historia } = await supabase
    .from('compra')
    .select('que')
    .not('archivado_en', 'is', null)
    .limit(600)

  const cuenta = new Map<string, number>()
  for (const h of historia ?? []) {
    const clave = h.que.trim().toLowerCase()
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
  }

  const enLista = new Set((data ?? []).map((c) => c.que.trim().toLowerCase()))
  const habituales = [...cuenta.entries()]
    .filter(([q, veces]) => veces >= 2 && !enLista.has(q))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([q]) => q.replace(/^\w/, (l) => l.toUpperCase()))

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <div className="flex h-14 items-center gap-3">
          <Pastilla nombre="bolsa" color="#0EA5E9" fondo="#E0F2FE" tam={44} icono={23} />
          <h1 className="text-[27px] font-extrabold tracking-tight">La compra</h1>
        </div>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-1">
        {/* Si ni siquiera así se pueden leer, SE DICE. Un "no hay
            nada" cuando lo que pasa es que no se ha podido leer es
            mentirle a alguien sobre sus propias cosas. */}
        {falloCompra && (
          <div className="mb-4 rounded-[20px] border border-coral bg-coral-suave px-4 py-4">
            <p className="text-[17px] font-extrabold text-coral">
              La compra no se ha podido leer
            </p>
            <p className="mt-1.5 text-[15.5px] font-semibold leading-snug text-tinta-suave">
              Lo apuntado sigue guardado. Esto es un fallo al leerlo.
            </p>
            <p className="mt-2 break-words rounded-[14px] bg-superficie px-3 py-2 text-[14px] font-semibold text-tinta-suave">
              {falloCompra.message}
            </p>
          </div>
        )}

        <Pantalla
          inicial={(data ?? []).map((c) => ({ ...c, lista_id: c.lista_id ?? null }))}
          nombres={nombres}
          yo={user.id}
          habituales={habituales}
          listas={(listas ?? []) as ListaCompra[]}
          secciones={(raices ?? []).map((r) => ({
            id: r.id,
            nombre: r.nombre,
            segmento: r.segmento_drive,
          }))}
        />
      </div>

      <Barra activa={null} />
    </main>
  )
}
