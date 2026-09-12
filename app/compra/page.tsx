import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../barra'
import Cabecera from '../cabecera'
import Encabezado from '../encabezado'
import { Aviso, PastillaAmbito } from '../piezas'
import Pantalla, { type Cerrada, type ListaCompra } from './lista'
import { elEspacioO } from '@/lib/espacio'

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
    .eq('hogar_id', await elEspacioO(supabase))
    .is('padre_id', null)
    .eq('activa', true)
    .order('orden')

  /*
    ── DÓNDE VA EL TICKET ──

    Al salir del súper tienes el papel en la mano y el móvil en la
    otra. Ése es el momento, y hasta ahora había que salir de la
    compra, entrar en Guardar documento y buscar la carpeta a mano:
    cuatro pasos para algo que se hace cada semana.

    Se resuelve aquí y no en el navegador porque la carpeta es
    distinta en cada casa. Se busca Casa → Compras → Alimentación, y
    si esa casa no tiene el desglose de Compras, la propia Compras.
    Si no hay ni eso, el botón no sale — mejor que no exista a que
    lleve a una carpeta inventada.
  */
  const { data: arbol } = await supabase
    .from('categorias')
    .select('id, padre_id, nombre, segmento_drive')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('activa', true)

  const cats = arbol ?? []
  const casa = cats.find((c) => c.segmento_drive === 'CASA' && !c.padre_id)
  const compras = casa ? cats.find((c) => c.padre_id === casa.id && c.segmento_drive === 'COMPRAS') : null
  const alimentacion = compras
    ? cats.find((c) => c.padre_id === compras.id && c.segmento_drive === 'ALIMENTACION')
    : null

  const ticketEn = alimentacion?.id ?? compras?.id ?? null
  const nombres = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p.nombre]))

  /* Las listas vivas. Puede haber varias por categoría: la del lunes
     y la de fin de mes son dos compras distintas, con su día y su
     responsable cada una.

     Si la tabla todavía no existe —el SQL sin ejecutar— esto viene
     vacío y la pantalla funciona igual, con una sola lista. */
  const { data: listas } = await supabase
    .from('listas_compra')
    .select('id, nombre, seccion_id, fecha, hora, asignado_a')
    .eq('hogar_id', await elEspacioO(supabase))
    .is('archivada_en', null)
    .order('creada_en')

  /*
    ── LAS COMPRAS QUE YA SE HICIERON ──

    Para poder recuperarlas: la de casa se repite casi igual todas las
    semanas, y volver a escribirla entera es trabajo inventado — y es
    donde se olvidan cosas, porque se escribe de memoria.

    Seis, no todas. Con el histórico entero esto sería una pantalla
    que hay que leer; con las seis últimas se contesta «la del lunes
    pasado» de un vistazo.

    Envuelto y con dos intentos: `cerrada_por` y `ticket_id` son del
    SQL 40, y si no está, Postgres rechaza la consulta ENTERA en vez
    de decir «esa columna no existe». La compra no puede dejar de
    funcionar porque falte una función nueva.
  */
  const anteriores: Cerrada[] = []

  try {
    const columnasC = 'id, nombre, seccion_id, archivada_en'
    const conTicket = await supabase
      .from('listas_compra')
      .select(`${columnasC}, ticket_id`)
      .eq('hogar_id', await elEspacioO(supabase))
      .not('archivada_en', 'is', null)
      .order('archivada_en', { ascending: false })
      .limit(6)

    const cerradas = conTicket.error
      ? (
          await supabase
            .from('listas_compra')
            .select(columnasC)
            .eq('hogar_id', await elEspacioO(supabase))
            .not('archivada_en', 'is', null)
            .order('archivada_en', { ascending: false })
            .limit(6)
        ).data
      : conTicket.data

    const ids = (cerradas ?? []).map((c) => c.id as string)

    /* Cuántas cosas llevaba cada una. De una vez para todas: con seis
       listas, una consulta por cada una serían seis viajes a la base
       de datos para pintar una fila de botones. */
    const cuantas = new Map<string, number>()
    if (ids.length > 0) {
      const { data: suyas } = await supabase
        .from('compra')
        .select('lista_id')
        .eq('hogar_id', await elEspacioO(supabase))
        .in('lista_id', ids)

      for (const c of suyas ?? []) {
        const k = c.lista_id as string
        cuantas.set(k, (cuantas.get(k) ?? 0) + 1)
      }
    }

    for (const c of cerradas ?? []) {
      anteriores.push({
        id: c.id as string,
        nombre: c.nombre as string,
        seccion_id: (c.seccion_id as string | null) ?? null,
        cerrada: (c.archivada_en as string | null) ?? null,
        cosas: cuantas.get(c.id as string) ?? 0,
        ticket_id: ((c as { ticket_id?: string | null }).ticket_id as string | null) ?? null,
      })
    }
  } catch {
    /* Sin la tabla o sin las columnas: no se ofrece recuperar nada y
       la compra sigue funcionando igual. */
  }

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
    .eq('hogar_id', await elEspacioO(supabase))
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
      .eq('hogar_id', await elEspacioO(supabase))
      .is('archivado_en', null)
      .order('comprado', { ascending: true })
      .order('creado_en', { ascending: true })

    data = segunda.data as Fila[] | null
    falloCompra = segunda.error
    if (falloCompra) {
      console.error('[HUBI] La compra tampoco ha cargado sin lista_id:', falloCompra.message)
    }
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
    .eq('hogar_id', await elEspacioO(supabase))
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
    <main className="min-h-screen pb-40 lg:pb-16">
      <Cabecera ancho>
        <div className="flex h-14 items-center gap-3 lg:hidden">
          {/* Era `#0EA5E9`, el cian que no está declarado en la
              paleta. La compra es de la casa, y la casa lleva arena. */}
          <PastillaAmbito icono="bolsa" ambito="arena" tam={44} />
          <h1 className="t-titulo">La compra</h1>
        </div>

        <Encabezado icono="bolsa" ambito="arena" titulo="La compra" volver="/dia" />
      </Cabecera>

      <div className="columna pt-1">
        {/*
          ── AQUÍ NO VA LA CAJA DE HUBI, Y ES A PROPÓSITO ──

          Se puso, y al probarla salió el motivo para quitarla: esta
          pantalla YA tiene su campo —«Leche, pan, huevos…»— y es mejor
          que HUBI para lo que se hace aquí. Apuntas tres cosas
          seguidas sin salir, sin esperar y sin confirmar nada.

          Poner encima la caja de HUBI sería volver a tener dos cajas
          haciendo la misma pregunta con dos motores distintos — que es
          exactamente lo que se acaba de quitar de Papeles. Una
          pantalla que ya resuelve lo suyo no necesita un asistente
          delante.

          HUBI sigue estando: el botón de voz de la barra de abajo.
        */}
        {/* Si ni siquiera así se pueden leer, SE DICE. Un "no hay
            nada" cuando lo que pasa es que no se ha podido leer es
            mentirle a alguien sobre sus propias cosas. */}
        {/* El motivo técnico va al registro del servidor, no a la
            pantalla: aquí solo hace ruido y asusta. */}
        {falloCompra && (
          <div className="mb-4">
            <Aviso
              titulo="La compra no se ha podido leer"
              explicacion="Lo apuntado sigue guardado. Esto es un fallo al leerlo, no una pérdida."
            />
          </div>
        )}

        <Pantalla
          inicial={(data ?? []).map((c) => ({ ...c, lista_id: c.lista_id ?? null }))}
          nombres={nombres}
          yo={user.id}
          habituales={habituales}
          listas={(listas ?? []) as ListaCompra[]}
          anteriores={anteriores}
          secciones={(raices ?? []).map((r) => ({
            id: r.id,
            nombre: r.nombre,
            segmento: r.segmento_drive,
          }))}
          ticketEn={ticketEn}
        />
      </div>

      <Barra activa="dia" />
    </main>
  )
}
