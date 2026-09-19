'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Ico } from '../iconos'

/*
  ═══════════════════════════════════════════════════════════════
  LA PIZARRA · lo primero de mappel que usa un niño
  ═══════════════════════════════════════════════════════════════

  Haris: *«hagamos en la cocina un espacio en notas, como si fuera un
  tablón de dibujo, con un icono de lápiz; con la tableta es muy fácil
  que los niños hagan un dibujo y se coloque como foto. Que usen varios
  colores y así pintan con el dedo o el lápiz»*.

  Y es la idea más barata de todo el proyecto, porque no inventa nada:

      la cámara (`camara.tsx`)   →  lienzo → toBlob → POST /api/fotos
      la pizarra                 →           toBlob → POST /api/fotos

  Es la misma tubería sin la primera pieza. Cero SQL, cero permisos
  nuevos, cero tablas: un dibujo ES una foto de la casa, y por eso sale
  sola en el carrusel de Inicio, en el descanso a pantalla completa y en
  el corcho de los dos móviles. Nadie tiene que mandarla a ningún sitio.

  ─────────────────────────────────────────────────────────────
  LO QUE CAMBIA QUE ESTO EXISTA

  La tableta de la cocina era, hasta hoy, un aparato de consulta: enseña
  lo que pasa en la casa y apunta la leche. Con esto pasa a ser algo que
  un niño quiere tocar — y una pantalla que alguien quiere tocar es una
  pantalla que además se mira para lo demás.

  ─────────────────────────────────────────────────────────────
  EL MODELO, Y POR QUÉ NO SE PINTA «Y YA ESTÁ»

  Lo que se pinta se guarda en una lista de elementos —trazos y sellos—
  y el lienzo se repinta desde ella. Podría pintarse directamente sobre
  el lienzo y no guardar nada, que es más corto; pero entonces:

    · **Deshacer** sería imposible. Y deshacer, con un niño delante, no
      es una comodidad: es la diferencia entre seguir dibujando y
      empezar de cero porque se ha ido una raya.

    · **Girar la tableta** borraría el dibujo. Al cambiar de tamaño hay
      que volver a dimensionar el lienzo, y dimensionar un lienzo lo
      vacía. Con la lista se vuelve a pintar y no se pierde nada.

    · **Guardar** saldría a la resolución de la pantalla, que en una
      tableta moderna son 2.800 px de ancho. Con la lista se pinta otra
      vez en un lienzo de 1.600 y sale una foto del tamaño de una foto.

  ─────────────────────────────────────────────────────────────
  LAS PEGATINAS SE COLOCAN, NO SE ESTAMPAN

  Haris: *«los stickers sería bueno poder moverlos; ahora mismo están
  como si fueran un lápiz, pero al colocarse sería bueno poder poner
  tamaño y desplazarlo»*.

  Y la diferencia no es una comodidad: es lo que son. Un trazo de lápiz
  **ocurre** —se hace y se acabó, y si sale torcido se deshace—. Una
  pegatina es un **objeto**: se pone, se mira, se mueve dos dedos a la
  izquierda y se hace más grande. Eso es lo que hace un niño con una
  pegatina de verdad antes de despegar el papel.

  Estampándolas como si fueran lápiz, colocar una era acertar a la
  primera. Y a la primera no acierta nadie.

  ── EL PAPEL TIENE DOS MODOS, Y SE VE CUÁL ──

  Con la bandeja de pegatinas abierta, el papel es de pegatinas: tocas
  una que ya está y la coges, tocas el papel y pones la elegida.
  Cerrando la bandeja —o tocando un color— el papel vuelve a ser de
  pintar.

  Un solo interruptor, y visible. La alternativa era adivinar la
  intención según dónde cae el dedo, que es exactamente la clase de cosa
  que hace que una pantalla parezca que tiene vida propia.

  ── Y EL TAMAÑO CON BOTONES, NO PELLIZCANDO ──

  Pellizcar con dos dedos es el gesto «natural» y aquí está descartado:
  el punto 5 del planteamiento dice **nada basado exclusivamente en
  gestos**. Dos botones grandes, «Más grande» y «Más pequeña», los
  entiende un niño de cuatro años y una persona de ochenta. Y se pueden
  tocar veinte veces sin miedo.

  ─────────────────────────────────────────────────────────────
  LA GOMA NO BORRA: PINTA DEL COLOR DEL PAPEL

  Es un trazo más, del color del fondo. Parece un truco y es lo
  contrario: así la goma también se deshace, que es lo que espera
  cualquiera que la use. Una goma «de verdad» —recortar del modelo lo
  que toca— sería más código para un resultado peor.
*/

export type QuienPinta = { id: string; nombre: string; color: string }

/* El papel. Está aquí y no en el CSS porque la goma lo necesita como
   color, y porque la foto que sale tiene que llevarlo pintado: un PNG
   transparente saldría negro en el descanso. */
const PAPEL = '#FFFFFF'

/*
  Ocho colores de verdad, no la paleta de la marca.

  mappel es cálido y sobrio a propósito, pero eso es para la casa. Un
  niño no quiere dibujar en arena y oliva: quiere un rojo que sea rojo.
  Aquí manda quien pinta.
*/
const COLORES = [
  '#1A1714', // tinta
  '#CE2821', // rojo
  '#E2761B', // naranja
  '#E4B429', // amarillo
  '#3E9B5F', // verde
  '#2F6FD0', // azul
  '#7E4BA8', // morado
  '#D0508A', // rosa
]

/* Tres gruesos y no un deslizador: un deslizador es puntería fina, y
   esto se usa de pie y con el dedo. */
const GRUESOS = [8, 18, 36]

const GOMA = 46

/*
  Las pegatinas son emojis pintados en el lienzo, no imágenes.

  No hay que subir ni servir ni mantener un solo fichero, se ven igual
  en la tableta y en el móvil, y la foto que sale los lleva dentro como
  dibujo. Si un día hacen falta pegatinas propias, se cambia esta lista
  por rutas y se pinta con `drawImage`: el resto no se entera.
*/
const PEGATINAS = ['⭐', '❤️', '🌈', '☀️', '🐱', '🐶', '🌸', '🎈', '🦋', '🍀', '🚗', '🐟']

type Trazo = { que: 'trazo'; color: string; grueso: number; puntos: [number, number][] }
type Sello = { que: 'sello'; id: string; emoji: string; x: number; y: number; tam: number }
type Elemento = Trazo | Sello

/* Lo que mide una pegatina recién puesta, y hasta dónde se la puede
   llevar. El tope de arriba no es capricho: una pegatina de 600 px en
   un papel de 900 no es una pegatina, es el dibujo. */
const PEGATINA_AL_PONERLA = 110
const PEGATINA_MENOR = 44
const PEGATINA_MAYOR = 420

/* Lo ancho que sale la foto. Una foto de pared, no un cartel. */
const ANCHO_AL_GUARDAR = 1600

export default function Pizarra({
  gente,
  alGuardar,
  cerrar,
}: {
  /** Los de la casa, para poder decir de quién es el dibujo. */
  gente: QuienPinta[]
  alGuardar: () => void
  cerrar: () => void
}) {
  const lienzo = useRef<HTMLCanvasElement | null>(null)
  const marco = useRef<HTMLDivElement | null>(null)

  /*
    El dibujo vive en una `ref` y no en un estado.

    A propósito: mientras el dedo se mueve esto se toca sesenta veces por
    segundo, y un `useState` repintaría React entero en cada punto. Lo
    que sí es estado es CUÁNTOS elementos hay, que es lo único que la
    pantalla necesita saber para encender o apagar «Deshacer».
  */
  const dibujo = useRef<Elemento[]>([])
  const [cuantos, setCuantos] = useState(0)

  /* La medida del papel en puntos CSS. Hace falta para repintar y para
     saber a qué escala sale la foto. */
  const medida = useRef({ ancho: 0, alto: 0 })

  const [color, setColor] = useState(COLORES[0])
  const [grueso, setGrueso] = useState(GRUESOS[1])
  const [borrando, setBorrando] = useState(false)
  const [pegatina, setPegatina] = useState<string | null>(null)
  const [conPegatinas, setConPegatinas] = useState(false)

  /*
    Cuál está cogida, si hay alguna.

    Va en estado Y en `ref` a la vez, y no es un descuido: el estado es
    lo que pinta la barra de «más grande / más pequeña», y la `ref` es
    lo que lee `repintar()` para dibujar el recuadro. `repintar` se creó
    una sola vez —está en un `useCallback`—, así que si mirara el estado
    vería siempre el primero. Es el fallo de los que no dan la cara:
    todo parece ir bien hasta que el recuadro se queda pegado a la
    primera pegatina para siempre.
  */
  const [elegida, setElegida] = useState<string | null>(null)
  const laElegida = useRef<string | null>(null)

  /* Un número que sube. Vale como nombre y no depende del reloj ni del
     azar, que en el pintado de React son funciones impuras. */
  const contador = useRef(0)

  /* Lo que se está arrastrando: qué pegatina, y por dónde se cogió —si
     no se guarda el desvío, al empezar a mover la pegatina salta para
     ponerse centrada bajo el dedo. */
  const arrastre = useRef<{ id: string; dx: number; dy: number } | null>(null)

  /* Dos pasos para vaciar. Un niño que toca «Empezar de nuevo» sin
     querer pierde media tarde. */
  const [seguro, setSeguro] = useState(false)

  const [preguntando, setPreguntando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  /* ── PINTAR LA LISTA ENTERA ──────────────────────────────── */

  /*
    La misma función para la pantalla y para la foto. Es lo que hace que
    lo que se guarda sea exactamente lo que se ve: dos rutinas de pintar
    son dos sitios donde el trazo acaba siendo distinto.
  */
  const pintarTodo = useCallback((
    pincel: CanvasRenderingContext2D,
    escala: number,
    /* Cuál lleva el recuadro de «esta está cogida». En la foto va
       siempre `null`: el recuadro es una ayuda para colocar, no parte
       del dibujo. */
    marcar: string | null = null
  ) => {
    const { ancho, alto } = medida.current
    pincel.save()
    pincel.setTransform(escala, 0, 0, escala, 0, 0)

    pincel.fillStyle = PAPEL
    pincel.fillRect(0, 0, ancho, alto)

    pincel.lineCap = 'round'
    pincel.lineJoin = 'round'
    pincel.textAlign = 'center'
    pincel.textBaseline = 'middle'

    for (const e of dibujo.current) {
      if (e.que === 'sello') {
        pincel.font = `${e.tam}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`
        pincel.fillText(e.emoji, e.x, e.y)

        /* El recuadro de la cogida. A rayas y no relleno: tiene que
           decir «ésta» sin taparla. */
        if (marcar && e.id === marcar) {
          const r = e.tam * 0.62
          pincel.save()
          pincel.setLineDash([10, 8])
          pincel.lineWidth = 3
          pincel.strokeStyle = '#2F6FD0'
          pincel.strokeRect(e.x - r, e.y - r, r * 2, r * 2)
          pincel.restore()
        }
        continue
      }

      pincel.strokeStyle = e.color
      pincel.lineWidth = e.grueso

      /* Un punto suelto —un toque sin arrastrar— no es una línea: es un
         redondel. Sin esto, tocar la pizarra no deja marca, y lo
         primero que hace cualquiera es tocarla. */
      if (e.puntos.length === 1) {
        pincel.fillStyle = e.color
        pincel.beginPath()
        pincel.arc(e.puntos[0][0], e.puntos[0][1], e.grueso / 2, 0, Math.PI * 2)
        pincel.fill()
        continue
      }

      pincel.beginPath()
      pincel.moveTo(e.puntos[0][0], e.puntos[0][1])
      for (let i = 1; i < e.puntos.length; i++) pincel.lineTo(e.puntos[i][0], e.puntos[i][1])
      pincel.stroke()
    }

    pincel.restore()
  }, [])

  const repintar = useCallback(() => {
    const c = lienzo.current
    const pincel = c?.getContext('2d')
    if (!c || !pincel) return
    pincel.setTransform(1, 0, 0, 1, 0, 0)
    pincel.clearRect(0, 0, c.width, c.height)
    pintarTodo(pincel, c.width / Math.max(1, medida.current.ancho), laElegida.current)
  }, [pintarTodo])

  /* ── EL TAMAÑO DEL PAPEL ─────────────────────────────────── */

  useEffect(() => {
    function medir() {
      const c = lienzo.current
      const m = marco.current
      if (!c || !m) return

      const caja = m.getBoundingClientRect()
      if (caja.width < 10 || caja.height < 10) return

      /*
        El doble de puntos que de CSS, y no más. En una tableta de las
        de 3 el lienzo saldría de 4.000 px de ancho: el trazo no se ve
        mejor y cada repintado cuesta el triple.
      */
      const densidad = Math.min(2, window.devicePixelRatio || 1)

      medida.current = { ancho: caja.width, alto: caja.height }
      c.width = Math.round(caja.width * densidad)
      c.height = Math.round(caja.height * densidad)
      c.style.width = `${caja.width}px`
      c.style.height = `${caja.height}px`

      repintar()
    }

    medir()
    const ojo = new ResizeObserver(medir)
    if (marco.current) ojo.observe(marco.current)
    window.addEventListener('resize', medir)
    return () => {
      ojo.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [repintar])

  /* ── EL DEDO ─────────────────────────────────────────────── */

  const pintando = useRef(false)

  function dondeEsta(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const caja = e.currentTarget.getBoundingClientRect()
    return [e.clientX - caja.left, e.clientY - caja.top]
  }

  /* Poner o quitar el recuadro. Los dos sitios a la vez: el estado
     pinta la barra, la `ref` pinta el recuadro. */
  function coger(id: string | null) {
    laElegida.current = id
    setElegida(id)
  }

  /*
    ── QUÉ PEGATINA HAY DEBAJO DEL DEDO ──

    De arriba abajo, o sea de la última puesta a la primera: si dos se
    tocan, se coge la que se ve encima, que es la que la mano cree que
    está cogiendo.

    La caja es cuadrada y un pelo más grande que la letra (0,62 del
    tamaño a cada lado). Un emoji no llena su cuadro, así que una caja
    exacta obligaría a acertar en el dibujo; ésta perdona el borde, que
    es lo que hace falta con un dedo.
  */
  function laDeAhi(punto: [number, number]): Sello | null {
    for (let i = dibujo.current.length - 1; i >= 0; i--) {
      const e = dibujo.current[i]
      if (e.que !== 'sello') continue
      const r = e.tam * 0.62
      if (
        punto[0] >= e.x - r && punto[0] <= e.x + r &&
        punto[1] >= e.y - r && punto[1] <= e.y + r
      ) return e
    }
    return null
  }

  function empieza(e: React.PointerEvent<HTMLCanvasElement>) {
    /* Que el lienzo se quede con el dedo: sin esto, salirse del papel a
       media raya deja el trazo abierto y la siguiente vez que se entra
       se sigue pintando solo. Y para arrastrar una pegatina vale
       exactamente igual. */
    e.currentTarget.setPointerCapture(e.pointerId)
    const punto = dondeEsta(e)
    setSeguro(false)

    /*
      ── CON LA BANDEJA ABIERTA, EL PAPEL ES DE PEGATINAS ──

      Y no se pinta. Es el interruptor visible del que habla la cabecera:
      mientras la bandeja está abierta, tocar el papel coloca o coge; se
      cierra la bandeja —o se toca un color— y el papel vuelve a pintar.
    */
    if (conPegatinas) {
      const debajo = laDeAhi(punto)

      if (debajo) {
        /* Cogida. Se guarda por dónde se cogió para que no salte. */
        coger(debajo.id)
        arrastre.current = { id: debajo.id, dx: punto[0] - debajo.x, dy: punto[1] - debajo.y }
        repintar()
        return
      }

      if (pegatina) {
        contador.current += 1
        const id = `p${contador.current}`
        dibujo.current.push({
          que: 'sello',
          id,
          emoji: pegatina,
          x: punto[0],
          y: punto[1],
          tam: PEGATINA_AL_PONERLA,
        })
        setCuantos(dibujo.current.length)
        /* Nace cogida y arrastrándose: así, el mismo dedo que la puso
           puede seguir moviéndola sin levantarse. */
        coger(id)
        arrastre.current = { id, dx: 0, dy: 0 }
        repintar()
        return
      }

      /* Papel vacío y nada elegido: soltar la que hubiera. */
      coger(null)
      repintar()
      return
    }

    pintando.current = true
    dibujo.current.push({
      que: 'trazo',
      color: borrando ? PAPEL : color,
      grueso: borrando ? GOMA : grueso,
      puntos: [punto],
    })
    setCuantos(dibujo.current.length)
    repintar()
  }

  function sigue(e: React.PointerEvent<HTMLCanvasElement>) {
    /* Arrastrando una pegatina. Se repinta la lista entera en cada
       paso: hay que borrar el sitio de donde viene, y encima puede
       haber trazos por debajo que hay que volver a poner. */
    const cogida = arrastre.current
    if (cogida) {
      const punto = dondeEsta(e)
      const sello = dibujo.current.find(
        (x): x is Sello => x.que === 'sello' && x.id === cogida.id
      )
      if (sello) {
        sello.x = punto[0] - cogida.dx
        sello.y = punto[1] - cogida.dy
        repintar()
      }
      return
    }

    if (!pintando.current) return
    const ultimo = dibujo.current[dibujo.current.length - 1]
    if (!ultimo || ultimo.que !== 'trazo') return

    const punto = dondeEsta(e)
    const antes = ultimo.puntos[ultimo.puntos.length - 1]
    ultimo.puntos.push(punto)

    /*
      Y aquí SÍ se pinta a pelo, sin repintar la lista entera: es el
      único sitio donde importa la velocidad. Se dibuja sólo el tramo
      nuevo, encima de lo que ya hay.
    */
    const c = lienzo.current
    const pincel = c?.getContext('2d')
    if (!c || !pincel) return
    const escala = c.width / Math.max(1, medida.current.ancho)
    pincel.save()
    pincel.setTransform(escala, 0, 0, escala, 0, 0)
    pincel.lineCap = 'round'
    pincel.lineJoin = 'round'
    pincel.strokeStyle = ultimo.color
    pincel.lineWidth = ultimo.grueso
    pincel.beginPath()
    pincel.moveTo(antes[0], antes[1])
    pincel.lineTo(punto[0], punto[1])
    pincel.stroke()
    pincel.restore()
  }

  function acaba() {
    pintando.current = false
    /* Se suelta el arrastre, pero NO el recuadro: al levantar el dedo
       la pegatina sigue cogida, que es cuando hace falta la barra de
       hacerla más grande. */
    arrastre.current = null
  }

  /* Cerrar el modo pegatinas entero: la bandeja, la elegida y el
     recuadro. Se llama desde los colores, los gruesos y la goma, que
     son las tres maneras de decir «quiero pintar». */
  function dejarLasPegatinas() {
    setPegatina(null)
    setConPegatinas(false)
    coger(null)
    repintar()
  }

  /* Más grande y más pequeña, a pasos. Un cuarto por toque: se nota a
     la primera y no se dispara a los tres. */
  function cambiarTamano(hacia: 'mas' | 'menos') {
    const id = laElegida.current
    if (!id) return
    const sello = dibujo.current.find((x): x is Sello => x.que === 'sello' && x.id === id)
    if (!sello) return
    const nuevo = hacia === 'mas' ? sello.tam * 1.25 : sello.tam / 1.25
    sello.tam = Math.round(Math.min(PEGATINA_MAYOR, Math.max(PEGATINA_MENOR, nuevo)))
    repintar()
  }

  /* Quitar la cogida. Es lo que convierte «he puesto una sin querer» en
     un toque, en vez de en deshacer a ciegas hasta que desaparezca. */
  function quitarLaElegida() {
    const id = laElegida.current
    if (!id) return
    dibujo.current = dibujo.current.filter((x) => !(x.que === 'sello' && x.id === id))
    setCuantos(dibujo.current.length)
    coger(null)
    repintar()
  }

  function deshacer() {
    const fuera = dibujo.current.pop()
    /* Si lo que se ha quitado era la cogida, se suelta: un recuadro
       alrededor de algo que ya no existe es una pantalla mintiendo. */
    if (fuera && fuera.que === 'sello' && fuera.id === laElegida.current) coger(null)
    setCuantos(dibujo.current.length)
    setSeguro(false)
    repintar()
  }

  function empezarDeNuevo() {
    if (!seguro) {
      setSeguro(true)
      return
    }
    dibujo.current = []
    setCuantos(0)
    setSeguro(false)
    coger(null)
    repintar()
  }

  /* ── GUARDARLO ───────────────────────────────────────────── */

  async function guardar(dequien: QuienPinta | null) {
    setGuardando(true)
    setFallo(null)
    /* El recuadro no va en la foto. `pintarTodo` ya lo deja fuera
       —sólo lo pinta si se le pasa cuál marcar, y aquí no se le pasa—,
       pero además se suelta para que la pantalla no se quede con una
       pegatina cogida por detrás del panel. */
    coger(null)

    try {
      const { ancho, alto } = medida.current
      const escala = ANCHO_AL_GUARDAR / Math.max(1, ancho)

      const salida = document.createElement('canvas')
      salida.width = Math.round(ancho * escala)
      salida.height = Math.round(alto * escala)
      const pincel = salida.getContext('2d')
      if (!pincel) throw new Error()
      pintarTodo(pincel, escala)

      const foto = await new Promise<Blob | null>((listo) =>
        salida.toBlob(listo, 'image/png')
      )
      if (!foto) throw new Error()

      const paquete = new FormData()
      /* El nombre da igual: `/api/fotos` guarda el fichero con un
         identificador propio dentro de la carpeta de la casa. */
      paquete.append('foto', new File([foto], 'dibujo.png', { type: 'image/png' }))
      /* El pie ya existía en `fotos_casa` desde el paso 73. Por eso
         «de quién es» no cuesta ni una columna: sale debajo de la foto
         en el descanso, como el pie de cualquier otra. */
      paquete.append('pie', dequien ? `Un dibujo de ${dequien.nombre.split(' ')[0]}` : 'Un dibujo')

      const r = await fetch(api('/api/fotos'), { method: 'POST', body: paquete })
      const d = (await r.json().catch(() => null)) as { error?: string } | null

      if (!r.ok) {
        setFallo(d?.error ?? 'No se ha podido guardar el dibujo.')
        setGuardando(false)
        setPreguntando(false)
        return
      }

      alGuardar()
      cerrar()
    } catch {
      setFallo('No se ha podido guardar el dibujo.')
      setGuardando(false)
      setPreguntando(false)
    }
  }

  /* ── LA PANTALLA ─────────────────────────────────────────── */

  return (
    /*
      El mismo telón que la cámara y que `poner.tsx`. Y tampoco se
      cierra al tocarlo: con un niño pintando, un roce fuera del papel
      tiraría el dibujo a la basura sin preguntar.
    */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 py-5 xl:px-10 xl:py-8"
      style={{ background: 'rgba(26,23,20,.72)' }}
    >
      <div className="flex h-full w-full max-w-[1500px] flex-col rounded-[36px] border border-borde bg-fondo px-7 py-6 xl:px-9">
        {/* ── Arriba: qué es esto, y la salida ──────────────── */}
        <div className="flex shrink-0 items-center gap-5">
          <p className="text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">
            La pizarra
          </p>

          <span className="ml-auto flex items-center gap-3">
            <Boton onClick={deshacer} desactivado={cuantos === 0 || guardando}>
              <Ico nombre="atras" tam={22} grosor={2.4} />
              Deshacer
            </Boton>

            {/*
              «Empezar de nuevo» en dos toques, y el segundo lo dice con
              todas las letras. Es la única acción de esta pantalla que
              no se puede deshacer.
            */}
            <button
              type="button"
              onClick={empezarDeNuevo}
              disabled={cuantos === 0 || guardando}
              className="tocable flex items-center justify-center gap-3 rounded-full border px-7 text-[20px] font-extrabold disabled:opacity-45"
              style={{
                minHeight: 64,
                background: seguro ? 'var(--t-alerta)' : 'var(--t-superficie)',
                color: seguro ? '#FFFFFF' : 'var(--t-tinta)',
                borderColor: seguro ? 'transparent' : 'var(--t-borde)',
              }}
            >
              <Ico nombre="refrescar" tam={22} grosor={2.4} />
              {seguro ? '¿Seguro? Se borra todo' : 'Empezar de nuevo'}
            </button>

            <Boton principal onClick={() => setPreguntando(true)} desactivado={cuantos === 0 || guardando}>
              <Ico nombre="check" tam={24} grosor={2.6} />
              Guardar
            </Boton>

            {/* SALIR, siempre puesto. La misma lección que la cámara:
                el momento en que alguien quiere salir es el que no se
                puede prever. */}
            <Boton onClick={cerrar} desactivado={guardando}>
              <Ico nombre="atras" tam={22} grosor={2.6} />
              Salir
            </Boton>
          </span>
        </div>

        {/* ── EL PAPEL ──────────────────────────────────────── */}
        <div
          ref={marco}
          className="mt-5 min-h-0 flex-1 overflow-hidden rounded-[28px] border"
          style={{ borderColor: 'var(--t-borde)', background: PAPEL }}
        >
          <canvas
            ref={lienzo}
            onPointerDown={empieza}
            onPointerMove={sigue}
            onPointerUp={acaba}
            onPointerCancel={acaba}
            /* Sin esto, arrastrar el dedo desplaza la página en vez de
               pintar. Es la línea que hace que una pizarra sea una
               pizarra. */
            style={{ touchAction: 'none', display: 'block', cursor: 'crosshair' }}
          />
        </div>

        {fallo && (
          <p className="mt-3 shrink-0 text-[20px] font-bold" style={{ color: 'var(--t-alerta)' }}>
            {fallo}
          </p>
        )}

        {/*
          ── LA BANDEJA, O LA BARRA DE LA QUE ESTÁ COGIDA ──────

          El mismo renglón hace las dos cosas, y no por ahorrar sitio:
          mientras colocas una pegatina, la bandeja de las otras doce no
          es una ayuda, es ruido. Lo que hace falta ahí es «más grande,
          más pequeña, quítala, ya está».

          Y en cuanto sueltas, vuelve la bandeja sola.
        */}
        {conPegatinas && elegida && (
          <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2.5">
            <p className="mr-1 text-[19px] font-extrabold text-tinta-suave">
              Arrástrala por el papel
            </p>

            <button
              type="button"
              onClick={() => cambiarTamano('mas')}
              className="tocable flex h-[62px] items-center gap-3 rounded-full border border-borde bg-superficie px-6 text-[19px] font-extrabold text-tinta"
            >
              <Ico nombre="mas" tam={22} grosor={2.6} />
              Más grande
            </button>

            <button
              type="button"
              onClick={() => cambiarTamano('menos')}
              className="tocable flex h-[62px] items-center gap-3 rounded-full border border-borde bg-superficie px-6 text-[19px] font-extrabold text-tinta"
            >
              {/* Una raya, que es lo contrario del más. No hay icono de
                  «menos» en el juego de mappel y no hace falta
                  inventarlo: 22 px de línea es exactamente eso. */}
              <span aria-hidden className="block h-[3px] w-[22px] rounded-full bg-current" />
              Más pequeña
            </button>

            <button
              type="button"
              onClick={quitarLaElegida}
              className="tocable flex h-[62px] items-center gap-3 rounded-full border px-6 text-[19px] font-extrabold"
              style={{ borderColor: 'var(--t-alerta)', color: 'var(--t-alerta)' }}
            >
              <Ico nombre="atras" tam={22} grosor={2.4} />
              Quitarla
            </button>

            <button
              type="button"
              onClick={() => {
                coger(null)
                repintar()
              }}
              className="tocable ml-auto flex h-[62px] items-center gap-3 rounded-full border px-6 text-[19px] font-extrabold"
              style={{
                background: 'var(--t-tinta)',
                color: 'var(--t-fondo)',
                borderColor: 'transparent',
              }}
            >
              <Ico nombre="check" tam={22} grosor={2.6} />
              Ya está
            </button>
          </div>
        )}

        {conPegatinas && !elegida && (
          <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2.5">
            {PEGATINAS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPegatina(pegatina === p ? null : p)}
                className="tocable flex h-[62px] w-[62px] items-center justify-center rounded-[20px] border text-[32px]"
                style={{
                  background: 'var(--t-superficie)',
                  borderColor: pegatina === p ? 'var(--t-tinta)' : 'var(--t-borde)',
                  borderWidth: pegatina === p ? 3 : 1,
                }}
              >
                {p}
              </button>
            ))}
            <p className="ml-2 text-[19px] font-extrabold text-tinta-suave">
              {pegatina
                ? 'Toca el papel donde quieras ponerla'
                : 'Elige una, o toca una que ya esté puesta para moverla'}
            </p>
          </div>
        )}

        {/* ── LOS COLORES Y LO DEMÁS ────────────────────────── */}
        <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2.5">
          {COLORES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c)
                setBorrando(false)
                /* Tocar un color devuelve el papel a pintar. Es el
                   mismo interruptor que el botón de Pegatinas, visto
                   desde el otro lado: no hay modo escondido. */
                dejarLasPegatinas()
              }}
              aria-label={`Pintar de este color`}
              className="tocable flex h-[62px] w-[62px] items-center justify-center rounded-full"
              style={{
                background: c,
                /* El elegido se marca con un anillo del color del papel
                   por dentro: a dos metros, un borde fino no se ve. */
                boxShadow:
                  color === c && !borrando && !pegatina
                    ? `0 0 0 5px var(--t-fondo), 0 0 0 9px ${c}`
                    : 'none',
              }}
            />
          ))}

          <span className="mx-2 h-[46px] w-px bg-borde" />

          {GRUESOS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setGrueso(g)
                setBorrando(false)
                dejarLasPegatinas()
              }}
              aria-label="Cambiar el grosor"
              className="tocable flex h-[62px] w-[62px] items-center justify-center rounded-[20px] border"
              style={{
                background: 'var(--t-superficie)',
                borderColor: grueso === g && !borrando ? 'var(--t-tinta)' : 'var(--t-borde)',
                borderWidth: grueso === g && !borrando ? 3 : 1,
              }}
            >
              <span
                className="block rounded-full"
                style={{ height: g, width: g, background: 'var(--t-tinta)' }}
              />
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setBorrando(!borrando)
              dejarLasPegatinas()
            }}
            className="tocable flex h-[62px] items-center gap-3 rounded-full border px-6 text-[19px] font-extrabold"
            style={{
              background: borrando ? 'var(--t-tinta)' : 'var(--t-superficie)',
              color: borrando ? 'var(--t-fondo)' : 'var(--t-tinta)',
              borderColor: borrando ? 'transparent' : 'var(--t-borde)',
            }}
          >
            <Ico nombre="refrescar" tam={22} grosor={2.2} />
            Goma
          </button>

          <button
            type="button"
            onClick={() => {
              const abrir = !conPegatinas
              setConPegatinas(abrir)
              if (abrir) {
                /* Abrir la bandeja apaga la goma: el papel pasa a ser
                   de pegatinas y una goma encendida que no borra nada
                   es un botón mintiendo. */
                setBorrando(false)
              } else {
                setPegatina(null)
                coger(null)
                repintar()
              }
            }}
            className="tocable flex h-[62px] items-center gap-3 rounded-full border px-6 text-[19px] font-extrabold"
            style={{
              background: conPegatinas ? 'var(--t-tinta)' : 'var(--t-superficie)',
              color: conPegatinas ? 'var(--t-fondo)' : 'var(--t-tinta)',
              borderColor: conPegatinas ? 'transparent' : 'var(--t-borde)',
            }}
          >
            <span aria-hidden className="text-[24px] leading-none">
              ⭐
            </span>
            Pegatinas
          </button>
        </div>
      </div>

      {/* ── ¿DE QUIÉN ES? ─────────────────────────────────────
          Un toque, y el dibujo deja de ser «una foto más» para ser «un
          dibujo de Paula». Cuesta cero: `fotos_casa.pie` existe desde
          el paso 73 y ya se enseña debajo de la foto en el descanso.

          Con «De nadie» delante de nada: quien no quiera contestar
          tiene salida, y sin salida esta pregunta sería un peaje. */}
      {preguntando && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-10"
          style={{ background: 'rgba(26,23,20,.72)' }}
        >
          <div className="w-full max-w-[860px] rounded-[36px] border border-borde bg-fondo px-10 py-9">
            <p className="text-[30px] font-extrabold leading-tight text-tinta">
              ¿De quién es el dibujo?
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {gente.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => guardar(g)}
                  disabled={guardando}
                  className="tocable flex items-center gap-4 rounded-full border border-borde bg-superficie px-7 text-[23px] font-extrabold text-tinta disabled:opacity-45"
                  style={{ minHeight: 76 }}
                >
                  <span
                    className="block h-[38px] w-[38px] shrink-0 rounded-full"
                    style={{ background: g.color }}
                  />
                  {g.nombre.split(' ')[0]}
                </button>
              ))}

              <button
                type="button"
                onClick={() => guardar(null)}
                disabled={guardando}
                className="tocable flex items-center rounded-full border border-borde bg-superficie px-7 text-[23px] font-extrabold text-tinta-suave disabled:opacity-45"
                style={{ minHeight: 76 }}
              >
                De nadie
              </button>
            </div>

            <div className="mt-8 flex items-center gap-3">
              {guardando && (
                <p className="text-[21px] font-extrabold text-tinta-suave">Guardando el dibujo…</p>
              )}
              <span className="ml-auto">
                <Boton onClick={() => setPreguntando(false)} desactivado={guardando}>
                  <Ico nombre="atras" tam={22} grosor={2.6} />
                  Seguir pintando
                </Boton>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* El mismo botón de la cámara y de `poner.tsx`. 64 px y no 72: aquí hay
   cuatro en la misma línea y el papel es lo que tiene que mandar. */
function Boton({
  children,
  onClick,
  principal = false,
  desactivado = false,
}: {
  children: React.ReactNode
  onClick: () => void
  principal?: boolean
  desactivado?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      className="tocable flex items-center justify-center gap-3 rounded-full border px-7 text-[20px] font-extrabold disabled:opacity-45"
      style={{
        minHeight: 64,
        background: principal ? 'var(--t-boton)' : 'var(--t-superficie)',
        color: principal ? 'var(--t-boton-texto)' : 'var(--t-tinta)',
        borderColor: principal ? 'transparent' : 'var(--t-borde)',
      }}
    >
      {children}
    </button>
  )
}
