import { Ico } from './iconos'

/*
  La cara de cada uno.

  Si hay foto, la foto. Si no, sus iniciales sobre el verde de la
  marca. Nunca un muñeco gris genérico: la pantalla tiene que decir
  de un vistazo quién está usando HUBI.
*/

export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p: string) => p.charAt(0))
    .join('')
    .toUpperCase()
}

export default function Avatar({
  nombre,
  foto,
  tam = 44,
}: {
  nombre: string
  foto?: string | null
  tam?: number
}) {
  const letras = iniciales(nombre)

  if (foto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={foto}
        alt={nombre}
        width={tam}
        height={tam}
        className="shrink-0 rounded-full object-cover"
        style={{
          width: tam,
          height: tam,
          border: '1px solid var(--t-borde)',
        }}
      />
    )
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-verde font-extrabold text-white"
      style={{ width: tam, height: tam, fontSize: Math.round(tam * 0.34) }}
    >
      {letras || <Ico nombre="gente" tam={Math.round(tam * 0.5)} />}
    </span>
  )
}
