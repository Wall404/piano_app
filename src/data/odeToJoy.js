import { buildSong } from '../lib/song.js'

// Beethoven, Novena Sinfonía (dominio público), arreglo simple en Do mayor.
const C = 'C3+E3+G3'
const G = 'B2+D3+G3'

export default buildSong({
  title: 'Oda a la alegría',
  composer: 'L. van Beethoven',
  bpm: 96,
  beatsPerBar: 4,
  right: [
    'E4:1', 'E4:1', 'F4:1', 'G4:1', 'G4:1', 'F4:1', 'E4:1', 'D4:1',
    'C4:1', 'C4:1', 'D4:1', 'E4:1', 'E4:1.5', 'D4:0.5', 'D4:2',
    'E4:1', 'E4:1', 'F4:1', 'G4:1', 'G4:1', 'F4:1', 'E4:1', 'D4:1',
    'C4:1', 'C4:1', 'D4:1', 'E4:1', 'D4:1.5', 'C4:0.5', 'C4:2',
    'D4:1', 'D4:1', 'E4:1', 'C4:1', 'D4:1', 'E4:0.5', 'F4:0.5', 'E4:1', 'C4:1',
    'D4:1', 'E4:0.5', 'F4:0.5', 'E4:1', 'D4:1', 'C4:1', 'D4:1', 'G3:2',
    'E4:1', 'E4:1', 'F4:1', 'G4:1', 'G4:1', 'F4:1', 'E4:1', 'D4:1',
    'C4:1', 'C4:1', 'D4:1', 'E4:1', 'D4:1.5', 'C4:0.5', 'C4:2',
  ],
  left: [
    `${C}:4`, `${G}:4`, `${C}:4`, `${G}:4`,
    `${C}:4`, `${G}:4`, `${C}:4`, `${G}:2`, `${C}:2`,
    `${G}:4`, `${C}:4`, `${G}:4`, `${C}:2`, 'G2:2',
    `${C}:4`, `${G}:4`, `${C}:4`, `${G}:2`, `${C}:2`,
  ],
  sections: [
    { id: 'a1', name: 'Frase 1', fromBar: 1, toBar: 4 },
    { id: 'a2', name: 'Frase 2', fromBar: 5, toBar: 8 },
    { id: 'b', name: 'Puente', fromBar: 9, toBar: 12 },
    { id: 'a3', name: 'Final', fromBar: 13, toBar: 16 },
  ],
})
