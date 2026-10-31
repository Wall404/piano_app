import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Engine } from '../engine/transport'
import { measureChunks, scoreEnd } from '../model/score'
import type { Score } from '../model/types'
import { usePlayer } from '../store/usePlayer'

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    {children}
  </svg>
)

const PLAY = <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
const PAUSE = (
  <>
    <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
    <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
  </>
)
const RESTART = <path d="M12 5V2L7 6.5 12 11V7.5a5 5 0 1 1-5 5H4.5A7.5 7.5 0 1 0 12 5Z" />
const SLIDERS = <path d="M4 7h9.2a2.5 2.5 0 0 1 4.6 0H20v2h-2.2a2.5 2.5 0 0 1-4.6 0H4V7Zm0 8h2.2a2.5 2.5 0 0 1 4.6 0H20v2h-9.2a2.5 2.5 0 0 1-4.6 0H4v-2Z" />

const TEMPO_MIN = 25
const TEMPO_MAX = 150
const TEMPO_PRESETS = [50, 75, 100]

interface Props {
  score: Score
  hasSheet: boolean
  engine: Engine
}

export default function TransportBar({ score, hasSheet, engine }: Props) {
  const progressRef = useRef<HTMLInputElement>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const playing = usePlayer((s) => s.playing)
  const loadingAudio = usePlayer((s) => s.loadingAudio)
  const tempoPct = usePlayer((s) => s.tempoPct)
  const range = usePlayer((s) => s.range)
  const repeat = usePlayer((s) => s.repeat)
  const sound = usePlayer((s) => s.sound)
  const metronome = usePlayer((s) => s.metronome)
  const view = usePlayer((s) => s.view)
  const hands = usePlayer((s) => s.hands)
  const waitMode = usePlayer((s) => s.waitMode)
  const allKeys = usePlayer((s) => s.allKeys)
  const midiDevices = usePlayer((s) => s.midiDevices)
  const midiError = usePlayer((s) => s.midiError)
  const mic = usePlayer((s) => s.mic)
  const micSensitivityDb = usePlayer((s) => s.micSensitivityDb)

  useEffect(
    () =>
      usePlayer.subscribe((s) => {
        if (progressRef.current) progressRef.current.value = String(Math.max(0, s.position))
      }),
    [],
  )

  useEffect(() => {
    if (!optionsOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOptionsOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [optionsOpen])

  const midiConnected = Boolean(midiDevices?.length)
  const listening = midiConnected || mic === 'on'
  const count = score.measures.length
  const setBound = (key: 'from' | 'to', value: number) => {
    const next = { from: 1, to: count, ...range, [key]: Math.min(count, Math.max(1, value || 1)) }
    if (key === 'from') next.to = Math.max(next.to, next.from)
    else next.from = Math.min(next.from, next.to)
    engine.setRange(next)
  }
  const nudgeTempo = (delta: number) => engine.setTempo(Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, tempoPct + delta)))

  return (
    <div className="transport">
      <input
        ref={progressRef}
        className="progress"
        type="range"
        min={0}
        max={scoreEnd(score)}
        step={0.01}
        defaultValue={0}
        onInput={(e) => engine.seek(Number(e.currentTarget.value))}
        aria-label="Posición"
      />

      <div className="transport-main">
        <button className="icon-btn" onClick={() => engine.restart()} aria-label="Volver al inicio">
          <Svg>{RESTART}</Svg>
        </button>
        <button
          className={`play-btn ${playing ? 'is-playing' : ''}`}
          onClick={() => void engine.toggle()}
          disabled={loadingAudio}
          aria-label={playing ? 'Pausa' : 'Reproducir'}
        >
          <Svg>{playing ? PAUSE : PLAY}</Svg>
        </button>
        <div className="tempo">
          <div className="tempo-row">
            <button className="icon-btn small" onClick={() => nudgeTempo(-5)} disabled={tempoPct <= TEMPO_MIN} aria-label="Más lento">−</button>
            <span className="tempo-value">
              {Math.round((score.bpm * tempoPct) / 100)}
              <small> bpm · {tempoPct}%{loadingAudio && ' · cargando piano…'}</small>
            </span>
            <button className="icon-btn small" onClick={() => nudgeTempo(5)} disabled={tempoPct >= TEMPO_MAX} aria-label="Más rápido">+</button>
          </div>
          <input
            type="range"
            min={TEMPO_MIN}
            max={TEMPO_MAX}
            step={5}
            value={tempoPct}
            onChange={(e) => engine.setTempo(Number(e.target.value))}
            aria-label="Velocidad"
          />
        </div>
        <button
          className={`icon-btn options-btn ${optionsOpen ? 'on' : ''}`}
          onClick={() => setOptionsOpen(!optionsOpen)}
          aria-expanded={optionsOpen}
          aria-controls="practice-options"
          aria-label={optionsOpen ? 'Cerrar opciones' : 'Opciones'}
        >
          <Svg>{SLIDERS}</Svg>
          {listening && <span className="listening-dot" />}
        </button>
      </div>

      {optionsOpen && (
      <div className="options" id="practice-options" role="region" aria-label="Opciones de práctica">
      <div className="options-head">
        <strong>Opciones</strong>
        <button className="icon-btn small" onClick={() => setOptionsOpen(false)} aria-label="Cerrar opciones">✕</button>
      </div>

      <div className="chips" aria-label="Velocidad">
        {TEMPO_PRESETS.map((pct) => (
          <button key={pct} className={`chip ${tempoPct === pct ? 'sel' : ''}`} onClick={() => engine.setTempo(pct)}>
            {pct}%
          </button>
        ))}
      </div>

      <div className="chips" aria-label="Secciones">
        <button className={`chip ${range === null ? 'sel' : ''}`} onClick={() => engine.setRange(null)}>
          Todo
        </button>
        <label className="chip range">
          Compases
          <input type="number" min={1} max={count} value={range?.from ?? 1} onChange={(e) => setBound('from', e.target.valueAsNumber)} aria-label="Desde el compás" />
          a
          <input type="number" min={1} max={count} value={range?.to ?? count} onChange={(e) => setBound('to', e.target.valueAsNumber)} aria-label="Hasta el compás" />
        </label>
        {measureChunks(score).map((c) => (
          <button key={c.from} className={`chip ${range?.from === c.from && range.to === c.to ? 'sel' : ''}`} onClick={() => engine.setRange(c)}>
            {c.from}–{c.to}
          </button>
        ))}
      </div>

      <div className="toggles">
        <Toggle on={hands.L} onClick={() => engine.setHands({ ...hands, L: !hands.L })} className="L">Mano izq.</Toggle>
        <Toggle on={hands.R} onClick={() => engine.setHands({ ...hands, R: !hands.R })} className="R">Mano der.</Toggle>
        <Toggle on={repeat} onClick={() => engine.setRepeat(!repeat)}>Repetir</Toggle>
        <Toggle on={sound} onClick={() => usePlayer.setState({ sound: !sound })}>Sonido</Toggle>
        <Toggle on={metronome} onClick={() => usePlayer.setState({ metronome: !metronome })}>Metrónomo</Toggle>
        <Toggle on={allKeys} onClick={() => usePlayer.setState({ allKeys: !allKeys })}>88 teclas</Toggle>
        <Toggle on={waitMode} disabled={!listening} onClick={() => engine.setWaitMode(!waitMode)}>Modo espera</Toggle>
        {hasSheet && (
          <Toggle on={view === 'score'} onClick={() => usePlayer.setState({ view: view === 'score' ? 'falls' : 'score' })}>Partitura</Toggle>
        )}
      </div>

      <button className={`midi-btn ${mic === 'on' ? 'on' : ''}`} onClick={() => void engine.toggleMic()}>
        <span className="dot" />
        {mic === 'off' ? 'Escuchar con el micrófono' : mic === 'calibrating' ? 'Midiendo el ruido: hacé silencio…' : 'Escuchando: tocá para apagar'}
      </button>
      {mic === 'on' && (
        <label className="tempo sensitivity">
          <small>Sensibilidad</small>
          <input
            type="range"
            min={10}
            max={40}
            step={1}
            value={50 - micSensitivityDb}
            onChange={(e) => usePlayer.setState({ micSensitivityDb: 50 - Number(e.target.value) })}
            aria-label="Sensibilidad del micrófono"
          />
        </label>
      )}
      <button className={`midi-btn ${midiConnected ? 'on' : ''}`} onClick={() => void engine.connectMidi()}>
        <span className="dot" />
        {midiConnected ? midiDevices!.join(', ') : midiDevices ? 'Sin teclado: conectá el Casio por USB' : 'Conectar teclado MIDI por USB'}
      </button>
      {midiError && <p className="midi-error" role="alert">{midiError}</p>}
      </div>
      )}
    </div>
  )
}

interface ToggleProps {
  on: boolean
  onClick: () => void
  className?: string
  disabled?: boolean
  children: ReactNode
}

function Toggle({ on, onClick, className = '', disabled, children }: ToggleProps) {
  return (
    <button className={`toggle ${className} ${on ? 'on' : ''}`} onClick={onClick} disabled={disabled} aria-pressed={on}>
      <span className="dot" />
      {children}
    </button>
  )
}
