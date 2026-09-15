import Link from '@/app/enlace'
import { Ico } from '../iconos'

export const dynamic = 'force-static'

/*
  ═══════════════════════════════════════════════════════════════
  «ESTO ES LA PANTALLA DE LA COCINA»
  ═══════════════════════════════════════════════════════════════

  Esta página existe por una tarde perdida, y merece quedar escrita
  para que no se repita.

  ─────────────────────────────────────────────────────────────
  QUÉ PASÓ

  `/casa` —la pared— comprueba que quien mira sea de clase
  `dispositivo`, y si no lo es hacía esto:

      if (mio?.clase !== 'dispositivo') redirect('/')

  Sin una palabra. Haris abrió la pared con su cuenta después de que
  se publicaran tres funciones nuevas, aterrizó en la aplicación de
  siempre, y la conclusión razonable fue **«no se ha subido nada»**.

  Se comprobó el despliegue, se comprobó el commit, se comprobó el
  service worker, se comprobó Supabase. Todo estaba bien. Lo único que
  pasaba es que la pantalla que tenía delante no era la que creía.

  ─────────────────────────────────────────────────────────────
  LA REGLA QUE SALE DE AQUÍ

  **Una redirección silenciosa es una mentira educada.** Manda a la
  persona a un sitio correcto sin decirle que no llegó a donde iba, y
  entonces lo que ve —que es cierto— contesta a una pregunta que no
  había hecho.

  Cuesta dos minutos escribir por qué. La alternativa cuesta una tarde,
  y encima le hace dudar de que el trabajo esté hecho.

  Vale para todas las de este proyecto: si una pantalla decide por su
  cuenta llevarte a otra, que lo diga.

  ─────────────────────────────────────────────────────────────
  Y POR QUÉ ESTÁ FUERA DE `/casa`

  Porque el armazón de la pared —`app/casa/layout.tsx`— llama también a
  `laPared()`. Una página de aviso metida ahí dentro se redirigiría a sí
  misma para siempre.
*/

export default function EnLaCocina() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="columna-texto">
        <div className="rounded-[28px] border border-borde bg-superficie px-7 py-8">
          <h1 className="t-titulo">Esto es la pantalla de la cocina</h1>

          <p className="t-cuerpo mt-4 leading-snug">
            Lo que estabas abriendo es la pared: la vista grande, pensada para una tableta
            colgada. Se abre <strong className="text-tinta">desde la propia tableta</strong>, con
            la cuenta de la pantalla — no con la tuya.
          </p>

          <p className="t-cuerpo mt-3 leading-snug">
            Tú tienes mappel entero, que es más de lo que enseña esa pared.
          </p>

          {/*
            Y se dice cómo se entra. Decir «no es para ti» y callarse
            sería la misma redirección silenciosa con más palabras.
          */}
          <div className="mt-6 rounded-[20px] px-5 py-4" style={{ background: 'var(--t-velo)' }}>
            <p className="t-apoyo font-extrabold text-tinta">Para verla</p>
            <ol className="t-apoyo mt-2 list-decimal space-y-1.5 pl-5 leading-snug">
              <li>En la tableta, abre mappel y sal de la sesión que haya.</li>
              <li>Entra con el correo que le pusiste a la pantalla al colgarla.</li>
              <li>Llega un código de seis cifras a ese buzón.</li>
              <li>Al entrar va sola a la pared. No hay que escribir ninguna dirección.</li>
            </ol>
            <p className="t-apoyo mt-3 leading-snug">
              El correo de cada pantalla está en Ajustes → La pantalla de la cocina.
            </p>
          </div>

          <div className="mt-7">
            <Link
              href="/"
              className="tocable inline-flex h-[60px] items-center gap-3 rounded-full px-7 text-[18px] font-extrabold"
              style={{ background: 'var(--t-boton)', color: 'var(--t-boton-texto)' }}
            >
              <Ico nombre="atras" tam={22} grosor={2.3} />
              Volver a mappel
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
