const LETTER_TO_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SOLFEO = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']
const BLACK_PCS = new Set([1, 3, 6, 8, 10])

export const PIANO_LOW = 21
export const PIANO_HIGH = 108

/** "C4" | "F#3" | "Bb2" -> número MIDI (C4 = 60). */
export function parseNote(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name.trim())
  if (!m) throw new Error(`Nota inválida: ${name}`)
  const [, letter, acc, oct] = m
  const shift = acc === '#' ? 1 : acc === 'b' ? -1 : 0
  return (Number(oct) + 1) * 12 + LETTER_TO_PC[letter] + shift
}

export const isBlack = (midi: number) => BLACK_PCS.has(midi % 12)
export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1
export const solfeo = (midi: number) => SOLFEO[midi % 12]

export interface Key {
  midi: number
  black: boolean
  left: number // % del ancho del teclado
  width: number
}

export interface Layout {
  low: number
  high: number
  keys: Map<number, Key>
}

/** Extiende un rango a octavas completas, sin salir del piano. */
export function fitRange(low: number, high: number): [number, number] {
  return [Math.max(PIANO_LOW, low - (low % 12)), Math.min(PIANO_HIGH, high + 11 - (high % 12))]
}

/** Posición de cada tecla entre `low` y `high`, que deben ser teclas blancas. */
export function buildLayout(low: number, high: number): Layout {
  let whiteCount = 0
  for (let m = low; m <= high; m++) if (!isBlack(m)) whiteCount++

  const whiteWidth = 100 / whiteCount
  const blackWidth = whiteWidth * 0.62
  const keys = new Map<number, Key>()
  let whiteIndex = 0
  for (let midi = low; midi <= high; midi++) {
    if (isBlack(midi)) {
      keys.set(midi, { midi, black: true, left: whiteIndex * whiteWidth - blackWidth / 2, width: blackWidth })
    } else {
      keys.set(midi, { midi, black: false, left: whiteIndex * whiteWidth, width: whiteWidth })
      whiteIndex++
    }
  }
  return { low, high, keys }
}
