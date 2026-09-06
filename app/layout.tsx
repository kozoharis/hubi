import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { clienteSesion } from '@/lib/supabase/sesion'
import { actividadesDe, type Actividad } from '@/lib/actividades'
import { ProveedorActividades } from './actividades-contexto'

const fuente = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--fuente',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HUBI',
  description: 'Todo lo importante, en un mismo lugar.',
  manifest: '/manifest.webmanifest',
  applicationName: 'HUBI',
  /*
    ── LOS ICONOS ──

    Aquí salía el triángulo de Vercel. Dos motivos, y los dos
    silenciosos:

    1. `app/favicon.ico` seguía siendo EL DE FÁBRICA de Next. Nunca se
       tocó, y como un favicon no da error, no se notó: simplemente
       había un triángulo negro en la pestaña.
    2. `/apple-touch-icon.png` no existía. Se declaraba un archivo que
       no estaba, así que al añadir HUBI a la pantalla de inicio de un
       iPhone, Safari se inventaba el icono con una foto de la página.

    Ahora hay cuatro tamaños y cada uno es para algo:

      favicon.ico      la pestaña y los marcadores (lleva 16, 32, 48,
                       64, 128 y 256 dentro — Windows coge el grande)
      icono-32         la pestaña en pantallas normales
      icono-192/512    Android y el manifiesto
      apple-touch      la pantalla de inicio del iPhone, 180 px

    Todos sobre FONDO OSCURO (#0F172A, el mismo del manifiesto), y con
    la H que está dibujada para fondo oscuro — la otra se apaga por
    abajo y sobre negro desaparecería media pata.

    Y el de la pestaña va MÁS APRETADO que el de la aplicación: el
    margen que da aire en la pantalla de inicio de un móvil convierte
    la H en una manchita cuando el icono mide 16 píxeles. El
    «maskable» lleva todavía más, porque Android lo recorta con la
    forma que le dé la gana y se come lo de fuera del 80% central.
  */
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
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
    title: 'HUBI',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F1F5F9' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1220' },
  ],
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
  try {
    actividades = await actividadesDe(await clienteSesion())
  } catch {
    /* Sin sesión —la pantalla de entrar— o con la base caída. La barra
       tira de su lista de respaldo y se navega igual. */
  }

  return (
    <html lang="es" className={fuente.variable}>
      <head>
        {/*
          Se lee la preferencia y se marca el <html> ANTES de pintar
          nada. Si esto fuera un efecto de React, la pantalla saldría
          un instante en claro y saltaría a oscuro: un fogonazo blanco
          en la cara, de noche, es exactamente lo que no queremos.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('hubi-tema');if(t==='claro'||t==='oscuro')document.documentElement.dataset.tema=t}catch(e){}",
          }}
        />
      </head>
      <body>
        <ProveedorActividades actividades={actividades}>
          {children}
        </ProveedorActividades>
      </body>
    </html>
  )
}
