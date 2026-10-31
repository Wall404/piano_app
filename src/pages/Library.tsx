import { useEffect, useRef, useState } from 'react'
import { odeToJoy } from '../data/odeToJoy'
import { importFile } from '../import'
import type { Score } from '../model/types'
import { deleteScore, listAttempts, listScores, saveScore, type StoredScore } from '../storage/db'

const EXAMPLE = 'estudio-a-dos-manos.musicxml'

interface Row extends StoredScore {
  lastPct: number | null
}

export default function Library({ onOpen }: { onOpen: (score: Score, file?: Blob) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    const scores = await listScores()
    setRows(
      await Promise.all(
        scores.map(async (s) => {
          const last = (await listAttempts(s.score.id)).at(-1)?.result
          return { ...s, lastPct: last ? Math.round((last.hits / last.total) * 100) : null }
        }),
      ),
    )
  }

  useEffect(() => {
    void refresh()
  }, [])

  const load = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const score = await importFile(file)
      await saveScore(score, score.source.kind === 'musicxml' ? file : undefined)
      onOpen(score, score.source.kind === 'musicxml' ? file : undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la partitura.')
    } finally {
      setBusy(false)
    }
  }

  const loadExample = async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}scores/${EXAMPLE}`)
    await load(new File([await response.blob()], EXAMPLE))
  }

  return (
    <div
      className="library"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) void load(file)
      }}
    >
      <header className="brand">
        <span className="logo" aria-hidden="true" />
        <div>
          <h1>Piano App</h1>
          <p>Tus partituras, en el teclado</p>
        </div>
      </header>

      <button className="drop" disabled={busy} onClick={() => inputRef.current?.click()}>
        <strong>{busy ? 'Leyendo partitura…' : 'Cargar partitura'}</strong>
        <span>MusicXML, MXL o MIDI. En la compu también podés arrastrarla acá.</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".musicxml,.xml,.mxl,.mid,.midi"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void load(file)
        }}
      />
      {error && <p className="midi-error" role="alert">{error}</p>}

      <h2>Mi biblioteca</h2>
      {rows.length === 0 && <p className="empty">Todavía no cargaste partituras.</p>}
      <ul className="score-list">
        {rows.map(({ score, file, lastPct }) => (
          <li key={score.id}>
            <button className="score-row" onClick={() => onOpen(score, file)}>
              <strong>{score.title}</strong>
              <small>
                {score.measures.length} compases · {score.source.kind === 'midi' ? 'MIDI' : 'MusicXML'}
                {lastPct !== null && ` · último intento ${lastPct} %`}
              </small>
            </button>
            <button
              className="icon-btn"
              aria-label={`Borrar ${score.title}`}
              onClick={() => void deleteScore(score.id).then(refresh)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <h2>Ejemplos</h2>
      <ul className="score-list">
        <li>
          <button className="score-row" onClick={() => onOpen(odeToJoy)}>
            <strong>{odeToJoy.title}</strong>
            <small>{odeToJoy.composer}</small>
          </button>
        </li>
        <li>
          <button className="score-row" disabled={busy} onClick={() => void loadExample()}>
            <strong>Estudio a dos manos</strong>
            <small>MusicXML con partitura y repetición</small>
          </button>
        </li>
      </ul>
    </div>
  )
}
