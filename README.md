# Piano App

App web (mobile-first) para practicar piano: carga una partitura, muestra las notas cayendo
sobre un teclado animado y resalta qué teclas tocar en cada nota o acorde.

Este es el esqueleto inicial: reproduce una partitura de ejemplo (*Oda a la alegría*).

## Qué hace hoy

- Teclado SVG ajustado al rango de la obra, o las 88 teclas completas.
- Notas que caen hacia el teclado, con colores por mano (derecha celeste, izquierda violeta).
- Teclas resaltadas al sonar y aviso suave de la próxima tecla.
- Práctica por secciones con repetición en bucle.
- Velocidad de 25 % a 150 %, barra de posición y contador de compás.
- Practicar con una sola mano (la otra queda atenuada y en silencio).
- Sonido de piano con muestras reales (Tone.js); necesita conexión para cargarlas.
- Teclado MIDI por USB (Web MIDI): tus notas se marcan en verde o rojo y el modo espera
  frena en cada acorde hasta que lo tocás. Requiere Chrome con HTTPS o localhost.

## Requisitos

Node.js 20 o superior. En Arch / CachyOS:

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

## Scripts

- `npm test`: tests del modelo, el modo espera y los mensajes MIDI.
- `npm run typecheck`: TypeScript estricto.
- `npm run build`: build de producción. Con `GITHUB_PAGES=1` usa la ruta de GitHub Pages.

La arquitectura y el roadmap están en [docs/SPEC.md](docs/SPEC.md).
