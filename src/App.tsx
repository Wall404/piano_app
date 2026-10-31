import { useState } from 'react'
import { Engine } from './engine/transport'
import type { Score } from './model/types'
import Library from './pages/Library'
import Practice from './pages/Practice'

interface Session {
  score: Score
  file?: Blob
  engine: Engine
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)

  if (!session) {
    return <Library onOpen={(score, file) => setSession({ score, file, engine: new Engine(score) })} />
  }
  return (
    <Practice
      {...session}
      onBack={() => {
        session.engine.dispose()
        setSession(null)
      }}
    />
  )
}
