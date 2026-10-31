import { peakBin } from './peak'
import type { MidiNote } from './midiInput'

// Ventana larga para separar semitonos graves, corta para reaccionar rápido en los agudos.
// Cada banda deja al menos ~2,5 bins entre semitonos vecinos (a 48 kHz).
export const BANDS = [
  { fftSize: 16384, below: 60 },
  { fftSize: 8192, below: 72 },
  { fftSize: 4096, below: Infinity },
]
const FFT_LOW = BANDS[0].fftSize
// Cuánto más arriba del rango hay que leer para ver los armónicos de las notas más agudas.
const EXTRA_HIGH = 24
const MAX_MIDI = 108
const TICK_MS = 40
const CALIBRATION_MS = 1500
const RISE_DB = 7 // subida mínima para contar un ataque, también al repetir una nota
const RISE_TICKS = 3
// ponytail: la ventana de análisis sigue subiendo tras el ataque; repeticiones más rápidas que esto se pierden.
const REFRACTORY_TICKS = 5
const HARMONICS = [12, 19, 24] // semitonos hasta los armónicos 2, 3 y 4
// Un micrófono de teléfono casi no capta la fundamental de un grave: la nota esperada también vale si suenan sus armónicos.
const HARMONICS_NEEDED = 2
const THIRD_HARMONIC = 19
const PARTIALS = [12, 19, 24, 28, 31, 34, 36] // semitonos hasta los armónicos 2 a 8
const HARMONIC_MARGIN_DB = 12
const PEAK_DB = 3 // la nota debe sobresalir de sus semitonos vecinos
const DYNAMIC_RANGE_DB = 30 // lo que queda tan por debajo de lo más fuerte son parciales
const CONFIRM_TICKS = 3 // el ataque es ruido ancho: la nota recién se define después
const CONFIRM_UNEXPECTED_TICKS = 6 // una nota que no está en la partitura necesita más evidencia
const PEAK_EXPECTED_DB = 1

const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** Nivel en dB de cada nota, leyendo el espectro alrededor de su fundamental. */
export function noteLevels(spectrum: Float32Array, sampleRate: number, low: number, high: number, centsOffset = 0): number[] {
  const binsPerHz = (spectrum.length * 2) / sampleRate
  const levels: number[] = []
  for (let midi = low; midi <= high; midi++) {
    const center = midiToFreq(midi) * 2 ** (centsOffset / 1200) * binsPerHz
    const reach = Math.floor((center * 0.0595) / 4) // un cuarto de semitono
    const bin = Math.round(center)
    let level = -Infinity
    for (let b = bin - reach; b <= bin + reach; b++) level = Math.max(level, spectrum[b])
    levels.push(level)
  }
  return levels
}

/** Nivel de cada nota tomado de la banda que le corresponde; `spectra` en el orden de BANDS. */
export function bandLevels(spectra: Float32Array[], sampleRate: number, low: number, high: number, centsOffset = 0): number[] {
  return BANDS.flatMap(({ below }, i) => {
    const from = Math.max(low, i ? BANDS[i - 1].below : -Infinity)
    const to = Math.min(high, below - 1)
    return from <= to ? noteLevels(spectra[i], sampleRate, from, to, centsOffset) : []
  })
}

/** Detecta ataques comparando cada nota con su propio nivel reciente. */
export class OnsetDetector {
  private history: number[][] = []
  private on = new Set<number>()
  private lastOnset = new Map<number, number>()
  private candidates = new Map<number, number>()
  private tick = 0
  calibrated = false

  /** `high`: última nota que se informa; los niveles pueden seguir más arriba para leer armónicos. */
  constructor(
    private low: number,
    private high = Infinity,
  ) {}

  /** `threshold`: nivel mínimo por nota. Devuelve las notas que acaban de sonar y las que se apagaron. */
  update(levels: number[], threshold: number[], expected: Set<number>): MidiNote[] {
    const past = this.history[0]
    const loudest = Math.max(...levels)
    const events: MidiNote[] = []
    const sounding = (i: number, margin: number) =>
      levels[i] > threshold[i] &&
      levels[i] > (levels[i - 1] ?? -Infinity) + margin &&
      levels[i] > (levels[i + 1] ?? -Infinity) + margin &&
      levels[i] > loudest - DYNAMIC_RANGE_DB
    const rising = (i: number) => !past || levels[i] - past[i] >= RISE_DB
    // Armónicos que comparten dos notas esperadas no prueban ninguna de las dos.
    const shared = new Map<number, number>()
    for (const midi of expected) for (const h of [0, ...HARMONICS]) shared.set(midi + h, (shared.get(midi + h) ?? 0) + 1)
    /** Armónicos propios de una nota esperada que están sonando. */
    // La nota una octava arriba también suena en los armónicos 2 y 4, nunca en el 3: si el 3 es propio, tiene que estar.
    const ownHarmonics = (midi: number) => {
      const own = HARMONICS.map((h) => midi + h - this.low).filter((i) => i < levels.length && shared.get(this.low + i) === 1)
      const i = midi - this.low
      // Si el acorde tapa todos sus armónicos, alcanza con que la fundamental supere el umbral, aunque no se separe de sus vecinas.
      if (own.length === 0) return { heard: [i], ok: sounding(i, -Infinity) }
      const heard = own.filter((i) => sounding(i, PEAK_EXPECTED_DB))
      const third = midi + THIRD_HARMONIC - this.low
      const enough = own.length > 0 && heard.length >= Math.min(HARMONICS_NEEDED, own.length)
      return { heard, ok: enough && (!own.includes(third) || heard.includes(third)) }
    }
    levels.forEach((level, i) => {
      const midi = this.low + i
      if (midi > this.high) return
      if (level <= threshold[i] && !expected.has(midi)) {
        this.candidates.delete(midi)
        if (this.on.delete(midi)) events.push({ midi, on: false })
        return
      }
      const isExpected = expected.has(midi)
      const peak = sounding(i, isExpected ? PEAK_EXPECTED_DB : PEAK_DB)
      // Un grave casi sin fundamental igual llena de armónicos el espectro: si la nota de abajo se espera o ya sonó, esto es un armónico.
      const harmonic = PARTIALS.some(
        (h) =>
          i >= h &&
          (expected.has(midi - h) ||
            this.on.has(midi - h) ||
            (levels[i - h] > threshold[i - h] && levels[i - h] >= level - HARMONIC_MARGIN_DB)),
      )
      const byHarmonics = isExpected && !peak ? ownHarmonics(midi) : null
      const heardHarmonics = byHarmonics?.ok ?? false
      if ((!peak && !heardHarmonics) || (harmonic && !isExpected)) {
        this.candidates.delete(midi)
        if (level <= threshold[i] && !heardHarmonics && this.on.delete(midi)) events.push({ midi, on: false })
        return
      }

      const rose = peak ? rising(i) : byHarmonics!.heard.some(rising)
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
  calibrationMs?: number
  centsOffset?: number
  registerGain?: { low: number; mid: number; high: number }
}

const REGISTER_LOW_BELOW = 48
const REGISTER_HIGH_FROM = 72

/** Escucha el micrófono. */
export async function startMic({
  low,
  high,
  onNote,
  expected,
  sensitivityDb,
  onReady,
  calibrationMs = CALIBRATION_MS,
  centsOffset = 0,
  registerGain = { low: 0, mid: 0, high: 0 },
}: MicOptions) {
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
    return { analyser, spectrum: new Float32Array(analyser.frequencyBinCount) }
  }
  const bands = BANDS.map(({ fftSize }) => listen(fftSize))
  const lows = bands[0]
  const top = Math.min(MAX_MIDI, high + EXTRA_HIGH)
  const read = () => {
    bands.forEach((b) => b.analyser.getFloatFrequencyData(b.spectrum))
    return bandLevels(bands.map((b) => b.spectrum), ctx.sampleRate, low, top, centsOffset)
  }
  const gainFor = (midi: number) =>
    midi < REGISTER_LOW_BELOW ? registerGain.low : midi >= REGISTER_HIGH_FROM ? registerGain.high : registerGain.mid

  // Calibración: el máximo de cada nota en silencio es su piso de ruido.
  let noise: number[] | null = null
  const detector = new OnsetDetector(low, high)
  const startedAt = performance.now()
  const timer = setInterval(() => {
    const levels = read()
    if (performance.now() - startedAt < calibrationMs) {
      noise = noise ? noise.map((n, i) => Math.max(n, levels[i])) : levels
      return
    }
    if (noise && !detector.calibrated) {
      detector.calibrated = true
      onReady()
    }
    const threshold = noise!.map((n, i) => n + sensitivityDb() - gainFor(low + i))
    detector.update(levels, threshold, expected()).forEach(onNote)
  }, TICK_MS)

  return {
    stop() {
      clearInterval(timer)
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
    },
    /** Frecuencia real del pico más fuerte cerca de `hz`, a menos de un semitono. */
    peakHz(hz: number) {
      lows.analyser.getFloatFrequencyData(lows.spectrum)
      const hzPerBin = ctx.sampleRate / FFT_LOW
      return peakBin(lows.spectrum, Math.round((hz * 0.944) / hzPerBin), Math.round((hz * 1.059) / hzPerBin)) * hzPerBin
    },
    noiseDb: () => Math.max(...(noise ?? [-Infinity]).slice(0, high - low + 1)),
  }
}
