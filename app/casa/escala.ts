/*
  ═══════════════════════════════════════════════════════════════
  LA ESCALA DE LA PARED
  ═══════════════════════════════════════════════════════════════

  Haris, viéndola funcionando: *«lo veo todo algo grande, ¿no te
  parece? ¿lo hacemos un poco más pequeño todo?»*. Sí.

  ─────────────────────────────────────────────────────────────
  PERO EL PROBLEMA NO ERA «GRANDE». ERA **DESIGUAL**

  Esto es lo que había, comparado con la escala del móvil que manda en
  `sistema-visual-actual.md`:

      el reloj        84–104 px   ·  t-cifra del móvil: 34   → ×2,5–3,0
      la temperatura  48 px       ·                          → ×1,4
      una tarjeta     34 px       ·  t-tarjeta: 19           → ×1,8
      un rótulo       20 px       ·  t-seccion: 21           → ×0,95

  O sea: los rótulos estaban **a tamaño de teléfono** y los números a
  tres veces. Cuando en una misma pantalla conviven ×1 y ×3, lo grande
  no se lee como «esto es importante»: se lee como que algo está mal
  medido. Y la sensación que deja no es «es grande», es «es tosco».

  ─────────────────────────────────────────────────────────────
  LA REGLA, Y ES UNA SOLA

      UNA PARED ES LA MISMA CASA ×1,45.

  Se toma la escala del móvil —la del documento de identidad— y se
  multiplica entera por el mismo número. Ni el reloj ni los rótulos se
  salen: si el reloj tiene que destacar, ya destaca por ser una cifra
  de cuatro dígitos en una esquina vacía.

      t-titulo   27  →  39        t-cuerpo   17  →  25
      t-seccion  21  →  30        t-apoyo    15  →  22
      t-tarjeta  19  →  28        t-cifra    34  →  49

  El reloj es la única excepción consentida —62/74 px— y no por
  jerarquía: porque es lo que se mira desde la puerta, a cuatro metros,
  cuando no se está mirando nada más.

  ─────────────────────────────────────────────────────────────
  Y EL SUELO DE TOCAR SUBE A 60

  En el móvil son 48 px porque se toca con el pulgar y el teléfono a
  veinte centímetros. Aquí se toca de pie, de lado, muchas veces con
  una mano ocupada y casi siempre sin mirar dónde se da.

  **Nada de lo que haya que pulsar baja de 60 px.** Ése es el único
  número que la escala no puede reducir por bonito que quede.

  ─────────────────────────────────────────────────────────────
  ESTO NO ES CÓDIGO QUE SE EJECUTE

  Tailwind no puede leer una constante de TypeScript dentro de
  `text-[…]`, así que los números están escritos en cada sitio. Este
  archivo existe para que haya UN sitio donde esté la regla, y para que
  el próximo que toque una medida sepa de dónde sale en vez de elegir
  una que le parezca bien.
*/

/** El multiplicador de la pared sobre la escala del móvil. */
export const PARED = 1.45

/** La escala del móvil (`sistema-visual-actual.md`), en píxeles. */
export const MOVIL = {
  titulo: 27,
  seccion: 21,
  tarjeta: 19,
  cuerpo: 17,
  apoyo: 15,
  cifra: 34,
} as const

/** La de la pared, redondeada a entero. */
export const EN_LA_PARED = {
  titulo: 39,
  seccion: 30,
  tarjeta: 28,
  cuerpo: 25,
  apoyo: 22,
  cifra: 49,
} as const

/** Lo que se toca, nunca por debajo de esto. */
export const SUELO_DE_TOCAR = 60
