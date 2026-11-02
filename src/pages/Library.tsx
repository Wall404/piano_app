import { useEffect, useRef, useState } from 'react'
import { odeToJoy } from '../data/odeToJoy'
import { importFile } from '../import'
import { importCollection } from '../import/collection'
import type { Collection, Score } from '../model/types'
import {
  deleteCollection,
  deleteScore,
  listAttempts,
  listCollections,
  listScores,
  renameScore,
  saveCollection,
  saveScore,
  type StoredScore,
} from '../storage/db'

const EXAMPLE = 'estudio-a-dos-manos.musicxml'

interface Row extends StoredScore {
  lastPct: number | null
}

interface Props {
  onOpen: (score: Score, file?: Blob) => void
  onProgress: (score: Score) => void
}

export default function Library({ onOpen, onProgress }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [added, setAdded] = useState<string | null>(null) // colección recién cargada: se muestra abierta
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null) // borrar una colección pide un segundo toque
  const [odeAttempted, setOdeAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    const scores = await listScores()
    setOdeAttempted((await listAttempts(odeToJoy.id)).length > 0)
    setCollections(await listCollections())
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

  const load = async (files: File[]) => {
    setBusy(true)
    setError(null)
    try {
      if (files.length > 1) {
        const { collection, items } = await importCollection(files)
        const stored = items.map(({ score, file }) => ({ score, file: score.source.kind === 'musicxml' ? file : undefined }))
        await saveCollection(collection, stored)
        setAdded(collection.id)
        await refresh()
        return
      }
      const [file] = files
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
    await load([new File([await response.blob()], EXAMPLE)])
  }

  const scoreRow = ({ score, file, lastPct }: Row, inCollection: boolean) => (
    <li key={score.id}>
      {renaming === score.id ? (
        <form
          className="rename"
          onSubmit={(e) => {
            e.preventDefault()
            const title = new FormData(e.currentTarget).get('title')?.toString().trim()
            setRenaming(null)
            if (title) void renameScore(score.id, title).then(refresh)
          }}
        >
          <input
            name="title"
            defaultValue={score.title}
            autoFocus
            aria-label={`Nuevo nombre de ${score.title}`}
            onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)}
          />
          <button className="chip">Guardar</button>
        </form>
      ) : (
        <>
          <button className="score-row" onClick={() => onOpen(score, file)}>
            <strong>{score.title}</strong>
            <small>
              {score.measures.length} compases · {score.source.kind === 'midi' ? 'MIDI' : 'MusicXML'}
              {score.pages && ` · pág. ${score.pages[0]}–${score.pages[1]}`}
              {lastPct !== null && ` · último intento ${lastPct} %`}
            </small>
          </button>
          {lastPct !== null && <button className="chip" onClick={() => onProgress(score)}>Progreso</button>}
          {inCollection ? (
            <button className="icon-btn" aria-label={`Renombrar ${score.title}`} onClick={() => setRenaming(score.id)}>✎</button>
          ) : (
            <button className="icon-btn" aria-label={`Borrar ${score.title}`} onClick={() => void deleteScore(score.id).then(refresh)}>×</button>
          )}
        </>
      )}
    </li>
  )

  return (
    <div
      className="library"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const files = [...e.dataTransfer.files]
        if (files.length) void load(files)
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
        <span>MusicXML, MXL o MIDI. Varias a la vez forman una colección. En la compu también podés arrastrarlas acá.</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".musicxml,.xml,.mxl,.mid,.midi,.json"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) void load(files)
        }}
      />
      {error && <p className="midi-error" role="alert">{error}</p>}

      <h2>Mi biblioteca</h2>
      {rows.length === 0 && <p className="empty">Todavía no cargaste partituras.</p>}
      {collections.map((c) => {
        const works = c.scoreIds.flatMap((id) => rows.filter((r) => r.score.id === id))
        return (
          <details key={c.id} className="collection" open={c.id === added}>
            <summary>
              <strong>{c.title}</strong>
              <small>{c.scoreIds.length} obras</small>
            </summary>
            <ul className="score-list">{works.map((r) => scoreRow(r, true))}</ul>
            <button
              className="midi-btn"
              onClick={() => {
                if (confirming !== c.id) return setConfirming(c.id)
                setConfirming(null)
                void deleteCollection(c).then(refresh)
              }}
            >
              {confirming === c.id ? 'Tocá de nuevo para borrar todo, con su historial' : 'Borrar colección'}
            </button>
          </details>
        )
      })}
      <ul className="score-list">{rows.filter((r) => !r.score.collectionId).map((r) => scoreRow(r, false))}</ul>

      <h2>Ejemplos</h2>
      <ul className="score-list">
        <li>
          <button className="score-row" onClick={() => onOpen(odeToJoy)}>
            <strong>{odeToJoy.title}</strong>
            <small>{odeToJoy.composer}</small>
          </button>
          {odeAttempted && <button className="chip" onClick={() => onProgress(odeToJoy)}>Progreso</button>}
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
