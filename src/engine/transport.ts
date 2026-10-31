import * as Tone from 'tone'
import { match, type Played } from '../eval/match'
import { startMic } from '../eval/mic'
import { connectMidi, type MidiNote } from '../eval/midiInput'
import { fitRange } from '../model/notes'
import { groupChords, measureAt, nextChord, timeRange, type Chord } from '../model/score'
import type { Hand, MeasureRange, NoteEvent, Score } from '../model/types'
import { getCalibration, saveAttempt } from '../storage/db'
import { initialState, usePlayer } from '../store/usePlayer'

const SOON_BEATS = 0.75
// La tecla se suelta un poco antes del final para que se vea la repetición de notas iguales.
const HOLD_RATIO = 0.88
// Cuánto puede separarse una nota de su tiempo, en segundos reales, para contar como acertada.
const TOLERANCE_SEC = 0.2

// ponytail: muestras desde el CDN de Tone.js; pasan a public/samples/piano con la PWA (fase 3).
const SAMPLES_URL = 'https://tonejs.github.io/audio/salamander/'

function sampleUrls() {
  const urls: Record<string, string> = { A0: 'A0.mp3', C8: 'C8.mp3' }
  for (let octave = 1; octave <= 7; octave++) {
    urls[`C${octave}`] = `C${octave}.mp3`
    urls[`D#${octave}`] = `Ds${octave}.mp3`
    urls[`F#${octave}`] = `Fs${octave}.mp3`
    urls[`A${octave}`] = `A${octave}.mp3`
  }
  return urls
}

interface Voice {
  triggerAttackRelease(note: string, duration: number, time?: number, velocity?: number): unknown
}

// El audio se comparte entre partituras: las muestras se cargan una sola vez.
let voice: Voice | null = null
let click: Tone.Synth | null = null
let loading: Promise<void> | null = null

/** Debe llamarse desde un gesto del usuario, por la regla de audio de los navegadores. */
function ready() {
  return (loading ??= (async () => {
    usePlayer.setState({ loadingAudio: true })
    await Tone.start()
    click = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
      volume: -14,
    }).toDestination()
    await new Promise<void>((resolve) => {
      voice = new Tone.Sampler({
        urls: sampleUrls(),
        baseUrl: SAMPLES_URL,
        release: 1,
        onload: resolve,
        onerror: () => {
          // Sin red para las muestras, mejor un sonido simple que ninguno.
          voice = new Tone.PolySynth(Tone.Synth).toDestination() as unknown as Voice
          resolve()
        },
      }).toDestination() as unknown as Voice
    })
    usePlayer.setState({ loadingAudio: false })
  })())
}

export const prepareAudio = () => ready()

export function playClick(delaySec: number) {
  click?.triggerAttackRelease('C6', 0.03, Tone.now() + delaySec)
}

/** Único reloj de la app: toca la partitura y publica en el store qué notas están activas. */
export class Engine {
  private transport = Tone.getTransport()
  private leadSec: number
  private range: { start: number; end: number }
  private chords: Chord[]
  private part: Tone.Part<{ time: string; note: NoteEvent }>
  private raf = 0
  private cleared = -Infinity // último acorde resuelto en el modo espera
  private target: Chord | null = null
  private pending = new Set<number>() // notas del acorde que faltan
  private sig = ''
  private takes: Played[] = [] // lo tocado en esta pasada
  private inputLatencySec = 0
  private stopMic: (() => void) | null = null

  constructor(private score: Score) {
    const [beats, unit] = score.timeSignature
    this.leadSec = ((beats * 4) / unit) * (60 / score.bpm) // cuenta previa de un compás
    this.range = timeRange(score, null)
    this.chords = groupChords(score.notes)
    this.transport.bpm.value = score.bpm
    this.transport.on('loop', this.onLoop)

    const events = score.notes.map((note) => ({ time: this.tickTime(note.time), note }))
    this.part = new Tone.Part<{ time: string; note: NoteEvent }>((time, e) => this.sound(time, e.note), events).start(0)
    const beatTicks = Math.round((this.transport.PPQ * 4) / unit)
    this.transport.scheduleRepeat(
      (time) => {
        if (usePlayer.getState().metronome) click?.triggerAttackRelease('C6', 0.03, time)
      },
      `${beatTicks}i`,
      0,
    )

    const { midiDevices, mic, micSensitivityDb } = usePlayer.getState()
    usePlayer.setState({ ...initialState, midiDevices, micSensitivityDb })
    if (midiDevices) void this.connectMidi() // reconecta las entradas a este motor
    if (mic !== 'off') void this.connectMic()
    this.publish(this.position())
  }

  dispose() {
    this.stopMic?.()
    cancelAnimationFrame(this.raf)
    this.transport.stop()
    this.transport.cancel()
    this.transport.loop = false
    this.transport.off('loop', this.onLoop)
    this.part.dispose()
    this.transport.ticks = 0
  }

  private onLoop = () => {
    this.evaluate()
    this.cleared = -Infinity
    this.target = null
  }

  private secToTicks(sec: number) {
    return Math.round(((sec + this.leadSec) * this.score.bpm * this.transport.PPQ) / 60)
  }

  private tickTime(sec: number) {
    return `${this.secToTicks(sec)}i`
  }

  position() {
    const ticks = this.transport.getTicksAtTime(Tone.immediate())
    return (ticks * 60) / (this.score.bpm * this.transport.PPQ) - this.leadSec
  }

  private sound(time: number, n: NoteEvent) {
    const { sound, hands, waitMode, tempoPct } = usePlayer.getState()
    if (!sound || waitMode || !hands[n.hand]) return
    if (n.time < this.range.start || n.time >= this.range.end) return
    const name = Tone.Frequency(n.midi, 'midi').toNote()
    voice?.triggerAttackRelease(name, (n.duration * 100) / tempoPct, time, n.hand === 'L' ? 0.55 : 0.8)
  }

  async toggle() {
    if (usePlayer.getState().playing) return this.pause()
    await ready()
    if (this.position() >= this.range.end) this.restart()
    this.transport.start()
    usePlayer.setState({ playing: true })
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(this.frame)
  }

  pause() {
    this.transport.pause()
    cancelAnimationFrame(this.raf)
    this.target = null
    usePlayer.setState({ playing: false, waiting: false })
  }

  restart() {
    this.seek(this.range.start - this.leadSec)
  }

  seek(sec: number) {
    this.transport.ticks = this.secToTicks(Math.max(sec, -this.leadSec))
    this.cleared = sec
    this.target = null
    this.takes = []
    this.publish(sec)
  }

  setTempo(tempoPct: number) {
    this.transport.bpm.value = (this.score.bpm * tempoPct) / 100
    usePlayer.setState({ tempoPct })
  }

  setRange(range: MeasureRange | null) {
    usePlayer.setState({ range })
    this.applyRange()
  }

  setRepeat(repeat: boolean) {
    usePlayer.setState({ repeat })
    this.applyRange()
  }

  setWaitMode(waitMode: boolean) {
    const { waiting } = usePlayer.getState()
    this.cleared = this.position()
    this.target = null
    usePlayer.setState({ waitMode, waiting: false })
    if (waiting) this.transport.start()
  }

  setHands(hands: Record<Hand, boolean>) {
    this.target = null
    usePlayer.setState({ hands })
    this.publish(this.position())
  }

  strike(midi: number) {
    void ready().then(() => {
      if (usePlayer.getState().sound) {
        voice?.triggerAttackRelease(Tone.Frequency(midi, 'midi').toNote(), 0.5)
      }
    })
  }

  async connectMidi() {
    try {
      await connectMidi(this.onMidi, (midiDevices) => usePlayer.setState({ midiDevices, midiError: null }))
    } catch (err) {
      usePlayer.setState({ midiError: err instanceof Error ? err.message : 'No se pudo conectar el teclado MIDI.' })
    }
  }

  async toggleMic() {
    if (usePlayer.getState().mic !== 'off') return this.closeMic()
    if (await getCalibration()) return this.connectMic()
    this.openCalibration()
  }

  /** La calibración necesita el micrófono para ella sola. */
  openCalibration() {
    this.closeMic()
    if (usePlayer.getState().playing) this.pause()
    usePlayer.setState({ calibrationOpen: true })
  }

  async finishCalibration() {
    usePlayer.setState({ calibrationOpen: false })
    await this.connectMic()
  }

  private closeMic() {
    this.stopMic?.()
    this.stopMic = null
    this.inputLatencySec = 0
    usePlayer.setState({ mic: 'off' })
  }

  private async connectMic() {
    const midis = this.score.notes.map((n) => n.midi)
    const [low, high] = fitRange(Math.min(...midis), Math.max(...midis))
    // El micrófono escucharía a la propia app.
    usePlayer.setState({ mic: 'calibrating', sound: false, metronome: false, midiError: null })
    try {
      const profile = await getCalibration()
      const mic = await startMic({
        low,
        high,
        onNote: this.onMidi,
        expected: () => {
          const { active, soon } = usePlayer.getState()
          return new Set([...active.keys(), ...soon, ...this.pending])
        },
        sensitivityDb: () => usePlayer.getState().micSensitivityDb,
        onReady: () => usePlayer.setState({ mic: 'on' }),
        centsOffset: profile?.centsOffset,
        registerGain: profile?.registerGain,
      })
      this.stopMic = mic.stop
      this.inputLatencySec = (profile?.latencyMs ?? 220) / 1000
      usePlayer.setState({ chordsSupported: profile?.chordsSupported ?? true })
    } catch (err) {
      const denied = err instanceof DOMException && err.name === 'NotAllowedError'
      usePlayer.setState({
        mic: 'off',
        midiError: denied ? 'Permití el micrófono en el navegador para que la app te escuche.' : err instanceof Error ? err.message : 'No se pudo abrir el micrófono.',
      })
    }
  }

  private onMidi = ({ midi, on }: MidiNote) => {
    const played = new Set(usePlayer.getState().played)
    if (on) played.add(midi)
    else played.delete(midi)
    usePlayer.setState({ played })

    const { waitMode, playing } = usePlayer.getState()
    if (!on || !playing) return
    this.takes.push({ midi, time: this.position() - this.inputLatencySec * (usePlayer.getState().tempoPct / 100) })
    if (!waitMode) return
    this.aimNextChord()
    if (!this.target) return
    this.pending.delete(midi)
    // ponytail: el micrófono pierde notas internas de acordes; hasta un tercio pueden faltar. Mejorar con Basic Pitch.
    const size = this.target.notes.length
    const { chordsSupported } = usePlayer.getState()
    const allowedMissing = this.inputLatencySec > 0 ? (chordsSupported ? Math.floor(size / 3) : size - 1) : 0
    if (this.pending.size > allowedMissing) return

    // Acorde completo: si se tocó antes de tiempo, el reloj salta hasta él.
    const { time } = this.target
    this.cleared = time
    this.target = null
    if (usePlayer.getState().waiting) {
      usePlayer.setState({ waiting: false })
      this.transport.start()
    } else if (this.position() < time) {
      this.transport.ticks = this.secToTicks(time)
    }
  }

  private aimNextChord() {
    if (this.target) return
    const { hands } = usePlayer.getState()
    this.target = nextChord(this.chords, this.cleared, this.range, hands)
    this.pending = new Set(this.target?.notes.filter((n) => hands[n.hand]).map((n) => n.midi))
  }

  private applyRange() {
    const { range, repeat } = usePlayer.getState()
    this.range = timeRange(this.score, range)
    this.transport.loop = false
    if (range && repeat) {
      this.transport.setLoopPoints(this.tickTime(this.range.start), this.tickTime(this.range.end))
      this.transport.loop = true
    }
    const pos = this.position()
    if (pos < this.range.start - this.leadSec || pos >= this.range.end) this.restart()
  }

  private frame = () => {
    const pos = this.position()
    const { waitMode, waiting } = usePlayer.getState()

    if (pos >= this.range.end) {
      this.evaluate()
      this.pause()
      this.seek(this.range.end)
      return
    }

    if (waitMode) {
      this.aimNextChord()
      if (this.target && !waiting && pos >= this.target.time) {
        this.transport.pause()
        usePlayer.setState({ waiting: true })
      }
    }

    this.publish(pos)
    this.raf = requestAnimationFrame(this.frame)
  }

  private evaluate() {
    if (this.takes.length === 0) return
    const { hands, waitMode, tempoPct } = usePlayer.getState()
    const expected = this.score.notes.filter(
      (n) => hands[n.hand] && n.time >= this.range.start && n.time < this.range.end,
    )
    if (expected.length === 0) return
    // En modo espera marca el ritmo quien toca: solo importa qué notas.
    const tolerance = waitMode ? Infinity : (TOLERANCE_SEC * tempoPct) / 100
    const result = match(expected, this.takes, tolerance)
    this.takes = []
    usePlayer.setState({ result })
    void saveAttempt(this.score.id, { date: new Date().toISOString(), tempoPct, result })
  }

  private publish(position: number) {
    const { hands } = usePlayer.getState()
    const soonSec = (SOON_BEATS * 60) / this.score.bpm
    const activeIds = new Set<number>()
    const active = new Map<number, Hand>()
    const soon = new Set<number>()
    this.score.notes.forEach((n, i) => {
      if (!hands[n.hand]) return
      if (n.time <= position && position < n.time + n.duration * HOLD_RATIO) {
        activeIds.add(i)
        active.set(n.midi, n.hand)
      } else if (n.time > position && n.time - position < soonSec) {
        soon.add(n.midi)
      }
    })

    const sig = `${[...activeIds]}|${[...soon]}`
    const measure = measureAt(this.score, position)
    if (sig === this.sig) {
      usePlayer.setState({ position, measure })
    } else {
      this.sig = sig
      usePlayer.setState({ position, measure, activeIds, active, soon })
    }
  }
}
