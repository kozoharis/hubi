import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { elEspacioO } from '@/lib/espacio'
import Barra from '../../barra'
import Cabecera from '../../cabecera'
import Encabezado from '../../encabezado'
import { Volver } from '../../iconos'
import Decidir, { type Cuenta } from './decidir'

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

/* Los siete que HUBI sabe deducir (`deducirTipo`, `lib/tablon.ts`), con
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

/* Lo que HUBI propone si nadie ha decidido nada. Las dos de salud se
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
      </div>

      <Barra activa="ajustes" />
    </main>
  )
}
