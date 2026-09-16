Cambios en la web de mappel. Son siete, independientes entre sí.
No toques el texto, ni la estructura, ni los colores de fondo: todo eso
está bien. Son arreglos puntuales.

───────────────────────────────────────────────────────────────

1 · EL ENCABEZADO DE LA PÁGINA ESTÁ VACÍO

Hoy el `<title>` está vacío, el `<html>` no declara idioma y no hay
descripción. Añade:

    <html lang="es">
    <title>mappel · Todo lo importante, en un mismo lugar</title>
    <meta name="description" content="Haces una foto de la factura o de
    la póliza. mappel la lee, la guarda en su carpeta, te avisa antes de
    que venza y te la encuentra cuando la pides.">

Y las etiquetas para compartir, con el mismo título y la misma
descripción:

    <meta property="og:title" ...>
    <meta property="og:description" ...>
    <meta property="og:image" ...>   ← una captura del inicio, 1200×630

───────────────────────────────────────────────────────────────

2 · LA FILA DE PESTAÑAS DE LA COCINA ESTÁ EN MAL ORDEN

En la sección «La cocina», las cinco pastillas están hoy así:

    Hoy · Calendario · Compra · Menú · Notas

El orden correcto —el que tiene la tableta de verdad, y el que se ve en
la propia captura que hay justo debajo— es:

    Hoy · Calendario · Menú · Compra · Notas

Intercambia Menú y Compra. Nada más.

───────────────────────────────────────────────────────────────

3 · CADA PESTAÑA DE LA COCINA TIENE SU COLOR, Y AHORA NO LO USA

El punto de cada pastilla debe llevar el color de su sección. Hoy la
activa es ciruela (mal) y las otras cuatro llevan el gris del borde.

    Hoy          #6FA88A   (verde)
    Calendario   #6B93D6   (azul)
    Menú         #C09A62   (arena)
    Compra       #9AA85E   (oliva)
    Notas        #D07E97   (rosa)

El color va en el punto, en las cinco, estén activas o no. La pastilla
activa se distingue por el fondo, no por ser la única con color.

───────────────────────────────────────────────────────────────

4 · SUBE EL SUELO DE LA LETRA A 15 px

Hay 25 trozos de texto por debajo de 15 px en el móvil. mappel es un
producto para personas mayores y su suelo es 15 px; la web que lo vende
no puede leerse más pequeño que él.

Sube a 15 px como mínimo TODO el texto que lleve contenido. En
concreto:

  · los nombres y datos de las tarjetas que hoy están a 13,5 y 14,5 px
    («Póliza del coche», «Vence 12 nov», «Factura de la luz»,
    «127,43 €», «Cita del médico», «Recibos de la finca»,
    «Cuánto costó la reforma»…)
  · «mappel lo lee», que está a 11 px

EXCEPCIÓN, que se queda como está: los rótulos de sección en versales
—«PAPELES · AGENDA · CUENTAS · LA COMPRA», «ASISTENTE MAPPEL», «ASÍ SE
PREGUNTA EN LA APLICACIÓN»— pueden seguir a 12 px. Son etiquetas, no
contenido.

───────────────────────────────────────────────────────────────

5 · UNA SOLA ESCALA DE PÁRRAFO

Los `<p>` usan hoy nueve tamaños distintos: 15, 16, 16, 17, 17, 18, 18,
19 y 21 px. Y dos interlineados para el mismo 17.

Redúcelo a tres, y que cada uno tenga un único interlineado:

    entradilla de sección   21 px / 1,5
    cuerpo normal           17 px / 1,55
    apoyo y pies            15 px / 1,6

───────────────────────────────────────────────────────────────

6 · EL VÍDEO DE LA COCINA NO ARRANCA

`clip-pared.mp4` tiene `autoplay` desactivado; los otros tres vídeos de
la página sí arrancan solos. Es justo el vídeo que más convence.

Ponlo igual que los otros tres: `autoplay muted loop playsinline`, con
su `poster`.

Si estaba desactivado a propósito para no gastar datos en el móvil,
entonces desactívalo en los cuatro y pon a los cuatro el mismo
«Toca para verlo». Lo que no puede ser es que tres hagan una cosa y el
cuarto otra sin avisar.

───────────────────────────────────────────────────────────────

7 · DOS COSAS PEQUEÑAS

· Hay dos enlaces en `#04211D`, que no es un color de la paleta.
  Cámbialos a `#1A1714` (tinta) o a `#0B7C6F` (bien), lo que encaje.

· «El acceso puede caducar solo» va en blanco sobre una fotografía sin
  ningún velo detrás. Hoy se lee porque cae en la parte oscura. Ponle
  un degradado oscuro suave por debajo del texto para que siga
  leyéndose si algún día se cambia la foto.

───────────────────────────────────────────────────────────────

LO QUE NO HAY QUE TOCAR

  · El fondo `#F7F5F1`. Es el correcto.
  · La tipografía. Todo es Plus Jakarta Sans y está bien.
  · Las tintas `#1A1714`, `#453F39` y `#7D7166`. Son las del manual.
  · El texto. Ni una palabra.
  · El comportamiento en el móvil: no hay desbordamiento lateral y
    ningún botón baja de 44 px. No lo estropees al cambiar tamaños.

DESPUÉS DE LOS CAMBIOS, COMPRUEBA

  · Que en el móvil sigue sin haber scroll lateral.
  · Que ningún enlace ni botón ha bajado de 44 px de alto.
  · Que la fila de pestañas de la cocina coincide con la captura de la
    tableta que tiene debajo.
