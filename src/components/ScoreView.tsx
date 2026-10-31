import { useEffect, useRef, useState } from 'react'
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { cursorToMeasure, loadOsmd } from '../import/musicxml'
import { usePlayer } from '../store/usePlayer'

/** Partitura dibujada, con un cursor que sigue el compás actual. */
export default function ScoreView({ file }: { file: Blob }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const measure = usePlayer((s) => s.measure)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)

  useEffect(() => {
    let cancelled = false
    const container = ref.current!
    loadOsmd(container, file)
      .then((osmd) => {
        if (cancelled) return
        osmd.enableOrDisableCursors(true)
        osmd.cursor.show()
        osmdRef.current = osmd
        cursorToMeasure(osmd.cursor, usePlayer.getState().measure)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo dibujar la partitura.'))
    return () => {
      cancelled = true
      osmdRef.current = null
      container.replaceChildren()
    }
  }, [file])

  useEffect(() => {
    if (osmdRef.current) cursorToMeasure(osmdRef.current.cursor, measure)
  }, [measure])

  return (
    <div className="score-view">
      {error ? <p className="midi-error">{error}</p> : <div ref={ref} />}
    </div>
  )
}
