/*
  ═══════════════════════════════════════════════════════════════
  EL IGIC Y EL IVA
  ═══════════════════════════════════════════════════════════════

  LA REGLA QUE HACE QUE ESTO NO SEA UN INCORDIO:
  SIEMPRE SE TECLEA EL TOTAL.

  El total es lo que pone la factura en grande, lo que sale del banco y
  lo que uno recuerda haber pagado. La base no la sabe nadie de memoria
  y calcularla a mano es justo el trabajo que HUBI tiene que quitar.

  Así que se escribe 127,43 € —que es lo que ya se escribía— y de ahí
  salen la base y la cuota hacia atrás. Ni un campo más que antes.

  ─────────────────────────────────────────────────────────────
  Y EL TOTAL NO SE TOCA NUNCA

  `movimientos.importe` sigue siendo el total, exactamente como hasta
  hoy. Eso importa por dos motivos:

  · Los apuntes de antes siguen valiendo. No hay que migrar nada, y el
    balance de 2024 sigue diciendo lo mismo que decía ayer.
  · Si el desglose del impuesto estuviera mal —un tipo equivocado, una
    factura exenta— el balance SIGUE SIENDO CORRECTO. Lo que se paga es
    lo que se paga. El impuesto es una lectura de ese número, no el
    número.

  Por eso la base no se guarda: se calcula. Guardar total, base y cuota
  es guardar la misma verdad tres veces, y tres copias de una verdad
  acaban siendo tres verdades distintas.

  ─────────────────────────────────────────────────────────────
  EN POSITIVO Y EN NEGATIVO

  El impuesto de un gasto y el de un ingreso no son la misma cosa:

    SOPORTADO    el que pagas en tus compras
    REPERCUTIDO  el que cobras en tus facturas

  Y lo que se liquida es la diferencia. Por eso el balance lleva una
  tercera línea aparte: no es dinero ganado ni gastado, es dinero que
  está de paso.
*/

export type Impuesto = 'ninguno' | 'igic' | 'iva'

export const IMPUESTOS: Impuesto[] = ['ninguno', 'igic', 'iva']

export function esImpuesto(v: unknown): v is Impuesto {
  return typeof v === 'string' && (IMPUESTOS as string[]).includes(v)
}

/** Cómo se llama, para escribirlo en pantalla. */
export function comoSeLlama(i: Impuesto): string {
  return i === 'igic' ? 'IGIC' : i === 'iva' ? 'IVA' : ''
}

/*
  Los tipos de cada uno, en el orden en que se usan de verdad.

  El habitual va primero porque es el que se toca el 90% de las veces, y
  el 0 va al final: existe —hay facturas exentas— pero buscarlo no puede
  costar lo mismo que encontrar el normal.
*/
export const TIPOS: Record<Exclude<Impuesto, 'ninguno'>, number[]> = {
  /* Canarias. El general es el 7%. */
  igic: [7, 3, 9.5, 15, 20, 0],
  /* Península y Baleares. El general es el 21%. */
  iva: [21, 10, 4, 0],
}

/** El que se aplica si nadie dice otra cosa. */
export function tipoHabitual(i: Impuesto): number | null {
  return i === 'ninguno' ? null : TIPOS[i][0]
}

export function esTipoValido(i: Impuesto, tipo: number): boolean {
  return i !== 'ninguno' && TIPOS[i].includes(tipo)
}

/*
  ─────────────────────────────────────────────────────────────
  EL CÁLCULO

  Del total hacia atrás:

    base  = total / (1 + tipo/100)
    cuota = total − base

  Con una precaución que no es cosmética: se redondea LA CUOTA y la base
  se saca restando. Redondear las dos por separado deja sumas que no
  cuadran por un céntimo —2,83 + 0,20 = 3,03 pero 2,832 + 0,198 redondea
  a 2,83 + 0,20 unas veces y a 2,84 + 0,20 otras— y un céntimo que no
  cuadra en una factura es lo primero que ve una gestoría.

  Así, base + cuota es SIEMPRE exactamente el total. Sin excepciones.
*/
export function desglose(
  total: number,
  tipo: number | null
): { base: number; cuota: number } {
  if (tipo === null || !Number.isFinite(tipo) || tipo <= 0 || !Number.isFinite(total)) {
    return { base: redondear(total), cuota: 0 }
  }

  /*
    EN CÉNTIMOS ENTEROS, Y NO ES MANÍA.

    Restando euros con decimales, 3,03 − 0,20 da 2,8299999999999996. En
    coma flotante 0,1 + 0,2 no es 0,3, y eso no es un fallo del
    ordenador: es que esos números no existen exactos en binario.

    Con enteros no hay nada que redondear y por tanto nada que se
    descuadre: 303 − 20 = 283, siempre, en todas las máquinas.
  */
  const totalCent = Math.round(total * 100)
  const baseCent = Math.round(totalCent / (1 + tipo / 100))
  const cuotaCent = totalCent - baseCent

  return { base: baseCent / 100, cuota: cuotaCent / 100 }
}

/** A céntimos, sin los sustos de coma flotante de siempre. */
function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/*
  ─────────────────────────────────────────────────────────────
  QUÉ TIPO LE TOCA A UN APUNTE

  Por orden, y el orden es el que evita preguntas:

   1. El que se haya dicho para ESTE apunte. Manda siempre.
   2. El de su partida. «Luz» siempre lleva el mismo, y ponerlo una vez
      ahorra ponerlo en cada factura.
   3. El general de la casa. Mejor un desglose con el tipo normal —que
      acierta casi siempre y se ve y se corrige— que ningún desglose.

  Y si la casa no lleva impuesto, no le toca ninguno a nada.
*/
export function tipoQueToca({
  delApunte,
  deLaPartida,
  deLaCasa,
}: {
  delApunte?: number | null
  deLaPartida?: number | null
  deLaCasa: Impuesto
}): number | null {
  if (deLaCasa === 'ninguno') return null
  if (delApunte != null && Number.isFinite(delApunte)) return delApunte
  if (deLaPartida != null && Number.isFinite(deLaPartida)) return deLaPartida
  return tipoHabitual(deLaCasa)
}

/*
  ─────────────────────────────────────────────────────────────
  QUÉ LE TOCA A UN APUNTE, PREGUNTÁNDOSELO A LA BASE DE DATOS

  Lo mismo que arriba, pero yendo a buscar el impuesto de la casa y el
  tipo de la partida. Está aquí y no repetido en cada ruta porque las
  cuatro que apuntan dinero —a mano, por voz, desde una foto y al
  corregirla— tienen que hacer exactamente lo mismo. Cuando esa lógica
  vive en cuatro sitios, a la tercera semana hacen tres cosas distintas.

  Todo envuelto: si el SQL 46 no se ha ejecutado, esto devuelve «sin
  impuesto» y apuntar sigue funcionando igual que ayer.
*/
export async function desgloseQueToca(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  datos: {
    hogarId: string | null
    categoriaId?: string | null
    total: number
    /** Lo que haya dicho la pantalla para ESTE apunte. Manda siempre. */
    tipoDicho?: number | null
  }
): Promise<{ impuesto_tipo: number | null; impuesto_cuota: number | null }> {
  const sinNada = { impuesto_tipo: null, impuesto_cuota: null }

  try {
    if (!datos.hogarId) return sinNada

    const { data: casa, error } = await supabase
      .from('hogares')
      .select('impuesto')
      .eq('id', datos.hogarId)
      .maybeSingle()

    if (error || !casa || !esImpuesto(casa.impuesto) || casa.impuesto === 'ninguno') {
      return sinNada
    }

    let deLaPartida: number | null = null
    if (datos.categoriaId) {
      const { data: cat } = await supabase
        .from('categorias')
        .select('impuesto_tipo')
        .eq('id', datos.categoriaId)
        .maybeSingle()
      if (cat && cat.impuesto_tipo != null) deLaPartida = Number(cat.impuesto_tipo)
    }

    const tipo = tipoQueToca({
      delApunte: datos.tipoDicho,
      deLaPartida,
      deLaCasa: casa.impuesto,
    })
    if (tipo === null) return sinNada

    const { cuota } = desglose(datos.total, tipo)
    return { impuesto_tipo: tipo, impuesto_cuota: cuota }
  } catch {
    /* Sin las columnas todavía. Apuntar no puede depender de esto. */
    return sinNada
  }
}

/*
  ─────────────────────────────────────────────────────────────
  LA CUENTA DEL TRIMESTRE

  Lo soportado, lo repercutido y la diferencia. Los apuntes sin
  desglosar se cuentan aparte y NO se reparten: decir «se debe 340 €»
  escondiendo que hay doce facturas sin tipo sería dar por buena una
  cuenta que no lo es.
*/
export function cuentaDelImpuesto(
  movimientos: { tipo: string; importe: number; impuesto_cuota?: number | null }[]
): { soportado: number; repercutido: number; diferencia: number; sinDesglosar: number } {
  let soportado = 0
  let repercutido = 0
  let sinDesglosar = 0

  for (const m of movimientos) {
    const cuota = m.impuesto_cuota
    if (cuota == null) {
      sinDesglosar++
      continue
    }
    if (m.tipo === 'ingreso') repercutido += Number(cuota)
    else soportado += Number(cuota)
  }

  return {
    soportado: redondear(soportado),
    repercutido: redondear(repercutido),
    /* Repercutido menos soportado: positivo es lo que hay que ingresar,
       negativo lo que sale a devolver. */
    diferencia: redondear(repercutido - soportado),
    sinDesglosar,
  }
}
