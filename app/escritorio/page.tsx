import { redirect } from 'next/navigation'
import { clienteSesion } from '@/lib/supabase/sesion'
import { quien } from '@/lib/supabase/quien'
import { laMesa } from '@/lib/escritorio'
import { calcular } from '@/lib/periodos'
import { hoyAqui } from '@/lib/tablon'
import Cabecera from '../cabecera'
import Encabezado from '../encabezado'
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
    ── CON UNA SOLA CASA, SE ABRE IGUAL ──

    Aquí había un `redirect('/')`: con una casa esto sería una tabla de
    una fila con lo que ya está en el Inicio, así que se devolvía al
    Inicio sin explicar nada.

    Y era una pantalla que NO SE PODÍA VER. Ni por el enlace —que
    tampoco sale con una casa— ni escribiendo la dirección. Una función
    a la que no hay forma de llegar es una función que no se puede
    probar, ni enseñar, ni enseñarle a nadie lo que hace.

    Ahora se abre siempre. Lo que cambia con una sola casa es que se
    dice, arriba, que esto crece cuando hay más. Los ENLACES siguen sin
    salir: quien tiene una casa no tiene por qué encontrarse una puerta
    a una tabla de una fila, pero quien escribe la dirección —o le pasan
    el enlace— llega.
  */
  const unaSola = casas !== null && casas.length <= 1

  return (
    <main className="min-h-screen pb-24">
      {/* Era una cabecera escrita a mano, con `max-w-5xl` centrado: la
          única medida de HUBI que no salía del sistema, y centrada
          además, o sea flotando al lado del rail. Ahora es la columna
          de siempre —1100 a la izquierda— y la banda de siempre. */}
      <Cabecera ancho>
        <div className="lg:hidden">
          <Volver href="/" />
          <div className="flex h-14 items-center">
            <h1 className="t-titulo">El escritorio</h1>
          </div>
        </div>

        <Encabezado
          icono="casa"
          ambito="pizarra"
          titulo="El escritorio"
          pie={unaSola ? 'Ahora mismo tienes una casa' : 'Tus casas, de una vez'}
          volver="/"
        />
      </Cabecera>

      <div className="columna pt-1">
        <p className="t-apoyo">
          {unaSola
            ? 'Aquí saldrán todas tus casas juntas. Ahora mismo tienes una.'
            : 'Tus casas, de una vez.'}{' '}
          {/*
            «Las cuentas son de 3º trimestre de 2026» — así salía, sin
            artículo, y es de las cosas que uno lee tres veces sin ver
            qué le chirría.

            El motivo: `titulo` viene de `calcular()`, que lo escribe
            para ir SOLO como encabezado de la pantalla de cuentas. Una
            frase pensada para estar sola casi nunca encaja dentro de
            otra, y bajarle las mayúsculas no la convierte en un
            complemento — solo la disimula.
          */}
          Las cuentas son las del {titulo.toLowerCase()}, y solo de las actividades
          — la compra de casa no sale aquí.
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
