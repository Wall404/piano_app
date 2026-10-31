import { memo, useEffect, useMemo, useRef } from 'react'
import { solfeo, type Layout } from '../model/notes'
import { timeRange } from '../model/score'
import type { MeasureRange, Score } from '../model/types'
import { usePlayer } from '../store/usePlayer'
import { useSize } from './useSize'

const VISIBLE_BEATS = 7

// ponytail: una div por nota alcanza para piezas cortas; canvas cuando haya partituras largas (fase 3).
function Waterfall({ score, layout, range }: { score: Score; layout: Layout; range: MeasureRange | null }) {
  const [wrapRef, { height }] = useSize<HTMLDivElement>()
  const innerRef = useRef<HTMLDivElement>(null)
  const activeIds = usePlayer((s) => s.activeIds)
  const hands = usePlayer((s) => s.hands)

  const pps = Math.max(1, (height / VISIBLE_BEATS) * (score.bpm / 60))
  const band = useMemo(() => (range ? timeRange(score, range) : null), [score, range])

  // La posición va directo al DOM para no re-renderizar en cada frame.
  useEffect(() => {
    const move = (position: number) => {
      if (innerRef.current) innerRef.current.style.transform = `translate3d(0, ${position * pps}px, 0)`
    }
    move(usePlayer.getState().position)
    return usePlayer.subscribe((s) => move(s.position))
  }, [pps])

  return (
    <div className="waterfall" ref={wrapRef}>
      {[...layout.keys.values()].filter((k) => k.midi % 12 === 0).map((k) => (
        <div key={k.midi} className="lane-line" style={{ left: `${k.left}%` }} />
      ))}
      <div className="wf-inner" ref={innerRef}>
        {band && (
          <div className="section-band" style={{ bottom: band.start * pps, height: (band.end - band.start) * pps }} />
        )}
        {score.measures.map((m) => (
          <div key={m.index} className="bar-line" style={{ bottom: m.start * pps }}>
            <span>{m.index}</span>
          </div>
        ))}
        {score.notes.map((n, i) => {
          const k = layout.keys.get(n.midi)!
          const cls = ['note', n.hand, k.black && 'black', activeIds.has(i) && 'hit', !hands[n.hand] && 'muted']
            .filter(Boolean).join(' ')
          const noteHeight = n.duration * pps - 3
          return (
            <div
              key={i}
              className={cls}
              style={{ left: `${k.left}%`, width: `${k.width}%`, bottom: n.time * pps + 1, height: noteHeight }}
            >
              {noteHeight > 22 && <span>{solfeo(n.midi)}</span>}
            </div>
          )
        })}
      </div>
      <div className="now-line" />
    </div>
  )
}

export default memo(Waterfall)
