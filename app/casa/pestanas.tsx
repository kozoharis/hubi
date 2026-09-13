'use client'

import Link from '@/app/enlace'
import { usePathname } from 'next/navigation'
import { Ico, type Icono } from '../iconos'
import { AMBITO, type Ambito } from '@/lib/ambitos'

/*
  ═══════════════════════════════════════════════════════════════
  LAS CINCO PESTAÑAS DE LA PARED
  ═══════════════════════════════════════════════════════════════

  La primera versión de esta pantalla no llevaba navegación ninguna, y
  estaba razonado: «esto lo lee alguien de paso, a dos metros y sin
  parar de andar».

  Era verdad a medias. Un cartel sirve para enterarse, pero en una
  cocina hace falta además mirar la semana, ver qué toca comer y qué
  hay que hacer — y eso no cabe en una pantalla por grande que sea.

  Así que la pared tiene cinco sitios. Y como tiene cinco sitios, tiene
  un problema que un cartel no tenía:

  ─────────────────────────────────────────────────────────────
  ⚠️  EL PROBLEMA DE «LA DEJÓ EN OTRA»

  Una pantalla con pestañas se queda donde la dejó el último. Alguien
  mira el menú del jueves, se va, y a las tres horas la pared sigue
  enseñando el menú del jueves a quien pasa por delante buscando la
  hora.

  Lo arregla `vuelve-a-hoy.tsx`: a los tres minutos sin tocarla,
  vuelve sola a Hoy. Sin eso, esta navegación sería un empeoramiento.

  ─────────────────────────────────────────────────────────────
  POR QUÉ SON ENLACES Y NO ESTADO

  Cinco direcciones de verdad —`/casa`, `/casa/semana`…— y no un
  `useState` con cinco vistas. Tres razones, y las tres se notan en una
  pantalla encendida todo el día: recargar no pierde el sitio, cada
  pantalla pide SOLO sus datos, y la vuelta automática es una
  navegación normal en vez de un caso especial.

  ─────────────────────────────────────────────────────────────
  Y EL TAMAÑO

  Son 88 px de alto. El suelo de HUBI para lo que se pulsa son 48, y
  eso es para un dedo que apunta a un teléfono que sostiene. Esto se
  toca de pie, de lado, a veces con las manos ocupadas y casi siempre
  sin mirar dónde se está dando.
*/

const SITIOS: { href: string; texto: string; icono: Icono; ambito: Ambito }[] = [
  { href: '/casa', texto: 'Hoy', icono: 'casa', ambito: 'verde' },
  { href: '/casa/calendario', texto: 'Calendario', icono: 'calendario', ambito: 'azul' },
  { href: '/casa/menu', texto: 'Menú', icono: 'taza', ambito: 'arena' },
  /*
    Aquí estaba «Tareas», y se fue al Calendario. Lo dijo Haris —«tareas
    y calendario para mí es lo mismo»— y lo dice el punto 18 del
    planteamiento: para ellos todo son «cosas que tengo que recordar».
    Dos pestañas obligaban a decidir todos los días si lo del médico del
    martes era una tarea o era calendario.

    El sitio lo ocupa la compra, que es lo único que la pared puede
    escribir de verdad: su nivel en `compra` es `anadir` desde el paso
    61, y está así porque es exactamente para lo que sirve una tableta
    colgada en una cocina.
  */
  { href: '/casa/compra', texto: 'Compra', icono: 'bolsa', ambito: 'oliva' },
  { href: '/casa/notas', texto: 'Notas', icono: 'chincheta', ambito: 'rosa' },
]

export default function Pestanas() {
  /*
    Con el espacio en la dirección —`/e/<casa>/casa/semana`— comparar
    con `===` no valdría. Se mira el final del camino, que es lo único
    que distingue una pestaña de otra.
  */
  const donde = usePathname() ?? '/casa'

  return (
    <nav className="flex gap-3">
      {SITIOS.map((s) => {
        const cola = s.href.replace('/casa', '')
        const aqui = cola === '' ? /\/casa\/?$/.test(donde) : donde.endsWith(cola)
        const color = AMBITO[s.ambito]

        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={aqui ? 'page' : undefined}
            className="flex h-[72px] min-w-[142px] flex-col items-center justify-center gap-1.5 rounded-[24px] border transition-colors"
            style={
              aqui
                ? {
                    /*
                      La pestaña encendida lleva SU color de ámbito, al
                      14 % y con el borde marcado. Es la misma manera de
                      señalar que usa `Fila` con tinte — no un color de
                      acción, que aquí significaría «pulsa esto».
                    */
                    background: `color-mix(in srgb, ${color} 14%, var(--t-superficie))`,
                    borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
                    color: 'var(--t-tinta)',
                  }
                : {
                    background: 'var(--t-superficie)',
                    borderColor: 'var(--t-borde)',
                    color: 'var(--t-tenue)',
                  }
            }
          >
            <span style={{ color: aqui ? color : 'var(--t-apagado)' }}>
              <Ico nombre={s.icono} tam={26} grosor={2.1} />
            </span>
            {/* El dibujo NUNCA va solo: punto 5 del planteamiento. */}
            <span className="text-[17px] font-extrabold tracking-tight">{s.texto}</span>
          </Link>
        )
      })}
    </nav>
  )
}
