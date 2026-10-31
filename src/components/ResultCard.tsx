import { suggestion } from '../eval/match'
import { usePlayer } from '../store/usePlayer'

const RECALIBRATE_MISSED = 0.3

/** Devolución de la última pasada tocada. */
export default function ResultCard({ lastMeasure }: { lastMeasure: number }) {
  const result = usePlayer((s) => s.result)
  const tempoPct = usePlayer((s) => s.tempoPct)
  const waitMode = usePlayer((s) => s.waitMode)
  const mic = usePlayer((s) => s.mic)
  const chordsSupported = usePlayer((s) => s.chordsSupported)
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
      {mic !== 'off' && !chordsSupported && <p>Este dispositivo no detecta acordes completos: evaluá con notas sueltas.</p>}
      {mic !== 'off' && result.missed / result.total > RECALIBRATE_MISSED && <p>Si tocaste bien, recalibrá el micrófono.</p>}
    </aside>
  )
}
