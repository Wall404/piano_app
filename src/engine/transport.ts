import * as Tone from 'tone'
import { connectMidi, type MidiNote } from '../eval/midiInput'
import { dueChord, groupChords, measureAt, sectionRange, type Chord } from '../model/score'
import type { Hand, NoteEvent, Score, Section } from '../model/types'
import { usePlayer } from '../store/usePlayer'

const LEAD_BEATS = 2
const SOON_BEATS = 0.75
// La tecla se suelta un poco antes del final para que se vea la repetición de notas iguales.
const HOLD_RATIO = 0.88

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

/** Único reloj de la app: toca la partitura y publica en el store qué notas están activas. */
export class Engine {
  private transport = Tone.getTransport()
  private leadSec: number
  private range: { start: number; end: number }
  private chords: Chord[]
  private voice: Voice | null = null
  private loading: Promise<void> | null = null
  private raf = 0
  private cleared = -Infinity // último acorde resuelto en el modo espera
  private pending: Set<number> | null = null
  private sig = ''

  constructor(
    private score: Score,
    private sections: Section[],
  ) {
    this.leadSec = (LEAD_BEATS * 60) / score.bpm
    this.range = sectionRange(score, null)
    this.chords = groupChords(score.notes)
    this.transport.bpm.value = score.bpm

    const events = score.notes.map((note) => ({ time: this.tickTime(note.time), note }))
    new Tone.Part<{ time: string; note: NoteEvent }>((time, e) => this.sound(time, e.note), events).start(0)
    this.publish(this.position())
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
    this.voice?.triggerAttackRelease(name, (n.duration * 100) / tempoPct, time, n.hand === 'L' ? 0.55 : 0.8)
  }

  /** Debe llamarse desde un gesto del usuario, por la regla de audio de los navegadores. */
  private ready() {
    return (this.loading ??= (async () => {
      usePlayer.setState({ loadingAudio: true })
      await Tone.start()
      await new Promise<void>((resolve) => {
        this.voice = new Tone.Sampler({
          urls: sampleUrls(),
          baseUrl: SAMPLES_URL,
          release: 1,
          onload: resolve,
          onerror: () => {
            // Sin red para las muestras, mejor un sonido simple que ninguno.
            this.voice = new Tone.PolySynth(Tone.Synth).toDestination() as unknown as Voice
            resolve()
          },
        }).toDestination() as unknown as Voice
      })
      usePlayer.setState({ loadingAudio: false })
    })())
  }

  async toggle() {
    if (usePlayer.getState().playing) return this.pause()
    await this.ready()
    if (this.position() >= this.range.end) this.restart()
    this.transport.start()
    usePlayer.setState({ playing: true })
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(this.frame)
  }

  pause() {
    this.transport.pause()
    cancelAnimationFrame(this.raf)
    this.pending = null
    usePlayer.setState({ playing: false, waiting: false })
  }

  restart() {
    this.seek(this.range.start - this.leadSec)
  }

  seek(sec: number) {
    this.transport.ticks = this.secToTicks(Math.max(sec, -this.leadSec))
    this.cleared = sec
    this.pending = null
    this.publish(sec)
  }

  setTempo(tempoPct: number) {
    this.transport.bpm.value = (this.score.bpm * tempoPct) / 100
    usePlayer.setState({ tempoPct })
  }

  setSection(sectionId: string | null) {
    usePlayer.setState({ sectionId })
    this.applyRange()
  }

  setRepeat(repeat: boolean) {
    usePlayer.setState({ repeat })
    this.applyRange()
  }

  setWaitMode(waitMode: boolean) {
    const { waiting } = usePlayer.getState()
    this.cleared = this.position()
    this.pending = null
    usePlayer.setState({ waitMode, waiting: false })
    if (waiting) this.transport.start()
  }

  setHands(hands: Record<Hand, boolean>) {
    usePlayer.setState({ hands })
    this.publish(this.position())
  }

  strike(midi: number) {
    void this.ready().then(() => {
      if (usePlayer.getState().sound) {
        this.voice?.triggerAttackRelease(Tone.Frequency(midi, 'midi').toNote(), 0.5)
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

  private onMidi = ({ midi, on }: MidiNote) => {
    const played = new Set(usePlayer.getState().played)
    if (on) played.add(midi)
    else played.delete(midi)
    usePlayer.setState({ played })

    if (!on || !this.pending) return
    this.pending.delete(midi)
    if (this.pending.size === 0) {
      this.pending = null
      usePlayer.setState({ waiting: false })
      this.transport.start()
    }
  }

  private applyRange() {
    const { sectionId, repeat } = usePlayer.getState()
    const section = this.sections.find((s) => s.id === sectionId) ?? null
    this.range = sectionRange(this.score, section)
    this.transport.loop = false
    if (section && repeat) {
      this.transport.setLoopPoints(this.tickTime(this.range.start), this.tickTime(this.range.end))
      this.transport.loop = true
    }
    const pos = this.position()
    if (pos < this.range.start - this.leadSec || pos >= this.range.end) this.restart()
  }

  private frame = () => {
    const pos = this.position()
    const { waitMode, waiting, hands } = usePlayer.getState()
    if (pos < this.cleared) this.cleared = -Infinity // volvió al inicio del loop

    if (pos >= this.range.end) {
      this.pause()
      this.seek(this.range.end)
      return
    }

    if (waitMode && !waiting) {
      const chord = dueChord(this.chords, this.cleared, pos, this.range.start, hands)
      if (chord) {
        this.transport.pause()
        this.cleared = chord.time
        this.pending = new Set(chord.notes.filter((n) => hands[n.hand]).map((n) => n.midi))
        usePlayer.setState({ waiting: true })
      }
    }

    this.publish(pos)
    this.raf = requestAnimationFrame(this.frame)
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
