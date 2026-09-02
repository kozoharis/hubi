'use client'

import Link from 'next/link'
import { Ico, type Icono } from './iconos'

/*
  La barra de abajo.

  Cinco pestañas y las cinco son secciones de verdad: nada escondido
  detrás de tres puntos. Los ajustes salen de la inicial de arriba,
  que es donde todo el mundo los busca.

  Encima, el botón de voz: pequeño, siempre en el mismo sitio, pegado
  a la barra. Solo el símbolo de onda.

  Está a 52 px y a diez del borde de la barra. Estaba a 58 y flotando
  72 px por encima, y ahí molestaba dos veces: tapaba el final de las
  listas y obligaba a dejarle un hueco a la derecha en pantallas donde
  no pintaba nada —el pie del calendario tenía un `pr-24` puesto solo
  para esquivarlo, que partía la leyenda en dos renglones—.

  52 px sigue por encima de los 48 que fijamos como mínimo para lo que
  hay que pulsar. Por debajo de eso no baja aunque quede más elegante.

  En Inicio no aparece: allí la invitación de arriba ya lleva el mismo
  símbolo, y dos botones para lo mismo en una pantalla es uno de más.
*/

type Seccion =
  | 'inicio'
  | 'documentos'
  | 'agenda'
  | 'finca'
  | 'helechos'
  | null

/*
  Cinco pestañas, y ni una más.

  Con seis, cada botón baja de los 48 px que fijamos como mínimo para
  lo que hay que pulsar — la regla que protege a un dedo de 75 años. Y
  ese suelo no se negocia por hacer sitio a una sección.

  Tareas y Calendario eran DOS pestañas de la misma tabla: una lista y
  un mes de lo mismo. Tenerlas separadas obligaba a decidir dónde
  buscar algo que estaba en los dos sitios — justo la complejidad que
  el punto 18 dice que no debe existir para ellos: "todo debe ser
  cosas que tengo que recordar". Ahora son una: Agenda, con sus dos
  vistas dentro.

  Eso liberó el sitio de Los Helechos sin apretar nada.
*/
const PESTANAS: { clave: Exclude<Seccion, null>; texto: string; icono: Icono; href: string }[] = [
  { clave: 'inicio',     texto: 'Inicio',     icono: 'casa',       href: '/' },
  { clave: 'documentos', texto: 'Papeles',    icono: 'carpeta',    href: '/documentos' },
  { clave: 'agenda',     texto: 'Agenda',     icono: 'calendario', href: '/agenda' },
  { clave: 'finca',      texto: 'Finca',      icono: 'hoja',       href: '/finca' },
  { clave: 'helechos',   texto: 'Helechos',   icono: 'llave',      href: '/helechos' },
]

export default function Barra({
  activa = null,
  voz = true,
}: {
  activa?: Seccion
  voz?: boolean
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <div className="pointer-events-none relative mx-auto max-w-md">
        {voz && (
          <Link
            href="/hablar"
            aria-label="Hablar con HUBI"
            className="pointer-events-auto absolute bottom-[10px] right-4 flex flex-col items-center"
          >
            <span className="relative flex h-[52px] w-[52px] items-center justify-center">
              <span className="pulso" />
              <span className="pulso pulso-b" />
              <span
                className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full text-white"
                style={{
                  background: 'linear-gradient(140deg,#2DD4BF,#14B8A6 45%,#3B82F6)',
                  boxShadow:
                    '0 10px 26px rgba(20,184,166,.45), inset 0 1px 0 rgba(255,255,255,.35)',
                }}
              >
                <Ico nombre="onda" tam={23} grosor={2.4} />
              </span>
            </span>
          </Link>
        )}
      </div>

      <nav
        className="pointer-events-auto border-t border-borde bg-superficie"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto flex h-[68px] max-w-md">
          {PESTANAS.map((p) => {
            const puesta = p.clave === activa
            return (
              <Link
                key={p.clave}
                href={p.href}
                prefetch={false}
                aria-current={puesta ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-[12px] font-bold ${
                  puesta ? 'text-verde' : 'text-apagado'
                }`}
              >
                <Ico nombre={p.icono} tam={25} grosor={puesta ? 2.1 : 1.9} />
                <span>{p.texto}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
