import { useEffect, useMemo } from 'react'
import { odeToJoy as score, odeToJoySections as sections } from './data/odeToJoy'
import { Engine } from './engine/transport'
import { buildLayout, fitRange, octaveOf, PIANO_HIGH, PIANO_LOW, solfeo } from './model/notes'
import { usePlayer } from './store/usePlayer'
import Keyboard from './components/Keyboard'
import TransportBar from './components/TransportBar'
import Waterfall from './components/Waterfall'

const engine = new Engine(score, sections)
const midis = score.notes.map((n) => n.midi)
const fitted = fitRange(Math.min(...midis), Math.max(...midis))
const strike = (midi: number) => engine.strike(midi)

const names = (notes: number[]) =>
  notes.sort((a, b) => a - b).map((m) => `${solfeo(m)}${octaveOf(m)}`).join(' · ') || '—'

export default function App() {
  const allKeys = usePlayer((s) => s.allKeys)
  const sectionId = usePlayer((s) => s.sectionId)
  const measure = usePlayer((s) => s.measure)
  const active = usePlayer((s) => s.active)
  const waiting = usePlayer((s) => s.waiting)

  const layout = useMemo(() => (allKeys ? buildLayout(PIANO_LOW, PIANO_HIGH) : buildLayout(...fitted)), [allKeys])
  const section = sections.find((s) => s.id === sectionId) ?? null
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
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <div>
            <h1>{score.title}</h1>
            <p>{score.composer}</p>
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
        <Waterfall score={score} layout={layout} section={section} />
        <Keyboard layout={layout} onPress={strike} />
      </main>

      <TransportBar score={score} sections={sections} engine={engine} />
    </div>
  )
}
