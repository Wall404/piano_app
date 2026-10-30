import { fromTokens } from '../model/score'
import type { Section } from '../model/types'

// Beethoven, Novena Sinfonía (dominio público), arreglo simple en Do mayor.
const C = 'C3+E3+G3'
const G = 'B2+D3+G3'

export const odeToJoy = fromTokens({
  id: 'ode-to-joy',
  title: 'Oda a la alegría',
  composer: 'L. van Beethoven',
  bpm: 96,
  timeSignature: [4, 4],
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
})

const section = (id: string, name: string, fromMeasure: number, toMeasure: number): Section => ({
  id, scoreId: odeToJoy.id, name, fromMeasure, toMeasure,
})

export const odeToJoySections: Section[] = [
  section('a1', 'Frase 1', 1, 4),
  section('a2', 'Frase 2', 5, 8),
  section('b', 'Puente', 9, 12),
  section('a3', 'Final', 13, 16),
]
