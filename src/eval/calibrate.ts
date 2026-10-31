import { startMic } from './mic'

export interface CalibrationProfile {
  date: string
  noiseFloorDb: number
  a4Hz: number
  centsOffset: number
  latencyMs: number
  registerGain: { low: number; mid: number; high: number } // dB que se bajan del umbral
  chordsSupported: boolean
}

export interface CalibrationStep {
  index: number
  title: string
  detail: string
  waiting?: boolean // espera una nota: se puede saltear
}

export const STEP_COUNT = 5
const SILENCE_MS = 3000
const SENSITIVITY_DB = 22
const WEAK_REGISTER_GAIN_DB = 8 // un registro que no se oyó se escucha con umbral más bajo
const CLICK_INTERVAL_SEC = 0.8
const LEAD_CLICKS = 2
const COUNTED_CLICKS = 4
const DEFAULT_LATENCY_MS = 220
const A4_HZ = 440

export const centsFrom = (hz: number, reference = A4_HZ) => 1200 * Math.log2(hz / reference)

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Promedio del desfase entre cada golpe y su clic más cercano; null si no hubo ninguno cerca. */
export function meanLatencyMs(clicks: number[], hits: number[], windowMs = 450): number | null {
  const offsets = clicks.flatMap((click) => {
    const nearest = hits.filter((h) => Math.abs(h - click) <= windowMs).sort((a, b) => Math.abs(a - click) - Math.abs(b - click))[0]
    return nearest === undefined ? [] : [nearest - click]
  })
  if (offsets.length === 0) return null
  return offsets.reduce((sum, o) => sum + o, 0) / offsets.length
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Corre los cinco pasos. Si un paso falla sigue con valores por defecto, para no trabar a nadie. */
export async function runCalibration(
  playClick: (delaySec: number) => void,
  onStep: (step: CalibrationStep) => void,
  signal: AbortSignal,
  skip: { requested: boolean } = { requested: false },
): Promise<CalibrationProfile | null> {
  let wanted = new Set<number>()
  const hits: { midi: number; at: number }[] = []
  let notify = () => {}
  let ready = () => {}
  const noiseReady = new Promise<void>((resolve) => (ready = resolve))

  const mic = await startMic({
    low: 36,
    high: 96,
    onNote: ({ midi, on }) => {
      if (on) hits.push({ midi, at: performance.now() })
      notify()
    },
    expected: () => wanted,
    sensitivityDb: () => SENSITIVITY_DB,
    calibrationMs: SILENCE_MS,
    onReady: () => ready(),
  })

  /** Espera hasta oír todas las notas pedidas, o hasta que se saltee el paso. */
  const listenFor = async (midis: number[]) => {
    wanted = new Set(midis)
    hits.length = 0
    skip.requested = false
    const heard = () => midis.filter((m) => hits.some((h) => h.midi === m))
    while (heard().length < midis.length && !skip.requested && !signal.aborted) {
      await new Promise<void>((resolve) => {
        notify = resolve
        setTimeout(resolve, 100)
      })
    }
    return heard()
  }

  try {
    onStep({ index: 1, title: 'Silencio', detail: 'Hacé silencio unos segundos mientras mido el ruido de la sala.' })
    await noiseReady

    onStep({ index: 2, title: 'Afinación', detail: 'Tocá La4 (el La arriba del Do central) y mantenelo apretado.', waiting: true })
    let a4Hz = A4_HZ
    if ((await listenFor([69])).length > 0) {
      await sleep(250)
      const readings: number[] = []
      for (let i = 0; i < 5; i++) {
        readings.push(mic.peakHz(A4_HZ))
        await sleep(60)
      }
      a4Hz = median(readings)
    }

    const registers = { low: 36, mid: 60, high: 84 }
    const registerGain = { low: 0, mid: 0, high: 0 }
    const labels = { low: 'Do2, el grave', mid: 'Do4, el Do central', high: 'Do6, el agudo' }
    for (const key of ['low', 'mid', 'high'] as const) {
      if (signal.aborted) return null
      onStep({ index: 3, title: 'Registros', detail: `Tocá ${labels[key]}, con fuerza normal.`, waiting: true })
      if ((await listenFor([registers[key]])).length === 0) registerGain[key] = WEAK_REGISTER_GAIN_DB
      await sleep(500)
    }

    if (signal.aborted) return null
    onStep({ index: 4, title: 'Latencia', detail: 'Tocá Do4 con cada clic. Escuchá los dos primeros y arrancá en el tercero.' })
    wanted = new Set([60])
    hits.length = 0
    const startsAt = performance.now()
    const total = LEAD_CLICKS + COUNTED_CLICKS
    for (let i = 0; i < total; i++) playClick(0.5 + i * CLICK_INTERVAL_SEC)
    const clicks = Array.from({ length: COUNTED_CLICKS }, (_, i) => startsAt + (0.5 + (i + LEAD_CLICKS) * CLICK_INTERVAL_SEC) * 1000)
    await sleep((0.5 + total * CLICK_INTERVAL_SEC + 0.5) * 1000)
    const measured = meanLatencyMs(clicks, hits.filter((h) => h.midi === 60).map((h) => h.at))
    const latencyMs = Math.round(Math.min(500, Math.max(50, measured ?? DEFAULT_LATENCY_MS)))

    if (signal.aborted) return null
    onStep({ index: 5, title: 'Acorde', detail: 'Tocá juntas Do4, Mi4 y Sol4.', waiting: true })
    const chord = await listenFor([60, 64, 67])
    if (signal.aborted) return null

    return {
      date: new Date().toISOString(),
      noiseFloorDb: Math.round(mic.noiseDb()),
      a4Hz,
      centsOffset: centsFrom(a4Hz),
      latencyMs,
      registerGain,
      chordsSupported: chord.length === 3,
    }
  } finally {
    mic.stop()
  }
}
