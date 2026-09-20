import { PastillaAmbito, type Ambito } from './piezas'
import { Ico, type Icono } from './iconos'

/*
  ═══════════════════════════════════════════════════════════════
  LO QUE SE VE MIENTRAS LA PANTALLA LLEGA
  ═══════════════════════════════════════════════════════════════

  Haris, después de subir la barra al armazón: *«a ver si lo podemos
  dejar más fluido aún… ese paso en blanco»*.

  Al cambiar de pantalla, el contenido se sustituye por un armazón gris
  mientras el servidor contesta —cada pantalla es `force-dynamic` y
  hace sus consultas—, y ese armazón era UNO para toda la aplicación:
  una columna estrecha de bloques grises, sin título y sin cabecera.
  Da igual a dónde fueras: durante medio segundo veías lo mismo, y lo
  mismo no se parecía a nada.

  ─────────────────────────────────────────────────────────────
  LA IDEA · LO QUE SE SABE, SE PINTA

  Al pulsar «Papeles» ya sabemos tres cosas sin preguntarle nada al
  servidor: que vas a Papeles, que su icono es una carpeta y que es
  azul. Eso no es una suposición, es un dato que está en el código.

  Así que la espera deja de ser gris del todo: **la cabecera se pinta
  de verdad** y sólo el contenido va en bloques. Pulsas Papeles y lees
  «Papeles» al instante; lo que falta es lo que el servidor todavía
  está buscando, que es justo lo que debe parecer que falta.

  ─────────────────────────────────────────────────────────────
  ⚠️  Y HAY DOS CABECERAS, NO UNA

  Esto se hizo mal la primera vez y Haris lo vio enseguida: *«en
  cuentas y día a día el título hace algo raro… como que sube (parece
  que tiene un subtítulo) y luego vuelve a su posición»*.

  El motivo: **`app/encabezado.tsx` es `hidden lg:block`**. La cabecera
  con pastilla, subtítulo, caja de MAPPEL y botón de acción es la del
  ORDENADOR. En el móvil cada pantalla pinta la suya, más corta, a
  mano, justo encima — y casi ninguna lleva subtítulo.

  El armazón pintaba la de escritorio en los dos sitios. En el móvil
  eso reservaba un subtítulo que no existe, o sea que el título se
  colocaba más arriba de la cuenta y al llegar la pantalla bajaba de
  golpe. Un temblor, exactamente lo que se quería evitar.

  Ahora esta pieza tiene las dos mitades, como las pantallas:

    · `movil`  — la cabecera corta, que cada `loading.tsx` copia de su
                 `page.tsx`. Están al lado, en la misma carpeta, y así
                 se ve de un vistazo si una se ha quedado atrás.
    · Las demás propiedades — la cabecera de escritorio, que sí es
      siempre la misma forma porque la dibuja `Encabezado`.

  **Regla: si cambia la cabecera de móvil de una pantalla, cambia su
  `loading.tsx`.** Es el precio de que no tiemble.

  ─────────────────────────────────────────────────────────────
  NADA QUE LEER, NADA QUE INTERPRETAR

  Ni «Cargando…», ni ruedecitas, ni porcentajes. Sólo la forma de lo
  que va a venir. A una persona de setenta y cinco años, «cargando» le
  pide interpretar un tecnicismo para saber si su móvil va bien.
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

/*
  El botón de volver de las pantallas de dentro, quieto.

  Se dibuja de verdad —mismas medidas y mismas palabras que
  `Volver` en `iconos.tsx`— pero NO es un enlace: esto es un armazón,
  y un botón que se puede pulsar durante medio segundo y después
  desaparece debajo del dedo es peor que ninguno.
*/
export function VolverQuieto() {
  return (
    <span
      className="mb-3 inline-flex h-12 max-w-full items-center gap-1.5 rounded-full py-0 pl-3 pr-5 text-[16.5px] font-extrabold"
      style={{
        background: 'var(--t-superficie)',
        border: '1px solid var(--t-borde)',
        color: 'var(--t-tinta)',
      }}
    >
      <Ico nombre="atras" tam={21} grosor={2.6} />
      <span className="truncate">Volver</span>
    </span>
  )
}

/*
  La cabecera corta del móvil que sirve para la mayoría: la pastilla
  del ámbito y el nombre. `alto` porque unas pantallas la hacen de 56
  y otras de 48, y ese hueco de ocho píxeles también se nota.
*/
export function TituloMovil({
  icono,
  ambito,
  titulo,
  alto = 'h-14',
}: {
  icono: Icono
  ambito: Ambito
  titulo: string
  alto?: 'h-14' | 'h-12'
}) {
  return (
    <div className={`flex ${alto} items-center gap-3`}>
      <PastillaAmbito icono={icono} ambito={ambito} tam={44} />
      <h1 className="t-titulo">{titulo}</h1>
    </div>
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
  movil,
  ancho = 'ancho-trabajo',
  arriba = 'pt-2',
  children,
}: {
  /* La identidad de la pantalla a la que se va. Sin ella, la espera es
     genérica y sólo se pintan bloques — que es lo que hace el armazón
     de la raíz, porque desde ahí se puede ir a cualquier sitio. */
  icono?: Icono
  ambito?: Ambito
  titulo?: string
  /** Sólo en la cabecera de ESCRITORIO, que es la única que lo lleva.
      Si depende de los datos —«· septiembre»—, `conPie` reserva su
      altura sin inventarse el texto. */
  pie?: string
  conPie?: boolean
  /** La caja de MAPPEL, que en el ordenador va dentro de la cabecera.
      En el móvil vive en el cuerpo, así que la pone cada `loading.tsx`
      en su sitio. */
  conCaja?: boolean
  /** El botón de volver de la cabecera de escritorio. */
  volver?: boolean
  /** Las pastillas de elegir, en la cabecera de escritorio. */
  conControles?: boolean
  /** La cabecera del MÓVIL, copiada de su `page.tsx`. Sin ella se usa
      la corriente: pastilla y nombre en una fila de 56. */
  movil?: React.ReactNode
  ancho?: 'ancho-trabajo' | 'ancho-panoramica'
  /** El aire entre la cabecera y el cuerpo, el mismo que declara su
      `page.tsx`. Cuatro píxeles de diferencia no se ven en un bloque
      gris, pero sí en la caja de MAPPEL, que es idéntica en los dos. */
  arriba?: 'pt-2' | 'pt-1' | ''
  /** La forma del contenido. Cada pantalla dibuja la suya. */
  children?: React.ReactNode
}) {
  const seSabe = Boolean(icono && ambito && titulo)

  return (
    <main className="min-h-dvh pb-40 lg:pb-16" aria-hidden>
      <div className="cabecera">
        <div className={ancho}>
          {!seSabe ? (
            /* El armazón de la raíz: no se sabe a dónde se va, así que
               no hay nada cierto que pintar. */
            <div className="espera flex h-14 items-center gap-3">
              <Hueco ancho={44} alto={44} redondez={14} />
              <Hueco ancho={120} alto={26} />
            </div>
          ) : (
            <>
              {/* ── EL MÓVIL ── */}
              <div className="lg:hidden">
                {movil ?? (
                  <TituloMovil icono={icono!} ambito={ambito!} titulo={titulo!} />
                )}
              </div>

              {/*
                ── EL ORDENADOR ──

                Copia exacta de la fila de `encabezado.tsx`: `pt-1`,
                `pb-0.5`, `gap-x-5`, la pastilla de 44 y los mismos
                envoltorios de la caja y de las pastillas. Si midiera
                aunque sea seis píxeles distinto, al llegar la pantalla
                todo lo de abajo daría un salto — y un salto pequeño se
                nota MÁS que uno grande, porque no parece un cambio,
                parece un temblor.
              */}
              <div className="hidden lg:block">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-0 pb-0.5 pt-1">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {volver && (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-borde bg-superficie text-tinta">
                        <Ico nombre="atras" tam={22} grosor={2.4} />
                      </span>
                    )}
                    <PastillaAmbito icono={icono!} ambito={ambito!} tam={44} />
                    <div className="min-w-0">
                      <h1 className="t-titulo truncate">{titulo}</h1>
                      {pie && <p className="t-apoyo mt-0.5 truncate">{pie}</p>}
                      {/* `mt-0.5` y 21 px de alto: exactamente lo que
                          mide un `<p class="t-apoyo">` de una línea.
                          El bloque gris va centrado dentro y más fino,
                          porque una barra de 21 px de alto no parece
                          un subtítulo, parece un botón. */}
                      {!pie && conPie && (
                        <div className="espera mt-0.5 flex h-[21px] items-center">
                          <Hueco ancho={180} alto={13} redondez={7} />
                        </div>
                      )}
                    </div>
                  </div>

                  {conCaja && (
                    <div className="espera w-[420px] max-w-full shrink-0 ancha:order-2">
                      <Hueco alto={64} redondez={18} />
                    </div>
                  )}

                  {conControles && (
                    <div className="espera order-last mt-3 w-full ancha:order-3 ancha:mt-0 ancha:w-auto ancha:shrink-0">
                      <Hueco ancho={260} alto={48} redondez={999} />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/*
        Y LO DE DENTRO SÍ ESPERA.

        `.espera` esconde lo que lleve puesto un momento y después lo
        desvanece, y aquí hay que conservarlo: si la pantalla llega
        rápida, nadie llega a ver un armazón. Lo que no podía seguir
        era estar puesto en la PÁGINA ENTERA, porque entonces también
        se hacía esperar la cabecera —que es cierta— y eso era
        literalmente el paso en blanco.
      */}
      <div className={`${ancho} espera ${arriba}`}>
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
