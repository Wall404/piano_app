import { useEffect, useMemo, useRef, useState } from 'react'
import Calibration from '../components/Calibration'
import Keyboard from '../components/Keyboard'
import { CHORDS, noteName, report, scoreAttempt, type ChordAttempt, type ChordTestRecord } from '../eval/chordTest'
import { startMic } from '../eval/mic'
import type { MidiNote } from '../eval/midiInput'
import { buildLayout, fitRange } from '../model/notes'
import type { Hand } from '../model/types'
import { getCalibration, getChordTest, saveChordTest } from '../storage/db'
import { usePlayer } from '../store/usePlayer'

const WINDOW_MS = 1500 // cuánto se junta tras el primer ataque
const ALL_NOTES = CHORDS.flatMap((c) => c.notes)
const [LOW, HIGH] = fitRange(Math.min(...ALL_NOTES), Math.max(...ALL_NOTES))

/** Mide cuántos acordes de 3 notas distingue el detector, con el piano y el teléfono reales. */
export default function ChordTest({ onBack }: { onBack: () => void }) {
  const [testing, setTesting] = useState(false)
  const [ready, setReady] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState<ChordAttempt | null>(null)
  const [attempts, setAttempts] = useState<ChordAttempt[]>([])
  const [last, setLast] = useState<ChordTestRecord | null>(null)
  const [copied, setCopied] = useState(false)

  const mic = useRef<{ stop(): void } | null>(null)
  const device = useRef<ChordTestRecord['device'] | null>(null)
  const target = useRef(CHORDS[0])
  const heard = useRef(new Set<number>())
  const accepting = useRef(false)
  const timer = useRef(0)
  const left = useRef(false) // se salió o se canceló mientras se abría el micrófono

  const chord = CHORDS[index]
  const layout = useMemo(() => buildLayout(...fitRange(chord.notes[0], chord.notes[2])), [chord])

  useEffect(() => {
    void getChordTest().then((record) => setLast(record ?? null))
    left.current = false
    return () => {
      left.current = true
      clearTimeout(timer.current)
      mic.current?.stop()
      usePlayer.setState({ active: new Map(), played: new Set() })
    }
  }, [])

  // El teclado ya pinta de verde lo acertado y de rojo lo que no estaba pedido.
  useEffect(() => {
    const active = new Map<number, Hand>(testing ? chord.notes.map((m) => [m, 'R']) : [])
    usePlayer.setState({ active, played: new Set(result ? [...result.hits, ...result.extras] : []) })
  }, [testing, chord, result])

  const close = () => {
    accepting.current = false
    timer.current = 0
    setListening(false)
    setResult(scoreAttempt(target.current, [...heard.current]))
  }

  const onNote = ({ midi, on }: MidiNote) => {
    if (!on || !accepting.current) return
    heard.current.add(midi)
    if (timer.current) return
    timer.current = window.setTimeout(close, WINDOW_MS)
    setListening(true)
  }

  const arm = (i: number) => {
    clearTimeout(timer.current)
    timer.current = 0
    heard.current = new Set()
    accepting.current = true
    target.current = CHORDS[i]
    setIndex(i)
    setResult(null)
    setListening(false)
  }

  const start = async () => {
    setError(null)
    left.current = false
    const profile = await getCalibration()
    if (!profile) return setCalibrating(true)
    const sensitivityDb = usePlayer.getState().micSensitivityDb
    device.current = {
      chordsSupported: profile.chordsSupported,
      latencyMs: profile.latencyMs,
      noiseFloorDb: profile.noiseFloorDb,
      centsOffset: profile.centsOffset,
      sensitivityDb,
    }
    setAttempts([])
    setReady(false)
    setTesting(true)
    arm(0)
    try {
      const opened = await startMic({
        low: LOW,
        high: HIGH,
        onNote,
        expected: () => new Set(target.current.notes),
        sensitivityDb: () => sensitivityDb,
        onReady: () => setReady(true),
        centsOffset: profile.centsOffset,
        registerGain: profile.registerGain,
      })
      if (left.current) opened.stop()
      else mic.current = opened
    } catch (err) {
      setTesting(false)
      const denied = err instanceof DOMException && err.name === 'NotAllowedError'
      setError(denied ? 'Permití el micrófono en el navegador para hacer la prueba.' : err instanceof Error ? err.message : 'No se pudo abrir el micrófono.')
    }
  }

  const stop = () => {
    left.current = true
    clearTimeout(timer.current)
    accepting.current = false
    mic.current?.stop()
    mic.current = null
    setTesting(false)
  }

  const finish = (all: ChordAttempt[]) => {
    stop()
    if (all.length === 0) return
    const record = { date: new Date().toISOString(), attempts: all, device: device.current! }
    setLast(record)
    void saveChordTest(record)
  }

  // Lo no oído también cuenta: si el detector no reaccionó, el acorde queda en 0 de 3.
  const next = () => {
    const all = [...attempts, scoreAttempt(target.current, [...heard.current])]
    if (index + 1 < CHORDS.length) {
      setAttempts(all)
      arm(index + 1)
      return
    }
    finish(all)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setError('No se pudo copiar: seleccioná el texto a mano.')
    }
  }

  const lastReport = last && report(last)

  return (
    <div className="library chord-test">
      <header className="brand">
        <button className="icon-btn back" onClick={onBack} aria-label="Volver a la biblioteca">←</button>
        <div>
          <h1>Prueba de acordes</h1>
          <p>{testing ? `Acorde ${index + 1} de ${CHORDS.length}` : `${CHORDS.length} acordes de 3 notas`}</p>
        </div>
      </header>

      {error && <p className="midi-error" role="alert">{error}</p>}

      {testing ? (
        <>
          <h2>{chord.name} · {chord.register}</h2>
          <Keyboard layout={layout} onPress={() => {}} />
          <div className="chips chord-notes" aria-live="polite">
            {result ? (
              <>
                {result.hits.map((n) => <span key={n} className="chip hit">✓ {noteName(n)}</span>)}
                {result.missed.map((n) => <span key={n} className="chip miss">– {noteName(n)}</span>)}
                {result.extras.map((n) => <span key={n} className="chip extra">+ {noteName(n)}</span>)}
              </>
            ) : (
              chord.notes.map((n) => <span key={n} className="chip">{noteName(n)}</span>)
            )}
          </div>
          <p className="empty" role="status">
            {!ready ? 'Midiendo el ruido: hacé silencio…' : listening ? 'Escuchando…' : result ? (result.complete ? 'Acorde completo.' : `Oí ${result.hits.length} de ${result.notes.length} notas.`) : 'Tocá el acorde una vez y dejalo sonar.'}
          </p>
          <div className="chord-actions">
            <button className="midi-btn" onClick={() => arm(index)}>Repetir</button>
            <button className="midi-btn on" onClick={next} disabled={!ready}>
              {index + 1 < CHORDS.length ? 'Siguiente' : 'Terminar'}
            </button>
          </div>
          {/* Cortar antes de tiempo no pierde lo ya medido. */}
          <button className="midi-btn" onClick={() => finish(result ? [...attempts, result] : attempts)}>
            {attempts.length > 0 || result ? 'Terminar acá y ver el resultado' : 'Cancelar la prueba'}
          </button>
        </>
      ) : (
        <>
          <button className="drop" onClick={() => void start()}>
            <strong>{last ? 'Repetir la prueba' : 'Empezar la prueba'}</strong>
            <span>Apoyá el teléfono cerca de los parlantes, como al practicar. Son unos dos minutos.</span>
          </button>
          {lastReport && (
            <>
              <h2>Último resultado</h2>
              <pre className="chord-report">{lastReport}</pre>
              <button className="midi-btn" onClick={() => void copy(lastReport)}>{copied ? 'Copiado' : 'Copiar resultado'}</button>
            </>
          )}
        </>
      )}

      {calibrating && (
        <Calibration
          onDone={() => {
            setCalibrating(false)
            void start()
          }}
          onCancel={() => setCalibrating(false)}
        />
      )}
    </div>
  )
}
