import { useEffect, useRef, useState } from 'react'
import { odeToJoy } from '../data/odeToJoy'
import { importFile } from '../import'
import { importCollection } from '../import/collection'
import { countMeasures, readXml } from '../import/xmlEdit'
import type { Collection, Score } from '../model/types'
import {
  deleteCollection,
  deleteScore,
  listAttempts,
  listCollections,
  listScores,
  mergeWorks,
  renameScore,
  saveCollection,
  saveScore,
  splitWork,
  type StoredScore,
} from '../storage/db'

const EXAMPLE = 'estudio-a-dos-manos.musicxml'

interface Row extends StoredScore {
  lastPct: number | null
}

interface Props {
  onOpen: (score: Score, file?: Blob) => void
  onProgress: (score: Score) => void
  onChordTest: () => void
  onPdfPages: () => void
}

export default function Library({ onOpen, onProgress, onChordTest, onPdfPages }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [added, setAdded] = useState<string | null>(null) // colección recién cargada: se muestra abierta
  const [editing, setEditing] = useState<{ id: string; measures: number } | null>(null) // obra de colección abierta para editar
  const [confirming, setConfirming] = useState<string | null>(null) // borrar una colección o unir obras pide un segundo toque
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

  const edit = async (score: Score, file?: Blob) => {
    setConfirming(null)
    setEditing({ id: score.id, measures: 0 })
    if (!file) return
    try {
      const measures = countMeasures(await readXml(file, score.source.fileName))
      setEditing((e) => (e?.id === score.id ? { ...e, measures } : e))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la partitura.')
    }
  }

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await task()
      setEditing(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo editar la colección.')
    } finally {
      setBusy(false)
    }
  }

  const scoreRow = ({ score, file, lastPct }: Row, collection?: Collection, index = 0) => (
    <li key={score.id}>
      {collection && editing?.id === score.id ? (
        <div className="edit-work">
          <div className="rename">
            <form
              className="rename"
              onSubmit={(e) => {
                e.preventDefault()
                const title = new FormData(e.currentTarget).get('title')?.toString().trim()
                setEditing(null)
                if (title) void renameScore(score.id, title).then(refresh)
              }}
            >
              <input
                name="title"
                defaultValue={score.title}
                autoFocus
                aria-label={`Nuevo nombre de ${score.title}`}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
              />
              <button className="chip">Guardar</button>
            </form>
            <button className="icon-btn" aria-label="Cerrar edición" onClick={() => setEditing(null)}>×</button>
          </div>
          {file && index < collection.scoreIds.length - 1 && (
            <button
              className="midi-btn"
              disabled={busy}
              onClick={() => {
                if (confirming !== `merge:${score.id}`) return setConfirming(`merge:${score.id}`)
                setConfirming(null)
                void run(() => mergeWorks(collection, index))
              }}
            >
              {confirming === `merge:${score.id}` ? 'Tocá de nuevo: se pierde el historial de la siguiente' : 'Unir con la siguiente'}
            </button>
          )}
          {file && editing.measures > 1 && (
            <form
              className="rename"
              onSubmit={(e) => {
                e.preventDefault()
                const from = Number(new FormData(e.currentTarget).get('from'))
                void run(() => splitWork(collection, index, from))
              }}
            >
              <label className="chip range">
                Separar desde el compás
                <input name="from" type="number" min={2} max={editing.measures} defaultValue={2} required />
              </label>
              <button className="chip" disabled={busy}>Separar</button>
            </form>
          )}
        </div>
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
          {collection ? (
            <button className="icon-btn" aria-label={`Editar ${score.title}`} onClick={() => void edit(score, file)}>✎</button>
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
              <small>{c.scoreIds.length} {c.scoreIds.length === 1 ? 'obra' : 'obras'}</small>
            </summary>
            <ul className="score-list">{works.map((r) => scoreRow(r, c, c.scoreIds.indexOf(r.score.id)))}</ul>
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
      <ul className="score-list">{rows.filter((r) => !r.score.collectionId).map((r) => scoreRow(r))}</ul>

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

      <h2>Herramientas</h2>
      <ul className="score-list">
        <li>
          <button className="score-row" onClick={onChordTest}>
            <strong>Prueba de acordes</strong>
            <small>Mide cuántos acordes distingue el micrófono en tu piano</small>
          </button>
        </li>
        <li>
          <button className="score-row" onClick={onPdfPages}>
            <strong>Marcar obras de un PDF</strong>
            <small>Elegí dónde empieza cada obra de una colección</small>
          </button>
        </li>
      </ul>
    </div>
  )
}
