import type { ReactNode } from 'react'

/*
  El encabezado de cada zona de la pared: «HOY», «DESPUÉS», «LO QUE HAY
  QUE HACER». Existe para que las cinco pantallas no vuelvan a escribir
  cada una su `text-[20px] uppercase tracking-…`, que es exactamente la
  manera de que dentro de un mes haya cinco tamaños distintos.
*/
export function Rotulo({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">{children}</h2>
  )
}

/*
  Y el vacío. Nunca dice «no hay datos»: dice que no hay nada que hacer,
  que es una buena noticia.

  Va en tarjeta como todo lo demás — un párrafo suelto sobre el papel
  parecía que la pantalla no había terminado de cargar.
*/
export function Nada({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-[28px] border border-borde bg-superficie px-8 py-10">
      <p className="text-[25px] font-extrabold leading-snug text-tinta-suave">{children}</p>
    </div>
  )
}
