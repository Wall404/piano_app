# Piano App

App web (mobile-first) para practicar piano: carga una partitura, muestra las notas cayendo
sobre un teclado animado y resalta qué teclas tocar en cada nota o acorde.

Este es el esqueleto inicial: reproduce una partitura de ejemplo (*Oda a la alegría*).

## Qué hace hoy

- Teclado responsive que se ajusta al rango de la obra (octavas completas).
- Notas que caen hacia el teclado, con colores por mano (derecha celeste, izquierda violeta).
- Teclas resaltadas al sonar y aviso suave de la próxima tecla.
- Práctica por secciones (frases), con repetición en bucle.
- Control de velocidad (25 % a 150 %), barra de posición y contador de compás.
- Practicar con una sola mano (la otra queda atenuada y en silencio).
- Sonido sintetizado con Web Audio; las teclas también se pueden tocar con el dedo o el mouse.
- Barra espaciadora para reproducir o pausar.

## Requisitos

Node.js 18 o superior. En Arch / CachyOS:

```sh
sudo pacman -S nodejs npm
```

## Uso

```sh
npm install
npm run dev
```

`npm run dev` expone el servidor en la red local, así que se puede abrir desde el celular
con la IP de la PC (por ejemplo `http://192.168.0.10:5173`).

## Estructura

```
src/
  data/odeToJoy.js        partitura de ejemplo en el formato interno
  lib/song.js             formato interno de partitura (eventos por nota y mano)
  lib/player.js           reloj de reproducción, bucles y tempo (fuera de React)
  lib/synth.js            sintetizador simple con Web Audio
  lib/notes.js            nombres de notas y posición de cada tecla
  components/Waterfall    notas cayendo
  components/Keyboard     teclado
  components/Transport    controles de reproducción
```

El formato interno es independiente del origen, para que más adelante se puedan importar
MusicXML o MIDI y sumar la evaluación por micrófono.
