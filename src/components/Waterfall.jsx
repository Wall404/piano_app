import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { solfeo } from '../lib/notes.js'

const VISIBLE_BEATS = 7

/**
 * Notas que "caen" hacia el teclado. La posición se mueve con un transform
 * aplicado directo al DOM en cada frame, sin re-render de React.
 */
function Waterfall({ song, layout, player, activeIds, hands, section }) {
  const wrapRef = useRef(null)
  const innerRef = useRef(null)
  const [ppb, setPpb] = useState(48)

  useLayoutEffect(() => {
    const el = wrapRef.current
    const ro = new ResizeObserver(([entry]) => {
      setPpb(Math.max(28, entry.contentRect.height / VISIBLE_BEATS))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(
    () =>
      player.onFrame((beat) => {
        if (innerRef.current) innerRef.current.style.transform = `translate3d(0, ${beat * ppb}px, 0)`
      }),
    [player, ppb],
  )

  const bars = Array.from({ length: song.bars + 1 }, (_, i) => i)
  const octaveLines = [...layout.keys.values()].filter((k) => k.midi % 12 === 0)

  return (
    <div className="waterfall" ref={wrapRef}>
      {octaveLines.map((k) => (
        <div key={k.midi} className="lane-line" style={{ left: `${k.left}%` }} />
      ))}
      <div className="wf-inner" ref={innerRef}>
        {section && (
          <div
            className="section-band"
            style={{ bottom: section.start * ppb, height: (section.end - section.start) * ppb }}
          />
        )}
        {bars.map((b) => (
          <div key={b} className="bar-line" style={{ bottom: b * song.beatsPerBar * ppb }}>
            {b < song.bars && <span>{b + 1}</span>}
          </div>
        ))}
        {song.events.map((e) => {
          const k = layout.keys.get(e.midi)
          const cls = [
            'note',
            e.hand,
            k.black && 'black',
            activeIds.has(e.id) && 'hit',
            !hands[e.hand] && 'muted',
          ]
            .filter(Boolean)
            .join(' ')
          const height = e.dur * ppb - 3
          return (
            <div
              key={e.id}
              className={cls}
              style={{ left: `${k.left}%`, width: `${k.width}%`, bottom: e.start * ppb + 1, height }}
            >
              {height > 22 && <span>{solfeo(e.midi)}</span>}
            </div>
          )
        })}
      </div>
      <div className="now-line" />
    </div>
  )
}

export default memo(Waterfall)
