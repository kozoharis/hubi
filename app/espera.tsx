import { PastillaAmbito, type Ambito } from './piezas'
import { Ico, type Icono } from './iconos'

/*
  ═══════════════════════════════════════════════════════════════
  LO QUE SE VE MIENTRAS LA PANTALLA LLEGA
  ═══════════════════════════════════════════════════════════════

  Haris, después de subir la barra al armazón: *«a ver si lo podemos
  dejar más fluido aún… ese paso en blanco»*.

  Lo que quedaba es esto. Al cambiar de pestaña, el contenido se
  sustituye por un armazón gris mientras el servidor contesta —cada
  pantalla es `force-dynamic` y hace sus consultas—, y ese armazón era
  UNO para toda la aplicación: una columna estrecha de bloques grises,
  sin título y sin cabecera. Da igual a dónde fueras: durante medio
  segundo veías lo mismo, y lo mismo no se parecía a nada.

  ─────────────────────────────────────────────────────────────
  LA IDEA · LO QUE SE SABE, SE PINTA

  Al pulsar «Papeles» ya sabemos tres cosas sin preguntarle nada al
  servidor: que vas a Papeles, que su icono es una carpeta y que es
  azul. Eso no es una suposición, es un dato que está en el código.

  Así que la espera deja de ser gris del todo: **la cabecera se pinta
  de verdad** —el icono, el color y el nombre— y sólo el contenido va
  en bloques. Pulsas Papeles y lees «Papeles» al instante; lo que
  falta es lo que el servidor todavía está buscando, que es justo lo
  que debe parecer que falta.

  Y cuando llega la pantalla de verdad, la cabecera ya estaba puesta:
  no parpadea, no salta, no cambia de sitio. Lo único que se rellena
  es lo de debajo.

  ─────────────────────────────────────────────────────────────
  NADA QUE LEER, NADA QUE INTERPRETAR

  Se mantiene lo que ya decía el armazón viejo y sigue siendo verdad:
  ni «Cargando…», ni ruedecitas, ni porcentajes. Sólo la forma de lo
  que va a venir. A una persona de setenta y cinco años, «cargando» le
  pide interpretar un tecnicismo para saber si su móvil va bien.

  ─────────────────────────────────────────────────────────────
  Y EL ANCHO TIENE QUE SER EL SUYO

  El armazón viejo era `columna-formulario` —448 px— para todas. En un
  ordenador eso significaba que al entrar en Papeles, que es
  panorámica, aparecía una columnita estrecha a la izquierda y después
  la pantalla se abría de golpe a lo ancho. Ese salto era la mitad del
  «se ve raro».

  Cada pestaña dice el suyo, el mismo que declara su pantalla.
*/

export function Hueco({
  ancho,
  alto,
  redondez = 12,
}: {
  ancho?: number
  alto: number
  redondez?: number
}) {
  return (
    <div
      className="latido"
      style={{
        width: ancho ? `${ancho}px` : '100%',
        height: `${alto}px`,
        borderRadius: `${redondez}px`,
        background: 'var(--t-borde)',
      }}
    />
  )
}

export default function Espera({
  icono,
  ambito,
  titulo,
  pie,
  conPie = false,
  conCaja = false,
  volver = false,
  conControles = false,
  ancho = 'ancho-trabajo',
  children,
}: {
  /* La identidad de la pestaña a la que se va. Sin ella, la espera es
     genérica y sólo se pintan los bloques — que es lo que hace el
     armazón de la raíz, porque desde ahí se puede ir a cualquier
     sitio. */
  icono?: Icono
  ambito?: Ambito
  titulo?: string
  /** La línea de apoyo, cuando la pantalla la lleva y es siempre la
      misma. Si la lleva pero depende de los datos, `conPie` reserva su
      altura sin inventarse el texto. */
  pie?: string
  conPie?: boolean
  /** Las cinco pestañas llevan la caja de MAPPEL dentro de la cabecera.
      Si el armazón no la reserva, al llegar la pantalla la cabecera
      crece 76 px de golpe y empuja hacia abajo todo lo que ya se
      estaba leyendo. */
  conCaja?: boolean
  /** El botón de volver, en las pantallas que cuelgan de una pestaña.
      Se dibuja de verdad —el círculo y la flecha— pero NO es un enlace:
      esto es un armazón, y un botón que se puede pulsar durante medio
      segundo y después desaparece es peor que ninguno. */
  volver?: boolean
  /** Las pastillas de elegir (En el corcho · Guardadas, Semana · Mes…).
      En el móvil van a su propia línea, y son 48 px de alto que si no
      se reservan mueven toda la pantalla al llegar. */
  conControles?: boolean
  ancho?: 'ancho-trabajo' | 'ancho-panoramica'
  /** La forma del contenido. Cada pestaña dibuja la suya. */
  children?: React.ReactNode
}) {
  return (
    <main className="min-h-dvh pb-40 lg:pb-16" aria-hidden>
      {/*
        La misma cabecera pegajosa que todas las pantallas, y con la
        MISMA MEDIDA: no una parecida. La fila de abajo es copia exacta
        de la de `app/encabezado.tsx` —`pt-1`, `pb-0.5`, `gap-3`, la
        pastilla de 44— porque si midiera aunque sea seis píxeles
        distinto, al llegar la pantalla de verdad todo lo de abajo
        daría un salto — y un salto pequeño se nota MÁS que uno grande,
        porque no parece un cambio, parece un temblor.

        ── Y ESTA CABECERA NO SE HACE ESPERAR ──

        `.espera` esconde lo que lleve puesto durante 280 ms y después
        lo desvanece. Está bien pensado y hay que conservarlo PARA LOS
        BLOQUES GRISES: si la pantalla llega rápida, nadie llega a ver
        un armazón, que es lo que queremos.

        Pero eso, puesto en toda la página como estaba, era exactamente
        el «paso en blanco» que nos contó Haris: durante esos 280 ms no
        había nada. Lo de antes ya se había ido y lo nuevo todavía no
        asomaba.

        Aquí la cabecera no es un armazón: es la cabecera de verdad, la
        misma que va a traer la pantalla. Un dato cierto no tiene por
        qué esperar a nada. Se pinta en el mismo momento, y cuando
        llega la pantalla ya estaba puesta: no parpadea, no salta.

        Cuando no sabemos a dónde vamos —el armazón de la raíz— sí son
        bloques, y entonces sí esperan como los demás.
      */}
      <div className="cabecera">
        <div className={ancho}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-0 pb-0.5 pt-1">
            <div className="flex min-w-0 flex-1 items-center gap-3">
            {volver && (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-borde bg-superficie text-tinta">
                <Ico nombre="atras" tam={22} grosor={2.4} />
              </span>
            )}
            {icono && ambito ? (
              <>
                <PastillaAmbito icono={icono} ambito={ambito} tam={44} />
                <div className="min-w-0">
                  <h1 className="t-titulo truncate">{titulo}</h1>
                  {pie && <p className="t-apoyo mt-0.5 truncate">{pie}</p>}
                  {!pie && conPie && (
                    <div className="mt-1.5 espera">
                      <Hueco ancho={180} alto={13} redondez={7} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="espera flex items-center gap-3">
                <Hueco ancho={44} alto={44} redondez={14} />
                <Hueco ancho={120} alto={26} />
              </div>
            )}
            </div>

            {/* La caja de MAPPEL, con su hueco exacto: mismas clases de
                envoltorio que en `encabezado.tsx` y los 64 px de alto y
                los 18 de radio de `mappel-input.tsx`. */}
            {conCaja && (
              <div className="espera w-[420px] max-w-full shrink-0 ancha:order-2">
                <Hueco alto={64} redondez={18} />
              </div>
            )}

            {/* Las pastillas, con el mismo envoltorio que en
                `encabezado.tsx`: a su propia línea hasta 1439. */}
            {conControles && (
              <div className="espera order-last mt-3 w-full ancha:order-3 ancha:mt-0 ancha:w-auto ancha:shrink-0">
                <Hueco ancho={260} alto={48} redondez={999} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`${ancho} espera pt-2`}>
        {children ?? (
          <div className="space-y-3">
            <Hueco alto={74} redondez={22} />
            <Hueco alto={74} redondez={22} />
            <Hueco alto={74} redondez={22} />
          </div>
        )}
      </div>
    </main>
  )
}
