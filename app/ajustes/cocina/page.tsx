import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacioO } from '@/lib/espacio'
import Barra from '../../barra'
import Cabecera from '../../cabecera'
import Encabezado from '../../encabezado'
import { Volver } from '../../iconos'
import Decidir, { type Cuenta } from './decidir'
import Listas, { type LaLista } from './listas'
import AnadirPantalla from './anadir-pantalla'
import Fotos from './fotos'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  QUÉ SE VE EN LA PANTALLA DE LA COCINA
  ═══════════════════════════════════════════════════════════════

  Una pantalla que existe para tomar UNA decisión, y para tomarla
  mirando los números de verdad.

  ─────────────────────────────────────────────────────────────
  POR QUÉ ESTO NO SE HIZO EN UN SCRIPT

  Era el plan: «lo que venga de Salud, que no salga; lo demás, que
  salga», dentro de la migración. Se descartó por escrito
  (`modelo-63-visible-en-casa.md`, §6) y por dos razones.

  La primera es técnica: `recordatorios` no tiene `categoria_id`, así
  que mirando una fila no hay forma de saber si salió de Salud. Lo
  único que hay es `tipo`, y en cinco de los seis caminos que crean
  estas filas el tipo lo adivina una expresión regular sobre el título.

  La segunda es la que importa: **decidir qué cuelga de la pared de una
  cocina no es una migración.** Es una decisión de la familia, y quien
  la toma tiene derecho a ver la lista entera antes.

  Por eso aquí no hay «lo hemos configurado por ti». Hay siete líneas
  con su cuenta al lado y un botón.

  ─────────────────────────────────────────────────────────────
  Y POR QUÉ SE PUEDE DECIDIR ANTES DE QUE HAYA PANTALLA

  Se pensó en enseñar esto solo cuando la casa tuviera un aparato dado
  de alta. Pero entonces el día que se cuelga la tableta hay que
  decidir esto CON la tableta ya encendida en la pared enseñándolo
  todo, que es exactamente el momento en que no se quiere decidir
  nada.

  Así que se decide antes, tranquilamente, y la pantalla lo dice: por
  ahora no hay ninguna, y esto deja escrito lo que se verá cuando la
  haya.
*/

/* Los siete que mappel sabe deducir (`deducirTipo`, `lib/tablon.ts`), con
   el nombre que les pondría una persona y el emoji con el que ya se
   pintan en la Agenda — el mismo, para que nadie tenga que traducir
   entre esta pantalla y aquélla. */
const LOS_TIPOS: { tipo: string; nombre: string; emoji: string; explica: string }[] = [
  { tipo: 'tarea',       emoji: '✅', nombre: 'Tareas',        explica: 'Lo que hay que hacer' },
  { tipo: 'recado',      emoji: '🛍', nombre: 'Recados',       explica: 'Comprar, llevar, recoger' },
  { tipo: 'vencimiento', emoji: '⏳', nombre: 'Vencimientos',  explica: 'Lo que caduca o se renueva' },
  { tipo: 'coche',       emoji: '🚗', nombre: 'Coche',         explica: 'Taller, ITV, gasolina' },
  { tipo: 'papeles',     emoji: '📄', nombre: 'Papeles',       explica: 'Seguros, banco, gestor' },
  { tipo: 'cita',        emoji: '🩺', nombre: 'Citas médicas', explica: 'Médico, análisis, hospital' },
  { tipo: 'farmacia',    emoji: '💊', nombre: 'Farmacia',      explica: 'Medicación y recetas' },
]

/* Lo que MAPPEL propone si nadie ha decidido nada. Las dos de salud se
   quedan fuera, y ésa es toda la propuesta: una pantalla en una cocina
   la ve quien entre en la cocina. */
const LO_QUE_PROPONEMOS = ['tarea', 'recado', 'vencimiento', 'coche']

export default async function LaCocina() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const casa = await elEspacioO(supabase)
  if (!casa) redirect('/empezar')

  /* En dos intentos: las dos columnas son del SQL 69, y si todavía no
     está dado Postgres rechaza la consulta ENTERA —no la columna— y
     esta pantalla saldría sin nombre de casa y sin poder explicarse.
     Sin ellas se comporta como si nadie hubiera decidido nada, que es
     exactamente la verdad. */
  const conDecision = await supabase
    .from('hogares')
    .select('nombre, tipos_en_casa, notas_en_casa')
    .eq('id', casa)
    .maybeSingle()

  const [laCasa, cosas, recados, aparatos] = await Promise.all([
    conDecision.error
      ? supabase.from('hogares').select('nombre').eq('id', casa).maybeSingle()
      : conDecision,
    supabase
      .from('recordatorios')
      .select('tipo, visible_en_casa')
      .eq('hogar_id', casa)
      .is('eliminado_en', null),
    supabase.from('notas').select('id').eq('hogar_id', casa).is('guardada_en', null),
    /* ¿Hay ya alguna pantalla colgada? Cambia lo que dice la cabecera,
       no lo que se puede hacer. */
    supabase.from('miembros').select('perfil_id').eq('hogar_id', casa).eq('clase', 'dispositivo'),
  ])

  const filas = (cosas.data ?? []) as { tipo: string; visible_en_casa: boolean | null }[]

  const reglaGuardada = ((laCasa.data ?? null) as { tipos_en_casa?: string[] | null } | null)
    ?.tipos_en_casa

  const cuentas: Cuenta[] = LOS_TIPOS.map((t) => {
    const suyas = filas.filter((f) => f.tipo === t.tipo)

    /*
      ── QUÉ CUENTA COMO «DECIDIDO A MANO» ──

      Aquí ponía `visible_en_casa !== null`, y estaba mal en cuanto se
      pulsaba el botón una vez: la propia regla deja TODAS las filas con
      un valor, y entonces la pantalla decía «hay 12 cosas decididas una
      por una desde su propia ficha» sobre doce que acababa de decidir
      ella misma.

      Decidido a mano es que la fila diga **lo contrario** de lo que
      dice la regla guardada. Si coincide con la regla, es la regla.

      Y sin regla guardada todavía, cualquier valor no nulo sí lo puso
      una persona — que es como se comportaba antes y sigue siendo
      cierto en ese caso.
    */
    const loQueDiriaLaRegla = reglaGuardada ? reglaGuardada.includes(t.tipo) : null

    return {
      ...t,
      cuantas: suyas.length,
      yaDecididas: suyas.filter((f) =>
        f.visible_en_casa === null
          ? false
          : loQueDiriaLaRegla === null
            ? true
            : f.visible_en_casa !== loQueDiriaLaRegla
      ).length,
    }
  })

  /* Las dos columnas nuevas, leídas de un tipo que las contempla como
     opcionales: cuando el intento de arriba cae al de respaldo, la
     forma de `laCasa.data` es la corta y TypeScript tiene razón en
     quejarse si se pide `tipos_en_casa` sin más. */
  const dice = (laCasa.data ?? null) as {
    nombre?: string
    tipos_en_casa?: string[] | null
    notas_en_casa?: boolean | null
  } | null

  const guardados = dice?.tipos_en_casa ?? null

  /* Las pantallas colgadas, con su nombre. El nombre vive en
     `perfiles`, así que son dos consultas: `miembros` dice cuáles son
     de esta casa y `perfiles` cómo se llaman. Sin nombre, quitar una
     de dos sería elegir a ciegas. */
  const suyos = (aparatos.data ?? []).map((m) => m.perfil_id as string)
  const { data: comoSeLlaman } = suyos.length
    ? await supabase.from('perfiles').select('id, nombre').in('id', suyos)
    : { data: [] }

  const pantallas = suyos.map((id) => ({
    id,
    nombre:
      (comoSeLlaman ?? []).find((p) => p.id === id)?.nombre ?? 'Una pantalla',
  }))

  /*
    ── LAS LISTAS DE LA COMPRA (paso 77) ──

    Envuelto, y por lo de siempre: `visible_en_casa` es del sql/77, y
    si no está dado Postgres rechaza la consulta ENTERA. Sin eso, esta
    pantalla —que es la de decidir qué se ve en la cocina— se caería
    por la parte más nueva. Se queda sin la sección y lo demás sigue.
  */
  const lasListas: LaLista[] = await (async () => {
    try {
      const { data, error } = await supabase
        .from('listas_compra')
        .select('id, nombre, visible_en_casa')
        .eq('hogar_id', casa)
        .is('archivada_en', null)
        .order('creada_en', { ascending: true })
      if (error || !data) return []

      const abiertas = data as { id: string; nombre: string; visible_en_casa: boolean | null }[]
      if (abiertas.length === 0) return []

      /* Cuántas cosas tiene cada una pendientes. Sin esto, «El sábado»
         y «La ferretería» son dos palabras sin nada detrás y no hay
         forma de saber cuál es la que importa. */
      const { data: cosas } = await supabase
        .from('compra')
        .select('lista_id')
        .eq('hogar_id', casa)
        .is('archivado_en', null)
        .eq('comprado', false)

      const cuenta = new Map<string, number>()
      for (const c of (cosas ?? []) as { lista_id: string | null }[]) {
        if (c.lista_id) cuenta.set(c.lista_id, (cuenta.get(c.lista_id) ?? 0) + 1)
      }

      return abiertas.map((l) => ({
        id: l.id,
        nombre: l.nombre,
        visible: l.visible_en_casa,
        cuantas: cuenta.get(l.id) ?? 0,
      }))
    } catch {
      return []
    }
  })()

  return (
    <main className="min-h-screen pb-40 lg:pb-16">
      <Cabecera ancho>
        <div className="lg:hidden">
          <Volver href="/ajustes" />
          <h1 className="t-titulo mt-2.5">La pantalla de la cocina</h1>
        </div>

        <Encabezado
          icono="casa"
          ambito="pizarra"
          titulo="La pantalla de la cocina"
          pie={dice?.nombre ?? undefined}
          volver="/ajustes"
        />
      </Cabecera>

      <div className="columna-texto pt-1">
        <Decidir
          cuentas={cuentas}
          recados={recados.data?.length ?? 0}
          /* `null` = nadie ha decidido nunca. Entonces se enseña lo que
             proponemos, marcado, pero sin dar por hecho que está
             guardado: el botón sigue diciendo «Así está bien». */
          elegidos={guardados ?? LO_QUE_PROPONEMOS}
          sinDecidir={guardados === null}
          conRecados={dice?.notas_en_casa ?? false}
          hayPantalla={(aparatos.data?.length ?? 0) > 0}
        />

        {/*
          Las listas van justo debajo de los recordatorios: es la misma
          pregunta —qué cuelga de esa pared— hecha sobre la otra mitad
          de lo que la pared enseña.
        */}
        <Listas listas={lasListas} />

        {/*
          Colgar la pantalla va DESPUÉS de decidir qué se ve en ella, y
          no antes. Al revés, el orden sería: das de alta la tableta,
          se enciende en la pared enseñando lo que sea, y entonces te
          pones a decidir. Aquí se decide con calma y se cuelga al
          final, que es como se hace cualquier otra cosa en una casa.
        */}
        <div className="mt-4">
          <AnadirPantalla pantallas={pantallas} />
        </div>

        {/*
          ── EL AVISO DEL MICRÓFONO, ANTES Y NO DESPUÉS ──

          La pared tiene micrófono: se puede dictar la compra, apuntar
          algo en un día y dejar una nota. Pero el navegador de la
          tableta pide permiso la primera vez, y eso NO se puede
          conceder desde aquí — hay que hacerlo en la propia tableta.

          Haris: *«sería bueno que dé el aviso desde el inicio»*. Y
          tiene razón por una razón concreta: si esto no se dice aquí, se
          descubre el día que alguien está de pie en la cocina con las
          manos mojadas, toca el micrófono y sale un cartel del navegador
          que nadie esperaba. Se toca «Bloquear» por reflejo, y entonces
          la voz queda apagada para siempre sin que nadie sepa por qué.

          Dicho antes, es una casilla que se marca una vez mientras se
          cuelga la tableta.
        */}
        <div className="mt-6 rounded-[24px] border border-borde px-5 py-4">
          <p className="t-cuerpo font-extrabold">Una cosa al colgar la tableta</p>
          <p className="t-apoyo mt-1.5 leading-snug">
            En la cocina se puede hablar: dictar la compra, apuntar algo en un día y dejar una
            nota. La primera vez que se toque el micrófono, el navegador de la tableta
            preguntará si le deja usarlo. Hay que decir que{' '}
            <strong className="text-tinta">sí</strong>, y solo se pregunta una vez.
          </p>
          <p className="t-apoyo mt-2 leading-snug">
            Si por lo que sea se dijo que no, se vuelve a permitir desde los ajustes del propio
            navegador de la tableta. Desde aquí no se puede.
          </p>
        </div>

        {/*
          ── LAS FOTOS, Y SOLO SI HAY PANTALLA ──

          Debajo de todo, porque es lo último que se decide: primero qué
          se ve, luego se cuelga el aparato, y cuando ya está colgado se
          le ponen fotos.

          Y solo si hay alguna pantalla dada de alta. Subir fotos para
          una pared que no existe es una sección que no significa nada.
        */}
        {pantallas.length > 0 && <Fotos />}
      </div>

      <Barra activa="ajustes" />
    </main>
  )
}
