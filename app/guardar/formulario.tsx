'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cadena, type Categoria } from '@/lib/rutas'
import { Ico } from '../iconos'
import BuscarEnDrive, { hayBuscadorDrive } from './buscar-en-drive'
import { leerAqui } from './leer-aqui'
import { leerPdf } from './leer-pdf'
import CamposEstancia, { ESTANCIA_VACIA, type Estancia } from '../estancia'
import type { Reserva } from '@/lib/reservas'

type Paso =
  | 'archivo'
  | 'paginas'
  | 'leyendo'
  | 'encontrado'
  | 'estancia'
  | 'editar'
  | 'categoria'
  | 'guardado'

type Datos = {
  titulo: string
  categoriaId: string | null
  fecha: string
  importe: string
  proveedor: string
  vencimiento: string
  texto: string | null
  confianza: 'alta' | 'media' | 'baja' | null
  tipo: string | null
}

const HOY = () => new Date().toISOString().slice(0, 10)
const MAXIMO = 4 * 1024 * 1024

export default function Formulario({
  categorias,
  esPropietario = false,
}: {
  categorias: Categoria[]
  /* El buscador de Drive abre la cuenta de Juan Miguel. Solo él. */
  esPropietario?: boolean
}) {
  const [paso, setPaso] = useState<Paso>('archivo')

  /*
    Las páginas fotografiadas, en orden. Un PDF suelto no pasa por aquí.

    Cada página se guarda DOS VECES, y esa es la corrección:

    `subir` — la foto encogida y en JPEG. Es la que va a Drive: una foto
    de móvil pesa diez megas y no hay por qué guardar diez megas de una
    factura del agua.

    `leer` — la foto TAL CUAL SALIÓ DE LA CÁMARA. Es la que se lee.

    Hasta ahora solo existía la primera, y se leía esa. Encoger a 2000
    píxeles y volver a comprimir en JPEG al 85% no es gratis: donde
    había una letra de cuerpo 8 queda una mancha, y el JPEG además
    inventa un halo alrededor de cada trazo. Estábamos pidiéndole al
    lector que adivinara un texto que nosotros mismos habíamos borrado
    antes de enseñárselo.

    Ocupa memoria durante un minuto. Merece la pena.
  */
  const [paginas, setPaginas] = useState<{ subir: File; leer: File }[]>([])
  const [archivo, setArchivo] = useState<File | null>(null)
  const [vista, setVista] = useState<string | null>(null)

  const [padre, setPadre] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  /* El motivo técnico, cuando el servidor lo manda. No se le enseña a
     Juan Miguel ni a Conchita —a ellos no les dice nada— pero mientras
     esto se está montando, tener el mensaje exacto de Google delante
     ahorra media hora de adivinar dónde está el fallo. */
  const [detalle, setDetalle] = useState<string | null>(null)

  /* Cuánto lleva leído, de 0 a 100. El móvil tarda unos segundos en
     leer un papel, y una espera que no dice nada parece una avería. */
  const [avance, setAvance] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [resultado, setResultado] = useState<{
    id: string
    ruta: string
    vencimiento: string | null
    titulo: string
    /* La reserva ya estaba apuntada: el papel se guarda igual, pero el
       ingreso NO se suma dos veces. Hay que decirlo, o cuadrar las
       cuentas dentro de tres meses será un misterio. */
    repetida: string | null
  } | null>(null)
  const [avisoResuelto, setAvisoResuelto] = useState(false)
  const [creandoAviso, setCreandoAviso] = useState(false)

  /* Los datos de Los Helechos: apartamento, noches, personas, huésped
     y número de reserva. Solo se piden si el documento acaba en esa
     sección — una factura de la luz de la finca no los ve. */
  const [estancia, setEstancia] = useState<Estancia>(ESTANCIA_VACIA)

  const [datos, setDatos] = useState<Datos>({
    titulo: '',
    categoriaId: null,
    fecha: HOY(),
    importe: '',
    proveedor: '',
    vencimiento: '',
    texto: null,
    confianza: null,
    tipo: null,
  })

  const camara = useRef<HTMLInputElement>(null)
  const disco = useRef<HTMLInputElement>(null)
  const abandonado = useRef(false)
  const [tardando, setTardando] = useState(false)
  /* Está pidiendo ayuda para leer el papel. Se dice: una espera que
     cambia de duración sin explicarse parece una avería. */
  const [ayuda, setAyuda] = useState(false)

  useEffect(() => {
    if (paso !== 'leyendo') {
      setTardando(false)
      setAyuda(false)
      return
    }
    const reloj = setTimeout(() => setTardando(true), 12_000)
    return () => clearTimeout(reloj)
  }, [paso])

  const porId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])

  const hijosDe = useMemo(() => {
    const mapa = new Map<string | null, Categoria[]>()
    for (const c of categorias) mapa.set(c.padre_id, [...(mapa.get(c.padre_id) ?? []), c])
    return mapa
  }, [categorias])

  /*
    ¿Este documento acaba en Los Helechos?

    Se mira subiendo desde la carpeta elegida hasta la raíz. Así, si
    mañana se crea "Helechos → Gastos → Jardín", entra sola: no hay
    ninguna lista de carpetas escrita a mano que actualizar.
  */
  const enHelechos = useMemo(() => {
    if (!datos.categoriaId) return false
    return cadena(categorias, datos.categoriaId).some(
      (c) => c.segmento_drive === 'HELECHOS' && !c.padre_id
    )
  }, [categorias, datos.categoriaId])

  const esIngreso = useMemo(() => {
    if (!datos.categoriaId) return false
    return porId.get(datos.categoriaId)?.naturaleza === 'ingreso'
  }, [porId, datos.categoriaId])

  const rutaElegida = datos.categoriaId
    ? cadena(categorias, datos.categoriaId).map((c) => c.nombre).join(' → ')
    : null

  const migas = useMemo(() => {
    const camino: Categoria[] = []
    let actual = padre ? porId.get(padre) : undefined
    while (actual) {
      camino.unshift(actual)
      actual = actual.padre_id ? porId.get(actual.padre_id) : undefined
    }
    return camino
  }, [padre, porId])

  // ── 1 · Capturar ──────────────────────────────────────────
  function recibirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir la misma foto
    if (original) admitir(original)
  }

  /*
    La única puerta de entrada de un documento.

    Da igual de dónde venga —la cámara, el carrete o el Drive—: todo
    entra por aquí. Mientras no haya más de un camino, tampoco puede
    haber un camino con fallos que nadie recorre.
  */
  async function admitir(original: File) {
    setAviso(null)
    setDetalle(null)

    // Un PDF ya es un documento completo: no hay páginas que juntar.
    if (original.type === 'application/pdf') {
      if (original.size > MAXIMO) {
        setAviso('Ese PDF pesa demasiado. El máximo son 4 MB.')
        return
      }
      arrancarLectura(original)
      return
    }

    const comprimida = await comprimir(original, 2000, 0.85)
    setPaginas((p) => [...p, { subir: comprimida, leer: original }])
    setPaso('paginas')
  }

  // ── 2 · Cerrar el documento y leerlo ──────────────────────
  async function continuarConPaginas() {
    setPreparando(true)
    setAviso(null)

    try {
      const definitivo =
        paginas.length === 1
          ? paginas[0].subir
          : await construirPdf(paginas.map((p) => p.subir))

      if (definitivo.size > MAXIMO) {
        setAviso(
          `El documento pesa demasiado con ${paginas.length} páginas. Quita alguna o hazlas por separado.`
        )
        setPreparando(false)
        return
      }

      setPreparando(false)
      /* Se sube el PDF, pero se leen las fotos originales. Volver a
         dibujar el PDF para leerlo sería leer una copia de una copia. */
      arrancarLectura(definitivo, paginas.map((p) => p.leer))
    } catch {
      setPreparando(false)
      setAviso('No se han podido juntar las páginas. Prueba con menos.')
    }
  }

  /**
   * `f` es lo que se GUARDA. `paraLeer`, si viene, es lo que se LEE.
   *
   * Casi siempre son lo mismo. Se separan cuando el archivo que va a
   * Drive es una versión empeorada del papel —el PDF que juntamos con
   * varias fotos— y todavía tenemos las fotos buenas a mano.
   */
  function arrancarLectura(f: File, paraLeer?: File[]) {
    setAvance(0)
    setArchivo(f)
    setVista(f.type === 'application/pdf' ? null : URL.createObjectURL(f))
    abandonado.current = false
    setPaso('leyendo')
    analizar(f, paraLeer)
  }

  async function analizar(f: File, paraLeer?: File[]) {
    try {
      setAvance(0)

      /*
        ── QUIÉN LEE QUÉ, Y EN QUÉ ORDEN ──

        Tres caminos, y el orden importa tanto como el reparto.

        1 · UN PDF QUE LLEGA POR CORREO lleva el texto ESCRITO dentro.
        Sacarlo es leerlo literalmente: instantáneo, exacto, gratis, y
        sin que el documento salga del teléfono. Ahí no hay nada que
        mejorar y no se toca.

        2 · UNA FOTO DE UN PAPEL va al modelo, que ve la imagen. Se
        intentó al revés durante tres rondas —leer en el móvil y
        deducir con reglas escritas a mano— y las tres falló en el
        mismo sitio. Y no fallaba quedándose corto, que se ve enseguida:
        fallaba sacando algo CREÍBLE Y EQUIVOCADO ("Ef» Po Pi" como
        nombre de una tienda) que además tapaba el fallo, porque con
        los campos llenos ya no pedía ayuda.

        Y va PRIMERO, antes de reconocer nada aquí. Antes se leía en el
        móvil y luego se mandaba la foto igual: eran diez segundos de
        espera para tirar el resultado. El modelo tarda menos que el
        reconocedor del teléfono.

        3 · SOLO SI EL MODELO NO PUEDE —sin cupo, sin conexión, un
        error— se lee aquí. El móvil deja de ser el primero y pasa a
        ser la red: peor es quedarse sin nada.

        Lo que hizo posible esto no fue cambiar de opinión: fue que la
        voz dejó de mandar audio a Gemini. El cupo se lo comía ella,
        no los documentos.
      */

      // ── 1 · ¿Es un PDF con el texto dentro? ────────────────
      let textoDelMovil = ''
      let digital = false

      if (!paraLeer?.length && f.type === 'application/pdf') {
        const pdf = await leerPdf(f, (p) => setAvance(Math.round(p * 60)))
        if (abandonado.current) return
        textoDelMovil = pdf.texto
        digital = pdf.digital
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let leido: any = null
      let falloDelModelo: string | null = null

      // ── 2 · Si no lo era, que lo lea el modelo ─────────────
      /*
        Y QUE LA VEA BIEN.

        Hasta ahora se le mandaba `f`, que es la versión encogida a
        2000 px y recomprimida en JPEG al 85% —la que va a Drive—.
        Pedirle que lea una letra de cuerpo 8 en una copia degradada es
        el mismo error que ya cometimos con el reconocedor del móvil,
        repetido con otro lector.

        Va la foto TAL CUAL salió de la cámara. Y si pesa más de lo que
        admite una petición, se encoge lo justo y con calidad alta —no
        con la del archivo—.
      */
      const original = paraLeer?.length === 1 ? paraLeer[0] : null
      const paraElModelo =
        original && original.size <= MAXIMO
          ? original
          : original
            ? await comprimir(original, 2600, 0.92)
            : f

      if (!digital && archivoSirve(paraElModelo)) {
        setAyuda(true)
        setAvance(0)
        try {
          const cuerpo = new FormData()
          cuerpo.append('archivo', paraElModelo)
          const conFoto = await fetch('/api/analizar', { method: 'POST', body: cuerpo })
          if (abandonado.current) return

          const respuesta = await conFoto.json()
          if (conFoto.ok) leido = respuesta
          else {
            /*
              AQUÍ HABÍA UN SILENCIO, Y ERA MÍO.

              Si esto fallaba, se seguía con lo que hubiera y no se
              decía NADA. Se veían datos raros sin ninguna pista de que
              hubo un intento fallido detrás, ni de si fue el cupo, la
              conexión o la foto. El mismo tipo de fallo mudo que ya
              nos costó una tarde con el borrado.
            */
            falloDelModelo = respuesta?.error ?? `El lector no ha respondido (${conFoto.status}).`
          }
        } catch (e) {
          falloDelModelo =
            e instanceof Error ? `No se ha podido consultar: ${e.message}` : 'Sin conexión.'
        }
        setAyuda(false)
      }

      // ── 3 · La red: leerlo aquí ────────────────────────────
      if (!leido) {
        if (!textoDelMovil) {
          if (paraLeer?.length) {
            const trozos: string[] = []
            for (let i = 0; i < paraLeer.length; i++) {
              trozos.push(
                await leerAqui(paraLeer[i], (p) =>
                  setAvance(Math.round(((i + p) / paraLeer.length) * 100))
                )
              )
              if (abandonado.current) return
            }
            textoDelMovil = trozos.join('\n').trim()
          } else if (f.type !== 'application/pdf') {
            textoDelMovil = await leerAqui(f, (p) => setAvance(Math.round(p * 100)))
          }
        }
        if (abandonado.current) return

        if (textoDelMovil.trim()) {
          const r = await fetch('/api/analizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto: textoDelMovil }),
          })
          if (abandonado.current) return
          if (r.ok) leido = await r.json()
          else {
            const fallo = await r.json().catch(() => ({}))
            falloDelModelo = falloDelModelo ?? fallo.error ?? null
          }
        }
      }

      if (abandonado.current) return

      /* Ni el modelo ni el móvil. Se va a elegir carpeta a mano, con
         el motivo exacto delante para no tener que adivinarlo. */
      if (!leido) {
        setAviso(
          falloDelModelo
            ? 'No he podido leer este documento. Dime tú dónde va.'
            : 'No se ha leído texto en la foto. Prueba con más luz o clasifícalo a mano.'
        )
        setDetalle(falloDelModelo)
        setPaso('categoria')
        return
      }

      /* Se ha leído, pero por la red de emergencia y a medias. El papel
         se guarda igual; lo que no puede pasar es que nadie sepa por
         qué los datos vienen cojos. */
      if (falloDelModelo && !bastante(leido)) {
        setAviso('No he podido leerlo del todo. Repasa los datos antes de guardar.')
        setDetalle(falloDelModelo)
      }

      const reserva: Reserva | null = leido.reserva ?? null
      setEstancia(
        reserva
          ? {
              apartamento: null,
              personas: reserva.personas,
              noches: reserva.noches,
              huesped: reserva.huesped ?? '',
              referencia: reserva.referencia ?? '',
            }
          : ESTANCIA_VACIA
      )

      setDatos({
        titulo: leido.titulo ?? '',
        categoriaId: leido.categoria_id ?? null,
        fecha: leido.fecha ?? HOY(),
        importe: leido.importe != null ? String(leido.importe) : '',
        proveedor: leido.proveedor ?? '',
        vencimiento: leido.vencimiento ?? '',
        texto: leido.texto ?? null,
        confianza: leido.confianza ?? null,
        tipo: leido.tipo ?? null,
      })

      setPaso(leido.categoria_id ? 'encontrado' : 'categoria')
    } catch (e) {
      if (abandonado.current) return
      setAviso('No se ha podido leer el documento. Clasifícalo a mano.')
      /* El motivo real, en letra pequeña. Sin esto, un fallo del
         lector y un fallo de conexión se ven exactamente igual — y se
         acaba arreglando lo que no era. */
      setDetalle(e instanceof Error ? e.message.slice(0, 220) : null)
      setPaso('categoria')
    }
  }

  function elegirCategoria(c: Categoria) {
    if ((hijosDe.get(c.id) ?? []).length > 0) {
      setPadre(c.id)
      return
    }
    setDatos((d) => ({ ...d, categoriaId: c.id, titulo: d.titulo || c.nombre }))
    setPadre(null)
    setPaso(datos.confianza ? 'editar' : 'encontrado')
  }

  async function guardar() {
    if (!archivo || !datos.categoriaId) return
    setGuardando(true)
    setAviso(null)

    const cuerpo = new FormData()
    cuerpo.append('archivo', archivo)
    cuerpo.append('categoria_id', datos.categoriaId)
    cuerpo.append('titulo', datos.titulo.trim())
    cuerpo.append('fecha_documento', datos.fecha)
    cuerpo.append('importe', datos.importe)
    cuerpo.append('proveedor', datos.proveedor)
    cuerpo.append('vencimiento', datos.vencimiento)
    if (datos.texto) cuerpo.append('texto_ocr', datos.texto)
    if (datos.confianza) cuerpo.append('confianza', datos.confianza)

    if (enHelechos) {
      if (estancia.apartamento) cuerpo.append('apartamento', String(estancia.apartamento))
      if (estancia.personas) cuerpo.append('personas', String(estancia.personas))
      if (estancia.noches) cuerpo.append('noches', String(estancia.noches))
      if (estancia.huesped.trim()) cuerpo.append('huesped', estancia.huesped.trim())
      if (estancia.referencia.trim()) cuerpo.append('referencia', estancia.referencia.trim())
    }

    try {
      const r = await fetch('/api/documentos', { method: 'POST', body: cuerpo })
      const respuesta = await r.json()

      if (!r.ok) {
        setAviso(respuesta.error ?? 'No se ha podido guardar.')
        setGuardando(false)
        return
      }
      setResultado({
        id: respuesta.id,
        ruta: respuesta.ruta,
        vencimiento: respuesta.vencimiento ?? null,
        titulo: respuesta.titulo ?? datos.titulo,
        repetida: respuesta.repetida ?? null,
      })
      setPaso('guardado')
    } catch {
      setAviso('No hay conexión. Comprueba tu internet e inténtalo otra vez.')
    }
    setGuardando(false)
  }

  // ══ ¿VENCE? ═══════════════════════════════════════════════
  // Nunca se crea un aviso sin preguntar. Pero el vencimiento sí se
  // marca siempre en el calendario: es información del documento.
  async function marcarVencimiento(aviso: string) {
    if (!resultado?.vencimiento) return
    setCreandoAviso(true)
    try {
      await fetch('/api/recordatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: `Vence: ${resultado.titulo}`,
          tipo: 'vencimiento',
          asignado_a: null,
          fecha: resultado.vencimiento,
          aviso_previo: aviso,
          documento_origen_id: resultado.id,
        }),
      })
    } catch {
      // Si falla, el documento ya está guardado: no se pierde nada.
    }
    setCreandoAviso(false)
    setAvisoResuelto(true)
  }

  if (paso === 'guardado' && resultado?.vencimiento && !avisoResuelto) {
    return (
      <main className="flex min-h-screen flex-col justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-md">
          <p className="flex items-center justify-center gap-2 text-center text-[17px] font-bold text-verde"><Ico nombre="check" tam={20} grosor={2.2} /> Documento guardado</p>

          <h1 className="mt-8 text-center text-[26px] font-extrabold leading-tight tracking-tight text-tinta">
            Este documento vence el
          </h1>
          <p className="mt-3 text-center text-[24px] font-extrabold text-coral">
            {enPalabras(resultado.vencimiento)}
          </p>

          <p className="mt-8 text-center text-lg leading-relaxed text-tinta-suave">
            Lo marcamos en el calendario.
            <br />
            ¿Queréis que además os avisemos?
          </p>

          <div className="mt-10 space-y-4">
            {[
              ['1_mes', 'Un mes antes'],
              ['1_semana', 'Una semana antes'],
              ['1_dia', 'Un día antes'],
            ].map(([valor, texto]) => (
              <button
                key={valor}
                onClick={() => marcarVencimiento(valor)}
                disabled={creandoAviso}
                className="w-full flex h-[64px] items-center justify-center rounded-[18px] bg-verde text-[18px] font-extrabold text-white disabled:opacity-40"
              >
                {texto}
              </button>
            ))}
            <button
              onClick={() => marcarVencimiento('sin_aviso')}
              disabled={creandoAviso}
              className="w-full flex h-[64px] items-center justify-center rounded-[18px] border border-borde bg-superficie text-[18px] font-bold text-tinta-suave disabled:opacity-40"
            >
              Solo en el calendario
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ══ PANTALLA FINAL ════════════════════════════════════════
  if (paso === 'guardado' && resultado) {
    return (
      <main className="flex min-h-screen flex-col justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-verde text-white">
            <Ico nombre="check" tam={40} grosor={2.2} />
          </div>
          <h1 className="mt-8 text-[28px] font-extrabold leading-tight tracking-tight text-tinta">
            Documento guardado
          </h1>
          <p className="mt-4 text-lg text-tinta-suave">{resultado.ruta}</p>

          {resultado.repetida && (
            <p className="mt-6 rounded-[16px] bg-coral-suave px-4 py-3.5 text-left text-[16px] font-semibold leading-snug text-coral">
              La reserva {resultado.repetida} ya estaba apuntada, así que el ingreso no se
              ha sumado otra vez. El documento sí se ha guardado.
            </p>
          )}

          <div className="mt-12 space-y-4">
            <Link
              href={`/documentos/${resultado.id}`}
              className="block flex h-[62px] items-center justify-center rounded-[18px] bg-verde text-[18px] font-extrabold text-white"
            >
              Ver documento
            </Link>
            <Link href="/guardar" className="block flex h-[62px] items-center justify-center rounded-[18px] border border-borde bg-superficie text-[18px] font-bold text-tinta-suave">
              Guardar otro
            </Link>
            <Link href="/" className="block flex h-[62px] items-center justify-center rounded-[18px] border border-borde bg-superficie text-[18px] font-bold text-tinta-suave">
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="techo-holgado min-h-screen px-6 pb-10">
      {/*
        Los dos campos de archivo viven aquí, fuera de las pantallas.
        Si se declararan dentro de cada paso, al cambiar de pantalla la
        referencia apuntaría a un elemento que ya no existe y el botón
        de "añadir otra página" no haría nada.
      */}
      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={recibirArchivo} />
      {/*
        `image/*` en vez de la lista cerrada de antes.

        Con una lista concreta de tipos, Chrome en Android abre el
        selector de FOTOS —la galería del carrete y poco más— donde
        Google Drive no aparece por ningún lado. Con `image/*` junto a
        los PDF abre el selector de ARCHIVOS del sistema, que sí lleva
        Drive, Descargas y el resto de sitios en su menú lateral.

        No entra basura por ampliarlo: todo lo que no es PDF pasa por
        `comprimir()`, que lo redibuja en un lienzo y lo devuelve
        convertido en JPEG. Un HEIC del iPhone o un WEBP acaban siendo
        el mismo JPEG que una foto normal.
      */}
      <input ref={disco} type="file" accept="image/*,application/pdf,.pdf" hidden onChange={recibirArchivo} />

      <div className="mx-auto w-full max-w-md">
        {paso !== 'leyendo' && (
          <button onClick={atras} className="flex h-11 items-center gap-2 text-[16px] font-bold text-tinta-suave">
            ← Volver
          </button>
        )}

        {/* ══ 1 · EL ARCHIVO ══ */}
        {paso === 'archivo' && (
          <>
            <h1 className="mt-8 text-[28px] font-extrabold leading-tight tracking-tight text-tinta">
              Guardar documento
            </h1>
            <div className="mt-10 space-y-4">
              <button onClick={() => camara.current?.click()} className="w-full flex h-[76px] items-center justify-center gap-3 rounded-[20px] bg-verde text-[19px] font-extrabold text-white">
                <Ico nombre="foto" tam={24} grosor={2.1} /> Hacer foto
              </button>
              <button onClick={() => disco.current?.click()} className="w-full flex h-[76px] items-center justify-center gap-3 rounded-[20px] border border-borde bg-superficie text-[19px] font-bold text-tinta">
                <Ico nombre="papel" tam={24} grosor={2.1} /> Elegir archivo
              </button>

              {/* Solo aparece si está configurado Y si es su Drive.
                  Un botón que no puede funcionar es peor que no tenerlo. */}
              {esPropietario && hayBuscadorDrive && (
                <BuscarEnDrive onArchivo={admitir} />
              )}
            </div>
            <p className="mt-8 text-center text-base leading-relaxed text-tenue">
              Si el documento tiene varias páginas, podrás añadirlas después.
            </p>
          </>
        )}

        {/* ══ 2 · LAS PÁGINAS ══ */}
        {paso === 'paginas' && (
          <>
            <h1 className="mt-8 text-[28px] font-extrabold leading-tight tracking-tight text-tinta">
              {paginas.length === 1
                ? '¿Tiene más páginas?'
                : `${paginas.length} páginas`}
            </h1>

            <p className="mt-4 text-lg leading-relaxed text-tinta-suave">
              {paginas.length === 1
                ? 'Si el documento sigue por detrás o en otra hoja, fotografía también esa página.'
                : 'Se guardarán juntas como un solo documento.'}
            </p>

            <ul className="mt-8 space-y-4">
              {paginas.map((p, i) => (
                <li key={i} className="overflow-hidden rounded-[18px] border border-borde bg-superficie">
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-lg font-medium text-tinta">Página {i + 1}</span>
                    <button
                      onClick={() => setPaginas((ps) => ps.filter((_, j) => j !== i))}
                      className="text-[16px] font-bold text-coral"
                    >
                      Quitar
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(p.subir)} alt={`Página ${i + 1}`} className="max-h-64 w-full object-contain" />
                </li>
              ))}
            </ul>

            <div className="mt-8 space-y-4">
              <button
                onClick={() => camara.current?.click()}
                className="w-full flex h-[68px] items-center justify-center gap-3 rounded-[20px] border border-borde bg-superficie text-[18px] font-bold text-tinta"
              >
                <Ico nombre="foto" tam={22} grosor={2.1} /> Añadir otra página
              </button>
              <button
                onClick={continuarConPaginas}
                disabled={preparando || paginas.length === 0}
                className="w-full flex h-[68px] items-center justify-center rounded-[20px] bg-verde text-[19px] font-extrabold text-white disabled:opacity-40"
              >
                {preparando ? 'Preparando…' : 'Continuar'}
              </button>
            </div>
          </>
        )}

        {/* ══ 3 · LEYENDO ══ */}
        {paso === 'leyendo' && (
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
            <div className="relative h-20 w-20">
              <span aria-hidden className="orbita" />
              <span aria-hidden className="orbita orbita-b" />
            </div>

            <h1 className="mt-12 text-[24px] font-extrabold leading-tight text-tinta">
              {ayuda ? 'Mirándolo con más detalle' : 'Leyendo el documento'}
            </h1>

            {/* Se dice por qué está tardando más. Una espera que cambia
                de duración sin explicarse parece una avería. */}
            {ayuda && (
              <p className="mt-3 max-w-xs text-[16.5px] font-medium leading-snug text-tinta-suave">
                Este papel cuesta un poco más de leer. Un momento.
              </p>
            )}

            {/*
              La barra de avance no es adorno.

              Leer un papel dentro del móvil son unos segundos, y la
              primera vez además hay que descargar el idioma. Una
              pantalla quieta durante ese rato parece una avería, y la
              reacción normal es volver a pulsar — que empieza otra vez
              desde cero. Ver el número subir es lo que evita eso.
            */}
            <div className="mt-6 h-2.5 w-56 overflow-hidden rounded-full bg-borde">
              <div
                className="h-full rounded-full bg-verde transition-[width] duration-300"
                style={{ width: `${Math.max(4, avance)}%` }}
              />
            </div>

            <p className="mt-4 text-lg text-tinta-suave">
              {ayuda
                ? 'Un momento…'
                : avance === 0
                ? 'Preparando la foto…'
                : avance < 100
                  ? `${avance}%`
                  : 'Ordenando lo leído…'}
            </p>

            <p className="mt-2 text-[15px] font-semibold text-tenue">
              Se lee aquí, en tu teléfono. La foto no sale de él.
            </p>

            {tardando && (
              <div className="mt-12 w-full">
                <p className="text-lg leading-relaxed text-tinta-suave">
                  Está tardando más de lo normal.
                </p>
                <button
                  onClick={() => {
                    abandonado.current = true
                    setPaso('categoria')
                  }}
                  className="mt-5 w-full flex h-[62px] items-center justify-center rounded-[18px] border border-borde bg-superficie text-[18px] font-bold text-tinta"
                >
                  Clasificarlo yo
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ 4 · LO ENCONTRADO ══ */}
        {paso === 'encontrado' && (
          <>
            <h1 className="mt-8 text-[28px] font-extrabold leading-tight tracking-tight text-tinta">
              Hemos encontrado esto
            </h1>

            {datos.confianza === 'baja' && (
              <p className="mt-5 rounded-[16px] bg-coral-suave px-4 py-3.5 text-[16px] font-semibold leading-snug text-coral">
                La foto no se lee del todo bien. Repasa los datos antes de guardar.
              </p>
            )}

            <div className="mt-6 divide-y divide-borde rounded-[20px] border border-borde bg-superficie px-4">
              <Dato etiqueta="Qué es" valor={datos.titulo} />
              <Dato etiqueta="Tipo" valor={datos.tipo} />
              <Dato etiqueta="Proveedor" valor={datos.proveedor} />
              <Dato etiqueta="Fecha" valor={enPalabras(datos.fecha)} />
              <Dato etiqueta="Importe" valor={datos.importe ? `${datos.importe.replace('.', ',')} €` : null} />
              <Dato etiqueta="Vencimiento" valor={enPalabras(datos.vencimiento)} />
              <Dato etiqueta="Se guardará en" valor={rutaElegida} />
              {estancia.huesped && <Dato etiqueta="Huésped" valor={estancia.huesped} />}
              {estancia.referencia && <Dato etiqueta="Nº de reserva" valor={estancia.referencia} />}
              {estancia.noches != null && (
                <Dato
                  etiqueta="Estancia"
                  valor={`${estancia.noches} ${estancia.noches === 1 ? 'noche' : 'noches'}${
                    estancia.personas != null
                      ? ` · ${estancia.personas} ${estancia.personas === 1 ? 'persona' : 'personas'}`
                      : ''
                  }`}
                />
              )}
              {paginas.length > 1 && <Dato etiqueta="Páginas" valor={String(paginas.length)} />}
            </div>

            <LoQueHeLeido texto={datos.texto} />

            <h2 className="mt-10 text-center text-[24px] font-extrabold text-tinta">¿Es correcto?</h2>

            <div className="mt-6 space-y-4">
              <button
                onClick={() => (enHelechos ? setPaso('estancia') : guardar())}
                disabled={guardando || !datos.categoriaId}
                className="w-full flex h-[64px] items-center justify-center rounded-[18px] bg-verde text-[19px] font-extrabold text-white disabled:opacity-40"
              >
                {guardando ? 'Guardando…' : enHelechos ? 'Continuar' : 'Guardar'}
              </button>
              <button onClick={() => setPaso('editar')} className="w-full flex h-[64px] items-center justify-center rounded-[18px] border border-borde bg-superficie text-[19px] font-bold text-tinta">
                Cambiar
              </button>
            </div>
          </>
        )}

        {/* ══ 4b · LOS HELECHOS ══ */}
        {/*
          El apartamento nunca sale en el papel. La captura de Airbnb no
          lo dice, y la factura del fontanero tampoco. Es el único dato
          que hay que preguntar sí o sí — y por eso tiene su pantalla, en
          vez de esconderse al final de una lista larga.
        */}
        {paso === 'estancia' && (
          <>
            <h1 className="mt-8 text-[28px] font-extrabold leading-tight tracking-tight text-tinta">
              Los Helechos
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-tinta-suave">
              {esIngreso
                ? 'Esto no viene en la pantalla de la reserva. Repásalo y lo guardo.'
                : 'Si el gasto es de un apartamento en concreto, dilo aquí.'}
            </p>

            <CamposEstancia valor={estancia} cambiar={setEstancia} conEstancia={esIngreso} />

            <button
              onClick={guardar}
              disabled={guardando}
              className="mt-10 w-full flex h-[64px] items-center justify-center rounded-[18px] bg-verde text-[19px] font-extrabold text-white disabled:opacity-40"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        )}

        {/* ══ 5 · CORREGIR ══ */}
        {paso === 'editar' && (
          <>
            <h1 className="mt-8 text-[28px] font-extrabold leading-tight tracking-tight text-tinta">Corregir</h1>

            <Campo etiqueta="¿Qué es?" valor={datos.titulo} onChange={(v) => setDatos((d) => ({ ...d, titulo: v }))} />

            <div className="mt-7">
              <p className="text-[17px] font-bold text-tinta">Se guardará en</p>
              <button
                onClick={() => {
                  setPadre(null)
                  setPaso('categoria')
                }}
                className="mt-3 flex w-full items-center justify-between rounded-[16px] border border-borde bg-superficie px-4 py-3.5 text-left text-[17px] font-semibold text-tinta"
              >
                <span>{rutaElegida ?? 'Elegir carpeta'}</span>
                <span className="text-verde underline underline-offset-4">Cambiar</span>
              </button>
            </div>

            <Campo etiqueta="Fecha del documento" valor={datos.fecha} tipo="date" onChange={(v) => setDatos((d) => ({ ...d, fecha: v }))} />
            <Campo etiqueta="Importe en euros" valor={datos.importe} modo="decimal" onChange={(v) => setDatos((d) => ({ ...d, importe: v }))} />
            <Campo etiqueta="Proveedor" valor={datos.proveedor} onChange={(v) => setDatos((d) => ({ ...d, proveedor: v }))} />
            <Campo etiqueta="Vencimiento (si lo tiene)" valor={datos.vencimiento} tipo="date" onChange={(v) => setDatos((d) => ({ ...d, vencimiento: v }))} />

            {enHelechos && (
              <CamposEstancia valor={estancia} cambiar={setEstancia} conEstancia={esIngreso} />
            )}

            <button onClick={guardar} disabled={guardando || !datos.categoriaId} className="mt-10 w-full flex h-[64px] items-center justify-center rounded-[18px] bg-verde text-[19px] font-extrabold text-white disabled:opacity-40">
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        )}

        {/* ══ 6 · CARPETA ══ */}
        {paso === 'categoria' && (
          <>
            <h1 className="mt-8 text-[28px] font-extrabold leading-tight tracking-tight text-tinta">
              ¿Dónde lo guardamos?
            </h1>
            {migas.length > 0 && (
              <p className="mt-3 text-lg text-tenue">{migas.map((m) => m.nombre).join(' → ')}</p>
            )}
            {migas.length === 0 && <LoQueHeLeido texto={datos.texto} />}
            <div className="mt-8 space-y-3">
              {(hijosDe.get(padre) ?? []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => elegirCategoria(c)}
                  className="flex w-full items-center gap-4 rounded-[18px] border border-borde bg-superficie px-5 py-4 text-left text-[18px] font-bold text-tinta"
                >
                  {c.icono && <span className="text-2xl">{c.icono}</span>}
                  <span className="flex-1">{c.nombre}</span>
                  {(hijosDe.get(c.id) ?? []).length > 0 && <Ico nombre="flecha" tam={19} grosor={2.2} className="text-borde" />}
                </button>
              ))}
            </div>
          </>
        )}

        {vista && paso === 'encontrado' && paginas.length <= 1 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vista} alt="" className="mt-10 w-full rounded-[18px] border border-borde object-contain" />
        )}

        {aviso && (
          <>
            <p className="mt-6 rounded-[16px] bg-coral-suave px-4 py-3.5 text-[16px] font-semibold leading-snug text-coral">
              {aviso}
            </p>
            {/* El motivo exacto que ha dado Google. Pequeño y aparte:
                no es para Juan Miguel ni para Conchita, pero mientras
                esto se monta ahorra tener que adivinar. */}
            {detalle && (
              <p className="mt-2 break-words rounded-[14px] bg-superficie px-4 py-3 text-[13px] font-medium leading-snug text-tenue">
                {detalle}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )

  function atras() {
    if (paso === 'categoria' && padre) {
      setPadre(migas.length > 1 ? migas[migas.length - 2].id : null)
    } else if (paso === 'categoria') {
      setPaso(datos.confianza ? 'editar' : 'archivo')
    } else if (paso === 'editar') {
      setPaso('encontrado')
    } else if (paso === 'estancia') {
      setPaso('encontrado')
    } else if (paso === 'encontrado') {
      setPaso(paginas.length > 0 ? 'paginas' : 'archivo')
    } else if (paso === 'paginas') {
      setPaginas([])
      setPaso('archivo')
    } else {
      window.location.href = '/'
    }
  }
}

/*
  Lo que HUBI ha leído del papel, plegado.

  No es una pantalla de programador: es la respuesta a "¿por qué no ha
  reconocido nada?". Si el texto sale entero y aun así falta el
  importe, el fallo está en cómo se entiende. Si el texto sale a
  trozos, el fallo está en la foto —y entonces la solución es repetirla
  con más luz, que es algo que la persona sí puede hacer.

  Cerrado por defecto: quien no lo necesita no lo ve. Y sin él, cada
  "no reconoce nada" costaba dos rondas de arreglar lo que no era.
*/
function LoQueHeLeido({ texto }: { texto: string | null }) {
  if (!texto?.trim()) return null

  return (
    <details className="mt-4 rounded-[16px] border border-borde bg-superficie px-4 py-3">
      <summary className="cursor-pointer list-none text-[16px] font-bold text-tinta-suave">
        Ver lo que he leído del papel
      </summary>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[14px] leading-relaxed text-tenue">
        {texto}
      </pre>
    </details>
  )
}

/*
  ¿Ha sacado el móvil lo que hace falta?

  Los tres a la vez: proveedor, fecha e importe. No dos de tres.

  El listón es alto porque el riesgo de leer en el teléfono no es
  quedarse corto —eso se ve enseguida— sino sacar algo CREÍBLE Y
  EQUIVOCADO: coger la fecha del periodo de consumo en vez de la de
  emisión, o el IVA en vez del total. Con dos de tres se daría por
  bueno justo el caso peligroso.

  Un papel sin importe —un informe médico, una ITV— no tiene por qué
  llevarlo, y ahí basta con el proveedor y la fecha. Lo que nunca
  basta es no tener ni idea de quién lo manda.
*/
function bastante(l: {
  proveedor?: string | null
  fecha?: string | null
  importe?: number | null
  tipo?: string | null
  reserva?: unknown
  conocido?: boolean
}): boolean {
  if (!l) return false

  // Una reserva leída es un caso resuelto: trae su importe y su gente.
  if (l.reserva) return true

  if (!l.proveedor || !l.fecha) return false

  /*
    Y EL PROVEEDOR TIENE QUE SER UN NOMBRE, NO UNA SUPOSICIÓN.

    Aquí estaba el fallo del ticket de Stradivarius. El móvil sacaba
    bien la fecha y bien el total —37,98 €— pero como "proveedor"
    cogía la primera línea que salía del reconocedor, que no era la
    tienda: eran los dibujos del mantel leídos como letras. "Ef» Po
    Pi".

    Con los tres campos "llenos", HUBI se creía que había leído el
    papel y no pedía ayuda. El dato inventado tapaba el fallo entero.

    Ahora solo cuenta un proveedor RECONOCIDO: uno que ya habéis
    archivado antes, o una empresa de las que salen en cualquier casa.
    Un comercio nuevo lo lee el modelo, que ve la foto —y a partir de
    ahí ya es conocido y lo lee el móvil solo.
  */
  if (!l.conocido) return false

  // Con dinero de por medio, el importe no es opcional.
  const esDeDinero = l.tipo === 'Factura' || l.tipo === 'Recibo' || l.tipo === 'Ticket'
  return esDeDinero ? l.importe != null : true
}

/* Solo se manda lo que el servidor admite y cabe en una petición. */
function archivoSirve(f: File): boolean {
  return (
    f.size > 0 &&
    f.size <= MAXIMO &&
    ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(f.type)
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="py-5">
      <p className="text-[13px] font-extrabold tracking-widest text-tenue">{etiqueta}</p>
      <p className={`mt-0.5 text-[18px] font-bold leading-snug ${valor ? 'text-tinta' : 'text-tenue'}`}>
        {valor || 'No aparece'}
      </p>
    </div>
  )
}

function Campo({
  etiqueta,
  valor,
  onChange,
  tipo = 'text',
  modo,
}: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  tipo?: string
  modo?: 'decimal'
}) {
  return (
    <div className="mt-7">
      <label className="block text-[17px] font-bold text-tinta">{etiqueta}</label>
      <input
        type={tipo}
        inputMode={modo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="mt-3 w-full h-[58px] rounded-[16px] border border-borde bg-superficie px-4 font-semibold text-tinta focus:border-verde focus:outline-none"
      />
    </div>
  )
}

function enPalabras(iso: string): string | null {
  if (!iso) return null
  const [a, m, d] = iso.split('-')
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${Number(d)} de ${meses[Number(m) - 1]} de ${a}`
}

/** Reduce una foto: las de móvil pesan demasiado para una petición. */
async function comprimir(original: File, lado: number, calidad: number): Promise<File> {
  if (!original.type.startsWith('image/')) return original
  try {
    const bitmap = await createImageBitmap(original)
    const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height))
    if (escala === 1 && original.size < 1_200_000 && calidad >= 0.85) return original

    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(bitmap.width * escala)
    lienzo.height = Math.round(bitmap.height * escala)
    const ctx = lienzo.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height)

    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/jpeg', calidad))
    if (!blob) return original
    return new File([blob], original.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return original
  }
}

/**
 * Junta varias fotos en un único PDF, una página por foto.
 *
 * Un documento de tres hojas debe ser UN archivo en Drive, no tres imágenes
 * sueltas que alguien tendría que reordenar años después. Y el modelo lee
 * mucho mejor un documento completo que páginas por separado.
 *
 * Si el resultado no cabe en una petición, se reintenta con menos calidad
 * antes de rendirse.
 */
async function construirPdf(imagenes: File[]): Promise<File> {
  const { jsPDF } = await import('jspdf')

  for (const [lado, calidad] of [
    [1800, 0.78],
    [1400, 0.68],
    [1100, 0.55],
  ] as const) {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    const anchoPagina = pdf.internal.pageSize.getWidth()
    const altoPagina = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < imagenes.length; i++) {
      const reducida = await comprimir(imagenes[i], lado, calidad)
      const datos = await comoDataUrl(reducida)
      const medidas = await tamano(datos)

      const escala = Math.min(
        (anchoPagina - 40) / medidas.ancho,
        (altoPagina - 40) / medidas.alto
      )
      const ancho = medidas.ancho * escala
      const alto = medidas.alto * escala

      if (i > 0) pdf.addPage()
      pdf.addImage(
        datos,
        'JPEG',
        (anchoPagina - ancho) / 2,
        (altoPagina - alto) / 2,
        ancho,
        alto
      )
    }

    const blob = pdf.output('blob')
    if (blob.size <= MAXIMO) {
      return new File([blob], 'documento.pdf', { type: 'application/pdf' })
    }
  }

  throw new Error('DEMASIADAS_PAGINAS')
}

function comoDataUrl(f: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result))
    lector.onerror = rechazar
    lector.readAsDataURL(f)
  })
}

function tamano(dataUrl: string): Promise<{ ancho: number; alto: number }> {
  return new Promise((resolver, rechazar) => {
    const img = new Image()
    img.onload = () => resolver({ ancho: img.naturalWidth, alto: img.naturalHeight })
    img.onerror = rechazar
    img.src = dataUrl
  })
}
