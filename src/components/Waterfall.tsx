import { memo, useEffect, useMemo, useRef } from 'react'
import { solfeo, type Layout } from '../model/notes'
import { timeRange } from '../model/score'
import type { MeasureRange, Score } from '../model/types'
import { usePlayer } from '../store/usePlayer'
import { useSize } from './useSize'

const VISIBLE_BEATS = 7
const MAX_DPR = 2 // más resolución no se nota y cuesta cuadros en el teléfono
const RADIUS = 7
const MIN_LABEL_HEIGHT = 22

const GLOW = {
  R: ['rgba(56, 225, 255, 0.35)', 'rgba(56, 225, 255, 0.7)'],
  L: ['rgba(192, 107, 255, 0.35)', 'rgba(192, 107, 255, 0.7)'],
}
const LABEL = { R: 'rgba(5, 10, 30, 0.75)', L: 'rgba(255, 255, 255, 0.85)' }

function Waterfall({ score, layout, range }: { score: Score; layout: Layout; range: MeasureRange | null }) {
  const [wrapRef, { width, height }] = useSize<HTMLDivElement>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const band = useMemo(() => (range ? timeRange(score, range) : null), [score, range])

  useEffect(() => {
    if (!width || !height) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio, MAX_DPR)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.scale(dpr, dpr)

    const style = getComputedStyle(canvas)
    const color = (name: string) => style.getPropertyValue(name).trim()
    const fill = { R: [color('--right'), color('--right-deep')], L: [color('--left'), color('--left-deep')] }
    const textDim = color('--text-dim')
    const labelSize = Math.min(12, Math.max(8, window.innerWidth * 0.016))
    const pps = Math.max(1, (height / VISIBLE_BEATS) * (score.bpm / 60))
    const lanes = [...layout.keys.values()].filter((k) => k.midi % 12 === 0).map((k) => (k.left / 100) * width)

    const drawBand = (top: number, bottom: number) => {
      const gradient = ctx.createLinearGradient(0, top, 0, bottom)
      gradient.addColorStop(0, 'rgba(255, 214, 102, 0.07)')
      gradient.addColorStop(1, 'rgba(255, 214, 102, 0.02)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, top, width, bottom - top)
      ctx.strokeStyle = 'rgba(255, 214, 102, 0.35)'
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(0, top + 0.5)
      ctx.lineTo(width, top + 0.5)
      ctx.moveTo(0, bottom - 0.5)
      ctx.lineTo(width, bottom - 0.5)
      ctx.stroke()
      ctx.setLineDash([])
    }

    const barLine = ctx.createLinearGradient(0, 0, width, 0)
    barLine.addColorStop(0, 'transparent')
    barLine.addColorStop(0.15, 'rgba(255, 255, 255, 0.12)')
    barLine.addColorStop(0.85, 'rgba(255, 255, 255, 0.12)')
    barLine.addColorStop(1, 'transparent')

    const draw = () => {
      const { position, activeIds, hands } = usePlayer.getState()
      const yOf = (time: number) => height - (time - position) * pps
      ctx.clearRect(0, 0, width, height)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
      for (const x of lanes) ctx.fillRect(x, 0, 1, height)

      if (band) drawBand(yOf(band.end), yOf(band.start))

      ctx.font = `10.4px ${style.fontFamily}`
      ctx.textAlign = 'left'
      for (const m of score.measures) {
        const y = yOf(m.start)
        if (y < 0 || y > height + 14) continue
        ctx.fillStyle = barLine
        ctx.fillRect(0, y - 1, width, 1)
        ctx.globalAlpha = 0.7
        ctx.fillStyle = textDim
        ctx.fillText(String(m.index), 6, y - 4)
        ctx.globalAlpha = 1
      }

      ctx.font = `700 ${labelSize}px ${style.fontFamily}`
      ctx.textAlign = 'center'
      score.notes.forEach((n, i) => {
        const bottom = yOf(n.time) - 1
        const noteHeight = n.duration * pps - 3
        const top = bottom - noteHeight
        if (bottom < 0 || top > height) return
        const k = layout.keys.get(n.midi)!
        const x = (k.left / 100) * width
        const w = (k.width / 100) * width
        const hit = activeIds.has(i)
        const muted = !hands[n.hand]

        const gradient = ctx.createLinearGradient(0, top, 0, bottom)
        gradient.addColorStop(0, fill[n.hand][0])
        gradient.addColorStop(1, fill[n.hand][1])
        ctx.beginPath()
        ctx.roundRect(x, top, w, Math.max(1, noteHeight), RADIUS)
        ctx.globalAlpha = muted ? 0.15 : 1
        ctx.fillStyle = gradient
        if (!muted) {
          ctx.shadowColor = GLOW[n.hand][hit ? 1 : 0]
          ctx.shadowBlur = (hit ? 26 : 14) * dpr
        }
        ctx.fill()
        ctx.shadowBlur = 0
        if (hit) {
          // Mismo color sumado: equivale a un brillo de 1.35.
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = 0.35
          ctx.fill()
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = muted ? 0.15 : 1
        } else if (k.black) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
          ctx.fill()
        }
        if (noteHeight > MIN_LABEL_HEIGHT) {
          ctx.fillStyle = hit && n.hand === 'R' ? '#022' : LABEL[n.hand]
          ctx.fillText(solfeo(n.midi), x + w / 2, bottom - 4)
        }
        ctx.globalAlpha = 1
      })
    }

    let raf = 0
    const schedule = () => {
      raf ||= requestAnimationFrame(() => {
        raf = 0
        draw()
      })
    }
    draw()
    void document.fonts.ready.then(schedule) // la primera pintura pudo usar la fuente de reserva
    const unsubscribe = usePlayer.subscribe((s, prev) => {
      if (s.position !== prev.position || s.activeIds !== prev.activeIds || s.hands !== prev.hands) schedule()
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(raf)
    }
  }, [score, layout, band, width, height])

  return (
    <div className="waterfall" ref={wrapRef}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="now-line" />
    </div>
  )
}

export default memo(Waterfall)
