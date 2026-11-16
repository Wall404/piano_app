# Práctica Piano

App web (mobile-first) para practicar piano: carga una partitura, muestra las notas cayendo
sobre un teclado animado y resalta qué teclas tocar en cada nota o acorde.

Probala en https://wall404.github.io/practica-piano/ (Chrome en Android o en la compu).

## Qué hace hoy

- Biblioteca local: carga MusicXML, MXL y MIDI, los guarda en el navegador y recuerda el último tempo y sección de cada obra.
- Colecciones: varias obras de un PDF agrupadas, cada una con su progreso y nombre editable.
- Partitura dibujada con un cursor que sigue el compás (solo MusicXML).
- Teclado SVG ajustado al rango de la obra, o las 88 teclas completas.
- Notas que caen hacia el teclado, con colores por mano, y aviso de la próxima tecla.
- Práctica por rango de compases en bucle, velocidad de 25 % a 150 %, metrónomo y una mano por vez.
- Secciones guardadas con nombre por partitura, y subida automática de 5 % cada 3 pasadas sin errores.
- Sonido de piano con muestras reales (Tone.js), incluidas en la app para usarla sin red.
- Te escucha por el micrófono del teléfono, o por teclado MIDI USB: tus notas se marcan en verde o
  rojo, el modo espera sigue tu ritmo y cada pasada termina con una devolución. Requiere HTTPS o localhost.
  La primera vez, un asistente calibra ruido, afinación, registros, latencia y acordes.
- Progreso por partitura: gráfico de aciertos, lista de intentos y los compases con más errores.
- Prueba de acordes: mide cuántos acordes de 3 notas distingue el micrófono en tu piano y deja un resultado para copiar.
- Instalable como app en el teléfono (PWA).

## PDF a MusicXML

Un PDF es una imagen: para practicarlo hay que leer sus notas, y eso lo hace
[Audiveris](https://github.com/audiveris/audiveris) en la PC (instalalo una vez).

Con la app abierta desde la PC (`npm run dev`), tocá «Cargar partitura» y elegí el PDF. Si trae
varias obras, marcá la página donde empieza cada una y tocá «Convertir y agregar a la biblioteca»:
quedan agrupadas como colección. Si varias obras comparten página, no marques nada y separalas
después con ✎. El reconocimiento comete errores: revisá la partitura en la app.

Sin la app local, el mismo paso se hace a mano y deja los archivos en `scores/` (no se sube al repo):

```bash
npm run pdf -- pieza.pdf --paginas 1-2,3-5   # o --coleccion para que Audiveris busque los cortes
```

Después cargá juntos el `.coleccion.json` y sus `.mxl`.

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
