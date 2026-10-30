import { memo, useState } from 'react'
import { octaveOf, solfeo, type Key, type Layout } from '../model/notes'
import { usePlayer } from '../store/usePlayer'
import { useSize } from './useSize'

const GRADIENTS: Record<string, [string, string]> = {
  white: ['#dfe2ee', '#ffffff'],
  black: ['#2a2f45', '#10131f'],
  whiteR: ['#8ff0ff', '#0b8fd6'],
  whiteL: ['#e2bfff', '#7a2ee0'],
  blackR: ['#38e1ff', '#0b8fd6'],
  blackL: ['#c06bff', '#7a2ee0'],
  whiteSoon: ['#fff0bf', '#ffffff'],
}

// Las esquinas superiores quedan fuera del SVG: solo se redondea el borde inferior.
const TOP_OVERFLOW = 8

function Keyboard({ layout, onPress }: { layout: Layout; onPress: (midi: number) => void }) {
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const active = usePlayer((s) => s.active)
  const soon = usePlayer((s) => s.soon)
  const played = usePlayer((s) => s.played)
  const [pressed, setPressed] = useState<number | null>(null)
  const keys = [...layout.keys.values()]

  const render = (k: Key) => {
    const x = (k.left / 100) * width
    const w = (k.width / 100) * width
    const h = k.black ? height * 0.62 : height - 2
    const hand = active.get(k.midi)
    const base = k.black ? 'black' : 'white'
    const gradient = hand ? `${base}${hand}` : soon.has(k.midi) && !k.black ? 'whiteSoon' : base
    const fromPiano = played.has(k.midi)
    const cls = [
      'key',
      hand && `on ${hand}`,
      !hand && soon.has(k.midi) && 'soon',
      fromPiano && (hand ? 'hit-ok' : 'hit-bad'),
      pressed === k.midi && 'pressed',
    ].filter(Boolean).join(' ')
    const shift = hand || pressed === k.midi ? 2 : 0
    const fontSize = Math.min(w * 0.5, 12)

    return (
      <g
        key={k.midi}
        className={cls}
        onPointerDown={(e) => {
          e.preventDefault()
          setPressed(k.midi)
          onPress(k.midi)
        }}
        onPointerUp={() => setPressed(null)}
        onPointerLeave={() => setPressed(null)}
        onPointerCancel={() => setPressed(null)}
        role="button"
        aria-label={`${solfeo(k.midi)}${octaveOf(k.midi)}`}
      >
        <rect
          x={x + 0.5}
          y={-TOP_OVERFLOW + shift}
          width={Math.max(w - 1, 1)}
          height={h + TOP_OVERFLOW}
          rx={k.black ? 3 : 5}
          fill={`url(#${gradient})`}
        />
        {w >= 10 && hand && (
          <text x={x + w / 2} y={h - 8} fontSize={fontSize} className={k.black ? 'lbl dark' : 'lbl'}>
            {solfeo(k.midi)}
          </text>
        )}
        {w >= 10 && !hand && k.midi % 12 === 0 && (
          <text x={x + w / 2} y={h - 8} fontSize={fontSize} className="lbl c">
            Do{octaveOf(k.midi)}
          </text>
        )}
      </g>
    )
  }

  return (
    <div className="keyboard" ref={ref}>
      <svg width={width} height={height}>
        <defs>
          {Object.entries(GRADIENTS).map(([id, [top, bottom]]) => (
            <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={top} />
              <stop offset="1" stopColor={bottom} />
            </linearGradient>
          ))}
        </defs>
        {width > 0 && keys.filter((k) => !k.black).map(render)}
        {width > 0 && keys.filter((k) => k.black).map(render)}
      </svg>
    </div>
  )
}

export default memo(Keyboard)
