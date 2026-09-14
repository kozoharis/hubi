'use client'

import { useRef, useState } from 'react'
import { api } from '@/lib/api'
import { encoger } from '@/lib/encoger'
import { Ico } from '../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  HACER UNA FOTO DESDE LA PROPIA PARED
  ═══════════════════════════════════════════════════════════════

  Es **lo único que una pantalla de cocina puede escribir en todo MAPPEL**
  aparte de la lista de la compra. Su nivel es `nada` en casi todo, y la
  excepción está escrita a mano en la base (paso 73): un aparato puede
  insertar en `fotos_casa`, y solo ahí.

  Por eso el botón tiene que ser inconfundible y estar en un solo sitio.
  Un segundo sitio desde el que subir sería un segundo camino que
  mantener, y en una pared nadie va a buscar el otro.

  ─────────────────────────────────────────────────────────────
  `capture` ABRE LA CÁMARA, Y SI NO HAY, ABRE LOS ARCHIVOS

  `<input type="file" accept="image/*" capture="environment">` en una
  tableta con cámara abre la cámara trasera directamente. En un aparato
  sin cámara —un monitor con un miniPC detrás— el navegador ignora el
  `capture` y abre el selector de archivos. Las dos cosas son correctas
  y no hay que preguntar cuál: el aparato ya lo sabe.

  ─────────────────────────────────────────────────────────────
  Y SE ENCOGE ANTES DE SALIR

  Una foto de tableta son varios megas y en una pared no se distingue de
  una de 300 KB. `lib/encoger.ts` la deja en 1600 px antes de mandarla,
  en el propio navegador. Si algo falla ahí, se manda la original: el
  fallo va hacia «más lento», nunca hacia «no funciona».
*/
export default function SubirFoto({ alTerminar }: { alTerminar: () => void }) {
  const campo = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function elegida(e: React.ChangeEvent<HTMLInputElement>) {
    const fichero = e.target.files?.[0]
    /* Se vacía enseguida: si no, elegir la MISMA foto dos veces seguidas
       no dispara el evento y parece que la segunda vez no ha hecho
       nada. */
    e.target.value = ''
    if (!fichero) return

    setFallo(null)
    setSubiendo(true)

    try {
      const lista = await encoger(fichero)

      const paquete = new FormData()
      paquete.append('foto', lista)

      const r = await fetch(api('/api/fotos'), { method: 'POST', body: paquete })
      const d = (await r.json().catch(() => null)) as { error?: string; detalle?: string } | null

      if (!r.ok) {
        setFallo(d?.error ?? 'No se ha podido guardar la foto.')
      } else {
        alTerminar()
      }
    } catch {
      setFallo('No se ha podido guardar la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      {fallo && (
        <p className="text-[17px] font-bold" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}

      <input
        ref={campo}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={elegida}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => campo.current?.click()}
        disabled={subiendo}
        className="tocable flex h-[60px] items-center gap-3 rounded-full border border-borde bg-fondo px-6 text-[18px] font-extrabold text-tinta disabled:opacity-60"
      >
        <Ico nombre="foto" tam={24} grosor={2.2} />
        {subiendo ? 'Guardando…' : 'Hacer una foto'}
      </button>
    </div>
  )
}
