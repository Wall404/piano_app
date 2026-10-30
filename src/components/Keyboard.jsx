import { memo, useState } from 'react'
import { octaveOf, solfeo } from '../lib/notes.js'

/**
 * Teclado de piano. `active` es un Map midi -> mano ('right' | 'left'),
 * `soon` las teclas que se tocan enseguida, para anticipar el movimiento.
 */
function Keyboard({ layout, active, soon, onPress }) {
  const [pressed, setPressed] = useState(() => new Set())
  const keys = [...layout.keys.values()]

  const down = (midi) => (ev) => {
    ev.preventDefault()
    setPressed((p) => new Set(p).add(midi))
    onPress?.(midi)
  }
  const up = (midi) => () =>
    setPressed((p) => {
      if (!p.has(midi)) return p
      const n = new Set(p)
      n.delete(midi)
      return n
    })

  const render = (k) => {
    const hand = active.get(k.midi)
    const cls = [
      'key',
      k.black ? 'black' : 'white',
      hand && `on ${hand}`,
      !hand && soon.has(k.midi) && 'soon',
      pressed.has(k.midi) && 'pressed',
    ]
      .filter(Boolean)
      .join(' ')
    const isC = k.midi % 12 === 0
    return (
      <div
        key={k.midi}
        className={cls}
        style={{ left: `${k.left}%`, width: `${k.width}%` }}
        onPointerDown={down(k.midi)}
        onPointerUp={up(k.midi)}
        onPointerLeave={up(k.midi)}
        onPointerCancel={up(k.midi)}
        role="button"
        aria-label={`${solfeo(k.midi)}${octaveOf(k.midi)}`}
      >
        {hand ? (
          <span className="key-label">{solfeo(k.midi)}</span>
        ) : (
          isC && <span className="key-c">Do{octaveOf(k.midi)}</span>
        )}
      </div>
    )
  }

  return (
    <div className="keyboard">
      {keys.filter((k) => !k.black).map(render)}
      {keys.filter((k) => k.black).map(render)}
    </div>
  )
}

export default memo(Keyboard)
