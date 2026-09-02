'use client'

/**
 * La última red: se muestra si falla algo tan de base que ni siquiera se
 * ha podido dibujar la estructura de la página. Por eso lleva su propio
 * html y body, y estilos escritos a mano en vez de las clases de la app.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body
        style={{
          background: '#F1F5F9',
          color: '#0F172A',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 34, lineHeight: 1.2, margin: 0 }}>
            Algo no ha ido bien
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: '#334155' }}>
            No se ha perdido nada. Prueba a volver a cargar.
          </p>

          <button
            onClick={reset}
            style={{
              width: '100%',
              marginTop: 32,
              padding: '20px 24px',
              fontSize: 20,
              fontWeight: 600,
              color: '#fff',
              background: '#14B8A6',
              border: 'none',
              borderRadius: 16,
            }}
          >
            Volver a intentarlo
          </button>

          <a
            href="/entrar"
            style={{
              display: 'block',
              marginTop: 16,
              padding: '18px 24px',
              fontSize: 18,
              color: '#334155',
              border: '2px solid #E2E8F0',
              borderRadius: 16,
              textDecoration: 'none',
            }}
          >
            Entrar de nuevo
          </a>

          <p style={{ marginTop: 32, fontSize: 12, color: '#64748B', wordBreak: 'break-word' }}>
            {error.message}
            {error.digest ? ` · ${error.digest}` : ''}
          </p>
        </div>
      </body>
    </html>
  )
}
