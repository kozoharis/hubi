import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { laMesa } from '@/lib/escritorio'
import { calcular } from '@/lib/periodos'
import { hoyAqui } from '@/lib/tablon'
import { Volver } from '../iconos'
import { Aviso } from '../piezas'
import Mesa from './mesa'

export const dynamic = 'force-dynamic'

/*
  ═══════════════════════════════════════════════════════════════
  EL ESCRITORIO
  ═══════════════════════════════════════════════════════════════

  Todas tus casas de una vez.

  ─────────────────────────────────────────────────────────────
  LA ÚNICA PANTALLA DE HUBI QUE PIDE SITIO

  Y va contra la regla de la casa, que es móvil primero. A propósito.

  Todo lo demás —guardar un papel, apuntar algo, mirar la agenda— se
  hace de pie, con una mano y en un teléfono. Esto no: esto es
  comparar quince casas, y comparar necesita verlas juntas. Un asesor
  lo dijo con todas las letras: llevar quince desde el móvil es
  imposible. Y no porque las pantallas sean pequeñas, sino porque para
  saber cuál le está esperando tiene que entrar en las quince.

  Aquí la densidad no es un descuido: es la función.

  En un teléfono sigue funcionando —las columnas se apilan— pero no es
  donde se usa. Es la pantalla del ordenador y de la tableta.

  ─────────────────────────────────────────────────────────────
  Y NO SE LLAMA «EL ASESOR»

  La idea salió de uno, pero un hijo con dos casas —la suya y la de
  sus padres— tiene el mismo problema en pequeño y le sirve la misma
  pantalla. Ponerle el nombre de un rol la habría dejado escondida
  para él.

  ─────────────────────────────────────────────────────────────
  LO QUE ESTA PANTALLA NO HACE

  No enseña ni un documento. Los números salen de `mi_escritorio()`,
  que solo sabe contar y sumar: para ver un papel hay que entrar en su
  casa, exactamente igual que antes. La frontera entre una casa y otra
  sigue donde estaba.
*/
export default async function Escritorio() {
  const supabase = await clienteSesion()
  const user = await quien(supabase)
  if (!user) redirect('/entrar')

  const casas = await laMesa(supabase)
  const { titulo } = calcular('trimestre', hoyAqui())

  /*
    Con una sola casa esto no tiene nada que decir: sería una tabla de
    una fila con lo que ya está en el Inicio. Se vuelve, sin explicar
    nada — nadie llega aquí a propósito con una casa.
  */
  if (casas && casas.length <= 1) redirect('/')

  return (
    <main className="min-h-screen pb-24">
      <div className="cabecera">
        <div className="mx-auto w-full max-w-5xl px-5">
          <Volver href="/" />
          <div className="flex h-14 items-center">
            <h1 className="t-titulo">El escritorio</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-5 pt-1">
        <p className="t-apoyo">
          Tus casas, de una vez. Las cuentas son de {titulo.toLowerCase()}, y solo de
          las actividades — la compra de casa no sale aquí.
        </p>

        {casas === null ? (
          <div className="mt-5">
            <Aviso
              tono="atencion"
              titulo="Todavía no hay de dónde leer esto"
              explicacion="El escritorio necesita una consulta que aún no está puesta en la base de datos. Todo lo demás de HUBI funciona igual."
              detalle="Falta ejecutar sql/52-el-escritorio.sql en Supabase."
            />
          </div>
        ) : (
          <div className="mt-5">
            <Mesa casas={casas} hoy={hoyAqui()} />
          </div>
        )}
      </div>
    </main>
  )
}
