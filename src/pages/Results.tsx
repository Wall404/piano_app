import { useEffect, useState } from 'react'
import { worstMeasures, type Result } from '../eval/match'
import type { Score } from '../model/types'
import { listAttempts, type Attempt } from '../storage/db'

const RECENT = 10
const WIDTH = 320
const HEIGHT = 120
const BOTTOM = HEIGHT - 6
const AXIS = 22 // espacio para las etiquetas del eje
const MAX_BAR = 16

const percent = (r: Result) => Math.round((r.hits / r.total) * 100)
const when = (date: string) => new Date(date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })

/** Barra con la punta redondeada, apoyada en la línea de base. */
function bar(x: number, width: number, height: number) {
  const r = Math.min(4, width / 2, height)
  const top = BOTTOM - height
  return `M${x} ${BOTTOM}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + width - r}Q${x + width} ${top} ${x + width} ${top + r}V${BOTTOM}Z`
}

function Chart({ attempts }: { attempts: Attempt[] }) {
  const step = (WIDTH - AXIS) / attempts.length
  const barWidth = Math.min(MAX_BAR, Math.max(1, step - 2))
  const last = percent(attempts[attempts.length - 1].result)
  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Aciertos en ${attempts.length} intentos; el último, ${last} %`}>
      {[0, 50, 100].map((pct) => {
        const y = BOTTOM - ((BOTTOM - 8) * pct) / 100
        return (
          <g key={pct}>
            <line x1={AXIS} x2={WIDTH} y1={y} y2={y} />
            <text x={0} y={y + 3}>{pct}%</text>
          </g>
        )
      })}
      {attempts.map(({ date, tempoPct, result }, i) => {
        const pct = percent(result)
        return (
          <path key={date} d={bar(AXIS + i * step + (step - barWidth) / 2, barWidth, Math.max(1, ((BOTTOM - 8) * pct) / 100))}>
            <title>{`${when(date)}: ${pct} % al ${tempoPct} %`}</title>
          </path>
        )
      })}
    </svg>
  )
}

export default function Results({ score, onBack }: { score: Score; onBack: () => void }) {
  const [attempts, setAttempts] = useState<Attempt[]>([])

  useEffect(() => {
    void listAttempts(score.id).then(setAttempts)
  }, [score])

  const worst = worstMeasures(attempts.slice(-RECENT).map((a) => a.result))

  return (
    <div className="library">
      <header className="brand">
        <button className="icon-btn back" onClick={onBack} aria-label="Volver a la biblioteca">←</button>
        <div>
          <h1>{score.title}</h1>
          <p>Progreso</p>
        </div>
      </header>

      {attempts.length > 0 && (
        <>
          <h2>Aciertos por intento</h2>
          <Chart attempts={attempts} />
        </>
      )}

      {worst.length > 0 && (
        <>
          <h2>Compases con más errores</h2>
          <ol className="attempts">
            {worst.map(({ measure, errors }) => (
              <li key={measure}>
                <span>Compás {measure}</span>
                <small>{errors} {errors === 1 ? 'error' : 'errores'}</small>
              </li>
            ))}
          </ol>
        </>
      )}

      <h2>Intentos</h2>
      <ul className="attempts">
        {[...attempts].reverse().map(({ date, tempoPct, result }) => (
          <li key={date}>
            <span>{percent(result)} % correctas</span>
            <small>{when(date)} · al {tempoPct} % · notas de más: {result.wrong}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
