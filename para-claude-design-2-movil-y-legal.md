SEGUNDA TANDA · MÓVIL Y PÁGINAS LEGALES

Va después de los siete cambios del archivo anterior. Todo medido a
375 px de ancho en un navegador real.

═══════════════════════════════════════════════════════════════
PARTE A · EL MÓVIL
═══════════════════════════════════════════════════════════════

Primero lo que está bien, para que no se toque:

  · No hay desbordamiento lateral. El documento mide 375 exactos.
  · El menú de hamburguesa es 48×48, lleva `aria-label="Menú"` y
    `aria-expanded`, y sus seis entradas miden 60 px de alto cada una.
    Está bien hecho. No lo toques.
  · Ningún enlace ni botón de la página baja de 44 px de alto.

Y ahora los cuatro arreglos.

───────────────────────────────────────────────────────────────

A1 · TRES ETIQUETAS SE CORTAN DE VERDAD

En la sección «El problema», la columna de la izquierda tiene cajas de
109 px con `overflow: hidden`, y hay tres textos que no caben:

    «Recibos de la finca»   necesita 120 px   → se pierden 11
    «Coste de la reforma»   necesita 127 px   → se pierden 18
    «Lo sabe mamá»          necesita 112 px   → se pierden 3

No es que queden apretados: están literalmente cortados en un móvil de
375. Y en uno de 360 será peor.

Arréglalo como prefieras —dejar que la caja crezca, permitir dos
líneas, o bajar el cuerpo— pero que **no se corte ninguna palabra**.
Comprueba las tres a 360 px, que es el móvil más estrecho que hay que
soportar.

Hay un cuarto caso menor en el bloque «MAPPEL LO LEE» (334 visibles,
339 necesarios). Mismo arreglo.

───────────────────────────────────────────────────────────────

A2 · EL RÓTULO DE ARRIBA PARTE «LA COMPRA» EN DOS

En el móvil, el rótulo de la portada sale así:

    PAPELES · AGENDA · CUENTAS · LA
    COMPRA

«LA COMPRA» es el nombre de una sección y no se puede partir. Pon un
espacio duro entre las dos palabras (`LA&nbsp;COMPRA`), y lo mismo en
cualquier otro rótulo con nombres de dos palabras.

───────────────────────────────────────────────────────────────

A3 · EL MÓVIL SE BAJA 3,1 MB, Y 2 SON DE UN VÍDEO QUE NO SE VE

Medido: **3.121 KB** en la primera carga, de los cuales

    clip-pared.mp4      2.063 KB   ← y es el que NO arranca
    clip-guardar.mp4      466 KB
    clip-hablar.mp4       242 KB
    clip-agenda.mp4       203 KB
    los cuatro pósters    147 KB

O sea: el 66 % de lo que se baja un móvil con datos es un vídeo que la
página ni siquiera reproduce, y que está al final de todo.

Haz dos cosas:

  1. `preload="none"` en los cuatro vídeos. Que se baje el póster y
     nada más hasta que el vídeo entre en pantalla.
  2. Comprime `clip-pared.mp4`. Diez veces el peso de los otros tres
     no se justifica; que quede por debajo de 600 KB.

(Esto va junto con el punto 6 de la tanda anterior: decide si arranca
solo o no, pero que los cuatro hagan lo mismo.)

───────────────────────────────────────────────────────────────

A4 · LA PÁGINA MIDE 14.683 px EN EL MÓVIL

Son unas dieciocho pantallas de deslizar. No es un fallo y no te pido
que cortes contenido, pero sí dos cosas baratas:

  · Un botón de «volver arriba» que aparezca a partir de la tercera
    pantalla.
  · Que la barra de arriba con el logo y el menú siga estando
    disponible al deslizar (hoy la barra existe, comprueba que no se
    pierde a mitad de página).

Y una inconsistencia pequeña: todos los titulares llevan
`text-wrap: balance` menos «Y esto es lo que ya vive dentro.», que
lleva `wrap`. Ponle `balance` como a los demás.

═══════════════════════════════════════════════════════════════
PARTE B · LAS PÁGINAS LEGALES
═══════════════════════════════════════════════════════════════

Hoy el pie no tiene ni un solo enlace legal. Hacen falta tres páginas
nuevas y una fila nueva en el pie.

── LO PRIMERO, Y ES UNA BUENA NOTICIA ──

He medido qué guarda la web en el navegador y de dónde se baja las
cosas:

    cookies ................... 0
    localStorage .............. 0
    IndexedDB ................. 0
    sessionStorage ............ 1 · «mappel_intro_seen»
    dominios de terceros ...... 0 (los 8 recursos son del propio sitio)

Sin analítica, sin fuentes de Google, sin píxeles, sin nada.

**Por lo tanto: NO pongas banner de cookies.** Un banner pidiendo
consentimiento para algo que no existe es ruido, y además da una
impresión falsa. Lo que hace falta es una página que lo explique.

`mappel_intro_seen` es almacenamiento técnico de sesión —sirve para no
repetir la introducción—, se borra al cerrar la pestaña y no necesita
consentimiento.

Si algún día se añade analítica, ESO sí cambia la respuesta. Que quede
escrito en la página.

───────────────────────────────────────────────────────────────

B1 · AVISO LEGAL  ·  /aviso-legal

Titular del sitio:

    ARCH LEGRAND HOUSE, S.L.
    NIF: B88499132
    Domicilio: Calle de El Algabeño 1, piso 2, puerta 203
    Correo de contacto: [PENDIENTE]
    Datos registrales: [PENDIENTE]

Contenido: identificación del titular, objeto del sitio, condiciones de
uso, propiedad intelectual de los contenidos y de la marca mappel, y
ley aplicable y fuero.

───────────────────────────────────────────────────────────────

B2 · POLÍTICA DE PRIVACIDAD  ·  /privacidad

**Ojo: esta es la de la WEB, no la de la aplicación.** La aplicación ya
tiene la suya y no hay que tocarla. Pero tienen que enlazarse entre sí
y no contradecirse.

Lo que tiene que decir la de la web:

  · Responsable: ARCH LEGRAND HOUSE, S.L., con los datos de arriba.
  · Qué datos trata la web: **ninguno que se pida a nadie.** No hay
    formularios, no hay registro, no hay boletín. Lo único son los
    registros del servidor (dirección IP, navegador, hora) que genera
    el alojamiento por el hecho de servir la página.
  · Base jurídica: interés legítimo en mantener el sitio seguro y
    operativo.
  · Destinatarios: el proveedor de alojamiento como encargado del
    tratamiento. **Hoy es Vercel Inc., empresa estadounidense**, así
    que hay que mencionar la transferencia internacional y el marco
    que la ampara.
  · Plazo de conservación de esos registros.
  · Derechos: acceso, rectificación, supresión, oposición, limitación
    y portabilidad, cómo ejercerlos, y el derecho a reclamar ante la
    Agencia Española de Protección de Datos (www.aepd.es).
  · Un enlace a la política de privacidad de la aplicación, para quien
    quiera saber qué pasa cuando entra dentro.

───────────────────────────────────────────────────────────────

B3 · POLÍTICA DE COOKIES  ·  /cookies

Corta y honesta. En esencia:

  «Esta web no utiliza cookies. Tampoco analítica, ni publicidad, ni
  servicios de terceros: todo lo que ves se sirve desde este mismo
  sitio. Lo único que guardamos en tu navegador es un dato técnico de
  sesión que recuerda que ya has visto la introducción, y que se borra
  solo al cerrar la pestaña. Por eso no verás ningún aviso pidiéndote
  permiso: no hay nada que permitir.»

Y una línea diciendo que si esto cambiara, se actualizaría la página y
se pediría consentimiento antes.

───────────────────────────────────────────────────────────────

B4 · EL PIE

Añade una fila al final del pie, debajo de «© 2026 mappel», con los
tres enlaces:

    Aviso legal · Privacidad · Cookies

Mismo cuerpo que el resto del pie y nunca por debajo de 15 px. Y que
cada enlace tenga sus 44 px de alto de zona tocable en el móvil.

───────────────────────────────────────────────────────────────

B5 · CÓMO TIENEN QUE VERSE LAS TRES PÁGINAS

No son un anexo feo. Son mappel:

  · Mismo papel `#F7F5F1`, misma Plus Jakarta Sans, mismas tintas.
  · Columna de lectura estrecha, sobre 65 caracteres por línea.
  · Cuerpo de 17 px, nunca menos de 15.
  · Titulares de sección que se puedan escanear.
  · Arriba, la palabra mappel y un «Volver» evidente.
  · Fecha de última actualización al principio.
  · Nada de letra pequeña gris apelotonada. Si el texto legal se puede
    leer, se lee.

═══════════════════════════════════════════════════════════════
LO QUE HACE FALTA ANTES DE PUBLICAR ESTO
═══════════════════════════════════════════════════════════════

Son datos que no tengo y que no me puedo inventar:

  1. **Código postal y ciudad.** La dirección que me han dado es
     «Calle de El Algabeño 1, piso 2, puerta 203» y le falta el CP y
     el municipio.
  2. **Un correo de contacto** para ejercer los derechos de protección
     de datos.
  3. **Datos registrales** de la sociedad —Registro Mercantil, tomo,
     folio, hoja—, que el artículo 10 de la LSSI pide para una
     sociedad inscrita.
  4. **El dominio definitivo.** El aviso legal tiene que decir a qué
     sitio se refiere, y hoy la web vive en una dirección de Vercel.
  5. **Confirmar quién aloja la web** cuando esté en su dominio, para
     nombrar bien al encargado del tratamiento.

Y una advertencia que va en serio: **esto no es asesoramiento
jurídico.** Yo puedo dejar los textos redactados, ordenados y
completos, pero quien los tiene que dar por buenos es un abogado — más
todavía porque la aplicación guarda documentación médica, que el RGPD
trata como categoría especial.
