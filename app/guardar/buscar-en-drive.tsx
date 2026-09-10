'use client'

import { useState } from 'react'
import { Aviso, BotonSecundario } from '../piezas'
import { api } from '@/lib/api'

/*
  Buscar un papel que ya está en el Drive.

  Muchos documentos no hay que fotografiarlos: llevan años en el Drive
  de Juan Miguel, sueltos, sin nombre y sin carpeta. Esto sirve para
  traerlos a HUBI sin sacarles una foto a la pantalla.

  Cómo funciona por dentro, que tiene su gracia:

  El buscador lo dibuja Google, no nosotros. Nosotros no vemos su
  Drive; solo recibimos el archivo que él señala con el dedo. Ese es
  justo el trato del permiso `drive.file`: la persona elige, y la
  aplicación recibe acceso a ESE archivo y a ninguno más. Por eso esto
  no ha necesitado pedirle a Google ni un permiso nuevo.

  Y una vez elegido, el archivo se descarga al móvil y entra por la
  MISMA puerta que una foto recién hecha. No hay un segundo camino
  paralelo con sus propias reglas: se lee igual, se clasifica igual, se
  nombra igual y se archiva igual. Un camino que solo recorren algunos
  documentos es un camino donde los fallos tardan meses en aparecer.
*/

const API = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
const PROYECTO = process.env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER

/** ¿Está configurado? Sin las dos cosas, el botón no existe. */
export const hayBuscadorDrive = Boolean(API && PROYECTO)

type Ventana = Window & {
  gapi?: { load: (m: string, cb: () => void) => void }
  google?: { picker?: Record<string, any> }
}

/** Carga el guion de Google una sola vez. */
function cargarGoogle(): Promise<void> {
  return new Promise((listo, falla) => {
    const w = window as Ventana
    if (w.gapi) return listo()

    const guion = document.createElement('script')
    guion.src = 'https://apis.google.com/js/api.js'
    guion.async = true
    guion.onload = () => listo()
    guion.onerror = () => falla(new Error('sin-guion'))
    document.head.appendChild(guion)
  })
}

export default function BuscarEnDrive({
  onArchivo,
}: {
  onArchivo: (archivo: File) => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function abrir() {
    setAviso(null)
    setOcupado(true)

    try {
      // 1 · El pase temporal, que da el servidor y solo a Juan Miguel.
      const r = await fetch(api('/api/google/permiso-picker'))
      const datos = await r.json()
      if (!r.ok || !datos.acceso) {
        /* El motivo al registro, no a la pantalla: aquí solo asusta. */
        if (datos.error) console.error('[HUBI] El pase del buscador de Drive:', datos.error)
        setAviso('Puedes hacerle una foto o elegir el archivo del teléfono.')
        setOcupado(false)
        return
      }

      // 2 · El buscador de Google.
      await cargarGoogle()
      const w = window as Ventana
      await new Promise<void>((listo) => w.gapi!.load('picker', () => listo()))

      const P = w.google!.picker!

      const vista = new P.DocsView(P.ViewId.DOCS)
        .setMimeTypes('application/pdf,image/jpeg,image/png,image/heic,image/webp')
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)

      const buscador = new P.PickerBuilder()
        .setTitle('Elige el documento')
        .setOAuthToken(datos.acceso)
        .setDeveloperKey(API!)
        // Sin esto, `drive.file` no reconoce a quién darle el archivo.
        .setAppId(PROYECTO!)
        .addView(vista)
        .setLocale('es')
        .setCallback((res: any) => {
          if (res[P.Response.ACTION] === P.Action.PICKED) {
            const doc = res[P.Response.DOCUMENTS][0]
            traer(doc[P.Document.ID], doc[P.Document.NAME], datos.acceso)
          } else if (res[P.Response.ACTION] === P.Action.CANCEL) {
            setOcupado(false)
          }
        })
        .build()

      buscador.setVisible(true)
    } catch {
      setAviso('Puedes hacerle una foto o elegir el archivo del teléfono.')
      setOcupado(false)
    }
  }

  /** Descarga el archivo elegido y lo entrega como si acabara de hacerse la foto. */
  async function traer(id: string, nombre: string, acceso: string) {
    try {
      const r = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
        { headers: { Authorization: `Bearer ${acceso}` } }
      )
      if (!r.ok) throw new Error('descarga')

      const trozo = await r.blob()
      onArchivo(new File([trozo], nombre, { type: trozo.type }))
    } catch {
      setAviso('El documento sigue en tu Drive. Vuelve a intentarlo.')
    }
    setOcupado(false)
  }

  return (
    <>
      <BotonSecundario onClick={abrir} desactivado={ocupado} icono="carpeta">
        {ocupado ? 'Abriendo el Drive…' : 'Buscar en mi Drive'}
      </BotonSecundario>

      {aviso && <Aviso titulo="No se ha podido abrir tu Drive" explicacion={aviso} />}
    </>
  )
}
