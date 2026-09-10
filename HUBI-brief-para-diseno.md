# HUBI · brief de identidad visual

Este documento es la **fuente de verdad** del lenguaje visual de HUBI.
Está sacado del código del producto (commit `c9f3d98`), no de un manual.

**Aplícalo literalmente.** Donde diga un hexadecimal, usa ese hexadecimal.
Si algo no está aquí, pregúntalo antes de inventarlo.

---

## 0 · Qué es HUBI

Un asistente familiar digital privado. Centraliza los papeles, el dinero,
las citas y los recados de una casa. Está pensado para personas mayores
—Juan Miguel y Conchita, de unos 75 años— y ahora se abre a más familias.

Se resume en tres verbos: **hablar · fotografiar · consultar**.

Claim: **«Todo lo importante, en un mismo lugar.»**

Tono de marca: cercano · claro · confiable · inteligente.

**No debe parecer:** un dashboard SaaS genérico, una estética corporativa,
una interfaz negra, algo excesivamente tecnológico, ni una estética infantil
por ser para gente mayor.

**Debe sentirse:** ordenado · sereno · seguro · personal · fácil · cálido.

---

## 1 · LA REGLA QUE ORDENA TODO EL COLOR

> **Lo saturado reclama atención. Lo apagado solo identifica.**

De ahí salen cuatro familias que **nunca se invaden**. Antes de poner un
color, decide a cuál pertenece.

---

## 2 · Tokens · cópialos tal cual

```css
:root {
  /* Superficies y tinta — modo claro */
  --fondo:         #F7F5F1;   /* el papel de la mesa, crema cálida */
  --superficie:    #FFFFFF;   /* tarjetas, filas, campos */
  --borde:         #EAE7E3;   /* hairline de 1 px */
  --tinta:         #1A1714;   /* todo lo que hay que leer — negro CÁLIDO */
  --tinta-suave:   #453F39;   /* segundo nivel de lectura */
  --tenue:         #7D7166;   /* pies, rótulos, texto de apoyo */
  --apagado:       #AAA096;   /* lo desactivado */
  --velo:          rgba(26, 23, 20, .04);

  /* B · Acción — IDÉNTICO en claro y en oscuro */
  --accion:        #14B8A6;
  --accion-tinta:  #04211D;   /* el texto DENTRO del botón. Nunca blanco. */

  /* C · Estado */
  --bien:          #0B7C6F;
  --atencion:      #9E6104;
  --alerta:        #CE2821;
  --bien-velo:     #E1F8E7;
  --atencion-velo: #FDF1DD;
  --alerta-velo:   #FDE8E5;

  /* D · Ámbito — apagados, solo identifican */
  --azul:    #6B93D6;
  --violeta: #9482D9;
  --ciruela: #A87BB5;
  --rosa:    #D07E97;
  --arena:   #C09A62;
  --oliva:   #9AA85E;
  --verde:   #6FA88A;
  --pizarra: #7A8899;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fondo:         #0B1220;
    --superficie:    #182133;
    --borde:         #253148;
    --tinta:         #F1F5F9;
    --tinta-suave:   #CBD5E1;
    --tenue:         #94A3B8;
    --apagado:       #64748B;
    --velo:          rgba(255, 255, 255, .06);
    /* La acción NO cambia: #14B8A6 en los dos modos. */
    --bien:          #2DD4BF;
    --atencion:      #F0B440;
    --alerta:        #FF7B75;
    --bien-velo:     #10322F;
    --atencion-velo: #33270F;
    --alerta-velo:   #3A1D22;
    /* Los ocho ámbitos tampoco cambian. */
  }
}
```

**El negro es cálido a propósito.** `#1A1714` lleva marrón dentro, igual que
la crema. Un negro azulado sobre papel cálido se ve sucio. No lo sustituyas
por `#000`, `#111827` ni ningún gris de sistema.

---

## 3 · El degradado de marca

```css
linear-gradient(140deg, #2DD4BF, #14B8A6 45%, #3B82F6)
```

**Hay UNO SOLO en todo HUBI y significa una cosa concreta: aquí hay
inteligencia.** Aparece donde HUBI escucha, entiende o responde: el botón de
voz, el aro del micrófono, la línea de arranque.

**NO lo uses como decoración.** Un degradado bonito en una cabecera hace que
el símbolo deje de querer decir nada. Si lo pones en la web, que sea en la
sección donde se habla de la voz o de lo que HUBI hace solo.

---

## 4 · Las cuatro familias, y cuándo usar cada una

| Familia | Qué es | Dónde |
|---|---|---|
| **A · Marca** | El degradado | Solo donde hay inteligencia |
| **B · Acción** | `#14B8A6` sólido | La llamada a la acción. **Una por pantalla.** |
| **C · Estado** | Bien / atención / alerta | Solo cuando comunican algo que pasó o va a pasar |
| **D · Ámbito** | Los ocho apagados | Identificar de qué es algo. **Nunca en un botón, nunca en una cifra.** |

**El teal es el ÚNICO color de acción de toda la web.** Botones, la llamada
principal, un enlace destacado. Todo lo demás es tinta y ámbito.

**Las pastillas de icono** son el color de ámbito al **16 %** de fondo con el
icono al 100 %. Ése es el par que se repite en toda la aplicación.

---

## 5 · PROHIBIDO · siete colores retirados

Estos colores estuvieron en HUBI y se retiraron. Tienen **cero usos** en el
producto. Si aparece uno, la web y la aplicación dejan de leerse como la
misma marca.

```
#F97316   naranja
#EC4899   rosa fucsia
#EC486E   rosa
#8B5CF6   morado
#FF6B6B   coral
#F59E0B   ámbar
#0EA5E9   cian
```

**Ninguno vuelve, tampoco «solo para la landing».**

Y tampoco introduzcas colores nuevos que no estén en el apartado 2.

---

## 6 · Tipografía

**Plus Jakarta Sans** (Google Fonts). Dos pesos y ninguno intermedio:

- **600** para todo lo que se lee.
- **800** para todo lo que titula.

El interletrado se aprieta a medida que sube el tamaño:

| Papel | px | Peso | Tracking |
|---|---|---|---|
| Título de pantalla | 27 | 800 | −0.025em |
| Título de sección | 21 | 800 | −0.02em |
| Título de tarjeta | 19 | 800 | −0.012em |
| Cuerpo | 17 | 600 | — |
| Apoyo | 15 | 600 | — (color tenue) |
| Cifra | 34 | 800 | −0.03em, tabular-nums |

En una **web** esta escala puede crecer: titulares de 60–90 px están bien.
Lo que **no** cambia son los dos pesos, el tracking negativo en los grandes
y `tabular-nums` en cualquier cifra que se alinee en columna.

---

## 7 · Formas

- Radio **20 px** — tarjetas y filas
- Radio **16 px** — campos y botones
- Radio **999** — píldoras y avatares
- Botón principal **60 px** de alto · terciario **48 px**
- Borde de 1 px en `--borde`. **Las tarjetas no se rellenan de color**: el
  color va en la pastilla del icono o en una marca de 3 px al borde izquierdo.
- Sombras: casi ninguna. El sistema separa con borde y con papel blanco
  sobre crema, no con sombra.

---

## 8 · Movimiento

HUBI se mueve por **tres razones y ninguna más**. Lo que no confirma algo,
no se mueve.

1. **Te he oído** — al pulsar: escala `0.985` + opacidad `0.92`. Ida 120 ms,
   vuelta 180 ms (la vuelta más lenta a propósito: seca se lee como
   parpadeo).
2. **Voy en camino** — lo pulsado se enciende al instante, sin esperar.
   Nunca dos cosas encendidas a la vez.
3. **Esto ha cambiado** — la confirmación se pinta donde está el dedo; el
   resto acompaña más despacio.

Con `prefers-reduced-motion` no se quita la respuesta, se quita el viaje: el
cambio ocurre de golpe en vez de con transición.

**No añadas animación decorativa.** Es lo que hace que un diseño parezca
generado.

---

## 9 · Accesibilidad · no es opcional

- Texto normal **4,5:1** mínimo. Texto grande y elementos no textuales
  **3:1**.
- Los tres colores de estado del apartado 2 son la **segunda** versión: los
  primeros se eligieron a ojo y daban 3,4:1. **Mide** cualquier color que
  pongas sobre texto.
- La aplicación tiene dos suelos que mandan sobre cualquier consideración
  estética: **17 px** en lo que hay que leer y **48 px** en lo que hay que
  pulsar. En una web de presentación el de 48 no aplica igual, pero el
  producto que estás presentando existe por ese cuidado — que se note.

---

## 10 · Lo que la web sí puede hacer distinto

La aplicación es para dos personas mayores; una web de presentación tiene
otro público.

**Puede respirar:** la escala tipográfica, la densidad (una web puede contar
más cosas seguidas), y la **fotografía** — la aplicación no tiene imágenes, y
la web probablemente deba tenerlas, porque lo que vende HUBI no es una
interfaz sino una escena doméstica: una factura encima de la mesa, un móvil
en la mano de alguien mayor, una casa.

**No puede cambiar:** la paleta, el significado del degradado, el acento
único, ni los siete colores retirados.
