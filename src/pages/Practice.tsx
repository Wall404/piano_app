import { useEffect, useMemo } from 'react'
import ResultCard from '../components/ResultCard'
import Keyboard from '../components/Keyboard'
import ScoreView from '../components/ScoreView'
import TransportBar from '../components/TransportBar'
import Waterfall from '../components/Waterfall'
import type { Engine } from '../engine/transport'
import { buildLayout, fitRange, octaveOf, PIANO_HIGH, PIANO_LOW, solfeo } from '../model/notes'
import type { Score } from '../model/types'
import { usePlayer } from '../store/usePlayer'

const names = (notes: number[]) =>
  notes.sort((a, b) => a - b).map((m) => `${solfeo(m)}${octaveOf(m)}`).join(' · ') || '—'

interface Props {
  score: Score
  file?: Blob
  engine: Engine
  onBack: () => void
}

export default function Practice({ score, file, engine, onBack }: Props) {
  const allKeys = usePlayer((s) => s.allKeys)
  const range = usePlayer((s) => s.range)
  const measure = usePlayer((s) => s.measure)
  const active = usePlayer((s) => s.active)
  const waiting = usePlayer((s) => s.waiting)
  const view = usePlayer((s) => s.view)

  const layout = useMemo(() => {
    if (allKeys) return buildLayout(PIANO_LOW, PIANO_HIGH)
    const midis = score.notes.map((n) => n.midi)
    return buildLayout(...fitRange(Math.min(...midis), Math.max(...midis)))
  }, [allKeys, score])
  const byHand = (hand: string) => [...active].filter(([, h]) => h === hand).map(([m]) => m)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'BUTTON'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        void engine.toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <button className="icon-btn back" onClick={onBack} aria-label="Volver a la biblioteca">←</button>
          <div>
            <h1>{score.title}</h1>
            <p>{score.composer ?? score.source.fileName}</p>
          </div>
        </div>
        <div className="bar-counter">
          <small>Compás</small>
          <strong>{measure}<em>/{score.measures.length}</em></strong>
        </div>
      </header>

      <div className="now-playing" aria-live="polite">
        <span className="np L">{names(byHand('L'))}</span>
        <span className="np R">{names(byHand('R'))}</span>
        {waiting && <span className="np waiting">Tocá el acorde</span>}
      </div>

      <main className="instrument">
        {view === 'score' && file ? (
          <ScoreView file={file} />
        ) : (
          <Waterfall score={score} layout={layout} range={range} />
        )}
        <Keyboard layout={layout} onPress={(midi) => engine.strike(midi)} />
        <ResultCard lastMeasure={score.measures.length} />
      </main>

      <TransportBar score={score} hasSheet={Boolean(file)} engine={engine} />
    </div>
  )
}
