import { describe, expect, it } from 'vitest'
import { BANDS, bandLevels, OnsetDetector } from '../src/eval/mic'

// Piano sintético grabado con un teléfono: parciales inarmónicos que decaen y un micrófono
// que casi no capta debajo de 150 Hz. Pasa por el mismo camino que startMic.
const RATE = 48000
const TICK = 0.04
const NOISE = 1e-4
const SENSITIVITY_DB = 22
const LOW = 21
const HIGH = 96
const TOP = 108

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
const phoneMic = (f: number) => (f / 150) ** 4 / Math.sqrt(1 + (f / 150) ** 8)

function render(notes: number[], onset: number, seconds: number) {
  const out = new Float64Array(Math.round(seconds * RATE))
  let seed = 1
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  for (let n = 0; n < out.length; n++) out[n] = NOISE * random()
  for (const midi of notes) {
    for (let k = 1; k <= 12; k++) {
      const f = k * hz(midi) * Math.sqrt(1 + 2e-4 * k * k)
      if (f > RATE / 2) break
      const amp = (0.05 / k) * phoneMic(f)
      for (let n = Math.round(onset * RATE); n < out.length; n++) {
        const t = n / RATE - onset
        out[n] += amp * Math.exp(-t * (1 + k / 4)) * Math.sin(2 * Math.PI * f * t)
      }
    }
  }
  return out
}

/** Como AnalyserNode.getFloatFrequencyData: ventana Blackman, |X|/N en dB. */
function spectrum(signal: Float64Array, end: number, size: number) {
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  for (let i = 0; i < size; i++) {
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / size) + 0.08 * Math.cos((4 * Math.PI * i) / size)
    re[i] = (signal[end - size + i] ?? 0) * w
  }
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) [re[i], re[j], im[i], im[j]] = [re[j], re[i], im[j], im[i]]
  }
  for (let len = 2; len <= size; len <<= 1) {
    const a = (-2 * Math.PI) / len
    for (let i = 0; i < size; i += len)
      for (let k = 0; k < len / 2; k++) {
        const [c, s] = [Math.cos(a * k), Math.sin(a * k)]
        const [p, q] = [i + k, i + k + len / 2]
        const tr = re[q] * c - im[q] * s
        const ti = re[q] * s + im[q] * c
        re[q] = re[p] - tr
        im[q] = im[p] - ti
        re[p] += tr
        im[p] += ti
      }
  }
  const out = new Float32Array(size / 2)
  for (let i = 0; i < size / 2; i++) out[i] = 20 * Math.log10(Math.hypot(re[i], im[i]) / size + 1e-12)
  return out
}

/** Notas que el detector informa al tocar `notes` esperando `expected`. */
export function hear(notes: number[], expected: number[]) {
  const signal = render(notes, 0.8, 1.6)
  const read = (t: number) =>
    bandLevels(BANDS.map((b) => spectrum(signal, Math.round(t * RATE), b.fftSize)), RATE, LOW, TOP)
  let noise: number[] | null = null
  for (let t = 0.4; t < 0.8; t += TICK) {
    const levels = read(t)
    noise = noise ? noise.map((n, i) => Math.max(n, levels[i])) : levels
  }
  const threshold = noise!.map((n) => n + SENSITIVITY_DB)
  const detector = new OnsetDetector(LOW, HIGH)
  const heard = new Set<number>()
  for (let t = 0.8; t < 1.6; t += TICK)
    detector.update(read(t), threshold, new Set(expected)).forEach((e) => e.on && heard.add(e.midi))
  return [...heard].sort((a, b) => a - b)
}

describe('detección con audio de piano sintético', () => {
  it('oye graves aunque el micrófono no capte la fundamental', () => {
    for (const midi of [28, 33, 36, 40, 43]) expect(hear([midi], [midi])).toEqual([midi])
  })

  it('no confunde un grave con su octava de arriba', () => {
    expect(hear([45], [33])).not.toContain(33)
  })

  it('oye los acordes completos en el registro medio y grave', () => {
    expect(hear([60, 64, 67], [60, 64, 67])).toEqual([60, 64, 67])
    expect(hear([48, 52, 55], [48, 52, 55])).toEqual([48, 52, 55])
    expect(hear([36, 48], [36, 48])).toEqual([36, 48])
  })
})
