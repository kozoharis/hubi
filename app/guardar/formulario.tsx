'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cadena, type Categoria } from '@/lib/rutas'
import { Ico, Volver } from '../iconos'
import {
  Aviso,
  BotonPrincipal,
  BotonSecundario,
  BotonTerciario,
  Campo as CampoDS,
  Dato as DatoDS,
  Fila,
  Hecho,
  PastillaAmbito,
  seccionPintada,
} from '../piezas'
import BuscarEnDrive, { hayBuscadorDrive } from './buscar-en-drive'
import { leerAqui } from './leer-aqui'
import { leerPdf, primeraPagina } from './leer-pdf'
import { esPdf, tipoDe, conSuTipo, TIPOS_BUENOS } from '@/lib/archivos'
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
  /* El tipo de IGIC/IVA que dice el papel. Vacío = no lo pone, y
     entonces manda el general de la casa. */
  impuestoTipo: string
  /** Los euros de IVA/IGIC impresos en el papel, si los traía. */
  impuestoCuota: string
  texto: string | null
  confianza: 'alta' | 'media' | 'baja' | null
  tipo: string | null
  /* Con cuál de los dos lectores se ha leído. Ver la nota en la
     pantalla de confirmar. */
  comoSeLeyo: 'modelo' | 'reglas' | null
}

const HOY = () => new Date().toISOString().slice(0, 10)
const MAXIMO = 4 * 1024 * 1024

export default function Formulario({
  categorias,
  esPropietario = false,
  enCarpeta = null,
  paraLista = null,
}: {
  categorias: Categoria[]
  /* El buscador de Drive abre la cuenta de quien conectó Google. */
  esPropietario?: boolean
  /*
    LA COMPRA A LA QUE ENGANCHAR ESTE TICKET.

    Viene de «Guardar el ticket» al cerrar una compra. Con ella, el
    ticket deja de ser un papel suelto en una carpeta y pasa a ser EL
    ticket de aquella compra: dentro de tres meses, la lista del 8 de
    septiembre y lo que costó están en el mismo sitio.
  */
  paraLista?: string | null
  /*
    LA CARPETA DE DONDE VIENE.

    Cuando se entra desde una carpeta —«Añadir documento» al final de
    Casa, o de Seguros— ya sabemos dónde va. Preguntárselo otra vez
    sería hacerle repetir a mano el camino que acaba de recorrer con
    el dedo, que es exactamente lo que el punto 29 dice que tiene que
    hacer el sistema y no la persona.

    Se preselecciona, no se impone: la pantalla de dónde guardarlo
    sigue estando y se puede cambiar.
  */
  enCarpeta?: string | null
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
    /* Si el papel traía importe, si ese importe ha entrado en las
       cuentas, y si se ha quedado fuera por estar en una carpeta de
       papeles. Antes no se sabía, y por eso no se decía. */
    conDinero?: boolean
    apuntado?: boolean
    enPapeles?: boolean
    seccion?: string | null
  } | null>(null)
  const [avisoResuelto, setAvisoResuelto] = useState(false)
  const [creandoAviso, setCreandoAviso] = useState(false)

  /*
    ── LAS PREGUNTAS DEL VENCIMIENTO ──

    Tres pantallas con UNA decisión cada una, en vez de un formulario
    con cuatro controles. Es más lento de contar y bastante más rápido
    de contestar: quien acaba de fotografiar una póliza está de pie, con
    el papel en la otra mano, y no va a leerse un formulario.

    Y el orden no es casual. Primero si se renueva, porque es lo que
    cambia CUÁL es la fecha importante; y solo después con cuánto hay
    que avisar. Al revés habría que preguntar por un preaviso que a lo
    mejor no existe.
  */
  const [pasoVence, setPasoVence] = useState<'renueva' | 'preaviso' | 'aviso'>('renueva')
  const [seRenueva, setSeRenueva] = useState(false)
  const [preaviso, setPreaviso] = useState(30)

  /* Los datos de Los Helechos: apartamento, noches, personas, huésped
     y número de reserva. Solo se piden si el documento acaba en esa
     sección — una factura de la luz de la finca no los ve. */
  const [estancia, setEstancia] = useState<Estancia>(ESTANCIA_VACIA)

  const [datos, setDatos] = useState<Datos>({
    titulo: '',
    categoriaId: enCarpeta,
    fecha: HOY(),
    importe: '',
    proveedor: '',
    vencimiento: '',
    impuestoTipo: '',
    impuestoCuota: '',
    texto: null,
    confianza: null,
    tipo: null,
    comoSeLeyo: null,
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

  /*
    ── DINERO EN UNA CARPETA QUE NO SUMA ──

    Hay un importe leído y la carpeta elegida es de papeles ('neutro'),
    o sea que ese importe no va a entrar en el balance de nadie.

    Se calcula aquí, ANTES de guardar, porque aquí todavía se puede
    cambiar la carpeta con un toque. Decirlo después también hace
    falta —y se dice— pero entonces ya hay que ir a buscar el papel
    para moverlo.
  */
  const dineroSinSumar = useMemo(() => {
    if (!datos.categoriaId) return false
    const importe = Number(datos.importe.replace(',', '.'))
    if (!Number.isFinite(importe) || importe <= 0) return false
    return porId.get(datos.categoriaId)?.naturaleza === 'neutro'
  }, [porId, datos.categoriaId, datos.importe])

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
    /* `conSuTipo` arregla aquí, en la puerta, los archivos que llegan
       sin decir lo que son — que es como llegan casi todos los PDF
       elegidos desde Drive o Descargas en Android. A partir de este
       punto el resto del formulario no se entera de que hubo nada
       raro. Ver lib/archivos.ts. */
    if (original) admitir(conSuTipo(original))
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
    if (esPdf(original)) {
      if (original.size > MAXIMO) {
        setAviso('Ese PDF pesa demasiado. El máximo son 4 MB.')
        return
      }
      arrancarLectura(original)
      return
    }

    /* Y lo que no es ni PDF ni imagen se dice AQUÍ, con su nombre.
       Antes se colaba, se intentaba encoger, y fallaba más adelante
       con un mensaje que no señalaba al archivo. */
    if (!tipoDe(original)) {
      setAviso('Ese archivo no se puede guardar. Solo fotos (JPG, PNG) o documentos PDF.')
      setDetalle(original.name ? `Has elegido: ${original.name}` : null)
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
    /*
      LA VISTA PREVIA TAMBIÉN PARA LOS PDF.

      Antes un PDF no enseñaba nada: pantalla en blanco mientras se
      leía. Y ahí, con un archivo que además fallaba, era imposible
      saber si HUBI lo había cogido siquiera.

      Se dibuja su primera página, que es lo que uno reconoce de un
      vistazo. Va sin esperar a nadie: si tarda o falla, la lectura
      sigue su camino y como mucho no hay foto.
    */
    if (esPdf(f)) {
      setVista(null)
      primeraPagina(f)
        .then((url) => {
          if (url && !abandonado.current) setVista(url)
        })
        .catch(() => {})
    } else {
      setVista(URL.createObjectURL(f))
    }
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

      if (!paraLeer?.length && esPdf(f)) {
        /*
          ── SI EL LECTOR DE PDF SE ATRAGANTA, NO SE ACABA AQUÍ ──

          Antes esta llamada estaba suelta dentro del `try` grande, así
          que un PDF que pdf.js no supiera abrir —protegido, con una
          fuente rara, medio corrupto— tiraba TODA la lectura al fallo
          general. Y con ella la segunda oportunidad: mandárselo al
          modelo, que lee PDF de sobra.

          Perder la lectura barata es un incordio. Perder también la
          buena por haber intentado la barata es un fallo.
        */
        try {
          const pdf = await leerPdf(f, (p) => setAvance(Math.round(p * 60)))
          if (abandonado.current) return
          textoDelMovil = pdf.texto
          digital = pdf.digital
        } catch (e) {
          console.error('[HUBI] El PDF no se ha podido leer aquí:', e)
          /* Se sigue: abajo va al modelo como cualquier otro papel. */
        }
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
      /*
        ── AQUÍ SE ESTABA QUEDANDO EL MODELO SIN VER LA FOTO ──

        Antes: si la foto pasaba de 4 MB se encogía UNA vez a 2600 px y
        calidad 0,92 — y si aun así seguía pesando de más, `archivoSirve`
        decía que no y EL MODELO NI SE INTENTABA. Sin error, sin aviso,
        sin nada: se caía al lector de respaldo en silencio.

        Una foto de un iPhone reciente pasa de 4 MB con facilidad, así
        que dependía del teléfono y de la luz. De ahí lo de «a veces lee
        de miedo y otras veces no»: no era el papel, era el peso.

        Ahora se insiste. Se baja de escalón en escalón hasta que entra,
        y solo se rinde cuando ya no hay nada más que bajar. Perder algo
        de nitidez es infinitamente mejor que no enseñarle la foto al
        único lector que sabe leerla.
      */
      const original = paraLeer?.length === 1 ? paraLeer[0] : null
      let paraElModelo = original ?? f

      if (original && original.size > MAXIMO) {
        for (const [lado, calidad] of [
          [2600, 0.92],
          [2200, 0.85],
          [1800, 0.8],
          [1400, 0.72],
        ] as [number, number][]) {
          paraElModelo = await comprimir(original, lado, calidad)
          if (paraElModelo.size <= MAXIMO) break
          if (abandonado.current) return
        }
      }

      /* Y si no cabe ni así, se dice. Antes este caso era mudo y se
         vivía como que HUBI «leía mal» por capricho. */
      if (!digital && !archivoSirve(paraElModelo)) {
        falloDelModelo = `La foto pesa ${Math.round(paraElModelo.size / 1024 / 1024 * 10) / 10} MB y no he podido reducirla lo suficiente para mandarla al lector bueno.`
      }

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
          } else if (!esPdf(f)) {
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
      /* El motivo se guarda SIEMPRE que lo haya, aunque el respaldo
         haya leído bastante. Antes solo se guardaba si además la
         lectura venía coja, y por eso el porqué se perdía justo en el
         caso que más despista: datos completos pero pobres, sin
         ninguna pista de que el lector bueno no había llegado. */
      /* Y el del servidor también: puede que el móvil mandara la foto
         sin problema y el modelo se cayera al otro lado. Los dos
         motivos juntos, que cada uno cuenta una mitad. */
      const porElServidor = (leido as { por_que_reglas?: string | null }).por_que_reglas ?? null
      const elMotivo = [falloDelModelo, porElServidor].filter(Boolean).join(' · ')
      if (elMotivo) setDetalle(elMotivo)

      if (falloDelModelo && !bastante(leido)) {
        setAviso('No he podido leerlo del todo. Repasa los datos antes de guardar.')
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
        impuestoTipo:
          leido.impuesto_tipo != null ? String(leido.impuesto_tipo) : '',
        impuestoCuota:
          leido.impuesto_cuota != null ? String(leido.impuesto_cuota) : '',
        texto: leido.texto ?? null,
        confianza: leido.confianza ?? null,
        comoSeLeyo: leido.como_se_leyo ?? null,
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
    /* Solo si el papel lo decía. Mandar vacío no es lo mismo que no
       mandarlo: el servidor tiene que poder distinguir «el papel dice
       0%» de «el papel no dice nada». */
    if (datos.impuestoTipo !== '') cuerpo.append('impuesto_tipo', datos.impuestoTipo)
    /* Y los euros de impuesto que venían impresos, que es lo único que
       tiene un ticket con tres tipos a la vez. */
    if (datos.impuestoCuota !== '') cuerpo.append('impuesto_cuota', datos.impuestoCuota)
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
        conDinero: respuesta.conDinero ?? false,
        apuntado: respuesta.apuntado ?? false,
        enPapeles: respuesta.enPapeles ?? false,
        seccion: respuesta.seccion ?? null,
      })
      setPaso('guardado')

      /*
        Y se engancha a la compra, si venía de ahí.

        SIN ESPERARLO Y SIN QUE PUEDA ROMPER NADA: el documento ya está
        guardado en Drive y en la base de datos. Si el enganche falla
        —falta el SQL 40, se ha ido la conexión— lo peor que pasa es
        que el ticket queda en su carpeta sin apuntar a la compra, que
        es exactamente lo que pasaba antes. Lo que no puede pasar es
        que un extra tumbe el guardado.
      */
      if (paraLista && respuesta.id) {
        fetch('/api/compra/listas', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: paraLista, ticket_id: respuesta.id }),
        }).catch(() => {})
      }
    } catch {
      setAviso('No hay conexión. Comprueba tu internet e inténtalo otra vez.')
    }
    setGuardando(false)
  }

  // ══ ¿VENCE? ═══════════════════════════════════════════════
  /*
    Nunca se crea un aviso sin preguntar. Pero el vencimiento sí se
    marca siempre en el calendario: es información del documento.

    LO QUE CAMBIÓ, Y ES LO IMPORTANTE.

    Antes esto creaba el recordatorio a pelo. El aviso quedaba suelto y
    el papel no se acordaba de nada: no había forma de cambiarlo después
    —ni la fecha, ni el aviso, ni quitarlo— porque no estaba guardado en
    ninguna parte.

    Ahora se guarda EN EL PAPEL, y los avisos los deduce el servidor de
    ahí. Un camino, una verdad, y todo editable mañana desde «Corregir».
  */
  async function marcarVencimiento(aviso: string) {
    if (!resultado?.vencimiento) return
    setCreandoAviso(true)
    try {
      await fetch(`/api/documentos/${resultado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_vencimiento: resultado.vencimiento,
          se_renueva: seRenueva,
          preaviso_dias: seRenueva ? preaviso : null,
          avisar_con: aviso,
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
      <main className="flex min-h-screen flex-col justify-center px-5 py-16">
        <div className="mx-auto w-full max-w-md">
          {/* Primero se confirma que YA ESTÁ GUARDADO, y luego se
              pregunta. Estas tres preguntas son opcionales; si alguien
              cierra el móvil aquí, su papel está a salvo, y eso tiene
              que verse antes de nada. */}
          <Aviso tono="bien" titulo="El papel ya está guardado" />

          <h1 className="t-titulo mt-8 text-center">Este documento vence el</h1>
          {/* Iba en coral, el color de alarma. Un vencimiento futuro no
              es una alarma: es una fecha. En tinta, y grande. */}
          <p className="t-cifra-2 mt-2 text-center">{enPalabras(resultado.vencimiento)}</p>

          {/* ── 1 · ¿Se renueva solo? ── */}
          {pasoVence === 'renueva' && (
            <>
              <p className="t-cuerpo mt-6 text-center">Si ese día no hacéis nada, ¿qué pasa?</p>

              {/*
                ── DOS OPCIONES, NO UN BOTÓN Y UN «CANCELAR» ──

                Aquí «Se renueva solo» iba relleno de verde y «Se acaba»
                con borde. Eso es el reparto de un botón principal y uno
                secundario, y dice: «lo normal es lo verde». Pero no hay
                respuesta normal — depende del papel, y elegir la mala
                porque parecía la recomendada estropea el aviso.

                Las dos igual de fuertes: son una PREGUNTA, no una
                acción con salida.
              */}
              <div className="mt-8 space-y-2.5">
                <Opcion
                  texto="Se renueva solo"
                  alPulsar={() => {
                    setSeRenueva(true)
                    setPasoVence('preaviso')
                  }}
                />
                <Opcion
                  texto="Se acaba"
                  alPulsar={() => {
                    setSeRenueva(false)
                    setPasoVence('aviso')
                  }}
                />
              </div>
              <p className="t-apoyo mt-5 text-center">
                Los seguros y casi todas las suscripciones se renuevan solas.
              </p>
            </>
          )}

          {/* ── 2 · ¿Con cuánto hay que avisar? ── */}
          {pasoVence === 'preaviso' && (
            <>
              <p className="t-cuerpo mt-6 text-center">Para cancelarlo hay que avisar con…</p>

              {/* Eran TRES botones rellenos de verde, uno debajo de
                  otro. Tres acciones principales en una pantalla no son
                  tres acciones principales: son una lista. */}
              <div className="mt-8 space-y-2.5">
                {([[30, 'Un mes de antelación'], [15, 'Quince días'], [7, 'Una semana']] as [number, string][]).map(
                  ([dias, texto]) => (
                    <Opcion
                      key={dias}
                      texto={texto}
                      alPulsar={() => {
                        setPreaviso(dias)
                        setPasoVence('aviso')
                      }}
                    />
                  )
                )}
                <Opcion
                  texto="No lo sé"
                  tenue
                  alPulsar={() => {
                    setSeRenueva(false)
                    setPasoVence('aviso')
                  }}
                />
              </div>
              {/*
                Y aquí está el motivo de toda esta pregunta, dicho antes
                de contestarla. Sin esta frase, «un mes de antelación»
                es burocracia; con ella se entiende que la fecha que hay
                que apuntarse no es la del vencimiento.
              */}
              <p className="mt-6 text-center text-[15.5px] font-semibold leading-snug text-tenue">
                Os avisaremos ese día, no el del vencimiento: para entonces ya
                sería tarde.
              </p>
            </>
          )}

          {/* ── 3 · ¿Y cuándo suena el teléfono? ── */}
          {pasoVence === 'aviso' && (
            <>
              <p className="t-cuerpo mt-6 text-center">
                Lo marcamos en el calendario.
                <br />
                ¿Queréis que además os avisemos?
              </p>

              <div className="mt-8 space-y-2.5">
                {[
                  ['1_mes', 'Un mes antes'],
                  ['1_semana', 'Una semana antes'],
                  ['1_dia', 'Un día antes'],
                ].map(([valor, texto]) => (
                  <Opcion
                    key={valor}
                    texto={texto}
                    desactivada={creandoAviso}
                    alPulsar={() => marcarVencimiento(valor)}
                  />
                ))}
                <Opcion
                  texto="Solo en el calendario"
                  tenue
                  desactivada={creandoAviso}
                  alPulsar={() => marcarVencimiento('sin_aviso')}
                />
              </div>
            </>
          )}
        </div>
      </main>
    )
  }

  // ══ PANTALLA FINAL ════════════════════════════════════════
  if (paso === 'guardado' && resultado) {
    return (
      <main className="flex min-h-screen flex-col justify-center px-5 py-16">
        <div className="mx-auto w-full max-w-md">
          <Hecho titulo="Documento guardado" explicacion={resultado.ruta}>
            {resultado.repetida && (
              /* Esto NO es un error: es que HUBI ha sabido que ese
                 ingreso ya estaba y no lo ha contado dos veces. Iba en
                 coral, que lo leía como un fallo. */
              <Aviso
                tono="atencion"
                titulo={`La reserva ${resultado.repetida} ya estaba apuntada`}
                explicacion="El ingreso no se ha sumado otra vez. El documento sí se ha guardado."
              />
            )}

            {/*
              ── Y SI TRAÍA DINERO, SE DICE QUÉ HA PASADO CON ÉL ──

              Hasta hoy esta pantalla ponía «Documento guardado» tanto
              si el importe había entrado en el balance como si no. Una
              factura archivada en la carpeta de papeles de su
              actividad se guardaba igual de bien y no sumaba en ningún
              sitio, y desde fuera las dos cosas se veían idénticas.

              Ahora se distinguen. Y cuando no ha sumado no se plantea
              como un error —el papel está a salvo, que es lo primero—
              sino como algo que se arregla cambiándolo de carpeta.
            */}
            {resultado.conDinero && resultado.enPapeles && (
              <Aviso
                tono="atencion"
                titulo="Esto no se ha sumado a las cuentas"
                explicacion={`Está guardado en una carpeta de papeles${
                  resultado.seccion ? ` de ${resultado.seccion}` : ''
                }, que es donde van los contratos y las pólizas. Si es un gasto o un ingreso, cámbialo de carpeta y entrará en el balance.`}
              />
            )}

            {resultado.conDinero && resultado.apuntado && (
              <Aviso tono="bien" titulo="Sumado a las cuentas" />
            )}

            <BotonPrincipal href={`/documentos/${resultado.id}`} icono="ojo">
              Ver documento
            </BotonPrincipal>
            <BotonSecundario href="/guardar" icono="mas">
              Guardar otro
            </BotonSecundario>
            <BotonTerciario href="/" icono="casa">
              Volver al inicio
            </BotonTerciario>
          </Hecho>
        </div>
      </main>
    )
  }

  return (
    <main className="techo-holgado min-h-screen px-5 pb-10">
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
          <Volver alPulsar={atras} />
        )}

        {/* ══ 1 · EL ARCHIVO ══ */}
        {paso === 'archivo' && (
          <>
            <h1 className="t-titulo mt-8">Guardar documento</h1>

            {/*
              «Hacer foto» ES la acción de esta pantalla, y aquí sí le
              corresponde el botón principal: HABLAR · FOTOGRAFIAR ·
              CONSULTAR. Las otras dos son maneras alternativas de traer
              el mismo papel.

              Iba de `bg-verde` a 76 px de alto. El verde ya no es
              acento sino ámbito, y la altura es la del sistema.
            */}
            <div className="mt-8 space-y-2.5">
              <BotonPrincipal onClick={() => camara.current?.click()} icono="foto">
                Hacer foto
              </BotonPrincipal>
              <BotonSecundario onClick={() => disco.current?.click()} icono="papel">
                Elegir archivo
              </BotonSecundario>

              {/* Solo aparece si está configurado Y si es su Drive.
                  Un botón que no puede funcionar es peor que no tenerlo. */}
              {esPropietario && hayBuscadorDrive && <BuscarEnDrive onArchivo={admitir} />}
            </div>
            <p className="t-apoyo mt-6 text-center">
              Si el documento tiene varias páginas, podrás añadirlas después.
            </p>
          </>
        )}

        {/* ══ 2 · LAS PÁGINAS ══ */}
        {paso === 'paginas' && (
          <>
            <h1 className="t-titulo mt-8">
              {paginas.length === 1 ? '¿Tiene más páginas?' : `${paginas.length} páginas`}
            </h1>

            <p className="t-cuerpo mt-3">
              {paginas.length === 1
                ? 'Si el documento sigue por detrás o en otra hoja, fotografía también esa página.'
                : 'Se guardarán juntas como un solo documento.'}
            </p>

            <ul className="mt-6 space-y-2.5">
              {paginas.map((p, i) => (
                <li key={i} className="r-tarjeta overflow-hidden border border-borde bg-superficie">
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="t-cuerpo">Página {i + 1}</span>
                    {/*
                      Era «Quitar» en coral, a 16 px y sin altura: un
                      blanco de 22 px para deshacer una foto. Ahora es
                      un botón de verdad, de 48, y en tinta — quitar una
                      página de las tres que llevas no es una alarma.
                    */}
                    <button
                      onClick={() => setPaginas((ps) => ps.filter((_, j) => j !== i))}
                      className="flex h-[48px] shrink-0 items-center px-2 text-[16px] font-extrabold text-tinta-suave"
                    >
                      Quitar
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(p.subir)}
                    alt={`Página ${i + 1}`}
                    className="max-h-64 w-full object-contain"
                  />
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2.5">
              <BotonPrincipal
                onClick={continuarConPaginas}
                desactivado={preparando || paginas.length === 0}
                porQue={paginas.length === 0 ? 'No queda ninguna página' : undefined}
                icono="check"
              >
                {preparando ? 'Preparando…' : 'Continuar'}
              </BotonPrincipal>
              <BotonSecundario onClick={() => camara.current?.click()} icono="foto">
                Añadir otra página
              </BotonSecundario>
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

            <h1 className="t-titulo mt-12">
              {ayuda ? 'Mirándolo con más detalle' : 'Leyendo el documento'}
            </h1>

            {/* Se dice por qué está tardando más. Una espera que cambia
                de duración sin explicarse parece una avería. */}
            {ayuda && (
              <p className="t-cuerpo mt-3 max-w-xs">
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
                /* La barra de avance iba de verde de ámbito. Está
                   diciendo «esto va bien y va avanzando»: es el color
                   de estado, no el de una sección. */
                className="h-full rounded-full bg-[color:var(--t-bien)] transition-[width] duration-300"
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
                <div className="mt-5 w-full">
                  <BotonSecundario
                    onClick={() => {
                      abandonado.current = true
                      setPaso('categoria')
                    }}
                    icono="carpeta"
                  >
                    Clasificarlo yo
                  </BotonSecundario>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ 4 · LO ENCONTRADO ══ */}
        {paso === 'encontrado' && (
          <>
            <h1 className="t-titulo mt-8">Hemos encontrado esto</h1>

            {dineroSinSumar && (
              <div className="mt-5">
                {/* Antes de guardar, no después: aquí la carpeta se
                    cambia con un toque. */}
                <Aviso
                  tono="atencion"
                  titulo="Este importe no entrará en las cuentas"
                  explicacion="La carpeta elegida es de papeles —contratos, pólizas—. Si es un gasto o un ingreso, cambia la carpeta aquí abajo."
                />
              </div>
            )}

            {datos.confianza === 'baja' && (
              <div className="mt-5">
                {/* Es una ADVERTENCIA, no un fallo: se ha leído, y lo
                    que hay que hacer es repasarlo. Iba en coral, el
                    color de las cosas rotas. */}
                <Aviso
                  tono="atencion"
                  titulo="La foto no se lee del todo bien"
                  explicacion="Repasa los datos antes de guardar."
                />
              </div>
            )}

            {/* El `divide-y` se va: cada `Dato` ya trae su propia raya
                debajo, y con los dos salían dobles. */}
            <div className="mt-6 rounded-[20px] border border-borde bg-superficie px-4 py-1">
              <Dato etiqueta="Qué es" valor={datos.titulo} />
              <Dato etiqueta="Tipo" valor={datos.tipo} />
              <Dato etiqueta="Proveedor" valor={datos.proveedor} />
              <Dato etiqueta="Fecha" valor={enPalabras(datos.fecha)} />
              <Dato etiqueta="Importe" valor={datos.importe ? `${datos.importe.replace('.', ',')} €` : null} />
              {/* El IGIC o el IVA, si el papel lo dice. Solo sale
                  cuando se ha leído: una línea que pone «no lo has
                  dicho» en todos los tickets del súper sería ruido en
                  la pantalla que más se mira de HUBI. */}
              {datos.impuestoTipo !== '' && (
                <Dato
                  etiqueta="IGIC / IVA"
                  valor={`${datos.impuestoTipo.replace('.', ',')}%`}
                />
              )}
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

            {/*
              ── CON QUÉ SE HA LEÍDO ──

              Solo cuando ha leído el respaldo. Y hace falta decirlo:
              el modelo y las reglas leen con calidad muy distinta, y
              hasta ahora cuál de los dos había leído era invisible. Se
              veían datos pobres —a veces bien, a veces mal, sin ningún
              motivo aparente— y no había forma de saber si el papel
              estaba mal fotografiado o si el lector bueno no había
              podido esta vez.

              Una diferencia de calidad que el usuario no puede ver la
              vive como que la aplicación es caprichosa.
            */}
            {datos.comoSeLeyo === 'reglas' && (
              <div className="mt-4">
                {/*
                  ── EN CRISTIANO, Y SEGÚN EL MOTIVO ──

                  «Lector de respaldo» es una palabra nuestra, de la
                  fontanería. A Juan Miguel no le dice absolutamente
                  nada, y encima suena a avería.

                  El caso del cupo agotado merece su propia frase
                  porque NO es una avería y no hay nada que arreglar:
                  se ha usado mucho hoy y mañana vuelve solo. Decirlo
                  así evita que alguien se pase la tarde repitiendo la
                  foto pensando que la culpa es suya.
                */}
                {/*
                  Y esto tampoco es un error: HA LEÍDO. Peor, pero ha
                  leído, y el papel se puede guardar igual. En coral se
                  leía como que algo se había roto — y encima el caso
                  del cupo agotado se arregla solo mañana.

                  `atencion` es exactamente lo que es: repásalo.
                */}
                <Aviso
                  tono="atencion"
                  titulo={
                    /cupo|quota|429|agotad/i.test(detalle ?? '')
                      ? 'Hoy la lectura automática se ha agotado'
                      : 'Esto lo he leído a mi manera torpe, sin ayuda'
                  }
                  explicacion={
                    /cupo|quota|429|agotad/i.test(detalle ?? '')
                      ? 'He leído el papel como he podido: repasa los datos antes de guardar. Mañana vuelve a leer bien sola.'
                      : 'Repasa los datos antes de guardar.'
                  }
                  detalle={detalle}
                />
                {/*
                  ── Y POR QUÉ ──

                  Este motivo se calculaba y se TIRABA: solo se enseñaba
                  cuando no se conseguía leer nada. Si el respaldo sí
                  leía —peor, pero leía— el porqué se perdía, y desde
                  fuera parecía que HUBI leía mal por capricho.

                  Es lo mismo que nos pasó con el índice de los avisos:
                  la respuesta exacta valía más que tres rondas de
                  suposiciones.
                */}
              </div>
            )}

            <LoQueHeLeido texto={datos.texto} />

            <h2 className="t-seccion mt-10 text-center">¿Es correcto?</h2>

            <div className="mt-6 space-y-2.5">
              <BotonPrincipal
                onClick={() => (enHelechos ? setPaso('estancia') : guardar())}
                desactivado={guardando || !datos.categoriaId}
                /* Un botón gris y mudo se lee como avería. Si falta la
                   carpeta, se DICE que falta la carpeta. */
                porQue={!datos.categoriaId ? 'Falta decir en qué carpeta va' : undefined}
                icono="check"
              >
                {guardando ? 'Guardando…' : enHelechos ? 'Continuar' : 'Guardar'}
              </BotonPrincipal>
              <BotonSecundario onClick={() => setPaso('editar')} icono="lapiz">
                Cambiar
              </BotonSecundario>
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
            <h1 className="t-titulo mt-8">Los Helechos</h1>
            <p className="t-cuerpo mt-3">
              {esIngreso
                ? 'Esto no viene en la pantalla de la reserva. Repásalo y lo guardo.'
                : 'Si el gasto es de un apartamento en concreto, dilo aquí.'}
            </p>

            <CamposEstancia valor={estancia} cambiar={setEstancia} conEstancia={esIngreso} />

            <div className="mt-8">
              <BotonPrincipal onClick={guardar} desactivado={guardando} icono="check">
                {guardando ? 'Guardando…' : 'Guardar'}
              </BotonPrincipal>
            </div>
          </>
        )}

        {/* ══ 5 · CORREGIR ══ */}
        {paso === 'editar' && (
          <>
            <h1 className="t-titulo mt-8">Corregir</h1>

            <Campo etiqueta="¿Qué es?" valor={datos.titulo} onChange={(v) => setDatos((d) => ({ ...d, titulo: v }))} />

            <div className="mt-7">
              <p className="rotulo mb-2">Se guardará en</p>
              {/*
                Era `text-verde` subrayado —el verde ya no es acento
                sino ámbito—, y toda la fila medía 54 px. Ahora es una
                fila de 64 con su flecha: se lee que lleva a otro sitio
                sin necesidad de subrayar nada.
              */}
              <button
                onClick={() => {
                  setPadre(null)
                  setPaso('categoria')
                }}
                className="r-campo flex min-h-[64px] w-full items-center justify-between gap-3 border border-borde bg-superficie px-4 py-3 text-left"
              >
                <span className="t-cuerpo min-w-0 flex-1">
                  {rutaElegida ?? 'Elegir carpeta'}
                </span>
                <span className="t-apoyo shrink-0">Cambiar</span>
                <Ico nombre="flecha" tam={19} grosor={2.2} className="shrink-0" />
              </button>
            </div>

            <Campo etiqueta="Fecha del documento" valor={datos.fecha} tipo="date" onChange={(v) => setDatos((d) => ({ ...d, fecha: v }))} />
            <Campo etiqueta="Importe en euros" valor={datos.importe} modo="decimal" onChange={(v) => setDatos((d) => ({ ...d, importe: v }))} />
            <Campo etiqueta="Proveedor" valor={datos.proveedor} onChange={(v) => setDatos((d) => ({ ...d, proveedor: v }))} />
            <Campo etiqueta="Vencimiento (si lo tiene)" valor={datos.vencimiento} tipo="date" onChange={(v) => setDatos((d) => ({ ...d, vencimiento: v }))} />

            {enHelechos && (
              <CamposEstancia valor={estancia} cambiar={setEstancia} conEstancia={esIngreso} />
            )}

            <div className="mt-8">
              <BotonPrincipal
                onClick={guardar}
                desactivado={guardando || !datos.categoriaId}
                porQue={!datos.categoriaId ? 'Falta decir en qué carpeta va' : undefined}
                icono="check"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </BotonPrincipal>
            </div>
          </>
        )}

        {/* ══ 6 · CARPETA ══ */}
        {paso === 'categoria' && (
          <>
            <h1 className="t-titulo mt-8">¿Dónde lo guardamos?</h1>
            {migas.length > 0 && (
              <p className="t-apoyo mt-2">{migas.map((m) => m.nombre).join(' → ')}</p>
            )}
            {migas.length === 0 && <LoQueHeLeido texto={datos.texto} />}

            {/*
              El icono ya no es el emoji guardado en la categoría: es el
              de trazo que le corresponde a su carpeta de Drive, EL
              MISMO con el que va a salir luego en Papeles. Que el sitio
              donde lo guardas y el sitio donde lo encuentras se
              parezcan es media pantalla de explicación ahorrada.
            */}
            <div className="mt-6 space-y-2.5">
              {(hijosDe.get(padre) ?? []).map((c) => {
                const pintada = seccionPintada(c.segmento_drive)
                const tieneHijos = (hijosDe.get(c.id) ?? []).length > 0
                return (
                  <Fila
                    key={c.id}
                    onClick={() => elegirCategoria(c)}
                    alto="alta"
                    ambito={pintada.ambito}
                  >
                    <PastillaAmbito icono={pintada.icono} ambito={pintada.ambito} tam={48} />
                    <span className="t-tarjeta min-w-0 flex-1">{c.nombre}</span>
                    {tieneHijos && <Ico nombre="flecha" tam={20} grosor={2.2} className="shrink-0" />}
                  </Fila>
                )
              })}
            </div>
          </>
        )}

        {vista && paso === 'encontrado' && paginas.length <= 1 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vista} alt="" className="mt-10 w-full rounded-[18px] border border-borde object-contain" />
        )}

        {aviso && (
          <div className="mt-6">
            {/* El motivo exacto que ha dado Google va en `detalle`: no
                es para Juan Miguel ni para Conchita, pero mientras esto
                se monta ahorra tener que adivinar. */}
            <Aviso titulo="No se ha podido guardar" explicacion={aviso} detalle={detalle} />
          </div>
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
/*
  Una opción de una pregunta.

  Aquí había hasta CUATRO botones rellenos de verde en la misma
  pantalla —«Un mes antes», «Una semana antes», «Un día antes»— y eso
  no es un botón principal repetido cuatro veces: es una lista de
  respuestas a una pregunta. El sistema tiene un botón principal por
  pantalla; esto no es ninguno de ellos.

  Se pintan todas igual porque valen lo mismo. `tenue` es solo para la
  que significa «ninguna de las anteriores», que sí es distinta.
*/
function Opcion({
  texto,
  alPulsar,
  desactivada = false,
  tenue = false,
}: {
  texto: string
  alPulsar: () => void
  desactivada?: boolean
  tenue?: boolean
}) {
  return (
    <button
      onClick={alPulsar}
      disabled={desactivada}
      className={`r-tarjeta flex h-[64px] w-full items-center justify-center border border-borde bg-superficie text-[18px] font-extrabold disabled:opacity-40 ${
        tenue ? 'text-tenue' : 'text-tinta'
      }`}
    >
      {texto}
    </button>
  )
}

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
  /* Por lo que ES, no por lo que dice ser: la lista cerrada de tipos
     dejaba fuera cualquier PDF que llegara sin su etiqueta. */
  const tipo = tipoDe(f)
  return f.size > 0 && f.size <= MAXIMO && tipo !== null && TIPOS_BUENOS.includes(tipo)
}

/*
  Un dato leído del papel.

  Es el `Dato` del sistema con UNA diferencia, y la diferencia es el
  motivo de que exista: el del sistema no pinta la fila si el valor
  está vacío, porque en la ficha de un papel una etiqueta con un hueco
  al lado parece que falta un dato.

  Aquí es justo al revés. Esta es la pantalla donde hay que ver QUÉ NO
  HA LEÍDO: si el importe no sale, esconder la línea deja creer que el
  papel no llevaba importe. Se dice «No aparece» y se dice en tenue.
*/
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <DatoDS
      etiqueta={etiqueta}
      valor={valor || <span className="font-semibold text-tenue">No aparece</span>}
    />
  )
}

/*
  Y este era el `Campo` del sistema escrito otra vez: su propia altura
  (58 en vez de la de `.entrada`), su propio radio, y `focus:border-verde`
  —el verde que ya no es acento—. Ahora es el del sistema, con la
  etiqueta apuntando a su campo.
*/
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
  const id = 'c-' + etiqueta.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return (
    <CampoDS etiqueta={etiqueta} htmlFor={id} className="mt-7">
      <input
        id={id}
        type={tipo}
        inputMode={modo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="entrada"
      />
    </CampoDS>
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
