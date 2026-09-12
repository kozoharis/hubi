import Link from '@/app/enlace'
import { redirect, notFound } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { cuando, iconoDe, atrasado, type Recordatorio } from '@/lib/tablon'
import AccionHecho from './accion'
import Editar from './editar'
import EnLaCocina from './en-la-cocina'
import Barra from '../../barra'
import Encabezado from '../../encabezado'
import { Volver } from '../../iconos'
import type { Icono } from '../../iconos'
import { elEspacioO } from '@/lib/espacio'

export const dynamic = 'force-dynamic'

/*
  El mismo tipo que decide el emoji del móvil (`lib/tablon.ts`), dicho
  con los iconos dibujados de HUBI, que son los que entiende la banda.

  Se traduce aquí y no allí a propósito: `lib/tablon.ts` lo usan
  también la Agenda y el resumen del Inicio, y no tienen por qué
  conocer el juego de iconos de las pantallas.
*/
const ICONO_DE_BANDA: Record<string, Icono> = {
  farmacia: 'pastilla',
  cita: 'corazon',
  coche: 'coche',
  papeles: 'papel',
  vencimiento: 'reloj',
  recado: 'bolsa',
}

function iconoBanda(tipo: string): Icono {
  return ICONO_DE_BANDA[tipo] ?? 'check'
}

const CUANTO_ANTES: Record<string, string> = {
  sin_aviso: 'Sin aviso',
  '30_min': '30 minutos antes',
  '1_dia': 'Un día antes',
  '1_semana': 'Una semana antes',
  '1_mes': 'Un mes antes',
}

export default async function Detalle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const { data } = await supabase
    .from('recordatorios')
    .select(
      'id, titulo, tipo, asignado_a, creado_por, fecha, hora, estado, nota, documento_origen_id, aviso_previo, repite, repite_hasta, creado_en, hecho_en, hecho_por, visible_en_casa'
    )
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()

  const r = data as Recordatorio & {
    aviso_previo: string | null
    repite: string | null
    repite_hasta: string | null
    creado_en: string
    hecho_en: string | null
    hecho_por: string | null
    visible_en_casa: boolean | null
  }

  /*
    ¿Tiene esta casa una pantalla común?

    Si no la tiene, el interruptor de «se ve en la cocina» no se pinta:
    sería una decisión más en una pantalla, sobre un aparato que no
    existe. El día que se encienda una tablet, aparece solo.
  */
  const { data: pantallas } = await supabase
    .from('miembros')
    .select('perfil_id')
    .eq('hogar_id', await elEspacioO(supabase))
    .eq('clase', 'dispositivo')
    .limit(1)

  const hayPantalla = (pantallas ?? []).length > 0

  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre')
  const nombres = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p.nombre]))

  const { data: documento } = r.documento_origen_id
    ? await supabase
        .from('documentos')
        .select('id, titulo, tipo_mime')
        .eq('hogar_id', await elEspacioO(supabase))
        .eq('id', r.documento_origen_id)
        .maybeSingle()
    : { data: null }

  const hecho = r.estado === 'hecho'
  const tarde = atrasado(r)

  return (
    <main className="techo-holgado min-h-screen px-5 pb-40 lg:px-0 lg:pb-16">
      {/*
        ── LA BANDA ──

        Esta pantalla no tenía `Cabecera` —su título vive en el cuerpo y
        se va al deslizar—, así que la banda se pone suelta dentro de su
        propia `columna` en vez de envolver lo de siempre. En el móvil
        no se pinta (`Encabezado` es `hidden lg:block`), y por eso la
        ficha de abajo no se toca ni un píxel.

        Sin esto, ésta era la última pantalla de HUBI que en un
        ordenador seguía enseñando la cabecera del móvil: la flecha
        redonda de volver y el emoji a tamaño de pulgar.
      */}
      <div className="columna">
        <Encabezado
          icono={iconoBanda(r.tipo)}
          ambito="pizarra"
          titulo={r.titulo}
          pie={cuando(r.fecha, r.hora) + (tarde ? ' · sin hacer' : '')}
          volver="/tablon"
        />
      </div>

      {/*
        ── EN GRANDE, PEGADA A LA IZQUIERDA Y CON SU MEDIDA ──

        Esto NO se ensancha a mil cien píxeles, y es a propósito. Una
        ficha de tarea es un documento corto: título, cuándo, una nota y
        cuatro datos. Estirarla solo alarga el recorrido del ojo entre
        la etiqueta y el valor, y deja los botones de «Hecho» y
        «Cambiar» con el ancho de la pantalla entera — que es cuando un
        botón deja de parecer un botón y parece una franja de color.

        Lo que sí se arregla es la POSTURA: `columna` la pega a la
        izquierda en vez de centrarla, para que al pasar de la Agenda a
        una tarea el ojo no tenga que buscarla en otro sitio. Es la
        misma regla que las demás; lo que cambia es el ancho.
      */}
      <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-[560px] lg:px-9">
        {/* La cabecera del móvil, intacta. Arriba de 1024 px lo dice la
            banda, y sin este `lg:hidden` el título saldría dos veces. */}
        <div className="lg:hidden">
          <Volver href="/tablon" />

          <p className="mt-8 flex items-start gap-3">
            <span className="text-4xl leading-none">{iconoDe(r.tipo)}</span>
          </p>

          <h1
            className={`mt-4 text-[26px] font-extrabold leading-tight tracking-tight ${
              hecho ? 'text-tinta-suave line-through' : 'text-tinta'
            }`}
          >
            {r.titulo}
          </h1>

          {/* Algo que tenía que estar hecho y no lo está SÍ es una
              alerta: es de los pocos sitios donde el color dice lo que
              pasa y no de qué es. */}
          <p
            className="mt-3 text-xl"
            style={{ color: tarde ? 'var(--t-alerta)' : 'var(--t-tinta-suave)' }}
          >
            {cuando(r.fecha, r.hora)}
            {tarde && ' · sin hacer'}
          </p>
        </div>

        {/* ── La nota, entera ── */}
        {r.nota && (
          <section className="mt-8 rounded-[24px] bg-superficie p-7">
            <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-tenue">
              Nota
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-xl leading-relaxed text-tinta">
              {r.nota}
            </p>
          </section>
        )}

        {/* ── Todo lo demás ── */}
        <div className="mt-6 divide-y divide-borde rounded-[24px] bg-superficie px-7">
          <Dato
            etiqueta="Para quién"
            valor={r.asignado_a ? (nombres[r.asignado_a] ?? '') : 'Los dos'}
          />
          <Dato etiqueta="Lo apuntó" valor={nombres[r.creado_por] ?? ''} />
          <Dato etiqueta="Estado" valor={hecho ? 'Hecho' : 'Pendiente'} />
          {hecho && r.hecho_por && (
            <Dato etiqueta="Lo marcó" valor={nombres[r.hecho_por] ?? ''} />
          )}
          {/* Antes esto solo salía en los vencimientos, y el
              vencimiento solo se conseguía escribiendo «vence» o
              «caduca» en el título: el aviso era un dato que existía,
              se guardaba y no se podía ni ver ni poner. Ahora se
              enseña siempre que haya uno. */}
          {r.aviso_previo && r.aviso_previo !== 'sin_aviso' && (
            <Dato
              etiqueta="Aviso"
              valor={CUANTO_ANTES[r.aviso_previo] ?? 'Sin aviso'}
            />
          )}
        </div>

        {/* ── De dónde salió ── */}
        {documento && (
          <Link
            href={`/documentos/${documento.id}`}
            className="mt-6 flex items-center justify-between rounded-[20px] border-2 border-borde bg-superficie px-6 py-5"
          >
            <span className="text-lg text-tinta">
              Sale de un documento
              <span className="mt-1 block text-base text-tenue">{documento.titulo}</span>
            </span>
            <span className="text-verde">›</span>
          </Link>
        )}

        {hayPantalla && (
          <EnLaCocina id={r.id} inicial={r.visible_en_casa} />
        )}

        <div className="mt-10">
          <AccionHecho id={r.id} hecho={hecho} />

          {/* Cambiar y borrar, siempre a mano. Lo que no se puede
              corregir se deja mal, y una lista con cosas mal apuntadas
              deja de servir para nada. */}
          <Editar
            id={r.id}
            inicial={{
              titulo: r.titulo,
              asignado_a: r.asignado_a,
              fecha: r.fecha,
              hora: r.hora,
              nota: r.nota,
              repite: r.repite,
              repite_hasta: r.repite_hasta,
              aviso_previo: r.aviso_previo,
            }}
            personas={(perfiles ?? []) as { id: string; nombre: string }[]}
          />
        </div>
      </div>
      <Barra activa="agenda" />
    </main>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="py-5">
      <p className="text-sm uppercase tracking-[0.15em] text-tenue">{etiqueta}</p>
      <p className={`mt-1 text-xl leading-snug ${valor ? 'text-tinta' : 'text-tenue'}`}>
        {valor || '—'}
      </p>
    </div>
  )
}
