const LETTER_TO_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SOLFEO = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']
const BLACK_PCS = new Set([1, 3, 6, 8, 10])

/** "C4" | "F#3" | "Bb2" -> número MIDI (C4 = 60). */
export function parseNote(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name.trim())
  if (!m) throw new Error(`Nota inválida: ${name}`)
  const [, letter, acc, oct] = m
  const shift = acc === '#' ? 1 : acc === 'b' ? -1 : 0
  return (Number(oct) + 1) * 12 + LETTER_TO_PC[letter] + shift
}

export const isBlack = (midi) => BLACK_PCS.has(midi % 12)
export const octaveOf = (midi) => Math.floor(midi / 12) - 1
export const solfeo = (midi) => SOLFEO[midi % 12]
export const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12)

/**
 * Posición horizontal de cada tecla en porcentaje del ancho del teclado.
 * El rango se extiende a octavas completas (de Do a Si).
 */
export function buildLayout(lowMidi, highMidi) {
  const low = lowMidi - (lowMidi % 12)
  const high = highMidi + (11 - (highMidi % 12))
  const whites = []
  for (let m = low; m <= high; m++) if (!isBlack(m)) whites.push(m)

  const whiteWidth = 100 / whites.length
  const blackWidth = whiteWidth * 0.62
  const keys = new Map()
  let whiteIndex = 0
  for (let m = low; m <= high; m++) {
    if (isBlack(m)) {
      keys.set(m, { midi: m, black: true, left: whiteIndex * whiteWidth - blackWidth / 2, width: blackWidth })
    } else {
      keys.set(m, { midi: m, black: false, left: whiteIndex * whiteWidth, width: whiteWidth })
      whiteIndex++
    }
  }
  return { low, high, keys, whiteCount: whites.length }
}
