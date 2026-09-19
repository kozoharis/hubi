'use client'

import { useRef, useState } from 'react'
import { api } from '@/lib/api'
import { encoger } from '@/lib/encoger'
import { Ico } from '../iconos'
import CamaraDeLaPared from './camara'
import Pizarra, { type QuienPinta } from './pizarra'

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
  ⚠️  Y LA CÁMARA SE ABRE DENTRO, NO FUERA

  Haris: *«debería tener como un marco o algo así, o un botón de salir
  o atrás, por si entras sin querer»*.

  Esto abría la cámara de Android, que es OTRA APLICACIÓN: no se le
  puede poner un marco ni un «Salir» de mappel, y en una pared que va a
  pantalla completa y sin barras, quien tocaba sin querer se quedaba
  fuera de mappel y sin camino de vuelta a la vista.

  Ahora el botón abre `camara.tsx`, que es una pantalla nuestra con su
  marco, su «Salir» siempre puesto y la foto enseñada antes de
  guardarla. El `<input>` de abajo NO se va: es el camino de repuesto
  para el aparato que no deje abrir la cámara desde el navegador.

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
export default function SubirFoto({
  alTerminar,
  gente = [],
}: {
  alTerminar: () => void
  /*
    Los de la casa, para que la pizarra pueda preguntar de quién es el
    dibujo. Llega como DATOS desde `notas/page.tsx`, que es el
    servidor — nunca como una función que los busque: entre un
    componente de servidor y uno de cliente sólo pasan datos, y una
    función se compila sin una queja y revienta al abrir la pantalla.
  */
  gente?: QuienPinta[]
}) {
  const campo = useRef<HTMLInputElement>(null)
  const [abierta, setAbierta] = useState(false)
  const [pintando, setPintando] = useState(false)
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
      {abierta && (
        <CamaraDeLaPared
          alGuardar={alTerminar}
          cerrar={() => setAbierta(false)}
          /* Si esta tableta no deja abrir la cámara desde el
             navegador, se cae al camino de antes en vez de dejar a
             nadie mirando un aviso. */
          alUsarLaDelSistema={() => {
            setAbierta(false)
            campo.current?.click()
          }}
        />
      )}

      {/*
        ── Y LA PIZARRA, AL LADO DE LA CÁMARA ──

        Haris: *«con la tableta es muy fácil que los niños hagan un
        dibujo y se coloque como foto»*.

        Aquí y no en otro sitio, porque aquí está la regla que ya
        estaba escrita arriba: **hay un solo sitio desde el que se
        pone una imagen en el corcho de la casa**. Un dibujo es una
        imagen más, así que comparte botón, comparte tubería y
        comparte destino. Un segundo camino sería un segundo camino
        que mantener, y en una pared nadie va a buscar el otro.
      */}
      {pintando && (
        <Pizarra
          gente={gente}
          alGuardar={alTerminar}
          cerrar={() => setPintando(false)}
        />
      )}

      {fallo && (
        <p className="text-[17px] font-bold" style={{ color: 'var(--t-alerta)' }}>
          {fallo}
        </p>
      )}

      {/* `image/*`, que además es lo que dice el comentario de arriba de
          este mismo archivo. Estaba escrito `image/jpeg,image/png,
          image/webp`, y en el aparato SIN cámara —donde el navegador
          ignora `capture` y abre el selector— eso dejaba en gris casi
          todas las fotos de la tableta. */}
      <input
        ref={campo}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={elegida}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => setAbierta(true)}
        disabled={subiendo}
        className="tocable flex h-[60px] items-center gap-3 rounded-full border border-borde bg-fondo px-6 text-[18px] font-extrabold text-tinta disabled:opacity-60"
      >
        <Ico nombre="foto" tam={24} grosor={2.2} />
        {subiendo ? 'Guardando…' : 'Hacer una foto'}
      </button>

      <button
        type="button"
        onClick={() => setPintando(true)}
        disabled={subiendo}
        className="tocable flex h-[60px] items-center gap-3 rounded-full border border-borde bg-fondo px-6 text-[18px] font-extrabold text-tinta disabled:opacity-60"
      >
        <Ico nombre="lapiz" tam={24} grosor={2.2} />
        Pintar un dibujo
      </button>
    </div>
  )
}
