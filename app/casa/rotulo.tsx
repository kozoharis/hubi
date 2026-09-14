import type { ReactNode } from 'react'

/*
  El encabezado de cada zona de la pared: «HOY», «DESPUÉS», «LO QUE HAY
  QUE HACER». Existe para que las cinco pantallas no vuelvan a escribir
  cada una su `text-[20px] uppercase tracking-…`, que es exactamente la
  manera de que dentro de un mes haya cinco tamaños distintos.
*/
export function Rotulo({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 shrink-0 text-[20px] font-extrabold uppercase tracking-[0.2em] text-tenue">
      {children}
    </h2>
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
    /* Era `py-10` con `mt-6`. Cuarenta píxeles de aire y otros
       veinticuatro encima para decir que no hay nada: en una pared que
       tiene que caber entera, el hueco de lo que NO existe no puede
       medir lo mismo que una tarjeta con algo dentro. */
    <div className="shrink-0 rounded-[28px] border border-borde bg-superficie px-7 py-6">
      <p className="text-[23px] font-extrabold leading-snug text-tinta-suave">{children}</p>
    </div>
  )
}
