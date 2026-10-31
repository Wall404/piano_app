import { suggestion } from '../eval/match'
import { usePlayer } from '../store/usePlayer'

/** Devolución de la última pasada tocada en el teclado MIDI. */
export default function ResultCard({ lastMeasure }: { lastMeasure: number }) {
  const result = usePlayer((s) => s.result)
  const tempoPct = usePlayer((s) => s.tempoPct)
  const waitMode = usePlayer((s) => s.waitMode)
  if (!result) return null

  const pct = Math.round((result.hits / result.total) * 100)
  const offset = Math.round(result.avgOffsetMs)
  return (
    <aside className="result" role="status">
      <button className="result-close" onClick={() => usePlayer.setState({ result: null })} aria-label="Cerrar devolución">×</button>
      <strong>{pct} % correctas</strong>
      <p>
        {result.hits} de {result.total} · notas de más: {result.wrong} · sin tocar: {result.missed}
        {!waitMode && Math.abs(offset) >= 30 && ` · ${offset < 0 ? 'te adelantás' : 'te atrasás'} ${Math.abs(offset)} ms`}
      </p>
      <p>{suggestion(result, tempoPct, lastMeasure)}</p>
    </aside>
  )
}
