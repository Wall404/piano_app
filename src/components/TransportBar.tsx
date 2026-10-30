import { useEffect, useRef, type ReactNode } from 'react'
import type { Engine } from '../engine/transport'
import { scoreEnd } from '../model/score'
import type { Score, Section } from '../model/types'
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

interface Props {
  score: Score
  sections: Section[]
  engine: Engine
}

export default function TransportBar({ score, sections, engine }: Props) {
  const progressRef = useRef<HTMLInputElement>(null)
  const playing = usePlayer((s) => s.playing)
  const loadingAudio = usePlayer((s) => s.loadingAudio)
  const tempoPct = usePlayer((s) => s.tempoPct)
  const sectionId = usePlayer((s) => s.sectionId)
  const repeat = usePlayer((s) => s.repeat)
  const sound = usePlayer((s) => s.sound)
  const hands = usePlayer((s) => s.hands)
  const waitMode = usePlayer((s) => s.waitMode)
  const allKeys = usePlayer((s) => s.allKeys)
  const midiDevices = usePlayer((s) => s.midiDevices)
  const midiError = usePlayer((s) => s.midiError)

  useEffect(
    () =>
      usePlayer.subscribe((s) => {
        if (progressRef.current) progressRef.current.value = String(Math.max(0, s.position))
      }),
    [],
  )

  const midiConnected = Boolean(midiDevices?.length)

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
        <label className="tempo">
          <span className="tempo-value">
            {Math.round((score.bpm * tempoPct) / 100)}
            <small> bpm · {tempoPct}%{loadingAudio && ' · cargando piano…'}</small>
          </span>
          <input
            type="range"
            min={25}
            max={150}
            step={5}
            value={tempoPct}
            onChange={(e) => engine.setTempo(Number(e.target.value))}
            aria-label="Velocidad"
          />
        </label>
      </div>

      <div className="chips" aria-label="Secciones">
        <button className={`chip ${sectionId === null ? 'sel' : ''}`} onClick={() => engine.setSection(null)}>
          Todo
        </button>
        {sections.map((s) => (
          <button key={s.id} className={`chip ${sectionId === s.id ? 'sel' : ''}`} onClick={() => engine.setSection(s.id)}>
            {s.name}
            <small>{s.fromMeasure}–{s.toMeasure}</small>
          </button>
        ))}
      </div>

      <div className="toggles">
        <Toggle on={hands.L} onClick={() => engine.setHands({ ...hands, L: !hands.L })} className="L">Mano izq.</Toggle>
        <Toggle on={hands.R} onClick={() => engine.setHands({ ...hands, R: !hands.R })} className="R">Mano der.</Toggle>
        <Toggle on={repeat} onClick={() => engine.setRepeat(!repeat)}>Repetir</Toggle>
        <Toggle on={sound} onClick={() => usePlayer.setState({ sound: !sound })}>Sonido</Toggle>
        <Toggle on={allKeys} onClick={() => usePlayer.setState({ allKeys: !allKeys })}>88 teclas</Toggle>
        <Toggle on={waitMode} disabled={!midiConnected} onClick={() => engine.setWaitMode(!waitMode)}>Modo espera</Toggle>
      </div>

      <button className={`midi-btn ${midiConnected ? 'on' : ''}`} onClick={() => void engine.connectMidi()}>
        <span className="dot" />
        {midiConnected ? midiDevices!.join(', ') : midiDevices ? 'Sin teclado: conectá el Casio por USB' : 'Conectar teclado MIDI'}
      </button>
      {midiError && <p className="midi-error" role="alert">{midiError}</p>}
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
