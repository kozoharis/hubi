import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import Barra from '../barra'
import Cabecera from '../cabecera'
import { Volver } from '../iconos'
import { miHogar } from '@/lib/hogar'
import { genteDeLaCasa, elAsesor, type Quien } from '@/lib/gente'
import { cuandoSePuso } from '@/lib/notas'
import Hilo, { type Cosa } from './hilo'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  LO DE TU ASESOR
  ═══════════════════════════════════════════════════════════════

  Todo lo que os habéis dejado el uno al otro, en un sitio.

  ─────────────────────────────────────────────────────────────
  POR QUÉ UNA PANTALLA Y NO UN FILTRO DE LAS NOTAS

  Porque no es lo mismo. El corcho es la nevera de casa: «he dejado
  los papeles en la mesa», «el del agua viene los martes». Lo del
  asesor es otra conversación entera —«falta la factura de
  septiembre», «el día 20 hay un pago»— y mezclarlas hace las dos
  peores: los recados de casa se pierden entre requerimientos, y lo
  del gestor se pierde entre recados.

  Y sobre todo: esto hay que poder CONTESTARLO. Un filtro del corcho
  te enseña lo suyo; una pantalla suya te deja responderle sin pensar
  a quién se lo estás mandando.

  ─────────────────────────────────────────────────────────────
  LA MISMA PANTALLA POR LOS DOS LADOS

  La familia entra y ve «Silvia». Silvia entra y ve el nombre de la
  casa. Es la misma lista y el mismo sitio para escribir: dos
  pantallas distintas serían dos sitios donde buscar la misma
  conversación.

  Y no hay nada nuevo debajo: son las notas y los recordatorios de
  siempre, filtrados por quién los dejó. Una tabla más para esto
  habría sido una tabla más que proteger, que mantener y que
  sincronizar con la agenda.
*/

export default async function DelAsesor() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const hogarId = await miHogar(supabase, user.id)
  if (!hogarId) redirect('/empezar')

  const gente = await genteDeLaCasa(supabase, hogarId)
  const yo = gente.find((g) => g.id === user.id)
  const soyElAsesor = yo?.rol === 'asesor'

  /*
    CON QUIÉN ES ESTA CONVERSACIÓN.

    Si soy de la familia, con el asesor. Si soy el asesor, con quien
    creó la casa —que es quien le contrató y con quien se entiende.
  */
  let elOtro: Quien | null = null

  if (soyElAsesor) {
    /* Por identificador y no por nombre: `quienManda` devuelve el
       nombre de pila y comparar «Juan» con «Juan Miguel Nazco» no
       encuentra a nadie. */
    const { data: jefe } = await supabase
      .from('miembros')
      .select('perfil_id')
      .eq('hogar_id', hogarId)
      .eq('papel', 'propietario')
      .limit(1)
      .maybeSingle()

    elOtro =
      gente.find((g) => g.id === jefe?.perfil_id) ??
      gente.find((g) => g.id !== user.id && g.rol !== 'asesor') ??
      null
  } else {
    elOtro = elAsesor(gente)
  }

  /* Sin la otra parte no hay conversación. Se vuelve al Inicio en vez
     de enseñar una pantalla vacía que no explica nada. */
  if (!elOtro) redirect('/')

  const suyo = elOtro

  /*
    ── Lo que os habéis dejado ──

    Las notas entre los dos y las tareas que ha puesto él. Las dos
    consultas a la vez: son independientes y ponerlas en fila serían
    dos esperas donde basta una.

    Envueltas: si falta el SQL 35 la tabla `notas` no existe, y esta
    pantalla tiene que seguir enseñando al menos las tareas.
  */
  const cosas: Cosa[] = []

  const [notas, tareas] = await Promise.all([
    supabase
      .from('notas')
      .select('id, texto, para, escrita_por, creada_en, vista_en')
      .is('guardada_en', null)
      .or(`escrita_por.eq.${suyo.id},para.eq.${suyo.id}`)
      .order('creada_en', { ascending: false })
      .limit(60)
      .then(
        (r) => r,
        () => ({ data: null })
      ),

    supabase
      .from('recordatorios')
      .select('id, titulo, fecha, hora, estado, creado_por, creado_en, nota')
      .eq('creado_por', suyo.id)
      .order('fecha', { ascending: false })
      .limit(40)
      .then(
        (r) => r,
        () => ({ data: null })
      ),
  ])

  for (const n of (notas?.data ?? []) as {
    id: string
    texto: string
    para: string | null
    escrita_por: string
    creada_en: string
    vista_en: string | null
  }[]) {
    cosas.push({
      clase: 'nota',
      id: n.id,
      texto: n.texto,
      /* De él o mía: decide de qué lado de la pantalla se pinta y de
         qué color va. */
      suya: n.escrita_por === suyo.id,
      cuando: cuandoSePuso(n.creada_en),
      orden: n.creada_en,
      vista: Boolean(n.vista_en),
      fecha: null,
      hecha: false,
    })
  }

  for (const t of (tareas?.data ?? []) as {
    id: string
    titulo: string
    fecha: string | null
    hora: string | null
    estado: string
    creado_en: string
    nota: string | null
  }[]) {
    cosas.push({
      clase: 'tarea',
      id: t.id,
      texto: t.titulo,
      suya: true,
      cuando: cuandoSePuso(t.creado_en),
      orden: t.creado_en,
      vista: true,
      fecha: t.fecha,
      hecha: t.estado === 'hecho',
    })
  }

  /* Lo último arriba. Se ordena aquí y no en la base de datos porque
     son dos tablas: pedirle a Postgres que las mezcle sería una vista
     nueva para ahorrar una línea. */
  cosas.sort((a, b) => (a.orden < b.orden ? 1 : -1))

  /* Cómo se llama esto para quien lo mira. */
  let laCasa = 'la familia'
  try {
    const { data } = await supabase
      .from('hogares')
      .select('nombre')
      .eq('id', hogarId)
      .maybeSingle()
    if (data?.nombre) laCasa = data.nombre as string
  } catch {
    /* Sin nombre de casa, «la familia» sirve igual. */
  }

  const titulo = soyElAsesor ? laCasa : suyo.nombre.split(' ')[0]

  return (
    <main className="min-h-screen pb-40">
      <Cabecera>
        <Volver href="/" />
        <div className="flex h-14 items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold text-white"
            style={{ background: suyo.color }}
          >
            {titulo.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <h1 className="truncate text-[25px] font-extrabold leading-tight tracking-tight">
              {titulo}
            </h1>
            <p className="text-[14.5px] font-bold text-tenue">
              {soyElAsesor ? 'Lo que les dejas y lo que te piden' : 'Tu asesor'}
            </p>
          </span>
        </div>
      </Cabecera>

      <div className="mx-auto w-full max-w-md px-5 pt-2">
        <Hilo
          cosas={cosas}
          paraQuien={suyo.id}
          comoSeLlama={suyo.nombre.split(' ')[0]}
          color={suyo.color}
          soyElAsesor={soyElAsesor}
        />
      </div>

      <Barra activa={null} voz={false} />
    </main>
  )
}
