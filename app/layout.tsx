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
  icons: {
    icon: '/icono-192.png',
    apple: '/apple-touch-icon.png',
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
