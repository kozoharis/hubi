/*
  ═══════════════════════════════════════════════════════════════
  QUÉ HA HECHO YA ESTA PERSONA
  ═══════════════════════════════════════════════════════════════

  De aquí sale que la tarjeta de «Primeros pasos» se tache sola.

  Tres de los cuatro se preguntan a las tablas que ya existen, y esto
  es deliberado: si en vez de mirar los documentos guardáramos una
  marca al guardar el primero, esa marca podría no ponerse —un fallo,
  una versión vieja— y la tarjeta le diría a alguien que no ha
  guardado nada teniendo doce papeles dentro. Preguntando por lo que
  hay, eso no puede pasar.

  El cuarto, hablar, no deja rastro y por eso tiene su tabla (SQL 50).

  ─────────────────────────────────────────────────────────────
  TODO ENVUELTO, Y NO POR COSTUMBRE

  Si falta el SQL 50, o si una consulta falla, esto devuelve «no
  hecho» y la tarjeta sale entera. Lo que NUNCA puede pasar es que el
  Inicio se caiga por una tarjeta de bienvenida.
*/

/** Las cuatro claves que puede devolver, iguales a las de `lib/guia`. */
export type Paso = 'guardar' | 'hablar' | 'agenda' | 'nota'

export async function pasosHechos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  usuarioId: string
): Promise<Set<Paso>> {
  const hechos = new Set<Paso>()

  /* Una sola pregunta por paso, y todas a la vez: cuatro esperas en
     fila se notan en el Inicio, que es la pantalla que tiene que
     abrirse rápido. */
  const [papel, agenda, nota, hablado] = await Promise.all([
    uno(supabase, 'documentos', 'subido_por', usuarioId),
    uno(supabase, 'recordatorios', 'creado_por', usuarioId),
    uno(supabase, 'notas', 'escrita_por', usuarioId),
    (async () => {
      try {
        const { data } = await supabase
          .from('pasos_dados')
          .select('paso')
          .eq('perfil_id', usuarioId)
          .eq('paso', 'hablar')
          .limit(1)
        return (data?.length ?? 0) > 0
      } catch {
        return false
      }
    })(),
  ])

  if (papel) hechos.add('guardar')
  if (agenda) hechos.add('agenda')
  if (nota) hechos.add('nota')
  if (hablado) hechos.add('hablar')

  return hechos
}

/** ¿Hay al menos una fila de esta persona en esta tabla? */
async function uno(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tabla: string,
  columna: string,
  quien: string
): Promise<boolean> {
  try {
    /* `head: true` con `count: exact` no trae ni una fila: solo el
       número. Es la diferencia entre preguntar «¿hay alguno?» y
       traerse los doscientos documentos para contarlos. */
    const { count, error } = await supabase
      .from(tabla)
      .select('id', { count: 'exact', head: true })
      .eq(columna, quien)
      .limit(1)
    if (error) return false
    return (count ?? 0) > 0
  } catch {
    return false
  }
}
