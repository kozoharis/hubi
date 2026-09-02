import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
      <body>{children}</body>
    </html>
  )
}
