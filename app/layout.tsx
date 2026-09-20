import type { Metadata, Viewport } from 'next'
// stub
import './globals.css'
import { clienteSesion } from '@/lib/supabase/sesion'
import { actividadesDe, type Actividad } from '@/lib/actividades'
import { ProveedorActividades } from './actividades-contexto'
import Marco from './marco'
import { elEspacio } from '@/lib/espacio'
import Rail from './rail'
import Barra from './barra'
import Instalacion from './instalacion'
import SigueTrabajando from './sigue-trabajando'

const fuente = { variable: 'font-stub', className: 'font-stub' }

export const metadata: Metadata = {
  title: 'mappel',
  description: 'Todo lo importante, en un mismo lugar.',
  manifest: '/manifest.webmanifest',
  applicationName: 'mappel',

  /*
    ── FUERA DE LOS BUSCADORES ──

    Faltaba, y MAPPEL estaba abierto a Google. Lo de dentro no se podía
    leer —eso lo para el proxy— pero la puerta sí: buscando el nombre
    podía salir la dirección de la casa digital de una familia y un
    formulario donde escribir su correo.

    No es una brecha. Es que una casa privada no tiene por qué estar
    en la guía telefónica, y el punto 27 del planteamiento pide no
    usar direcciones públicas sin necesidad.

    Esto va junto con `app/robots.ts`, y hacen cosas distintas: el
    `robots.txt` es una petición educada que los buscadores serios
    respetan; esta cabecera la obedecen **también** cuando llegan a la
    página por un enlace de fuera, que es el caso que el otro no cubre.
  */
  robots: { index: false, follow: false, nocache: true },
  /*
    ── LOS ICONOS ──

    Esto es mappel cuando deja de ser una página y pasa a ser un
    botón: la pestaña del navegador y la pantalla de inicio del
    teléfono. Cada tamaño es para algo:

      favicon.ico      la pestaña y los marcadores. Lleva 16, 24, 32,
                       48, 64, 128 y 256 dentro; cada sistema coge el
                       que le conviene.
      icono-32         la pestaña en pantallas normales
      icono-192/512    Android y el manifiesto
      icono-maskable   Android otra vez, que lo recorta con la forma
                       que le dé la gana
      apple-touch      la pantalla de inicio del iPhone, 180 px

    Todos son la m sobre PAPEL CÁLIDO (#F7F5F1), el mismo de la
    aplicación y el mismo del manifiesto. Hasta septiembre de 2026
    fueron la H de HUBI sobre azul marino, y el favicon se quedó atrás
    cuando cambió todo lo demás: la pestaña de los dos siguió
    enseñando la H tres semanas más. Un favicon no da error, y por eso
    nadie lo mira.

    ── Y LO QUE CAMBIA CON EL TAMAÑO ES CUÁNTO LLENA, NO QUÉ ──

    La m mide 1,52 de ancho por 1 de alto, así que en un cuadrado
    pequeño se queda baja. Los iconos grandes van al 0,78 del lado
    —holgados, que es lo que pide una pantalla de inicio—; los de 16,
    24 y 32 van al 0,92, porque con el margen de los otros los dos
    arcos se funden en una mancha de color. El «maskable» va al revés,
    al 0,60: Android recorta un círculo del 80 % y hay que caber
    DENTRO.
  */
  icons: {
    icon: [
      /*
        ── AQUÍ NO VA `/favicon.ico`, Y ES A PROPÓSITO ──

        Estaba puesto, y salía DOS VECES en el `<head>`:

            <link rel="icon" sizes="256x256" href="/favicon.ico?favicon.0nv-…">
            <link rel="icon" sizes="any"     href="/favicon.ico">

        La primera la pone Next él solo, sin que nadie se lo pida, por
        el mero hecho de que exista `app/favicon.ico` — y además le
        cuelga una huella en la dirección para que al cambiarlo el
        navegador se entere. La segunda era ésta, escrita a mano.

        O sea que la nuestra no añadía nada y encima era la peor de las
        dos: sin huella, un navegador que se la quede en caché no se
        entera nunca de que el icono ha cambiado.

        Los PNG de abajo sí hacen falta: ésos Next no los deduce.
      */
      { url: '/icono-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icono-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icono-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  // Para que al añadirla a la pantalla de inicio se abra como una app,
  // sin la barra del navegador.
  appleWebApp: {
    capable: true,
    title: 'mappel',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  /*
    Uno solo, y es el papel.

    Eran dos, por `prefers-color-scheme`, y con el claro por defecto
    eso deja la franja de arriba del iPhone en azul marino encima de
    una aplicación de papel cálido: una costura horizontal justo
    debajo del reloj, en todas las pantallas y para todo el mundo que
    lleve el teléfono en oscuro.

    Quien elija el oscuro en Ajustes no se queda sin ella: `ColorDeBarra`
    la cambia en marcha desde cada pantalla que lo necesita, que es
    como lo hace ya la puerta con su marino.
  */
  themeColor: '#F7F5F1',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

/*
  ═══════════════════════════════════════════════════════════════
  ESTA LÍNEA ES OBLIGATORIA, Y ME COSTÓ UN ERROR 500 APRENDERLO
  ═══════════════════════════════════════════════════════════════

  Al leer las actividades aquí, la plantilla pasa a depender de la
  sesión —o sea, de las cookies—. Y Next avisa de eso lanzando un
  error interno muy concreto durante la construcción: «esta página no
  se puede pregenerar».

  El problema es que ese aviso viaja como una excepción normal, y el
  `try` de abajo se lo tragaba. Next se quedaba tan tranquilo creyendo
  que nueve pantallas eran fijas, las pregeneraba… y en Vercel
  reventaban al abrirlas. En el ordenador de uno no se nota: la
  construcción decía «9/9 correcto».

  Con esto se le dice de frente que ninguna pantalla es fija. No hay
  aviso que tragarse, no hay nada que pregenerar, y el `try` vuelve a
  hacer solo lo suyo: que si la base de datos no contesta, la barra
  tire de su lista de respaldo.
*/
export const dynamic = 'force-dynamic'

/*
  LAS ACTIVIDADES SE LEEN AQUÍ, UNA VEZ, Y PARA TODA LA APLICACIÓN.

  La barra de abajo sale en todas las pantallas y sus pestañas
  dependen de qué tenga cada casa —la Finca y Los Helechos aquí; las
  obras y la casa en otra—. Leerlas en cada pantalla sería quince
  consultas y quince sitios donde olvidarse; pedirlas desde el
  navegador haría que la barra parpadeara al cargar.

  Se leen aquí y se dejan disponibles. Si algo falla, `actividadesDe`
  devuelve las de siempre: nadie se queda sin poder navegar.
*/
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let actividades: Actividad[] = []
  let rol: string | null = null
  /*
    ── Y DE QUÉ CLASE ES QUIEN MIRA ──

    Una pantalla colgada en la cocina es un miembro más de la casa
    (`clase = 'dispositivo'`), y hasta ahora se le daba exactamente la
    misma navegación que a una persona: las cinco pestañas, Papeles y
    Cuentas incluidas — que para ella están vacías porque
    `nivel_por_rol('casa', …)` dice `nada`— y el botón de HABLAR.

    No era una fuga: no abría nada que no debiera. Pero una pantalla de
    pared no se navega, se MIRA, y un menú de cinco puertas de las que
    tres no llevan a ningún sitio es lo contrario de eso.
  */
  let esPantalla = false
  let usaCompra = true
  /* Si esta casa tiene Google conectado. Lo pide la barra de abajo
     desde que vive aquí: con Drive conectado el Inicio ya enseña
     HABLAR en grande y el botón flotante sobraría. */
  let conectado = false

  try {
    const supabase = await clienteSesion()
    actividades = await actividadesDe(supabase)

    /*
      QUIÉN ESTÁ ENTRANDO, Y SI ESTA CASA HACE LA COMPRA.

      Las dos cosas las necesita la barra de abajo para saber qué
      pestañas poner. Se leen aquí, una vez, y no en cada pantalla:
      quince sitios donde acordarse es quince sitios donde olvidarse.

      Todo dentro del mismo `try`. Si algo de esto fallara —la
      columna `rol` sin crear, la base caída— se navega con la barra
      de siempre. Que falte no puede dejar a nadie sin poder moverse.
    */
    const { data: user } = await supabase.auth.getUser()
    const yo = user?.user?.id ?? null

    if (yo) {
      /*
        EN QUÉ CASA ESTÁ, Y SALE DE LA RUTA.

        Aquí se preguntaba a `mi_hogar()`, o sea al dato global. Tenía
        sentido mientras el espacio era único: quien está en dos casas
        tiene dos filas con dos roles distintos —familia en la suya,
        ayuda en la de al lado— y coger una al azar le pondría la
        navegación equivocada la mitad de las veces.

        Desde el paso 3 la respuesta buena está en la dirección, y
        `elEspacio()` la da. Con el dato global, abrir la casa de un
        cliente en una pestaña le cambiaba las pestañas a la otra.

        Y es lo mismo que contestan las políticas, que es la única
        manera de que la pantalla y los permisos no se contradigan.
      */
      const casaActiva = await elEspacio(supabase)

      const { data: mio } = casaActiva
        ? await supabase
            .from('miembros')
            .select('rol, clase, hogar_id')
            .eq('perfil_id', yo)
            .eq('hogar_id', casaActiva as string)
            .maybeSingle()
        : await supabase
            .from('miembros')
            .select('rol, clase, hogar_id')
            .eq('perfil_id', yo)
            .limit(1)
            .maybeSingle()

      rol = (mio?.rol as string | null) ?? null
      esPantalla = (mio?.clase as string | null) === 'dispositivo'

      if (mio?.hogar_id) {
        /* Las dos, a la vez. Son dos tablas distintas y ninguna
           depende de la otra, así que esperarlas una detrás de otra
           sería un viaje de más en TODAS las pantallas. */
        const [{ data: casa }, { data: drive }] = await Promise.all([
          supabase
            .from('hogares')
            .select('usa_compra')
            .eq('id', mio.hogar_id)
            .maybeSingle(),
          supabase
            .from('conexion_drive')
            .select('estado')
            .eq('hogar_id', mio.hogar_id)
            .maybeSingle(),
        ])
        if (casa && casa.usa_compra === false) usaCompra = false
        conectado = drive?.estado === 'activa'
      }
    }
  } catch {
    /* Sin sesión —la pantalla de entrar— o con la base caída. La barra
       tira de su lista de respaldo y se navega igual. */
  }

  /*
    ── LA PANTALLA DE LA PARED VA SIEMPRE EN CLARO ──

    Una tableta colgada en la cocina no es el teléfono de nadie: es un
    objeto de la casa, como un calendario de papel. Y salía NEGRA,
    porque heredaba el modo oscuro del sistema a través de
    `prefers-color-scheme`, y en esa tableta no hay nadie que vaya a
    entrar en Ajustes a cambiarlo.

    El punto 28 del planteamiento lo dice sin matices —«no quiero
    interfaz negra»—, y aquí además es lo práctico: lo que se cuelga en
    una cocina se lee de un vistazo y desde lejos, y eso es tinta oscura
    sobre papel claro.

    De noche ya baja sola: `reloj.tsx` atenúa la pantalla entera a partir
    de las once. Bajar el brillo es lo que hace falta; cambiar de color
    no.
  */
  return (
    <html lang="es" className={fuente.variable} data-tema={esPantalla ? 'claro' : undefined}>
      <head>
        {/*
          Se lee la preferencia y se marca el <html> ANTES de pintar
          nada. Si esto fuera un efecto de React, la pantalla saldría
          un instante en claro y saltaría a oscuro: un fogonazo blanco
          en la cara, de noche, es exactamente lo que no queremos.

          Tres valores, y ninguno es el que tenga el teléfono por su
          cuenta: `claro`, `oscuro` y `sistema`. Sin nada guardado no se
          pone atributo, y sin atributo mappel es CLARO — la regla está
          explicada en `globals.css`.

          Y si el servidor ya ha puesto un tema —la pantalla de la
          pared—, ése manda: el guardado en la tableta no lo pisa.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(!document.documentElement.dataset.tema){var t=localStorage.getItem('mappel-tema');if(t==='claro'||t==='oscuro'||t==='sistema')document.documentElement.dataset.tema=t}}catch(e){}",
          }}
        />

        {/*
          Y lo mismo con cuántas cosas se ven a la vez. Antes de pintar
          y por el mismo motivo: si esto fuera un efecto de React, la
          lista de Papeles saldría con filas de 56 y saltaría a 48 un
          instante después. Doscientas filas moviéndose a la vez se ve
          como un tirón, y en una pantalla que está leyendo alguien
          mayor eso es peor que cualquier fallo de medida.

          Sin nada guardado no se pone atributo, y sin atributo manda
          el puntero — que es la regla de serie y la buena para casi
          todo el mundo.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=localStorage.getItem('mappel-densidad');if(d==='touch'||d==='comfortable'||d==='work')document.documentElement.dataset.densidad=d}catch(e){}",
          }}
        />

        {/*
          ── LA PANTALLA QUE SALE MIENTRAS ARRANCA, EN EL iPHONE ──

          Al tocar mappel en la pantalla de inicio, Safari enseña un
          BLANCO mientras carga, y sólo después entra el arranque de la
          propia aplicación. Es un parpadeo de blanco entre el dedo y
          la marca, y sobre papel cálido se ve perfectamente.

          Se arregla declarando una imagen por tamaño exacto de
          pantalla. iOS no escala: o el `media` coincide con el
          teléfono al píxel, o vuelve al blanco. De ahí que haya doce y
          no una.

          Las doce son el mismo papel con la m puesta EXACTAMENTE donde
          la pone `app/arranque.tsx` —88 de alto, centrada como si
          debajo ya estuvieran la raya y la palabra—, así que cuando
          iOS suelta su imagen y entra la nuestra no se mueve nada: lo
          que pasa después es que aparecen la raya y el nombre.

          Se generan con `instalada.py`, y no se escriben a mano: son
          doce etiquetas con doce medidas y una mal puesta no falla,
          simplemente vuelve al blanco en ese teléfono.
        */}
        <link rel="apple-touch-startup-image" href="/arranque/iphone-se1.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/arranque/iphone-8.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/arranque/iphone-8-plus.png" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/arranque/iphone-x.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/arranque/iphone-xr.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/arranque/iphone-xs-max.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/arranque/iphone-12.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/arranque/iphone-12-max.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/arranque/iphone-14.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/arranque/iphone-14-max.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/arranque/iphone-16.png" media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/arranque/iphone-16-max.png" media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
      </head>
      <body>
        {/*
          TODO VA DENTRO DEL MARCO, y el marco es lo que se desliza.

          El <body> se queda quieto —alto de pantalla y sin desbordé—
          para que el rebote del final ocurra aquí dentro y no arrastre
          consigo la barra de abajo ni la cabecera, que están clavadas
          a la ventana. El porqué largo está en `globals.css`.
        */}
        {/*
          No pinta nada. Registra el trabajador de fondo al cargar
          —hasta ahora sólo se registraba si alguien pulsaba «Activar
          los avisos», y sin eso Chrome en Android no ofrece instalar
          mappel— y se queda con el aviso de instalación que manda el
          navegador, que llega a los pocos segundos y sólo una vez.
        */}
        <Instalacion />

        {/*
          Tampoco pinta nada por su cuenta: deja pulsado el botón que
          está esperando al servidor, en las cincuenta pantallas a la
          vez. El porqué está en `lib/sigue-trabajando.ts`.
        */}
        <SigueTrabajando />

        <ProveedorActividades casa={{ actividades, rol, usaCompra, esPantalla, conectado }}>
          {/*
            ── DOS SUPERFICIES, UN ARMAZÓN ──

            En el móvil esto es una sola columna que se desliza, con la
            barra de pestañas abajo: exactamente lo de siempre, sin
            tocar.

            A partir de 1024 px se convierte en dos: el rail de pie a
            la izquierda y el contenido a su derecha. El rail no se
            desliza —está fuera del marco—, así que la navegación se
            queda quieta mientras se lee, que es lo que se espera de un
            ordenador y lo contrario de lo que se espera de un móvil.

            La barra de abajo se esconde sola en grande (`lg:hidden` en
            su propio archivo); si salieran las dos, habría dos sitios
            señalando dónde estás.
          */}
          <div className="flex h-full">
            <Rail />
            <Marco>{children}</Marco>

            {/*
              ── Y LA BARRA DE ABAJO, AQUÍ TAMBIÉN ──

              Fuera del `<Marco>`, igual que el rail. Eso es todo el
              arreglo: al vivir fuera de lo que cambia, no se va
              cuando cambias de pestaña. El porqué largo está en
              `barra.tsx`.

              Va DESPUÉS del marco en el documento porque está fija
              encima de él: así queda por delante sin tener que
              inventarse un `z-index` nuevo.
            */}
            <Barra />
          </div>
        </ProveedorActividades>
      </body>
    </html>
  )
}
