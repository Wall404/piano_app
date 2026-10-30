import { useEffect, useRef } from 'react'

const Icon = {
  play: <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />,
  pause: (
    <>
      <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
    </>
  ),
  restart: <path d="M12 5V2L7 6.5 12 11V7.5a5 5 0 1 1-5 5H4.5A7.5 7.5 0 1 0 12 5Z" />,
}

const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    {children}
  </svg>
)

export default function Transport({
  song, player, playing, onPlayToggle, tempo, onTempo, sectionId, onSection,
  repeat, onRepeat, sound, onSound, hands, onHands,
}) {
  const progressRef = useRef(null)

  useEffect(
    () =>
      player.onFrame((beat) => {
        if (progressRef.current) progressRef.current.value = Math.max(0, beat)
      }),
    [player],
  )

  const bpm = Math.round(song.bpm * tempo)

  return (
    <div className="transport">
      <input
        ref={progressRef}
        className="progress"
        type="range"
        min={0}
        max={song.totalBeats}
        step={0.01}
        defaultValue={0}
        onInput={(e) => player.seek(Number(e.target.value))}
        aria-label="Posición"
      />

      <div className="transport-main">
        <button className="icon-btn" onClick={() => player.restart()} aria-label="Volver al inicio">
          <Svg>{Icon.restart}</Svg>
        </button>
        <button className={`play-btn ${playing ? 'is-playing' : ''}`} onClick={onPlayToggle} aria-label={playing ? 'Pausa' : 'Reproducir'}>
          <Svg>{playing ? Icon.pause : Icon.play}</Svg>
        </button>
        <label className="tempo">
          <span className="tempo-value">
            {bpm}
            <small> bpm · {Math.round(tempo * 100)}%</small>
          </span>
          <input
            type="range"
            min={0.25}
            max={1.5}
            step={0.05}
            value={tempo}
            onChange={(e) => onTempo(Number(e.target.value))}
            aria-label="Velocidad"
          />
        </label>
      </div>

      <div className="chips" role="tablist" aria-label="Secciones">
        <button className={`chip ${sectionId === null ? 'sel' : ''}`} onClick={() => onSection(null)}>
          Todo
        </button>
        {song.sections.map((s) => (
          <button key={s.id} className={`chip ${sectionId === s.id ? 'sel' : ''}`} onClick={() => onSection(s.id)}>
            {s.name}
            <small>
              {s.fromBar}–{s.toBar}
            </small>
          </button>
        ))}
      </div>

      <div className="toggles">
        <Toggle on={hands.left} onClick={() => onHands({ ...hands, left: !hands.left })} className="left">
          Mano izq.
        </Toggle>
        <Toggle on={hands.right} onClick={() => onHands({ ...hands, right: !hands.right })} className="right">
          Mano der.
        </Toggle>
        <Toggle on={repeat} onClick={() => onRepeat(!repeat)}>Repetir</Toggle>
        <Toggle on={sound} onClick={() => onSound(!sound)}>Sonido</Toggle>
      </div>
    </div>
  )
}

function Toggle({ on, onClick, className = '', children }) {
  return (
    <button className={`toggle ${className} ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="dot" />
      {children}
    </button>
  )
}
