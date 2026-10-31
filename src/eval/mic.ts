import type { MidiNote } from './midiInput'

// Ventana larga para separar semitonos graves, corta para reaccionar rápido en el resto.
const FFT_LOW = 16384
const FFT_HIGH = 4096
const SPLIT_MIDI = 60
const TICK_MS = 40
const CALIBRATION_MS = 1500
const RISE_DB = 7 // subida mínima para contar un ataque, también al repetir una nota
const RISE_TICKS = 3
// ponytail: la ventana de análisis sigue subiendo tras el ataque; repeticiones más rápidas que esto se pierden.
const REFRACTORY_TICKS = 5
const HARMONICS = [12, 19, 24] // semitonos hasta los armónicos 2, 3 y 4
const HARMONIC_MARGIN_DB = 12
const PEAK_DB = 3 // la nota debe sobresalir de sus semitonos vecinos
const DYNAMIC_RANGE_DB = 30 // lo que queda tan por debajo de lo más fuerte son parciales
const CONFIRM_TICKS = 3 // el ataque es ruido ancho: la nota recién se define después
const CONFIRM_UNEXPECTED_TICKS = 6 // una nota que no está en la partitura necesita más evidencia
const PEAK_EXPECTED_DB = 1

const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** Nivel en dB de cada nota, leyendo el espectro alrededor de su fundamental. */
export function noteLevels(spectrum: Float32Array, sampleRate: number, low: number, high: number): number[] {
  const binsPerHz = (spectrum.length * 2) / sampleRate
  const levels: number[] = []
  for (let midi = low; midi <= high; midi++) {
    const center = midiToFreq(midi) * binsPerHz
    const reach = Math.floor((center * 0.0595) / 4) // un cuarto de semitono
    const bin = Math.round(center)
    let level = -Infinity
    for (let b = bin - reach; b <= bin + reach; b++) level = Math.max(level, spectrum[b])
    levels.push(level)
  }
  return levels
}

/** Detecta ataques comparando cada nota con su propio nivel reciente. */
export class OnsetDetector {
  private history: number[][] = []
  private on = new Set<number>()
  private lastOnset = new Map<number, number>()
  private candidates = new Map<number, number>()
  private tick = 0
  calibrated = false

  constructor(private low: number) {}

  /** `threshold`: nivel mínimo por nota. Devuelve las notas que acaban de sonar y las que se apagaron. */
  update(levels: number[], threshold: number[], expected: Set<number>): MidiNote[] {
    const past = this.history[0]
    const loudest = Math.max(...levels)
    const events: MidiNote[] = []
    levels.forEach((level, i) => {
      const midi = this.low + i
      if (level <= threshold[i]) {
        this.candidates.delete(midi)
        if (this.on.delete(midi)) events.push({ midi, on: false })
        return
      }
      const isExpected = expected.has(midi)
      const margin = isExpected ? PEAK_EXPECTED_DB : PEAK_DB
      const peak =
        level > (levels[i - 1] ?? -Infinity) + margin &&
        level > (levels[i + 1] ?? -Infinity) + margin &&
        level > loudest - DYNAMIC_RANGE_DB
      const harmonic = HARMONICS.some(
        (h) => i >= h && levels[i - h] > threshold[i - h] && levels[i - h] >= level - HARMONIC_MARGIN_DB,
      )
      if (!peak || (harmonic && !isExpected)) {
        this.candidates.delete(midi)
        return
      }

      const rose = !past || level - past[i] >= RISE_DB
      const recent = this.tick - (this.lastOnset.get(midi) ?? -Infinity) < REFRACTORY_TICKS
      if (recent || (!rose && !this.candidates.has(midi))) return
      const count = (this.candidates.get(midi) ?? 0) + 1
      this.candidates.set(midi, count)
      if (count < (isExpected ? CONFIRM_TICKS : CONFIRM_UNEXPECTED_TICKS)) return

      this.candidates.delete(midi)
      this.lastOnset.set(midi, this.tick)
      if (this.on.has(midi)) events.push({ midi, on: false })
      this.on.add(midi)
      events.push({ midi, on: true })
    })
    this.tick++
    this.history.push(levels)
    if (this.history.length > RISE_TICKS) this.history.shift()
    return events
  }
}

interface MicOptions {
  low: number
  high: number
  onNote: (note: MidiNote) => void
  expected: () => Set<number>
  sensitivityDb: () => number // cuánto por encima del ruido cuenta como nota
  onReady: () => void
}

/** Escucha el micrófono. Devuelve la función que lo apaga. */
export async function startMic({ low, high, onNote, expected, sensitivityDb, onReady }: MicOptions) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('El micrófono necesita HTTPS o localhost.')
  // Los filtros de voz del teléfono se comen las notas sostenidas.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  })
  const ctx = new AudioContext()
  await ctx.resume()
  const source = ctx.createMediaStreamSource(stream)
  const listen = (fftSize: number) => {
    const analyser = ctx.createAnalyser()
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = 0
    source.connect(analyser)
    const spectrum = new Float32Array(analyser.frequencyBinCount)
    return (from: number, to: number) => {
      analyser.getFloatFrequencyData(spectrum)
      return from <= to ? noteLevels(spectrum, ctx.sampleRate, from, to) : []
    }
  }
  const lows = listen(FFT_LOW)
  const highs = listen(FFT_HIGH)
  const read = () => [...lows(low, Math.min(high, SPLIT_MIDI - 1)), ...highs(Math.max(low, SPLIT_MIDI), high)]

  // Calibración: el máximo de cada nota en silencio es su piso de ruido.
  let noise: number[] | null = null
  const detector = new OnsetDetector(low)
  const startedAt = performance.now()
  const timer = setInterval(() => {
    const levels = read()
    if (performance.now() - startedAt < CALIBRATION_MS) {
      noise = noise ? noise.map((n, i) => Math.max(n, levels[i])) : levels
      return
    }
    if (noise && !detector.calibrated) {
      detector.calibrated = true
      onReady()
    }
    const threshold = noise!.map((n) => n + sensitivityDb())
    detector.update(levels, threshold, expected()).forEach(onNote)
  }, TICK_MS)

  return () => {
    clearInterval(timer)
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close()
  }
}
