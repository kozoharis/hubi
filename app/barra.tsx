'use client'

import { useLinkStatus } from 'next/link'
import Link from '@/app/enlace'
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Ico, type Icono } from './iconos'
import { useCasa } from './actividades-contexto'
import { pestanasDe, puedeHablar } from './pestanas'

/*
  La barra de abajo.

  Cinco pestañas y las cinco son secciones de verdad: nada escondido
  detrás de tres puntos. Los ajustes salen de la inicial de arriba,
  que es donde todo el mundo los busca.

  Encima, el botón de voz: pequeño, siempre en el mismo sitio, pegado
  a la barra. Solo el símbolo de onda.

  Está a 52 px y a diez del borde de la barra. Estaba a 58 y flotando
  72 px por encima, y ahí molestaba dos veces: tapaba el final de las
  listas y obligaba a dejarle un hueco a la derecha en pantallas donde
  no pintaba nada —el pie del calendario tenía un `pr-24` puesto solo
  para esquivarlo, que partía la leyenda en dos renglones—.

  52 px sigue por encima de los 48 que fijamos como mínimo para lo que
  hay que pulsar. Por debajo de eso no baja aunque quede más elegante.

  En Inicio no aparece: allí la invitación de arriba ya lleva el mismo
  símbolo, y dos botones para lo mismo en una pantalla es uno de más.
*/

type Seccion = string | null

/*
  ═══════════════════════════════════════════════════════════════
  CINCO PESTAÑAS FIJAS · Fase 2
  ═══════════════════════════════════════════════════════════════

      Inicio · Papeles · Agenda · Cuentas · El día a día

  Cinco es el tope de verdad: con seis, cada botón baja de los 48 px
  que protegen a un dedo de 75 años, y ese suelo no se negocia por
  hacer sitio a una sección.

  ─────────────────────────────────────────────────────────────
  LO QUE HABÍA, Y POR QUÉ NO PODÍA QUEDARSE

  La barra era ésta:

      Inicio · Papeles · Agenda · Finca · Helechos

  Tres funciones y dos NOMBRES PROPIOS. En esta casa son la Finca y
  Los Helechos; en la de al lado serán «Alquileres» y «Obra del
  garaje». O sea: la barra no tenía una forma fija, así que no se
  podía aprender — y explicársela a alguien por teléfono era imposible
  porque en su móvil ponía otra cosa.

  Y arrastraba un problema mayor. Con esas dos ocupando sitio, NO
  QUEDABA HUECO para nada más, así que La compra, los Menús, las
  Notas, La casa y el asesor colgaban todos del Inicio. Por eso Inicio
  medía mil doscientas líneas y había que bajar media pantalla para
  llegar al médico de las diez.

  No eran dos problemas: era uno. El sitio de las actividades en la
  barra era el sitio que le faltaba al día a día.

  ─────────────────────────────────────────────────────────────
  LO QUE CUESTA, DICHO CLARO

  Quien tiene una o dos actividades y las abre a diario paga UN TOQUE
  MÁS: antes la Finca estaba abajo, ahora está dentro de Cuentas.

  Se acepta porque a cambio la barra es igual en todas las casas, no
  cambia de forma cuando alguien crea una actividad nueva, y el día a
  día —que se usa varias veces al día, no una vez a la semana— pasa a
  estar a un toque en vez de a un scroll.
*/
/* Las pestañas viven en `pestanas.ts`: las comparten esta barra y el
   rail del ordenador, y escritas dos veces acabarían discrepando. */
/*
  ═══════════════════════════════════════════════════════════════
  Y LA BARRA NO ES LA MISMA PARA TODOS
  ═══════════════════════════════════════════════════════════════

  Hasta ahora sí lo era, y quedaba mal en cuanto entraba alguien que
  no es de la familia. A quien ayuda en casa le salían Papeles y las
  actividades: la base de datos le vaciaba el contenido —eso funciona—
  pero se pasaba el día viendo dos pestañas que no llevan a nada. Y
  una pestaña vacía no se lee como «esto no es para ti»: se lee como
  «esto está roto».

  Cada uno ve las suyas, y de paso le caben más anchas:

    Ayuda en casa   Inicio · Agenda · La compra
    Asesor          Inicio · Papeles · sus actividades
    Familia         todo, como siempre

  ESTO NO PROTEGE NADA, y conviene repetirlo. Quitar la pestaña de
  Papeles no impide abrir `/documentos` escribiéndolo — eso lo impiden
  las políticas de la base de datos. Aquí solo se decide qué se
  ofrece: no esconder, sino que cada uno encuentre lo suyo.
*/
export default function Barra({
  activa = null,
  voz = true,
}: {
  activa?: Seccion
  voz?: boolean
}) {
  const { rol } = useCasa()

  /*
    ═══════════════════════════════════════════════════════════
    «VOY EN CAMINO» · a qué pestaña vamos
    ═══════════════════════════════════════════════════════════

    Esto arregla un fallo, no es un pulido.

    Todas las pantallas de HUBI son `force-dynamic`: al pulsar una
    pestaña hay un viaje al servidor, y en un móvil con cobertura
    regular eso son entre 400 y 1500 ms. Durante todo ese rato la
    barra seguía señalando la pestaña ANTERIOR.

    O sea que lo único de la pantalla capaz de confirmar el toque
    estaba diciendo justo lo contrario: «sigues donde estabas». Ahí
    es donde se vuelve a pulsar, y entonces se encadenan dos
    navegaciones y la cosa va aún más lenta.

    Se guarda AQUÍ y no en cada pestaña porque hacen falta las dos
    mitades a la vez: encender la de destino y apagar la de origen.
    Con el estado repartido, las dos se encenderían y quedaría peor
    que antes — dos sitios señalados y ninguno claro.

    Se limpia solo: `useLinkStatus` pasa a falso cuando la navegación
    termina, y para entonces la pantalla nueva ya manda su `activa`.
  */
  const [yendo, setYendo] = useState<string | null>(null)

  /* La voz sirve para APUNTAR y para preguntar. A quien no puede
     escribir nada —el asesor, quien solo mira— le daría un botón
     grande que falla en cuanto lo use. */
  const sePuedeHablar = puedeHablar(rol)

  /*
    ── Y LA BARRA NO ES LA MISMA PARA TODOS ──

    Cada papel ve las suyas, y de paso le caben más anchas. Con la
    barra fija esto se simplifica: ya no hay que calcular nada, solo
    quitar lo que a esa persona no le lleva a ningún sitio.

      Ayuda en casa   Inicio · Agenda · Día a día
      Asesor          Inicio · Papeles · Agenda · Cuentas
      Familia         las cinco

    A quien ayuda en casa se le quitan Papeles y Cuentas: la base de
    datos se los vacía —eso funciona— pero pasarse el día viendo dos
    pestañas que no llevan a nada no se lee como «esto no es para ti»,
    se lee como «esto está roto». Y el Día a día se le queda porque es
    literalmente su pantalla: ahí están la compra, los menús y lo que
    toca hoy.

    Al asesor se le quita el Día a día por lo mismo: la compra y los
    recados de una familia que no es la suya no le corresponden. La
    agenda sí, porque desde que puede poner fechas es donde hace su
    trabajo — «el día 20 hay un pago» va en un calendario, no en un
    WhatsApp.
  */
  const PESTANAS = pestanasDe(rol)

  /* `lg:hidden`: en grande navega el rail de la izquierda. Dos sitios
     señalando dónde estás es peor que uno. */
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="pointer-events-none relative mx-auto max-w-md">
        {voz && sePuedeHablar && (
          <Link
            href="/hablar"
            aria-label="Hablar con HUBI"
            className="tocable pointer-events-auto absolute bottom-[10px] right-4 flex flex-col items-center"
          >
            <span className="relative flex h-[52px] w-[52px] items-center justify-center">
              <span className="pulso" />
              <span className="pulso pulso-b" />
              <span
                className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full text-white"
                style={{
                  background: 'linear-gradient(140deg,#2DD4BF,#14B8A6 45%,#3B82F6)',
                  boxShadow:
                    '0 10px 26px rgba(20,184,166,.45), inset 0 1px 0 rgba(255,255,255,.35)',
                }}
              >
                <Ico nombre="onda" tam={23} grosor={2.4} />
              </span>
            </span>
          </Link>
        )}
      </div>

      <nav
        className="barra-abajo pointer-events-auto border-t border-borde bg-superficie"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto flex h-[68px] max-w-md">
          {PESTANAS.map((p) => (
            <Link
              key={p.clave}
              href={p.href}
              prefetch={false}
              aria-current={p.clave === activa ? 'page' : undefined}
              className="flex flex-1"
            >
              {/* El color y el grosor viven DENTRO, no aquí: quien
                  decide si esta pestaña está encendida es el hijo, que
                  es el único que puede preguntarle al router si la
                  navegación va en camino. */}
              <Dentro
                icono={p.icono}
                texto={p.texto}
                clave={p.clave}
                activa={activa}
                yendo={yendo}
                avisar={setYendo}
              />
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}

/*
  ═══════════════════════════════════════════════════════════════
  EL INTERIOR DE UNA PESTAÑA
  ═══════════════════════════════════════════════════════════════

  Vive dentro del `<Link>` y no fuera por una razón técnica concreta:
  `useLinkStatus` solo contesta si quien pregunta está DENTRO del
  enlace del que quiere saber. Por eso el enlace se queda con la
  distribución y todo lo demás —color, grosor, respuesta al tacto—
  baja aquí.

  ── QUÉ SIGNIFICA CADA ESTADO ──

      alguien va en camino  →  la encendida es la de destino
      nadie va a ningún lado →  la encendida es donde estás

  Nunca las dos. Dos pestañas encendidas no es «estoy aquí y voy
  allí»: es no saber dónde estás.

  ── LA PESTAÑA EN LA QUE ESTÁS VA EN TINTA, NO EN VERDE ──

  Es la misma regla que la píldora del sistema: estar en un sitio es
  un ESTADO, no una acción. Y el verde ya no es un acento — es el
  color de ámbito de la Finca, así que la pestaña activa iba pintada
  del color de una sección concreta.
*/
function Dentro({
  icono,
  texto,
  clave,
  activa,
  yendo,
  avisar,
}: {
  icono: Icono
  texto: string
  clave: string
  activa: Seccion
  yendo: string | null
  avisar: Dispatch<SetStateAction<string | null>>
}) {
  const { pending } = useLinkStatus()

  useEffect(() => {
    if (pending) avisar(clave)
    /* Y al terminar se borra SOLO si el que sobra es el mío: si para
       entonces ya hay otra pestaña en camino, borrar sin mirar me
       llevaría por delante la suya. */
    else avisar((y) => (y === clave ? null : y))
  }, [pending, clave, avisar])

  const encendida = yendo ? yendo === clave : clave === activa

  return (
    <span
      className={`tocable flex h-full w-full flex-col items-center justify-center gap-1 text-[12px] font-bold ${
        encendida ? 'text-tinta' : 'text-apagado'
      }`}
    >
      <Ico nombre={icono} tam={25} grosor={encendida ? 2.1 : 1.9} />
      <span>{texto}</span>
    </span>
  )
}
