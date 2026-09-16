CUARTA TANDA · LO QUE QUEDÓ SIN HACER

He medido la web publicada. La mayor parte está hecha y bien hecho:

  ✔ El encabezado completo: título, `lang`, descripción, `og:image`,
    `canonical` y los tres `hreflang`.
  ✔ Las pestañas de la cocina, perfectas: el orden correcto y los
    cinco colores exactos.
  ✔ El texto por debajo de 15 px bajó de 25 trozos a 8, y los 8 que
    quedan son los rótulos en versales de 12 px, que es la excepción
    que estaba permitida.
  ✔ `clip-pared.mp4` ya arranca como los otros tres.
  ✔ Las siete páginas legales y la versión en inglés existen y
    responden, con el NIF, la dirección y los datos registrales.

Quedan cinco cosas. Las tres primeras son las que importan.

═══════════════════════════════════════════════════════════════
1 · LOS TEXTOS SE SIGUEN CORTANDO, Y AHORA SON SEIS
═══════════════════════════════════════════════════════════════

Esto estaba en la tanda anterior y ha ido a peor. Las cajas de la
sección «El problema» pasaron de 109 px a **108**, y el texto no se
tocó. Ahora no se cortan tres etiquetas: se cortan **seis**.

Medido en el navegador, `clientWidth` frente a `scrollWidth`:

    «Coste de la reforma»   tiene 108 px · necesita 141   → faltan 33
    «Recibos de la finca»   tiene 108 px · necesita 133   → faltan 25
    «Lo sabe mamá»          tiene 108 px · necesita 124   → faltan 16
    «Póliza del coche»      tiene 108 px · necesita 116   → faltan  8
    «Factura de la luz»     tiene 108 px · necesita 114   → faltan  6
    «Cita del médico»       tiene 108 px · necesita 113   → faltan  5

En «Coste de la reforma» se pierde casi un tercio de la frase.

**El arreglo no es hacer la caja un poco más ancha.** Es que la caja
deje de tener un ancho fijo con `overflow: hidden`. Cualquiera de estas
tres vale, elige la que encaje con el diseño:

  a. Que la caja se ajuste a su contenido (`width: auto` / `min-width`
     en vez de un ancho cerrado).
  b. Que el texto pueda ir en dos líneas.
  c. Que toda la columna sea más ancha.

Lo que NO vale es dejar `overflow: hidden` con un ancho que no cabe:
eso no aprieta el texto, **lo borra**.

Cuando termines, comprueba las seis a **360 px**, que es el móvil más
estrecho que hay que soportar. Ninguna palabra puede quedar cortada.

═══════════════════════════════════════════════════════════════
2 · LOS VÍDEOS SIGUEN BAJÁNDOSE ENTEROS
═══════════════════════════════════════════════════════════════

Los cuatro tienen `preload="auto"`. Tienen que tener:

    preload="none"

Con `auto`, un móvil con datos se baja los cuatro vídeos —unos 3 MB—
nada más abrir la página, antes de que nadie los haya mirado y aunque
no llegue nunca a esa parte. El póster ya enseña el primer fotograma;
el vídeo sólo hace falta cuando entra en pantalla.

Si hace falta que arranquen solos al llegar a ellos, se hace con un
`IntersectionObserver` que llame a `play()` — no bajándolos todos por
si acaso.

═══════════════════════════════════════════════════════════════
3 · TODAS LAS PÁGINAS NUEVAS TIENEN EL TÍTULO VACÍO
═══════════════════════════════════════════════════════════════

La portada está bien. Las seis interiores ponen **«Bundled Page»** en
la pestaña del navegador: es el mismo fallo que arreglamos en la
portada, repetido en todas las demás.

Cada una necesita el suyo:

    /aviso-legal        Aviso legal · mappel
    /privacidad         Política de privacidad · mappel
    /cookies            Cookies · mappel
    /en/legal-notice    Legal notice · mappel
    /en/privacy         Privacy policy · mappel
    /en/cookies         Cookies · mappel

Y cada una con su `lang` («es» o «en»), su `canonical` propio y su par
de `hreflang` apuntando a su gemela — no a la portada.

`/en/` sí lo tiene bien («mappel · Everything that matters, in one
place»), así que el patrón ya existe: sólo hay que aplicarlo a las
otras seis.

═══════════════════════════════════════════════════════════════
4 · UN COLOR QUE NO ES DE LA PALETA
═══════════════════════════════════════════════════════════════

Sigue habiendo texto en `#04211D`. Cámbialo a `#1A1714` (tinta) o a
`#0B7C6F` (bien), lo que encaje.

═══════════════════════════════════════════════════════════════
5 · LA ESCALA DE PÁRRAFO, A MEDIO CAMINO
═══════════════════════════════════════════════════════════════

Ha mejorado: de nueve tamaños distintos a cinco. Pero quedan **dos
interlineados para el mismo cuerpo**:

    17px / 25.5px    ← 9 párrafos
    17px / 26.35px   ← 8 párrafos

Un mismo tamaño tiene que tener un mismo interlineado. Deja los tres de
la tanda anterior:

    entradilla de sección   21 px / 1,5
    cuerpo normal           17 px / 1,55
    apoyo y pies            15 px / 1,6

═══════════════════════════════════════════════════════════════
LO QUE NO HAY QUE TOCAR
═══════════════════════════════════════════════════════════════

  · Las pestañas de la cocina. Están perfectas.
  · El encabezado de la portada. Está completo.
  · Los rótulos de sección a 12 px en versales. Es la excepción.
  · Los cinco enlaces de «Entrar en mappel», que siguen apuntando a la
    dirección de Vercel. Se cambiarán a `mappel.app` aparte, cuando esa
    dirección exista.

Y al terminar, comprueba otra vez lo de siempre: que en el móvil no hay
scroll lateral y que ningún enlace ni botón baja de 44 px de alto.
