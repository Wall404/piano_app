# Piano App

App web (mobile-first) para practicar piano: carga una partitura, muestra las notas cayendo
sobre un teclado animado y resalta qué teclas tocar en cada nota o acorde.

Probala en https://wall404.github.io/piano_app/ (Chrome en Android o en la compu).

## Qué hace hoy

- Biblioteca local: carga MusicXML, MXL y MIDI, y los guarda en el navegador.
- Partitura dibujada con un cursor que sigue el compás (solo MusicXML).
- Teclado SVG ajustado al rango de la obra, o las 88 teclas completas.
- Notas que caen hacia el teclado, con colores por mano, y aviso de la próxima tecla.
- Práctica por rango de compases en bucle, velocidad de 25 % a 150 %, metrónomo y una mano por vez.
- Sonido de piano con muestras reales (Tone.js), guardadas para usar sin red después de la primera vez.
- Teclado MIDI por USB (Web MIDI): tus notas se marcan en verde o rojo, el modo espera sigue tu
  ritmo y cada pasada termina con una devolución y una sugerencia. Requiere Chrome con HTTPS o localhost.
- Instalable como app en el teléfono (PWA).

## PDF a MusicXML

Instalá [Audiveris](https://github.com/audiveris/audiveris) y corré `npm run pdf -- pieza.pdf`.
El resultado queda en `scores/`, que no se sube al repo. El reconocimiento comete errores:
revisá la partitura en la app y corregila en MuseScore si hace falta.

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
